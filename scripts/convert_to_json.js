const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const RAW_DIR = path.join(ROOT, "raw_data");
const DATA_DIR = path.join(ROOT, "data", "official");
const PUBLIC_DIR = path.join(ROOT, "public", "data", "official");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn(`⚠️ JSON 讀取失敗: ${filePath} - ${err.message}`);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
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
    .map((r) => r.map((v) => String(v ?? "").trim()))
    .filter((r) => r.some((v) => v !== ""));
}

function toObjects(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const header = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = String(r[i] ?? "").trim();
    }
    return obj;
  });
}

function safeInt(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isInteger(n) ? n : null;
}

function normalizeDate(dateStr) {
  const s = String(dateStr || "").trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

  return s;
}

function normalizeIssue(issue, rowIndex) {
  const s = String(issue || "").trim();

  if (/^\d+$/.test(s)) return s;

  const digits = s.replace(/\D/g, "");
  if (digits) return digits;

  return `unknown-${String(rowIndex + 1).padStart(6, "0")}`;
}

function extractBingoNumbers(row) {
  const numbers = [];

  for (let i = 1; i <= 20; i++) {
    const n = safeInt(row[`n${i}`]);
    if (n !== null && n >= 1 && n <= 80) {
      numbers.push(n);
    }
  }

  return numbers;
}

function hasDuplicateNumbers(arr) {
  return new Set(arr).size !== arr.length;
}

function normalizeBingoRows(records) {
  const result = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];

    const issue = normalizeIssue(row.issue, i);
    const date = normalizeDate(row.date);
    const numbers = extractBingoNumbers(row);

    if (!issue) continue;
    if (!date) continue;
    if (numbers.length !== 20) continue;
    if (hasDuplicateNumbers(numbers)) continue;

    result.push({ issue, date, numbers });
  }

  return result;
}

function sortRowsDesc(rows) {
  return [...rows].sort((a, b) => {
    const ai = Number(String(a.issue).replace(/\D/g, ""));
    const bi = Number(String(b.issue).replace(/\D/g, ""));

    if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) {
      return bi - ai;
    }

    const ad = String(a.date || "");
    const bd = String(b.date || "");
    if (ad !== bd) return bd.localeCompare(ad);

    return String(b.issue).localeCompare(String(a.issue));
  });
}

function dedupeBingoRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = String(row.issue);

    if (!map.has(key)) {
      map.set(key, row);
      continue;
    }

    const prev = map.get(key);

    const prevScore =
      (prev.date ? 1 : 0) +
      (Array.isArray(prev.numbers) ? prev.numbers.length : 0);

    const currScore =
      (row.date ? 1 : 0) +
      (Array.isArray(row.numbers) ? row.numbers.length : 0);

    if (currScore > prevScore) {
      map.set(key, row);
      continue;
    }

    if (currScore === prevScore) {
      const prevDate = String(prev.date || "");
      const currDate = String(row.date || "");
      if (currDate > prevDate) {
        map.set(key, row);
      }
    }
  }

  return [...map.values()];
}

function syncToPublic(fileName) {
  const src = path.join(DATA_DIR, fileName);
  const dest = path.join(PUBLIC_DIR, fileName);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`📁 同步到 public: ${fileName}`);
  }
}

function updateLatestJson(bingoRows) {
  const latestPath = path.join(DATA_DIR, "latest.json");
  const existing = readJsonSafe(latestPath, {});

  const latest = {
    ...existing,
    version: "bingo-fix-2",
    updatedAt: new Date().toISOString(),
    games: {
      ...(existing && existing.games ? existing.games : {}),
      bingo: bingoRows.slice(0, 5)
    }
  };

  writeJson(latestPath, latest);
}

function convertBingo() {
  ensureDir(DATA_DIR);
  ensureDir(PUBLIC_DIR);

  const csvPath = path.join(RAW_DIR, "bingo.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`找不到檔案: ${csvPath}`);
  }

  const csvText = readText(csvPath);
  const parsedRows = parseCSV(csvText);
  const records = toObjects(parsedRows);

  if (records.length === 0) {
    throw new Error("bingo.csv 解析後沒有任何資料列");
  }

  const normalized = normalizeBingoRows(records);
  const deduped = dedupeBingoRows(normalized);
  const finalRows = sortRowsDesc(deduped);

  writeJson(path.join(DATA_DIR, "bingo.json"), finalRows);
  updateLatestJson(finalRows);

  syncToPublic("bingo.json");
  syncToPublic("latest.json");

  console.log("✅ bingo CSV → JSON 轉換完成");
  console.log(`原始筆數: ${records.length}`);
  console.log(`有效筆數: ${normalized.length}`);
  console.log(`去重後筆數: ${finalRows.length}`);
  console.log(`最新五期: ${finalRows.slice(0, 5).map(x => x.issue).join(", ")}`);
}

convertBingo();
