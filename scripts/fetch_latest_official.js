const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "raw_data");

const API = {
  bingo: "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LatestBingoResult",
  daily539:
    "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Daily539Result?period&month=2026-01&endMonth=2026-03&pageNum=1&pageSize=200",
  lotto649:
    "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Lotto649Result?period&month=2026-01&endMonth=2026-03&pageNum=1&pageSize=200",
  superLotto638:
    "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/SuperLotto638Result?period&month=2026-01&endMonth=2026-03&pageNum=1&pageSize=200"
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseCSV(text) {
  const rows = [];
  const input = normalizeLineEndings(text);

  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows
    .map(r => r.map(v => String(v ?? "").trim()))
    .filter(r => r.some(v => v !== ""));
}

function toObjects(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map(r => {
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = String(r[i] ?? "").trim();
    }
    return obj;
  });
}

function readCsvObjects(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
  return toObjects(parseCSV(text));
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(filePath, header, rows) {
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function normalizeDate(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) return s.slice(0, 10).replace(/\//g, "-");
  return s.slice(0, 10).replace(/\//g, "-");
}

function safeInt(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isInteger(n) ? n : null;
}

function sortDesc(rows) {
  return [...rows].sort((a, b) => {
    const ai = Number(String(a.issue || "").replace(/\D/g, ""));
    const bi = Number(String(b.issue || "").replace(/\D/g, ""));

    if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) {
      return bi - ai;
    }

    const ad = String(a.date || "");
    const bd = String(b.date || "");
    if (ad !== bd) return bd.localeCompare(ad);

    return String(b.issue || "").localeCompare(String(a.issue || ""));
  });
}

function dedupeByIssue(rows) {
  const map = new Map();

  for (const row of rows) {
    const issue = String(row.issue || "").trim();
    if (!issue) continue;

    if (!map.has(issue)) {
      map.set(issue, row);
      continue;
    }

    const prev = map.get(issue);

    const prevScore =
      (prev.date ? 1 : 0) +
      (Array.isArray(prev.numbers) ? prev.numbers.length : 0) +
      (prev.special !== undefined ? 1 : 0) +
      (prev.second !== undefined ? 1 : 0);

    const currScore =
      (row.date ? 1 : 0) +
      (Array.isArray(row.numbers) ? row.numbers.length : 0) +
      (row.special !== undefined ? 1 : 0) +
      (row.second !== undefined ? 1 : 0);

    if (currScore > prevScore) {
      map.set(issue, row);
      continue;
    }

    if (currScore === prevScore) {
      const prevDate = String(prev.date || "");
      const currDate = String(row.date || "");
      if (currDate > prevDate) {
        map.set(issue, row);
      }
    }
  }

  return sortDesc([...map.values()]);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json,text/plain,*/*"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} @ ${url}`);
  }

  return res.json();
}

function buildMonthRange(monthBack = 2) {
  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const startDate = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;

  return { start, end };
}

function buildRangeUrl(baseName) {
  const { start, end } = buildMonthRange(2);
  return `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/${baseName}?period&month=${start}&endMonth=${end}&pageNum=1&pageSize=200`;
}

function mergeRows(existingObjects, latestRows, parser) {
  const normalizedExisting = [];

  for (const obj of existingObjects) {
    const parsed = parser(obj, true);
    if (parsed) normalizedExisting.push(parsed);
  }

  return dedupeByIssue([...latestRows, ...normalizedExisting]);
}

function parseExistingBingoRow(row) {
  const issue = String(row.issue || "").trim();
  const date = normalizeDate(row.date || "");
  const numbers = [];

  for (let i = 1; i <= 20; i++) {
    const n = safeInt(row[`n${i}`]);
    if (n !== null && n >= 1 && n <= 80) numbers.push(n);
  }

  if (!issue || !date || numbers.length !== 20) return null;
  return { issue, date, numbers };
}

function parseExisting539Row(row) {
  const issue = String(row.issue || "").trim();
  const date = normalizeDate(row.date || "");
  const numbers = [];

  for (let i = 1; i <= 5; i++) {
    const n = safeInt(row[`n${i}`]);
    if (n !== null && n >= 1 && n <= 39) numbers.push(n);
  }

  if (!issue || !date || numbers.length !== 5) return null;
  return { issue, date, numbers };
}

function parseExistingLottoRow(row) {
  const issue = String(row.issue || "").trim();
  const date = normalizeDate(row.date || "");
  const numbers = [];

  for (let i = 1; i <= 6; i++) {
    const n = safeInt(row[`n${i}`]);
    if (n !== null && n >= 1 && n <= 49) numbers.push(n);
  }

  const special = safeInt(row.special);

  if (!issue || !date || numbers.length !== 6) return null;

  return {
    issue,
    date,
    numbers,
    special: special !== null && special >= 1 && special <= 49 ? special : undefined
  };
}

function parseExistingPowerRow(row) {
  const issue = String(row.issue || "").trim();
  const date = normalizeDate(row.date || "");
  const numbers = [];

  for (let i = 1; i <= 6; i++) {
    const n = safeInt(row[`n${i}`]);
    if (n !== null && n >= 1 && n <= 38) numbers.push(n);
  }

  const second = safeInt(row.second);

  if (!issue || !date || numbers.length !== 6) return null;
  if (second === null || second < 1 || second > 8) return null;

  return { issue, date, numbers, second };
}

async function fetchLatestBingoRows() {
  const data = await fetchJson(API.bingo);
  const post = data?.content?.lotteryBingoLatestPost;

  if (!post) throw new Error("找不到 lotteryBingoLatestPost");

  const issue = String(post.drawTerm || "").trim();
  const date = normalizeDate(post.date || post.eDate || "");
  const numbers = Array.isArray(post.bigShowOrder)
    ? post.bigShowOrder
        .map(v => Number(String(v).trim()))
        .filter(v => Number.isInteger(v) && v >= 1 && v <= 80)
    : [];

  if (!issue || !date || numbers.length !== 20) {
    throw new Error(`Bingo 最新資料格式錯誤 issue=${issue} date=${date} count=${numbers.length}`);
  }

  return [{ issue, date, numbers }];
}

async function fetchLatest539Rows() {
  const data = await fetchJson(buildRangeUrl("Daily539Result"));
  const list = data?.content?.daily539Res || [];

  return list
    .map(item => {
      const issue = String(item.period || "").trim();
      const date = normalizeDate(item.lotteryDate || "");
      const numbers = Array.isArray(item.drawNumberSize)
        ? item.drawNumberSize
            .map(v => Number(v))
            .filter(v => Number.isInteger(v) && v >= 1 && v <= 39)
        : [];

      if (!issue || !date || numbers.length !== 5) return null;
      return { issue, date, numbers };
    })
    .filter(Boolean);
}

async function fetchLatestLottoRows() {
  const data = await fetchJson(buildRangeUrl("Lotto649Result"));
  const list = data?.content?.lotto649Res || [];

  return list
    .map(item => {
      const issue = String(item.period || "").trim();
      const date = normalizeDate(item.lotteryDate || "");
      const arr = Array.isArray(item.drawNumberSize)
        ? item.drawNumberSize.map(v => Number(v)).filter(Number.isInteger)
        : [];

      if (!issue || !date || arr.length < 7) return null;

      const numbers = arr.slice(0, 6).filter(v => v >= 1 && v <= 49);
      const special = arr[6];

      if (numbers.length !== 6) return null;

      return {
        issue,
        date,
        numbers,
        special: Number.isInteger(special) && special >= 1 && special <= 49 ? special : undefined
      };
    })
    .filter(Boolean);
}

async function fetchLatestPowerRows() {
  const data = await fetchJson(buildRangeUrl("SuperLotto638Result"));
  const list = data?.content?.superLotto638Res || [];

  return list
    .map(item => {
      const issue = String(item.period || "").trim();
      const date = normalizeDate(item.lotteryDate || "");
      const arr = Array.isArray(item.drawNumberSize)
        ? item.drawNumberSize.map(v => Number(v)).filter(Number.isInteger)
        : [];

      if (!issue || !date || arr.length < 7) return null;

      const numbers = arr.slice(0, 6).filter(v => v >= 1 && v <= 38);
      const second = arr[6];

      if (numbers.length !== 6) return null;
      if (!Number.isInteger(second) || second < 1 || second > 8) return null;

      return { issue, date, numbers, second };
    })
    .filter(Boolean);
}

function writeBingo(rows) {
  writeCsv(
    path.join(RAW_DIR, "bingo.csv"),
    ["issue", "date", ...Array.from({ length: 20 }, (_, i) => `n${i + 1}`)],
    rows.map(r => [r.issue, r.date, ...r.numbers])
  );
}

function write539(rows) {
  writeCsv(
    path.join(RAW_DIR, "539.csv"),
    ["issue", "date", "n1", "n2", "n3", "n4", "n5"],
    rows.map(r => [r.issue, r.date, ...r.numbers])
  );
}

function writeLotto(rows) {
  writeCsv(
    path.join(RAW_DIR, "lotto.csv"),
    ["issue", "date", "n1", "n2", "n3", "n4", "n5", "n6", "special"],
    rows.map(r => [r.issue, r.date, ...r.numbers, r.special ?? ""])
  );
}

function writePower(rows) {
  writeCsv(
    path.join(RAW_DIR, "power.csv"),
    ["issue", "date", "n1", "n2", "n3", "n4", "n5", "n6", "second"],
    rows.map(r => [r.issue, r.date, ...r.numbers, r.second])
  );
}

async function main() {
  ensureDir(RAW_DIR);

  const [
    latestBingoRows,
    latest539Rows,
    latestLottoRows,
    latestPowerRows
  ] = await Promise.all([
    fetchLatestBingoRows(),
    fetchLatest539Rows(),
    fetchLatestLottoRows(),
    fetchLatestPowerRows()
  ]);

  const bingoMerged = mergeRows(
    readCsvObjects(path.join(RAW_DIR, "bingo.csv")),
    latestBingoRows,
    parseExistingBingoRow
  );

  const daily539Merged = mergeRows(
    readCsvObjects(path.join(RAW_DIR, "539.csv")),
    latest539Rows,
    parseExisting539Row
  );

  const lottoMerged = mergeRows(
    readCsvObjects(path.join(RAW_DIR, "lotto.csv")),
    latestLottoRows,
    parseExistingLottoRow
  );

  const powerMerged = mergeRows(
    readCsvObjects(path.join(RAW_DIR, "power.csv")),
    latestPowerRows,
    parseExistingPowerRow
  );

  writeBingo(bingoMerged);
  write539(daily539Merged);
  writeLotto(lottoMerged);
  writePower(powerMerged);

  console.log("✅ 即時資料已合併到 raw_data");
  console.log(`Bingo 最新期: ${latestBingoRows[0]?.issue || "-"}`);
  console.log(`539 最新期: ${latest539Rows[0]?.issue || "-"}`);
  console.log(`大樂透 最新期: ${latestLottoRows[0]?.issue || "-"}`);
  console.log(`威力彩 最新期: ${latestPowerRows[0]?.issue || "-"}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
