const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const RAW_DIR = path.join(DOCS_DIR, "raw_data");
const OUT_FILE = path.join(RAW_DIR, "bingo.csv");

const API_BASE = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery";
const BINGO_FALLBACK_URL = "https://lotto.auzonet.com/bingobingoV1.php";

const BINGO_DEF = {
  label: "Bingo Bingo",
  endpointCandidates: ["BingoBingoResult", "BingoResult"],
  monthSpan: 1,
  maxPages: 50,
  pageSize: 200,
  numberCount: 20,
  specialRange: [1, 80]
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatMonth(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function shiftMonth(date, offsetMonths) {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d;
}

function buildMonthRange(monthSpan) {
  const now = new Date();
  const endMonth = formatMonth(now);
  const start = shiftMonth(now, -(monthSpan - 1));
  return { month: formatMonth(start), endMonth };
}

function buildUrl(endpoint, pageNum, pageSize, monthSpan) {
  const { month, endMonth } = buildMonthRange(monthSpan);
  const qs = new URLSearchParams({
    period: "",
    month,
    endMonth,
    pageNum: String(pageNum),
    pageSize: String(pageSize)
  });
  return `${API_BASE}/${endpoint}?${qs.toString()}`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function findPrimaryArray(content) {
  if (!content || typeof content !== "object") return [];

  const preferredKeys = [
    "bingoBingoRes",
    "daily539Res",
    "lotto649Res",
    "superLotto638Res",
    "result",
    "results",
    "data",
    "list",
    "items"
  ];

  for (const key of preferredKeys) {
    if (Array.isArray(content[key])) return content[key];
  }

  for (const value of Object.values(content)) {
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      return value;
    }
  }

  for (const value of Object.values(content)) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function uniqSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a - b);
}

function numericArray(arr, min, max) {
  if (!Array.isArray(arr)) return [];
  return uniqSorted(
    arr.map(v => Number(v)).filter(v => Number.isFinite(v) && v >= min && v <= max)
  );
}

function firstExisting(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return null;
}

function parseDateValue(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);

  if (m) {
    return `${m[1]}-${m[2]}-${m[3]} ${m[4] || "00"}:${m[5] || "00"}`;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function normalizePeriod(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function findSequentialKeys(obj) {
  return Object.keys(obj)
    .filter(k => /(^n\d+$)|(^num\d+$)|(^no\d+$)|(^ball\d+$)|(^m\d+$)/i.test(k))
    .sort((a, b) => {
      const na = Number((a.match(/\d+/) || ["0"])[0]);
      const nb = Number((b.match(/\d+/) || ["0"])[0]);
      return na - nb;
    });
}

function extractNumbers(item, min, max, desiredCount) {
  const directArrays = [
    item.drawNumberSize,
    item.drawNumberSizes,
    item.numbers,
    item.number,
    item.orderNumbers
  ];

  for (const arr of directArrays) {
    const nums = numericArray(arr, min, max);
    if (nums.length >= Math.min(3, desiredCount)) {
      return nums.slice(0, desiredCount);
    }
  }

  const seqKeys = findSequentialKeys(item);
  if (seqKeys.length) {
    const nums = numericArray(seqKeys.map(k => item[k]), min, max);
    if (nums.length >= Math.min(3, desiredCount)) {
      return nums.slice(0, desiredCount);
    }
  }

  const values = Object.values(item);
  for (const v of values) {
    if (typeof v !== "string") continue;
    const parts = v.split(/[\s,/|-]+/).filter(Boolean);
    const nums = numericArray(parts, min, max);
    if (nums.length >= Math.min(3, desiredCount)) {
      return nums.slice(0, desiredCount);
    }
  }

  return [];
}

function extractOrderNumbers(item, min, max, desiredCount, fallbackNumbers) {
  const orderCandidates = [
    item.orderNumbers,
    item.drawOrderNumber,
    item.drawOrderNumbers
  ];

  for (const arr of orderCandidates) {
    const nums = numericArray(arr, min, max);
    if (nums.length >= Math.min(3, desiredCount)) {
      return nums.slice(0, desiredCount);
    }
  }

  return Array.isArray(fallbackNumbers) ? [...fallbackNumbers] : [];
}

function extractSpecial(item, min, max) {
  if (!min || !max) return null;

  const keys = [
    "specialNumber",
    "specialNum",
    "bonusNumber",
    "secondNumber",
    "secondAreaNumber",
    "superNumber",
    "special",
    "second"
  ];

  const raw = firstExisting(item, keys);
  const num = Number(raw);
  if (Number.isFinite(num) && num >= min && num <= max) return num;
  return null;
}

function normalizeBingoItem(item) {
  const period = normalizePeriod(firstExisting(item, ["period", "issue", "drawTerm", "term"]));
  const drawDate = parseDateValue(firstExisting(item, ["lotteryDate", "drawDate", "date"]));
  const redeemableDate = parseDateValue(firstExisting(item, ["redeemableDate"]));
  const numbers = extractNumbers(item, 1, 80, 20);
  const orderNumbers = extractOrderNumbers(item, 1, 80, 20, numbers);
  const specialNumber = extractSpecial(item, 1, 80);

  if (!period && !drawDate && !numbers.length) return null;

  return {
    period,
    drawDate,
    redeemableDate,
    numbers,
    orderNumbers,
    specialNumber
  };
}

function safeTime(value) {
  if (!value) return 0;
  const raw = String(value).trim().replace(" ", "T");
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function sortRowsDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = safeTime(a.drawDate);
    const tb = safeTime(b.drawDate);
    if (tb !== ta) return tb - ta;
    return Number(b.period || 0) - Number(a.period || 0);
  });
}

function dedupeRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = `${row.period || ""}__${row.drawDate || ""}`;
    if (!map.has(key)) {
      map.set(key, row);
    } else {
      const oldRow = map.get(key);
      const oldLen = oldRow?.numbers?.length || 0;
      const newLen = row?.numbers?.length || 0;
      if (newLen >= oldLen) {
        map.set(key, row);
      }
    }
  }

  return [...map.values()];
}

