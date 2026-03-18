const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const EXTRACTED_DIR = path.join(ROOT, "data", "extracted");
const OFFICIAL_DIR = path.join(ROOT, "data", "official");
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

function listCsvFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current) {
    const items = fs.readdirSync(current, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        walk(full);
      } else if (item.isFile() && item.name.toLowerCase().endsWith(".csv")) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }

  out.push(cur.trim());
  return out.map(v => v.replace(/^"|"$/g, "").trim());
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function cleanKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_\-\/\\（）()：:]/g, "");
}

function findField(obj, candidates) {
  const entries = Object.entries(obj || {});
  for (const key of candidates) {
    const ck = cleanKey(key);
    const found = entries.find(([k]) => cleanKey(k) === ck);
    if (found && found[1] !== "") return found[1];
  }

  for (const key of candidates) {
    const ck = cleanKey(key);
    const found = entries.find(([k]) => cleanKey(k).includes(ck));
    if (found && found[1] !== "") return found[1];
  }

  return "";
}

function toNumber(v) {
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeDate(v) {
  const s = String(v || "").trim();
  if (!s) return "";

  const m1 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m1) {
    return `${m1[1]}/${String(m1[2]).padStart(2, "0")}/${String(m1[3]).padStart(2, "0")}`;
  }

  const m2 = s.match(/^(\d{3})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    const year = String(Number(m2[1]) + 1911);
    return `${year}/${String(m2[2]).padStart(2, "0")}/${String(m2[3]).padStart(2, "0")}`;
  }

  return s;
}

function uniqueSortedNumbers(arr, min, max) {
  return [...new Set(
    arr
      .map(toNumber)
      .filter(n => Number.isFinite(n) && n >= min && n <= max)
  )].sort((a, b) => a - b);
}

function extractNumbersFromRow(row, min, max) {
  const preferred = [
    "numbers", "num", "n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9", "n10",
    "第一區", "第一區1", "第一區2", "第一區3", "第一區4", "第一區5", "第一區6",
    "開出號碼", "獎號1", "獎號2", "獎號3", "獎號4", "獎號5", "獎號6", "獎號7", "獎號8", "獎號9", "獎號10",
    "號碼1", "號碼2", "號碼3", "號碼4", "號碼5", "號碼6", "號碼7", "號碼8", "號碼9", "號碼10"
  ];

  const values = [];

  for (const key of preferred) {
    const v = findField(row, [key]);
    if (v !== "") values.push(v);
  }

  if (values.length) {
    const nums = uniqueSortedNumbers(values, min, max);
    if (nums.length) return nums;
  }

  const allValues = Object.values(row || {});
  const merged = allValues.join(" ");
  const nums = (merged.match(/\d+/g) || []).map(Number);
  return uniqueSortedNumbers(nums, min, max);
}

function buildRecord(row, game) {
  const issue = findField(row, [
    "期別", "期數", "期號", "開獎期別", "開獎期數", "drawno", "issue", "period", "term", "seq"
  ]);

  const date = findField(row, [
    "日期", "開獎日期", "開出日期", "drawdate", "date"
  ]);

  const issueStr = String(issue || "").trim();
  if (!issueStr) return null;

  if (game === "bingo") {
    const numbers = extractNumbersFromRow(row, 1, 80);
    if (!numbers.length) return null;
    return {
      issue: issueStr,
      date: normalizeDate(date),
      numbers
    };
  }

  if (game === "lotto649") {
    const numbers = extractNumbersFromRow(row, 1, 49).slice(0, 6);
    const special = toNumber(findField(row, ["特別號", "special", "specialno", "特號"]));
    if (numbers.length < 6) return null;
    return {
      issue: issueStr,
      date: normalizeDate(date),
      numbers,
      ...(Number.isFinite(special) && special >= 1 && special <= 49 ? { special } : {})
    };
  }

  if (game === "superlotto638") {
    const numbers = extractNumbersFromRow(row, 1, 38).slice(0, 6);
    const zone2 = toNumber(findField(row, ["第二區", "zone2", "second", "特別號", "special"]));
    if (numbers.length < 6) return null;
    return {
      issue: issueStr,
      date: normalizeDate(date),
      numbers,
      ...(Number.isFinite(zone2) && zone2 >= 1 && zone2 <= 8 ? { zone2 } : {})
    };
  }

  if (game === "dailycash") {
    const numbers = extractNumbersFromRow(row, 1, 39).slice(0, 5);
    if (numbers.length < 5) return null;
    return {
      issue: issueStr,
      date: normalizeDate(date),
      numbers
    };
  }

  return null;
}

function detectGameFromFile(filePath) {
  const name = filePath.toLowerCase();

  if (name.includes("bingo")) return "bingo";
  if (name.includes("649") || name.includes("lotto649") || name.includes("biglotto")) return "lotto649";
  if (name.includes("638") || name.includes("superlotto638") || name.includes("power")) return "superlotto638";
  if (name.includes("539") || name.includes("dailycash")) return "dailycash";

  return null;
}

function dedupeRecords(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [
      row.issue || "",
      row.date || "",
      (row.numbers || []).join("-"),
      row.special ?? "",
      row.zone2 ?? ""
    ].join("|");

    if (!map.has(key)) {
      map.set(key, row);
    }
  }

  return [...map.values()];
}

function sortRecordsDesc(rows) {
  return [...rows].sort((a, b) => {
    const ai = String(a.issue || "");
    const bi = String(b.issue || "");

    const an = Number(ai.replace(/\D/g, ""));
    const bn = Number(bi.replace(/\D/g, ""));

    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) {
      return bn - an;
    }

    return bi.localeCompare(ai);
  });
}

function saveGameJson(fileName, rows) {
  const officialPath = path.join(OFFICIAL_DIR, fileName);
  const publicPath = path.join(PUBLIC_DIR, fileName);

  writeJson(officialPath, rows);
  writeJson(publicPath, rows);
}

function main() {
  ensureDir(OFFICIAL_DIR);
  ensureDir(PUBLIC_DIR);

  const csvFiles = listCsvFiles(EXTRACTED_DIR);

  const buckets = {
    bingo: [],
    lotto649: [],
    superlotto638: [],
    dailycash: []
  };

  for (const file of csvFiles) {
    const game = detectGameFromFile(file);
    if (!game) continue;

    try {
      const text = readText(file);
      const csvRows = parseCsv(text);

      for (const row of csvRows) {
        const rec = buildRecord(row, game);
        if (rec) buckets[game].push(rec);
      }
    } catch (err) {
      console.error(`處理失敗: ${file}`, err.message);
    }
  }

  const bingo = sortRecordsDesc(dedupeRecords(buckets.bingo));
  const lotto649 = sortRecordsDesc(dedupeRecords(buckets.lotto649));
  const superlotto638 = sortRecordsDesc(dedupeRecords(buckets.superlotto638));
  const dailycash = sortRecordsDesc(dedupeRecords(buckets.dailycash));

  saveGameJson("bingo.json", bingo);
  saveGameJson("lotto649.json", lotto649);
  saveGameJson("superlotto638.json", superlotto638);
  saveGameJson("dailycash.json", dailycash);

  console.log("✅ convert_to_json 完成");
  console.log("bingo:", bingo.length);
  console.log("lotto649:", lotto649.length);
  console.log("superlotto638:", superlotto638.length);
  console.log("dailycash:", dailycash.length);
}

main();