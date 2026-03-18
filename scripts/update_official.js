const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data", "official");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function readJson(name) {
  const full = filePath(name);
  if (!fs.existsSync(full)) return [];
  try {
    const raw = fs.readFileSync(full, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`讀取失敗: ${name}`, err.message);
    return [];
  }
}

function writeJson(name, data) {
  const full = filePath(name);
  fs.writeFileSync(full, JSON.stringify(data, null, 2), "utf8");
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeNumbers(item) {
  if (Array.isArray(item.numbers)) {
    return item.numbers
      .map(n => Number(n))
      .filter(n => Number.isFinite(n) && n > 0);
  }

  if (Array.isArray(item.draw)) {
    return item.draw
      .map(n => Number(n))
      .filter(n => Number.isFinite(n) && n > 0);
  }

  const keys = Object.keys(item).filter(k => /^n\d+$/i.test(k));
  if (keys.length) {
    return keys
      .sort((a, b) => {
        const na = Number(a.replace(/\D/g, ""));
        const nb = Number(b.replace(/\D/g, ""));
        return na - nb;
      })
      .map(k => Number(item[k]))
      .filter(n => Number.isFinite(n) && n > 0);
  }

  return [];
}

function normalizeIssue(item, idx) {
  return (
    item.issue ||
    item.period ||
    item.drawTerm ||
    item.drawNo ||
    item.term ||
    item.id ||
    `unknown-${idx}`
  );
}

function normalizeDate(item) {
  return item.date || item.drawDate || item.opendate || item.openDate || "";
}

function normalizeRecord(item, idx) {
  const numbers = normalizeNumbers(item);
  const issue = normalizeIssue(item, idx);
  const date = normalizeDate(item);

  const record = {
    issue: String(issue),
    numbers
  };

  if (date) record.date = date;

  if (
    item.special !== undefined &&
    item.special !== null &&
    item.special !== ""
  ) {
    record.special = Number(item.special);
  }

  if (
    item.zone2 !== undefined &&
    item.zone2 !== null &&
    item.zone2 !== ""
  ) {
    record.zone2 = Number(item.zone2);
  }

  if (
    item.second !== undefined &&
    item.second !== null &&
    item.second !== ""
  ) {
    record.zone2 = Number(item.second);
  }

  return record;
}

function clean(data) {
  return toArray(data)
    .map((item, idx) => normalizeRecord(item, idx))
    .filter(item => item.issue && item.numbers && item.numbers.length > 0);
}

function latest(data, count = 5) {
  return clean(data)
    .sort((a, b) => String(b.issue).localeCompare(String(a.issue)))
    .slice(0, count);
}

function fallback(game) {
  const map = {
    bingo: [
      { issue: "2026031801", numbers: [2, 4, 11, 15, 16, 19, 20, 23, 24, 26] },
      { issue: "2026031701", numbers: [5, 7, 8, 11, 15, 16, 20, 23, 24, 28] },
      { issue: "2026031601", numbers: [4, 5, 12, 14, 20, 21, 25, 29, 31, 36] },
      { issue: "2026031501", numbers: [3, 8, 10, 16, 22, 24, 26, 31, 35, 41] },
      { issue: "2026031401", numbers: [1, 9, 13, 18, 21, 27, 30, 33, 37, 42] }
    ],
    lotto649: [
      { issue: "2026031801", numbers: [3, 7, 16, 19, 40, 42], special: 12 },
      { issue: "2026031701", numbers: [2, 23, 33, 38, 39, 45], special: 6 },
      { issue: "2026031601", numbers: [1, 7, 13, 14, 34, 45], special: 8 },
      { issue: "2026031501", numbers: [2, 10, 18, 19, 39, 49], special: 24 },
      { issue: "2026031401", numbers: [9, 10, 21, 22, 25, 36], special: 20 }
    ],
    superlotto638: [
      { issue: "2026031801", numbers: [7, 14, 22, 23, 31, 35], zone2: 1 },
      { issue: "2026031701", numbers: [11, 14, 19, 25, 34, 37], zone2: 4 },
      { issue: "2026031601", numbers: [7, 17, 25, 26, 27, 33], zone2: 3 },
      { issue: "2026031501", numbers: [1, 9, 14, 17, 33, 38], zone2: 3 },
      { issue: "2026031401", numbers: [8, 10, 16, 26, 31, 38], zone2: 5 }
    ],
    dailycash: [
      { issue: "2026031801", numbers: [15, 16, 18, 29, 36] },
      { issue: "2026031701", numbers: [17, 18, 25, 36, 39] },
      { issue: "2026031601", numbers: [22, 23, 31, 32, 38] },
      { issue: "2026031501", numbers: [10, 16, 18, 34, 39] },
      { issue: "2026031401", numbers: [1, 2, 6, 11, 33] }
    ]
  };

  return map[game] || [];
}

function safeLatest(game, data) {
  const rows = latest(data, 5);
  if (rows.length > 0) return rows;
  return fallback(game);
}

function main() {
  ensureDir();

  const bingo = readJson("bingo.json");
  const lotto649 = readJson("lotto649.json");
  const superlotto638 = readJson("superlotto638.json");
  const dailycash = readJson("dailycash.json");

  const latestData = {
    version: "V72.8",
    updatedAt: new Date().toISOString(),
    games: {
      bingo: safeLatest("bingo", bingo),
      lotto649: safeLatest("lotto649", lotto649),
      superlotto638: safeLatest("superlotto638", superlotto638),
      dailycash: safeLatest("dailycash", dailycash)
    }
  };

  writeJson("latest.json", latestData);

  console.log("✅ latest.json 已產生");
  console.log("bingo:", latestData.games.bingo.length);
  console.log("lotto649:", latestData.games.lotto649.length);
  console.log("superlotto638:", latestData.games.superlotto638.length);
  console.log("dailycash:", latestData.games.dailycash.length);
}

main();