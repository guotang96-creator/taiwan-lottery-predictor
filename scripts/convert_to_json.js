const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const RAW_DIR = path.join(ROOT, "raw_data");
const DATA_DIR = path.join(ROOT, "data", "official");
const PUBLIC_DIR = path.join(ROOT, "public", "data", "official");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * 簡易 CSV 解析器
 * 支援:
 * - 逗號分隔
 * - 雙引號包住欄位
 * - 欄位內有逗號
 * - 欄位內雙引號轉義 ""
 */
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

  // 最後一格
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
  const body = rows.slice(1);

  return body.map((r) => {
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

  // 已是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD -> YYYY-MM-DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");

  // YYYYMMDD -> YYYY-MM-DD
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  return s;
}

function normalizeIssue(issue, rowIndex) {
  const s = String(issue || "").trim();

  if (/^\d+$/.test(s)) return s;

  // 只保留數字，避免 weird 字元
  const digits = s.replace(/\D/g, "");
  if (digits) return digits;

  // 真的沒有才 fallback，但正常 bingo.csv 不該走到這裡
  return `unknown-${String(rowIndex + 1).padStart(6, "0")}`;
}

function extractBingoNumbers(row) {
  const numbers = [];

  for (let i = 1; i <= 20; i++) {
    const key = `n${i}`;
    const n = safeInt(row[key]);

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

    // 基本資料不完整就跳過
    if (!issue) continue;
    if (!date) continue;
    if (numbers.length !== 20) continue;
    if (hasDuplicateNumbers(numbers)) continue;

    result.push({
      issue,
      date,
      numbers
    });
  }

  return result;
}

/**
 * 以 issue 優先，date 次之
 * issue 是 202401010001 這種格式，直接比數字即可
 */
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

/**
 * 去重策略：
 * 先用 issue 去重，保留較完整的一筆
 * 若 issue 相同且 numbers 相同，視為同筆
 */
function dedupeBingoRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = String(row.issue);

    if (!map.has(key)) {
      map.set(key, row);
      continue;
    }

    const prev = map.get(key);

    const prevScore = (prev.date ? 1 : 0) + (Array.isArray(prev.numbers) ? prev.numbers.length : 0);
    const currScore = (row.date ? 1 : 0) + (Array.isArray(row.numbers) ? row.numbers.length : 0);

    if (currScore > prevScore) {
      map.set(key, row);
      continue;
    }

    // 若完整度相同，保留 issue/date 較新的結構穩定資料
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

function buildLatestFile(bingoRows) {
  return {
    version: "bingo-fix-1",
    updatedAt: new Date().toISOString(),
    games: {
      bingo: sortRowsDesc(bingoRows).slice(0, 5)
    }
  };
}

function syncToPublic(fileName) {
  const src = path.join(DATA_DIR, fileName);
  const dest = path.join(PUBLIC_DIR, fileName);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`📁 同步到 public: ${fileName}`);
  }
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

  const outPath = path.join(DATA_DIR, "bingo.json");
  writeJson(outPath, finalRows);

  // 若 latest.json 已存在，先讀進來再覆蓋 bingo 區塊
  const latestPath = path.join(DATA_DIR, "latest.json");
  let latest = {
    version: "bingo-fix-1",
    updatedAt: new Date().toISOString(),
    games: {}
  };

  if (fs.existsSync(latestPath)) {
    try {
      latest = JSON.parse(fs.readFileSync(latestPath, "utf8"));
    } catch (err) {
      console.warn("⚠️ 既有 latest.json 讀取失敗，將重建");
    }
  }

  latest.version = "bingo-fix-1";
  latest.updatedAt = new Date().toISOString();
  latest.games = latest.games || {};
  latest.games.bingo = finalRows.slice(0, 5);

  writeJson(latestPath, latest);

  syncToPublic("bingo.json");
  syncToPublic("latest.json");

  console.log("✅ bingo CSV → JSON 轉換完成");
  console.log(`原始筆數: ${records.length}`);
  console.log(`有效筆數: ${normalized.length}`);
  console.log(`去重後筆數: ${finalRows.length}`);
  console.log("最新五期 issue:", finalRows.slice(0, 5).map((x) => x.issue).join(", "));
}

convertBingo();
