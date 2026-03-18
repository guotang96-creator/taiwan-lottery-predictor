const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const ROOT = process.cwd();
const DOWNLOAD_DIR = path.join(ROOT, "data", "downloads");
const EXTRACT_DIR = path.join(ROOT, "data", "extracted");
const RAW_DIR = path.join(ROOT, "raw_data");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function parseDelimited(text, delimiter) {
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

    if (ch === delimiter) {
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

function detectDelimiter(text) {
  const firstLine = normalizeLineEndings(text).split("\n")[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function parseTable(filePath) {
  const text = readText(filePath);
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) return [];

  const header = rows[0].map(h => String(h || "").trim());
  return rows.slice(1).map(r => {
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = String(r[i] ?? "").trim();
    }
    return obj;
  });
}

function safeInt(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

function normalizeDate(value) {
  const s = String(value || "").trim();
  if (!s) return "";

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

  return s.replace(/\//g, "-");
}

function normalizeIssue(value, rowIndex) {
  const s = String(value || "").trim();
  if (/^\d+$/.test(s)) return s;

  const digits = s.replace(/\D/g, "");
  if (digits) return digits;

  return `unknown-${String(rowIndex + 1).padStart(6, "0")}`;
}

function hasDuplicateNumbers(arr) {
  return new Set(arr).size !== arr.length;
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
  writeText(filePath, lines.join("\n") + "\n");
}

function extractByPattern(pattern) {
  if (!fs.existsSync(EXTRACT_DIR)) return [];
  return fs
    .readdirSync(EXTRACT_DIR)
    .filter(name => pattern.test(name))
    .map(name => path.join(EXTRACT_DIR, name));
}

function unzipAll() {
  ensureDir(EXTRACT_DIR);

  if (!fs.existsSync(DOWNLOAD_DIR)) {
    throw new Error("downloads 資料夾不存在");
  }

  const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith(".zip"));
  if (files.length === 0) {
    throw new Error("沒有 zip 檔");
  }

  let total = 0;

  for (const file of files) {
    const fullPath = path.join(DOWNLOAD_DIR, file);
    try {
      console.log("📦 解壓:", file);
      const zip = new AdmZip(fullPath);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (!entry.isDirectory && entry.entryName.endsWith(".csv")) {
          const baseName = path.basename(entry.entryName);
          const outPath = path.join(EXTRACT_DIR, baseName);
          fs.writeFileSync(outPath, entry.getData());
          total++;
        }
      }
    } catch (err) {
      console.log("❌ 解壓失敗:", file, err.message);
    }
  }

  console.log("✅ CSV 總數:", total);

  if (total === 0) {
    throw new Error("沒有解出任何 CSV");
  }
}

function buildBingo() {
  const files = extractByPattern(/^賓果賓果_\d{4}\.csv$/);
  const rows = [];

  for (const file of files) {
    const records = parseTable(file);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const issue = normalizeIssue(r["期別"], i);
      const date = normalizeDate(r["開獎日期"]);
      const numbers = [];

      for (let n = 1; n <= 20; n++) {
        const v = safeInt(r[`獎號${n}`]);
        if (v !== null && v >= 1 && v <= 80) {
          numbers.push(v);
        }
      }

      if (!issue || !date || numbers.length !== 20 || hasDuplicateNumbers(numbers)) {
        continue;
      }

      rows.push({ issue, date, numbers });
    }
  }

  const finalRows = sortDesc(dedupeByIssue(rows));
  writeCsv(
    path.join(RAW_DIR, "bingo.csv"),
    ["issue", "date", ...Array.from({ length: 20 }, (_, i) => `n${i + 1}`)],
    finalRows.map(r => [r.issue, r.date, ...r.numbers])
  );

  console.log(`✅ 輸出 raw_data/bingo.csv (${finalRows.length} 筆)`);
}

function build539() {
  const files = extractByPattern(/^今彩539_\d{4}\.csv$/);
  const rows = [];

  for (const file of files) {
    const records = parseTable(file);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const issue = normalizeIssue(r["期別"], i);
      const date = normalizeDate(r["開獎日期"]);
      const numbers = [];

      for (let n = 1; n <= 5; n++) {
        const v = safeInt(r[`獎號${n}`]);
        if (v !== null && v >= 1 && v <= 39) {
          numbers.push(v);
        }
      }

      if (!issue || !date || numbers.length !== 5 || hasDuplicateNumbers(numbers)) {
        continue;
      }

      rows.push({ issue, date, numbers });
    }
  }

  const finalRows = sortDesc(dedupeByIssue(rows));
  writeCsv(
    path.join(RAW_DIR, "539.csv"),
    ["issue", "date", "n1", "n2", "n3", "n4", "n5"],
    finalRows.map(r => [r.issue, r.date, ...r.numbers])
  );

  console.log(`✅ 輸出 raw_data/539.csv (${finalRows.length} 筆)`);
}

function buildLotto() {
  const files = extractByPattern(/^大樂透_\d{4}\.csv$/);
  const rows = [];

  for (const file of files) {
    const records = parseTable(file);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const issue = normalizeIssue(r["期別"], i);
      const date = normalizeDate(r["開獎日期"]);
      const numbers = [];

      for (let n = 1; n <= 6; n++) {
        const v = safeInt(r[`獎號${n}`]);
        if (v !== null && v >= 1 && v <= 49) {
          numbers.push(v);
        }
      }

      const special = safeInt(r["特別號"]);

      if (!issue || !date || numbers.length !== 6 || hasDuplicateNumbers(numbers)) {
        continue;
      }

      rows.push({
        issue,
        date,
        numbers,
        special: special !== null && special >= 1 && special <= 49 ? special : undefined
      });
    }
  }

  const finalRows = sortDesc(dedupeByIssue(rows));
  writeCsv(
    path.join(RAW_DIR, "lotto.csv"),
    ["issue", "date", "n1", "n2", "n3", "n4", "n5", "n6", "special"],
    finalRows.map(r => [r.issue, r.date, ...r.numbers, r.special ?? ""])
  );

  console.log(`✅ 輸出 raw_data/lotto.csv (${finalRows.length} 筆)`);
}

function buildPower() {
  const files = extractByPattern(/^威力彩_\d{4}\.csv$/);
  const rows = [];

  for (const file of files) {
    const records = parseTable(file);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const issue = normalizeIssue(r["期別"], i);
      const date = normalizeDate(r["開獎日期"]);
      const numbers = [];

      for (let n = 1; n <= 6; n++) {
        const v = safeInt(r[`獎號${n}`]);
        if (v !== null && v >= 1 && v <= 38) {
          numbers.push(v);
        }
      }

      const zone2 = safeInt(r["第二區"]);

      if (!issue || !date || numbers.length !== 6 || hasDuplicateNumbers(numbers)) {
        continue;
      }
      if (zone2 === null || zone2 < 1 || zone2 > 8) {
        continue;
      }

      rows.push({ issue, date, numbers, zone2 });
    }
  }

  const finalRows = sortDesc(dedupeByIssue(rows));
  writeCsv(
    path.join(RAW_DIR, "power.csv"),
    ["issue", "date", "n1", "n2", "n3", "n4", "n5", "n6", "second"],
    finalRows.map(r => [r.issue, r.date, ...r.numbers, r.zone2])
  );

  console.log(`✅ 輸出 raw_data/power.csv (${finalRows.length} 筆)`);
}

function main() {
  ensureDir(RAW_DIR);

  unzipAll();
  buildBingo();
  build539();
  buildLotto();
  buildPower();

  console.log("🎉 parse_downloads 完成");
}

main();