async function fetchBingoRowsFromApi() {
  const allRows = [];
  let usedEndpoint = null;

  for (const endpoint of BINGO_DEF.endpointCandidates) {
    try {
      const rows = [];
      let gotAny = false;

      for (let pageNum = 1; pageNum <= BINGO_DEF.maxPages; pageNum += 1) {
        const url = buildUrl(endpoint, pageNum, BINGO_DEF.pageSize, BINGO_DEF.monthSpan);
        const json = await fetchJson(url);

        if (json?.rtCode !== 0 && json?.rtCode !== undefined) {
          throw new Error(`rtCode=${json.rtCode}`);
        }

        const content = json?.content || {};
        const arr = findPrimaryArray(content);
        if (!Array.isArray(arr) || !arr.length) break;

        gotAny = true;

        for (const item of arr) {
          const row = normalizeBingoItem(item);
          if (row) rows.push(row);
        }

        if (arr.length < BINGO_DEF.pageSize) break;
      }

      if (gotAny && rows.length) {
        usedEndpoint = endpoint;
        allRows.push(...rows);
        break;
      }
    } catch (err) {
      console.warn(`⚠️ bingo endpoint ${endpoint} 失敗：${err.message}`);
    }
  }

  const finalRows = sortRowsDesc(dedupeRows(allRows));
  if (!finalRows.length) {
    throw new Error("bingo 抓不到任何 API 資料");
  }

  console.log(`✅ Bingo API 成功，endpoint=${usedEndpoint}，筆數=${finalRows.length}`);
  return finalRows;
}

function stripHtmlTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ");
}

