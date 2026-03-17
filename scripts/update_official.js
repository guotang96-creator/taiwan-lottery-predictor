/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OFFICIAL_DIR = path.join(ROOT, "data", "official");

function exists(file) {
  return fs.existsSync(file);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function uniq(arr) {
  return [...new Set(arr)];
}

function sortNumbers(arr) {
  return [...arr].sort((a, b) => a - b);
}

function normalizeDate(value) {
  if (!value) return "";
  const s = String(value).trim();
  const m = s.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  return s;
}

function looksArithmetic(numbers) {
  if (!Array.isArray(numbers) || numbers.length < 4) return false;
  const diffs = [];
  for (let i = 1; i < numbers.length; i += 1) {
    diffs.push(numbers[i] - numbers[i - 1]);
  }
  return diffs.every(d => d === diffs[0]) && diffs[0] > 0 && diffs[0] <= 5;
}

function issueLooksFake(gameKey, issue) {
  const s = String(issue || "");
  if (!s) return false;

  if (gameKey === "dailycash" && /^539\d{4}$/.test(s)) return true;
  if (gameKey === "lotto649" && /^649\d{4}$/.test(s)) return true;
  if (gameKey === "superlotto638" && /^638\d{4}$/.test(s)) return true;
  if (gameKey === "bingo" && /^\d{6}$/.test(s)) return true;

  return false;
}

function rowSignature(gameKey, row) {
  if (gameKey === "superlotto638") {
    return (row.numbers1 || []).join(",");
  }
  return (row.numbers || []).join(",");
}

function isClearlyFake(gameKey, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;

  const sample = rows.slice(0, Math.min(20, rows.length));

  let arithmeticCount = 0;
  let fakeIssueCount = 0;
  let progressiveShiftCount = 0;

  for (let i = 0; i < sample.length; i += 1) {
    const row = sample[i];
    const nums = gameKey === "superlotto638" ? (row.numbers1 || []) : (row.numbers || []);

    if (looksArithmetic(nums)) arithmeticCount += 1;
    if (issueLooksFake(gameKey, row.issue)) fakeIssueCount += 1;

    if (i > 0) {
      const prev = gameKey === "superlotto638"
        ? (sample[i - 1].numbers1 || [])
        : (sample[i - 1].numbers || []);

      if (prev.length === nums.length && prev.length >= 4) {
        const deltas = nums.map((n, idx) => n - prev[idx]);
        const sameDelta = deltas.every(d => d === deltas[0]);
        if (sameDelta && Math.abs(deltas[0]) > 0 && Math.abs(deltas[0]) <= 5) {
          progressiveShiftCount += 1;
        }
      }
    }
  }

  const arithmeticRatio = arithmeticCount / sample.length;
  const fakeIssueRatio = fakeIssueCount / sample.length;
  const shiftRatio = sample.length > 1 ? progressiveShiftCount / (sample.length - 1) : 0;

  return (
    arithmeticRatio >= 0.6 ||
    fakeIssueRatio >= 0.8 ||
    shiftRatio >= 0.6
  );
}

  if (gameKey === "dailycash") {
    const numbers = Array.isArray(row.numbers)
      ? sortNumbers(uniq(row.numbers.filter(n => Number.isInteger(n) && n >= 1 && n <= 39))).slice(0, 5)
      : [];
    if (!issue || numbers.length < 5) return null;
    return { game: "dailycash", issue, drawDate, numbers };
  }

  if (gameKey === "lotto649") {
    const numbers = Array.isArray(row.numbers)
      ? sortNumbers(uniq(row.numbers.filter(n => Number.isInteger(n) && n >= 1 && n <= 49))).slice(0, 6)
      : [];
    const special = Number.isInteger(row.special) && row.special >= 1 && row.special <= 49 ? row.special : null;
    if (!issue || numbers.length < 6) return null;
    return { game: "lotto649", issue, drawDate, numbers, special };
  }

  if (gameKey === "superlotto638") {
    const numbers1 = Array.isArray(row.numbers1)
      ? sortNumbers(uniq(row.numbers1.filter(n => Number.isInteger(n) && n >= 1 && n <= 38))).slice(0, 6)
      : [];

    let numbers2 = [];
    if (Array.isArray(row.numbers2)) {
      numbers2 = row.numbers2.filter(n => Number.isInteger(n) && n >= 1 && n <= 8).slice(0, 1);
    } else if (Number.isInteger(row.numbers2) && row.numbers2 >= 1 && row.numbers2 <= 8) {
      numbers2 = [row.numbers2];
    }

    if (!issue || numbers1.length < 6) return null;
    return { game: "superlotto638", issue, drawDate, numbers1, numbers2 };
  }

  return null;
}

function isClearlyFake(gameKey, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const sample = rows.slice(0, Math.min(12, rows.length));

  let fakeCount = 0;
  for (const row of sample) {
    if (gameKey === "superlotto638") {
      if (looksFakeSequence(row.numbers1 || [])) fakeCount += 1;
    } else {
      if (looksFakeSequence(row.numbers || [])) fakeCount += 1;
    }
  }
  return fakeCount >= Math.ceil(sample.length * 0.7);
}

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const db = String(b.drawDate || "");
    const da = String(a.drawDate || "");
    if (db !== da) return db.localeCompare(da);
    return String(b.issue || "").localeCompare(String(a.issue || ""), "en", { numeric: true });
  });
}

function validateGameRows(gameKey, rows) {
  if (!Array.isArray(rows)) return { ok: false, reason: "not array", rows: [] };

  const normalized = rows.map(r => normalizeDraw(gameKey, r)).filter(Boolean);
  const deduped = dedupeRows(normalized);
  const sorted = sortRows(deduped);

  if (sorted.length === 0) return { ok: false, reason: "empty after normalize", rows: [] };
  if (isClearlyFake(gameKey, sorted)) return { ok: false, reason: "looks like generated/fake pattern", rows: [] };

  return { ok: true, reason: "validated", rows: sorted };
}

function sanitizeOne(gameKey) {
  const file = path.join(OFFICIAL_DIR, `${gameKey}.json`);
  if (checked.ok) {
  writeJson(file, checked.rows);
  return { count: checked.rows.length, status: checked.reason };
}

writeJson(file, []);
return { count: 0, status: checked.reason };;
  }

  const raw = readJson(file);
  const checked = validateGameRows(gameKey, raw);

  if (checked.ok) {
    writeJson(file, checked.rows);
    return { count: checked.rows.length, status: checked.reason };
  }

  // V67: 假資料或無效資料直接清空，不再保留污染資料
  writeJson(file, []);
  return { count: 0, status: checked.reason };
}

function main() {
  ensureDir(OFFICIAL_DIR);

  const games = {
    bingo: sanitizeOne("bingo"),
    lotto649: sanitizeOne("lotto649"),
    superlotto638: sanitizeOne("superlotto638"),
    dailycash: sanitizeOne("dailycash")
  };

  const meta = {
    version: "V67",
    mode: "official-only-sanitized",
    sourceName: "data/official 真資料安全展示模式",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    games
  };

  writeJson(path.join(OFFICIAL_DIR, "meta.json"), meta);
  console.log("[DONE] V67 official sanitize complete");
}

main();
