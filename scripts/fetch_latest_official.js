const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "raw_data");

const BINGO_API = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LatestBingoResult";

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

function readCsvObjects(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
  return toObjects(parseCSV(text));
}

function normalizeDate(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) return s.slice(0, 10).replace(/\//g, "-");
  return s.slice(0, 10).replace(/\//g, "-");
}

function sortDesc(rows) {
  return [...rows].sort((a, b) => {
    const ai = Number(String(a.issue || "").replace(/\D/g, ""));
    const bi = Number(String(b.issue || "").replace(/\D/g, ""));
    if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) {
      return bi - ai;
    }
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
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

async function fetchLatestBingo() {
  const data = await fetchJson(BINGO_API);
  const post = data?.content?.lotteryBingoLatestPost;

  if (!post) {
    throw new Error("找不到 lotteryBingoLatestPost");
  }

  const issue = String(post.drawTerm || "").trim();
  const date = normalizeDate(post.date || post.eDate || "");
  const numbers = Array.isArray(post.bigShowOrder)
    ? post.bigShowOrder
        .map(v => Number(String(v).trim()))
        .filter(v => Number.isInteger(v) && v >= 1 && v <= 80)
    : [];

  if (!issue || !date || numbers.length !== 20) {
    throw new Error(`Bingo 最新資料格式不完整 issue=${issue} date=${date} numbers=${numbers.length}`);
  }

  return { issue, date, numbers };
}

function mergeBingoRow(latestRow, existingRows) {
  const map = new Map();

  map.set(latestRow.issue, latestRow);

  for (const row of existingRows) {
    const issue = String(row.issue || "").trim();
    if (!issue) continue;

    const numbers = [];
    for (let i = 1; i <= 20; i++) {
      const n = Number(row[`n${i}`]);
      if (Number.isInteger(n) && n >= 1 && n <= 80) {
        numbers.push(n);
      }
    }

    if (numbers.length !== 20) continue;

    if (!map.has(issue)) {
      map.set(issue, {
        issue,
        date: normalizeDate(row.date || ""),
        numbers
      });
    }
  }

  return sortDesc([...map.values()]);
}

async function main() {
  ensureDir(RAW_DIR);

  const latestBingo = await fetchLatestBingo();
  const bingoPath = path.join(RAW_DIR, "bingo.csv");
  const existingBingo = readCsvObjects(bingoPath);

  const mergedBingo = mergeBingoRow(latestBingo, existingBingo);

  writeCsv(
    bingoPath,
    ["issue", "date", ...Array.from({ length: 20 }, (_, i) => `n${i + 1}`)],
    mergedBingo.map(r => [r.issue, r.date, ...r.numbers])
  );

  console.log("✅ Bingo 最新一期已合併到 raw_data/bingo.csv");
  console.log(`最新期別: ${latestBingo.issue}`);
  console.log(`最新日期: ${latestBingo.date}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
