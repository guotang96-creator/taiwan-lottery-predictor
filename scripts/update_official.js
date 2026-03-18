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

function sortDesc(rows) {
  if (!Array.isArray(rows)) return [];

  return [...rows].sort((a, b) => {
    const ai = Number(String(a?.issue || "").replace(/\D/g, ""));
    const bi = Number(String(b?.issue || "").replace(/\D/g, ""));

    if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) {
      return bi - ai;
    }

    const ad = String(a?.date || "");
    const bd = String(b?.date || "");
    if (ad !== bd) return bd.localeCompare(ad);

    return String(b?.issue || "").localeCompare(String(a?.issue || ""));
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

  const bingo = sortDesc(readJsonSafe(path.join(DATA_DIR, "bingo.json"), []));
  const lotto649 = sortDesc(readJsonSafe(path.join(DATA_DIR, "lotto649.json"), []));
  const superlotto638 = sortDesc(readJsonSafe(path.join(DATA_DIR, "superlotto638.json"), []));
  const dailycash = sortDesc(readJsonSafe(path.join(DATA_DIR, "dailycash.json"), []));

  const latest = {
    version: "V74.3",
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