function parseBingoFallbackHtml(html) {
  const text = stripHtmlTags(html)
    .replace(/\u3000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n");

  fs.writeFileSync(path.join(ROOT, "bingo_fallback_text.txt"), text, "utf8");

  const rows = [];
  const now = new Date();

  let datePart = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const dateMatch = text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (dateMatch) {
    datePart = `${dateMatch[1]}-${pad2(dateMatch[2])}-${pad2(dateMatch[3])}`;
  }

  const lines = text
    .split("\n")
    .map(v => v.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length - 1; i += 1) {
    const periodLine = lines[i];
    const nextLine = lines[i + 1];

    if (!/^\d{9}$/.test(periodLine)) continue;

    const timeMatch = nextLine.match(/^(\d{2}:\d{2})\s+(.+)$/);
    if (!timeMatch) continue;

    const period = periodLine;
    const timeText = timeMatch[1];
    const rest = timeMatch[2];

    const nums = (rest.match(/\d{1,2}/g) || [])
      .map(n => Number(n))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 80);

    if (nums.length < 21) continue;

    const orderNumbers = nums.slice(0, 20);
    const specialNumber = nums[20];

    if (orderNumbers.length !== 20) continue;

    rows.push({
      period,
      drawDate: `${datePart} ${timeText}`,
      redeemableDate: "",
      numbers: uniqSorted(orderNumbers),
      orderNumbers,
      specialNumber: Number.isFinite(specialNumber) ? specialNumber : null
    });
  }

  return sortRowsDesc(dedupeRows(rows));
}

async function fetchBingoFallbackRows() {
  const html = await fetchText(BINGO_FALLBACK_URL);

  fs.writeFileSync(path.join(ROOT, "bingo_fallback_raw.txt"), html, "utf8");

  if (!html.trim()) {
    throw new Error("bingo 備援回傳空內容");
  }

  const rows = parseBingoFallbackHtml(html);

  if (!rows.length) {
    throw new Error("bingo 備援 HTML 解析失敗");
  }

  console.log(`✅ Bingo 備援 HTML 成功，筆數=${rows.length}`);
  return rows;
}

function parseExistingCsv(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0].split(",");
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",");
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });

    const orderNumbers = [];
    for (let j = 1; j <= 20; j += 1) {
      const num = Number(row[`n${j}`]);
      if (Number.isFinite(num)) orderNumbers.push(num);
    }

    rows.push({
      period: String(row.period || "").trim(),
      drawDate: String(row.drawDate || "").trim(),
      redeemableDate: String(row.redeemableDate || "").trim(),
      numbers: uniqSorted(orderNumbers),
      orderNumbers,
      specialNumber: row.specialNumber === "" ? null : Number(row.specialNumber)
    });
  }

  return rows;
}

function readExistingBingoCsv() {
  if (!fs.existsSync(OUT_FILE)) return [];
  try {
    const text = fs.readFileSync(OUT_FILE, "utf8");
    return parseExistingCsv(text);
  } catch {
    return [];
  }
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildBingoCsv(rows) {
  const headers = [
    "period",
    "drawDate",
    "redeemableDate",
    "n1","n2","n3","n4","n5","n6","n7","n8","n9","n10",
    "n11","n12","n13","n14","n15","n16","n17","n18","n19","n20",
    "specialNumber"
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    const nums = Array.from({ length: 20 }, (_, i) => row.orderNumbers?.[i] ?? row.numbers?.[i] ?? "");
    lines.push(
      [row.period || "", row.drawDate || "", row.redeemableDate || "", ...nums, row.specialNumber ?? ""]
        .map(csvEscape)
        .join(",")
    );
  }

  return lines.join("\n");
}

function writeCsv(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
  console.log(`✅ 已寫入 ${filePath}`);
}

async function fetchLatestBingoRows() {
  try {
    return await fetchBingoRowsFromApi();
  } catch (err) {
    console.warn(`⚠️ Bingo 官方 API 失敗，改用備援來源：${err.message}`);
    return await fetchBingoFallbackRows();
  }
}

async function main() {
  ensureDir(RAW_DIR);

  const existingRows = readExistingBingoCsv();
  const freshRows = await fetchLatestBingoRows();

  const merged = sortRowsDesc(dedupeRows([...freshRows, ...existingRows]));
  if (!merged.length) {
    throw new Error("合併後 bingo 資料為空");
  }

  writeCsv(OUT_FILE, buildBingoCsv(merged));
  console.log(`🎉 parse_bingo_fast.js 完成，最新期數=${merged[0]?.period || "—"}，時間=${merged[0]?.drawDate || "—"}`);
}

main().catch(err => {
  console.error("❌ parse_bingo_fast.js 執行失敗：", err);
  process.exit(1);
});