const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "official");
const PUBLIC_DIR = path.join(ROOT, "public", "data", "official");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`讀取 JSON 失敗: ${filePath}`, err.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeNumberArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map(v => Number(v))
      .filter(v => Number.isFinite(v) && v > 0)
  )].sort((a, b) => a - b);
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, idx) => {
      const issue = row.issue || row.period || row.term || row.draw || `unknown-${idx}`;
      const date = row.date || row.drawDate || row.openDate || "";
      const numbers = normalizeNumberArray(row.numbers);

      const result = {
        issue: String(issue),
        date: date ? String(date) : "",
        numbers
      };

      if (row.special !== undefined && row.special !== null && row.special !== "") {
        const v = Number(row.special);
        if (Number.isFinite(v) && v > 0) result.special = v;
      }

      if (row.zone2 !== undefined && row.zone2 !== null && row.zone2 !== "") {
        const v = Number(row.zone2);
        if (Number.isFinite(v) && v > 0) result.zone2 = v;
      }

      if (row.second !== undefined && row.second !== null && row.second !== "") {
        const v = Number(row.second);
        if (Number.isFinite(v) && v > 0) result.zone2 = v;
      }

      return result;
    })
    .filter(row => row.issue && row.numbers.length > 0);
}

function sortByIssueDesc(rows) {
  return [...rows].sort((a, b) => String(b.issue).localeCompare(String(a.issue)));
}

function latestFive(rows) {
  return sortByIssueDesc(rows).slice(0, 5);
}

function buildLatestJson() {
  const bingoRows = normalizeRows(readJsonSafe(path.join(DATA_DIR, "bingo.json"), []));
  const lotto649Rows = normalizeRows(readJsonSafe(path.join(DATA_DIR, "lotto649.json"), []));
  const superlotto638Rows = normalizeRows(readJsonSafe(path.join(DATA_DIR, "superlotto638.json"), []));
  const dailycashRows = normalizeRows(readJsonSafe(path.join(DATA_DIR, "dailycash.json"), []));

  const latest = {
    version: "V74.1",
    updatedAt: new Date().toISOString(),
    games: {
      bingo: latestFive(bingoRows),
      lotto649: latestFive(lotto649Rows),
      superlotto638: latestFive(superlotto638Rows),
      dailycash: latestFive(dailycashRows)
    }
  };

  writeJson(path.join(DATA_DIR, "latest.json"), latest);

  console.log("✅ latest.json 已更新");
  console.log("bingo:", latest.games.bingo.length);
  console.log("lotto649:", latest.games.lotto649.length);
  console.log("superlotto638:", latest.games.superlotto638.length);
  console.log("dailycash:", latest.games.dailycash.length);

  return latest;
}

function copyToPublic() {
  ensureDir(PUBLIC_DIR);

  const filesToCopy = [
    "latest.json",
    "bingo.json",
    "lotto649.json",
    "superlotto638.json",
    "dailycash.json",
    "meta.json",
    "download_manifest.json",
    "zip_inventory.json"
  ];

  for (const fileName of filesToCopy) {
    const src = path.join(DATA_DIR, fileName);
    const dest = path.join(PUBLIC_DIR, fileName);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`📁 已同步到 public: ${fileName}`);
    }
  }
}

function main() {
  ensureDir(DATA_DIR);
  ensureDir(PUBLIC_DIR);

  buildLatestJson();
  copyToPublic();

  console.log("✅ V74.1 本地極速版完成");
}

main();
