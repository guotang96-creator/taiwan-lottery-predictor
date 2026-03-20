const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const RAW_DIR = path.join(DOCS_DIR, "raw_data");

const API_BASE = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery";
const BINGO_FALLBACK_URL = "https://www.pilio.idv.tw/bingo/list.asp";

const GAME_DEFS = {
  bingo: {
    label: "Bingo Bingo",
    outFile: path.join(RAW_DIR, "bingo.csv"),
    endpointCandidates: ["BingoBingoResult", "BingoResult"],
    monthSpan: 1,
    maxPages: 50,
    pageSize: 200,
    numberCount: 20,
    specialRange: [1, 80]
  },
  daily539: {
    label: "今彩539",
    outFile: path.join(RAW_DIR, "539.csv"),
    endpointCandidates: ["Daily539Result"],
    monthSpan: 18,
    maxPages: 20,
    pageSize: 200,
    numberCount: 5,
    specialRange: null
  },
  lotto649: {
    label: "大樂透",
    outFile: path.join(RAW_DIR, "lotto.csv"),
    endpointCandidates: ["Lotto649Result"],
    monthSpan: 24,
    maxPages: 20,
    pageSize: 200,
    numberCount: 6,
    specialRange: [1, 49]
  },
  superLotto638: {
    label: "威力彩",
    outFile: path.join(RAW_DIR, "power.csv"),
    endpointCandidates: ["SuperLotto638Result"],
    monthSpan: 24,
    maxPages: 20,
    pageSize: 200,
    numberCount: 6,
    specialRange: [1, 8]
  }
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

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

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

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

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

function normalizeItem(gameKey, item) {
  const def = GAME_DEFS[gameKey];
  if (!def) return null;

  const max =
    gameKey === "bingo" ? 80 :
    gameKey === "daily539" ? 39 :
    gameKey === "lotto649" ? 49 : 38;

  const period = normalizePeriod(firstExisting(item, ["period", "issue", "drawTerm", "term"]));
  const drawDate = parseDateValue(firstExisting(item, ["lotteryDate", "drawDate", "date"]));
  const redeemableDate = parseDateValue(firstExisting(item, ["redeemableDate"]));
  const numbers = extractNumbers(item, 1, max, def.numberCount);
  const orderNumbers = extractOrderNumbers(item, 1, max, def.numberCount, numbers);

  let specialNumber = null;
  if (def.specialRange) {
    specialNumber = extractSpecial(item, def.specialRange[0], def.specialRange[1]);
  }

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

async function fetchGameRowsFromApi(gameKey) {
  const def = GAME_DEFS[gameKey];
  const allRows = [];
  let usedEndpoint = null;

  for (const endpoint of def.endpointCandidates) {
    try {
      const rows = [];
      let gotAny = false;

      for (let pageNum = 1; pageNum <= def.maxPages; pageNum += 1) {
        const url = buildUrl(endpoint, pageNum, def.pageSize, def.monthSpan);
        const json = await fetchJson(url);

        if (json?.rtCode !== 0 && json?.rtCode !== undefined) {
          throw new Error(`rtCode=${json.rtCode}`);
        }

        const content = json?.content || {};
        const arr = findPrimaryArray(content);
        if (!Array.isArray(arr) || !arr.length) break;

        gotAny = true;

        for (const item of arr) {
          const row = normalizeItem(gameKey, item);
          if (row) rows.push(row);
        }

        if (arr.length < def.pageSize) break;
      }

      if (gotAny && rows.length) {
        usedEndpoint = endpoint;
        allRows.push(...rows);
        break;
      }
    } catch (err) {
      console.warn(`⚠️ ${gameKey} endpoint ${endpoint} 失敗：${err.message}`);
    }
  }

  const finalRows = sortRowsDesc(dedupeRows(allRows));
  if (!finalRows.length) {
    throw new Error(`${gameKey} 抓不到任何 API 資料`);
  }

  console.log(`✅ ${def.label} API 成功，endpoint=${usedEndpoint}，筆數=${finalRows.length}`);
  return finalRows;
}

function stripHtmlTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
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
  const text = stripHtmlTags(html);
  const rows = [];
  const now = new Date();

  // 先用今天日期；若頁首有明確日期，再覆蓋
  let datePart = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const dateMatch = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s*BINGO BINGO/);
  if (dateMatch) {
    datePart = `${dateMatch[1]}-${pad2(dateMatch[2])}-${pad2(dateMatch[3])}`;
  }

  const blockRegex =
    /期別[:：]?\s*(\d{6,})\s*([\d,\s]{40,}?)\s*超級獎號[:：]?\s*(\d{1,2})[^\(]*\((\d{2}:\d{2})\)/g;

  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    const period = match[1];
    const numberText = match[2];
    const specialNumber = Number(match[3]);
    const timeText = match[4];

    const orderNumbers = (numberText.match(/\d{1,2}/g) || [])
      .map(n => Number(n))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 80)
      .slice(0, 20);

    if (orderNumbers.length === 20) {
      rows.push({
        period,
        drawDate: `${datePart} ${timeText}`,
        redeemableDate: "",
        numbers: uniqSorted(orderNumbers),
        orderNumbers,
        specialNumber: Number.isFinite(specialNumber) ? specialNumber : null
      });
    }
  }

  return sortRowsDesc(dedupeRows(rows));
}

