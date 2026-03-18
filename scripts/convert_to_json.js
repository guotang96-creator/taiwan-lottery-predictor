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

function hasDuplicateNumbers(arr) {
  return new Set(arr).size !== arr.length;
}

function extractNumbers(row, count, min, max) {
  const numbers = [];

  for (let i = 1; i <= count; i++) {
    const n = safeInt(row[`n${i}`]);
    if (n !== null && n >= min && n <= max) {
      numbers.push(n);
    }
  }

  return numbers;
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

function dedupeRowsByIssue(rows) {
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
      (Array.isArray(prev.numbers) ? prev.numbers.length : 0) +
      (prev.special !== undefined ? 1 : 0) +
      (prev.zone2 !== undefined ? 1 : 0);

    const currScore =
      (row.date ? 1 : 0) +
      (Array.isArray(row.numbers) ? row.numbers.length : 0) +
      (row.special !== undefined ? 1 : 0) +
      (row.zone2 !== undefined ? 1 : 0);

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

function normalizeBingoRows(records) {
  const result = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const issue = normalizeIssue(row.issue, i);
    const date = normalizeDate(row.date);
    const numbers = extractNumbers(row, 20, 1, 80);

    if (!issue) continue;
    if (!date) continue;
    if (numbers.length !== 20) continue;
    if (hasDuplicateNumbers(numbers)) continue;

    result.push({ issue, date, numbers });
  }

  return result;
}

function normalizeDailycashRows(records) {
  const result = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const issue = normalizeIssue(row.issue, i);
    const date = normalizeDate(row.date);
    const numbers = extractNumbers(row, 5, 1, 39);

    if (!issue) continue;
    if (!date) continue;
    if (numbers.length !== 5) continue;
    if (hasDuplicateNumbers(numbers)) continue;

    result.push({ issue, date, numbers });
  }

  return result;
}

function normalizeLotto649Rows(records) {
  const result = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const issue = normalizeIssue(row.issue, i);
    const date = normalizeDate(row.date);
    const numbers = extractNumbers(row, 6, 1, 49);

    if (!issue) continue;
    if (!date) continue;
    if (numbers.length !== 6) continue;
    if (hasDuplicateNumbers(numbers)) continue;

    result.push({ issue, date, numbers });
  }

  return result;
}

function convertCsvFile(options) {
  const { csvFile, jsonFile, latestKey, normalizer } = options;

  const csvPath = path.join(RAW_DIR, csvFile);
  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠️ 找不到 ${csvFile}，略過`);
    return null;
  }

  const csvText = readText(csvPath);
  const parsedRows = parseCSV(csvText);
  const records = toObjects(parsedRows);

  if (records.length === 0) {
    console.warn(`⚠️ ${csvFile} 解析後沒有任何資料列`);
    writeJson(path.join(DATA_DIR, jsonFile), []);
    return { key: latestKey, rows: [] };
  }

  const normalized = normalizer(records);
  const deduped = dedupeRowsByIssue(normalized);
  const finalRows = sortRowsDesc(deduped);

  writeJson(path.join(DATA_DIR, jsonFile), finalRows);

  console.log(`✅ ${csvFile} → ${jsonFile}`);
  console.log(`   原始筆數: ${records.length}`);
  console.log(`   有效筆數: ${normalized.length}`);
  console.log(`   去重後筆數: ${finalRows.length}`);
  console.log(`   最新五期: ${finalRows.slice(0, 5).map(x => x.issue).join(", ")}`);

  return {
    key: latestKey,
    rows: finalRows
  };
}

function updateLatestJson(results) {
  const latestPath = path.join(DATA_DIR, "latest.json");
  const existing = readJsonSafe(latestPath, {});

  const latest = {
    ...existing,
    version: "csv-fix-3",
    updatedAt: new Date().toISOString(),
    games: {
      ...(existing && existing.games ? existing.games : {})
    }
  };

  for (const item of results) {
    if (!item || !item.key) continue;
    latest.games[item.key] = Array.isArray(item.rows) ? item.rows.slice(0, 5) : [];
  }

  writeJson(latestPath, latest);
}

function main() {
  ensureDir(DATA_DIR);
  ensureDir(PUBLIC_DIR);

  const results = [];

  results.push(
    convertCsvFile({
      csvFile: "bingo.csv",
      jsonFile: "bingo.json",
      latestKey: "bingo",
      normalizer: normalizeBingoRows
    })
  );

  results.push(
    convertCsvFile({
      csvFile: "539.csv",
      jsonFile: "dailycash.json",
      latestKey: "dailycash",
      normalizer: normalizeDailycashRows
    })
  );

  results.push(
    convertCsvFile({
      csvFile: "lotto.csv",
      jsonFile: "lotto649.json",
      latestKey: "lotto649",
      normalizer: normalizeLotto649Rows
    })
  );

  updateLatestJson(results);

  syncToPublic("bingo.json");
  syncToPublic("dailycash.json");
  syncToPublic("lotto649.json");
  syncToPublic("latest.json");

  console.log("✅ convert_to_json 完成");
}

main();
