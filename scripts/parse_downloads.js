const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const EXTRACTED_DIR = path.join(ROOT, "data", "extracted");
const OFFICIAL_DIR = path.join(ROOT, "data", "official");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function safeReadBuffer(file) {
  try {
    return fs.readFileSync(file);
  } catch {
    return null;
  }
}

function decodeBuffer(buf) {
  if (!buf) return "";

  const utf8 = buf.toString("utf8");
  if (looksReadable(utf8)) return stripBom(utf8);

  const latin1 = buf.toString("latin1");
  if (looksReadable(latin1)) return stripBom(latin1);

  return stripBom(utf8);
}

function stripBom(text) {
  if (!text) return "";
  return text.replace(/^\uFEFF/, "");
}

function looksReadable(text) {
  if (!text) return false;
  const sample = text.slice(0, 1200);

  if (/遊戲名稱|開獎日期|期別|大樂透|威力彩|今彩539|賓果賓果/.test(sample)) return true;

  const bad = (sample.match(/�/g) || []).length;
  return bad < 20;
}

function splitCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  result.push(cur);
  return result.map(v => v.trim());
}

function parseCsv(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  if (!lines.length) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (!cells.length) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] || "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function normalizeHeader(h) {
  return String(h || "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "")
    .trim();
}

function parseNum(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.replace(/\./g, "/").replace(/-/g, "/");
}

function getGameType(file, text) {
  const name = path.basename(file);

  if (/賓果|bingo/i.test(name) || /賓果賓果/.test(text)) return "bingo";
  if (/大樂透/.test(name) || /大樂透/.test(text)) return "lotto649";
  if (/威力彩/.test(name) || /威力彩/.test(text)) return "superlotto638";
  if (/今彩539/.test(name) || /今彩539/.test(text)) return "dailycash";

  return null;
}

function getIssue(row) {
  return (
    row["期別"] ||
    row["期號"] ||
    row["期次"] ||
    row["draw"] ||
    ""
  ).trim();
}

function collectNumbers(row, maxCount = 20) {
  const nums = [];

  for (let i = 1; i <= maxCount; i++) {
    const key = `獎號${i}`;
    const v = parseNum(row[key]);
    if (v != null) nums.push(v);
  }

  return nums;
}

function normalizeRecord(gameType, row) {
  const issue = getIssue(row);
  const date = parseDate(row["開獎日期"]);
  const gameName = (row["遊戲名稱"] || "").trim();

  if (!issue || !date) return null;

  if (gameType === "bingo") {
    const numbers = collectNumbers(row, 20);
    if (!numbers.length) return null;

    return {
      issue,
      date,
      game: gameName || "賓果賓果",
      numbers,
      special: parseNum(row["超級獎號"]),
      bigSmall: (row["猜大小"] || "").trim() || null,
      oddEven: (row["猜單雙"] || "").trim() || null
    };
  }

  if (gameType === "lotto649") {
    const numbers = collectNumbers(row, 6);
    if (numbers.length < 6) return null;

    return {
      issue,
      date,
      game: gameName || "大樂透",
      numbers,
      special: parseNum(row["特別號"])
    };
  }

  if (gameType === "superlotto638") {
    const numbers = collectNumbers(row, 6);
    if (numbers.length < 6) return null;

    return {
      issue,
      date,
      game: gameName || "威力彩",
      numbers,
      special: parseNum(row["第二區"])
    };
  }

  if (gameType === "dailycash") {
    const numbers = collectNumbers(row, 5);
    if (numbers.length < 5) return null;

    return {
      issue,
      date,
      game: gameName || "今彩539",
      numbers
    };
  }

  return null;
}

function dedupeAndSort(records) {
  const map = new Map();

  for (const r of records) {
    if (!r || !r.issue) continue;
    map.set(r.issue, r);
  }

  return [...map.values()].sort((a, b) => {
    if (a.issue === b.issue) return 0;
    return a.issue < b.issue ? -1 : 1;
  });
}

function takeLatest(records, count = 5) {
  return [...records].sort((a, b) => {
    if (a.issue === b.issue) return 0;
    return a.issue > b.issue ? -1 : 1;
  }).slice(0, count);
}

function main() {
  ensureDir(OFFICIAL_DIR);

  const allFiles = walk(EXTRACTED_DIR).filter(f => /\.csv$/i.test(f));

  const meta = {
    version: "V72.4",
    mode: "official-csv-parse",
    sourceName: "data/extracted 官方 zip 解壓 CSV",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    games: {
      bingo: [],
      lotto649: [],
      superlotto638: [],
      dailycash: []
    },
    fileStats: {
      csvFiles: allFiles.length,
      parsed: 0,
      skipped: 0
    }
  };

  for (const file of allFiles) {
    const buf = safeReadBuffer(file);
    const text = decodeBuffer(buf);
    const gameType = getGameType(file, text);

    if (!gameType) {
      meta.fileStats.skipped++;
      continue;
    }

    const { rows } = parseCsv(text);
    let added = 0;

    for (const row of rows) {
      const rec = normalizeRecord(gameType, row);
      if (!rec) continue;
      meta.games[gameType].push(rec);
      added++;
    }

    if (added > 0) meta.fileStats.parsed++;
    else meta.fileStats.skipped++;
  }

  meta.games.bingo = dedupeAndSort(meta.games.bingo);
  meta.games.lotto649 = dedupeAndSort(meta.games.lotto649);
  meta.games.superlotto638 = dedupeAndSort(meta.games.superlotto638);
  meta.games.dailycash = dedupeAndSort(meta.games.dailycash);

  const latest = {
    version: "V72.4",
    generatedAt: new Date().toISOString(),
    games: {
      bingo: takeLatest(meta.games.bingo, 5),
      lotto649: takeLatest(meta.games.lotto649, 5),
      superlotto638: takeLatest(meta.games.superlotto638, 5),
      dailycash: takeLatest(meta.games.dailycash, 5)
    }
  };

  const summary = {
    version: "V72.4",
    mode: "official-csv-parse",
    sourceName: "data/extracted 官方 zip 解壓 CSV",
    generatedAt: meta.generatedAt,
    updatedAt: meta.updatedAt,
    games: {
      bingo: {
        count: meta.games.bingo.length,
        status: meta.games.bingo.length ? "ok" : "empty"
      },
      lotto649: {
        count: meta.games.lotto649.length,
        status: meta.games.lotto649.length ? "ok" : "empty"
      },
      superlotto638: {
        count: meta.games.superlotto638.length,
        status: meta.games.superlotto638.length ? "ok" : "empty"
      },
      dailycash: {
        count: meta.games.dailycash.length,
        status: meta.games.dailycash.length ? "ok" : "empty"
      }
    },
    fileStats: meta.fileStats
  };

  writeJson(path.join(OFFICIAL_DIR, "meta.json"), meta);
  writeJson(path.join(OFFICIAL_DIR, "latest.json"), latest);
  writeJson(path.join(OFFICIAL_DIR, "summary.json"), summary);

  console.log("📦 CSV files:", allFiles.length);
  console.log("✅ parsed:", meta.fileStats.parsed);
  console.log("⏭️ skipped:", meta.fileStats.skipped);
  console.log("BINGO:", meta.games.bingo.length);
  console.log("649:", meta.games.lotto649.length);
  console.log("638:", meta.games.superlotto638.length);
  console.log("539:", meta.games.dailycash.length);
  console.log("✅ DONE");
}

main();