async function fetchBingoFallbackRows() {
  const html = await fetchText(BINGO_FALLBACK_URL);

  fs.writeFileSync(
    path.join(ROOT, "bingo_fallback_raw.txt"),
    html,
    "utf8"
  );

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

async function fetchGameRows(gameKey) {
  if (gameKey !== "bingo") {
    return await fetchGameRowsFromApi(gameKey);
  }

  try {
    return await fetchGameRowsFromApi("bingo");
  } catch (err) {
    console.warn(`⚠️ Bingo 官方 API 全部失敗，改用備援來源：${err.message}`);
    try {
      return await fetchBingoFallbackRows();
    } catch (fallbackErr) {
      console.warn(`⚠️ Bingo 備援來源也失敗：${fallbackErr.message}`);
      throw fallbackErr;
    }
  }
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(gameKey, rows) {
  const headers =
    gameKey === "bingo"
      ? [
          "period",
          "drawDate",
          "redeemableDate",
          "n1","n2","n3","n4","n5","n6","n7","n8","n9","n10",
          "n11","n12","n13","n14","n15","n16","n17","n18","n19","n20",
          "specialNumber"
        ]
      : gameKey === "daily539"
      ? ["period", "drawDate", "redeemableDate", "n1", "n2", "n3", "n4", "n5"]
      : ["period", "drawDate", "redeemableDate", "n1", "n2", "n3", "n4", "n5", "n6", "specialNumber"];

  const lines = [headers.join(",")];

  for (const row of rows) {
    const base = [row.period || "", row.drawDate || "", row.redeemableDate || ""];

    if (gameKey === "bingo") {
      const nums = Array.from({ length: 20 }, (_, i) => row.orderNumbers?.[i] ?? row.numbers?.[i] ?? "");
      lines.push([...base, ...nums, row.specialNumber ?? ""].map(csvEscape).join(","));
      continue;
    }

    if (gameKey === "daily539") {
      const nums = Array.from({ length: 5 }, (_, i) => row.numbers?.[i] ?? "");
      lines.push([...base, ...nums].map(csvEscape).join(","));
      continue;
    }

    const nums = Array.from({ length: 6 }, (_, i) => row.numbers?.[i] ?? "");
    lines.push([...base, ...nums, row.specialNumber ?? ""].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

function writeCsv(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
  console.log(`✅ 已寫入 ${filePath}`);
}

async function main() {
  ensureDir(RAW_DIR);
  const resultMap = {};

  for (const gameKey of Object.keys(GAME_DEFS)) {
    try {
      const rows = await fetchGameRows(gameKey);
      resultMap[gameKey] = rows;
    } catch (err) {
      if (gameKey === "bingo") {
        console.warn(`⚠️ ${GAME_DEFS[gameKey].label} 最後仍失敗，保留既有 CSV`);
        resultMap[gameKey] = [];
      } else {
        console.error(`❌ ${GAME_DEFS[gameKey].label} 失敗：${err.message}`);
        throw err;
      }
    }
  }

  if (resultMap.bingo.length) {
    writeCsv(GAME_DEFS.bingo.outFile, buildCsv("bingo", resultMap.bingo));
  }
  if (resultMap.daily539.length) {
    writeCsv(GAME_DEFS.daily539.outFile, buildCsv("daily539", resultMap.daily539));
  }
  if (resultMap.lotto649.length) {
    writeCsv(GAME_DEFS.lotto649.outFile, buildCsv("lotto649", resultMap.lotto649));
  }
  if (resultMap.superLotto638.length) {
    writeCsv(GAME_DEFS.superLotto638.outFile, buildCsv("superLotto638", resultMap.superLotto638));
  }

  console.log("🎉 parse_downloads.js 完成");
}

main().catch(err => {
  console.error("❌ parse_downloads.js 執行失敗：", err);
  process.exit(1);
});