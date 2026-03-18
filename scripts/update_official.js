const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "official");
const PUBLIC_DIR = path.join(ROOT, "public", "data", "official");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`讀取失敗: ${filePath}`, err.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeRows(rows, game) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const issue = String(row.issue || "").trim();
      const date = String(row.date || "").trim();

      const numbers = Array.isArray(row.numbers)
        ? [...new Set(
            row.numbers
              .map(v => Number(v))
              .filter(v => Number.isFinite(v) && v > 0)
          )].sort((a, b) => a - b)
        : [];

      if (!issue || !numbers.length) return null;

      const base = { issue, date, numbers };

      if (game === "lotto649") {
        const special = Number(row.special);
        if (Number.isFinite(special) && special >= 1 && special <= 49) {
          base.special = special;
        }
      }

      if (game === "superlotto638") {
        const zone2 = Number(row.zone2 ?? row.second ?? row.special);
        if (Number.isFinite(zone2) && zone2 >= 1 && zone2 <= 8) {
          base.zone2 = zone2;
        }
      }

      return base;
    })
    .filter(Boolean);
}

function dedupeRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [
      row.issue,
      row.date,
      row.numbers.join("-"),
      row.special ?? "",
      row.zone2 ?? ""
    ].join("|");

    if (!map.has(key)) {
      map.set(key, row);
    }
  }

  return [...map.values()];
}

function sortDesc(rows) {
  return [...rows].sort((a, b) => {
    const an = Number(String(a.issue).replace(/\D/g, ""));
    const bn = Number(String(b.issue).replace(/\D/g, ""));

    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) {
      return bn - an;
    }

    return String(b.issue).localeCompare(String(a.issue));
  });
}

function latestFive(rows) {
  return sortDesc(rows).slice(0, 5);
}

function syncFile(fileName) {
  const src = path.join(DATA_DIR, fileName);
  const dest = path.join(PUBLIC_DIR, fileName);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`📁 同步: ${fileName}`);
  }
}

function main() {
  ensureDir(DATA_DIR);
  ensureDir(PUBLIC_DIR);

  const bingo = sortDesc(dedupeRows(normalizeRows(readJsonSafe(path.join(DATA_DIR, "bingo.json")), "bingo")));
  const lotto649 = sortDesc(dedupeRows(normalizeRows(readJsonSafe(path.join(DATA_DIR, "lotto649.json")), "lotto649")));
  const superlotto638 = sortDesc(dedupeRows(normalizeRows(readJsonSafe(path.join(DATA_DIR, "superlotto638.json")), "superlotto638")));
  const dailycash = sortDesc(dedupeRows(normalizeRows(readJsonSafe(path.join(DATA_DIR, "dailycash.json")), "dailycash")));

  writeJson(path.join(DATA_DIR, "bingo.json"), bingo);
  writeJson(path.join(DATA_DIR, "lotto649.json"), lotto649);
  writeJson(path.join(DATA_DIR, "superlotto638.json"), superlotto638);
  writeJson(path.join(DATA_DIR, "dailycash.json"), dailycash);

  const latest = {
    version: "V74.2",
    updatedAt: new Date().toISOString(),
    games: {
      bingo: latestFive(bingo),
      lotto649: latestFive(lotto649),
      superlotto638: latestFive(superlotto638),
      dailycash: latestFive(dailycash)
    }
  };

  writeJson(path.join(DATA_DIR, "latest.json"), latest);

  syncFile("bingo.json");
  syncFile("lotto649.json");
  syncFile("superlotto638.json");
  syncFile("dailycash.json");
  syncFile("latest.json");

  console.log("✅ update_official 完成");
  console.log("bingo latest:", latest.games.bingo.length);
  console.log("lotto649 latest:", latest.games.lotto649.length);
  console.log("superlotto638 latest:", latest.games.superlotto638.length);
  console.log("dailycash latest:", latest.games.dailycash.length);
}

main();