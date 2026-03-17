/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OFFICIAL_DIR = path.join(ROOT, "data", "official");
const RAW_DIR = path.join(ROOT, "raw_data");

const GAME_CONFIG = {
  lotto649: {
    aliases: ["lotto649", "649", "lotto", "biglotto", "lotto_649"]
  },
  superlotto638: {
    aliases: ["superlotto638", "638", "power", "powerlotto", "super_lotto_638"]
  },
  dailycash: {
    aliases: ["dailycash", "539", "cash539", "daily_cash"]
  },
  bingo: {
    aliases: ["bingo", "bingobingo", "bingo_bingo"]
  }
};

const REMOTE_SOURCES = {
  lotto649: [],
  superlotto638: [],
  dailycash: [],
  bingo: []
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

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

function uniq(arr) {
  return [...new Set(arr)];
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeIssue(v) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[^\dA-Za-z]/g, "");
}

function normalizeDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  return s;
}

function normalizeNumbers(arr, min, max, takeCount) {
  if (!Array.isArray(arr)) return [];
  return uniq(
    arr
      .map(v => toNum(v))
      .filter(v => Number.isInteger(v) && v >= min && v <= max)
  )
    .sort((a, b) => a - b)
    .slice(0, takeCount);
}

function sortByIssueDesc(draws) {
  return [...draws].sort((a, b) => {
    const ia = String(a.issue || "");
    const ib = String(b.issue || "");
    if (ia !== ib) return ib.localeCompare(ia, "en", { numeric: true });
    return String(b.drawDate || "").localeCompare(String(a.drawDate || ""));
  });
}

function dedupeDraws(draws) {
  const seen = new Set();
  const out = [];
  for (const draw of draws) {
    const key = JSON.stringify(draw);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(draw);
    }
  }
  return sortByIssueDesc(out);
}

function normalizeDraw(gameKey, item) {
  if (!item || typeof item !== "object") return null;

  const issue = normalizeIssue(item.issue || item.period || item.id || item.drawNo);
  const drawDate = normalizeDate(item.drawDate || item.date || item.draw_date || item.opendate);

  if (gameKey === "bingo") {
    const numbers = normalizeNumbers(
      item.numbers || item.no || item.drawNumbers || item.main,
      1,
      80,
      20
    );
    if (!issue || numbers.length < 10) return null;
    return { game: "bingo", issue, drawDate, numbers };
  }

  if (gameKey === "dailycash") {
    const numbers = normalizeNumbers(
      item.numbers || item.no || item.drawNumbers || item.main,
      1,
      39,
      5
    );
    if (!issue || numbers.length < 5) return null;
    return { game: "dailycash", issue, drawDate, numbers };
  }

  if (gameKey === "lotto649") {
    const numbers = normalizeNumbers(
      item.numbers || item.no || item.drawNumbers || item.main,
      1,
      49,
      6
    );

    const specialVal = toNum(item.special ?? item.specialNumber ?? item.bonus ?? item.extra);
    const special = Number.isInteger(specialVal) && specialVal >= 1 && specialVal <= 49 ? specialVal : null;

    if (!issue || numbers.length < 6) return null;
    return { game: "lotto649", issue, drawDate, numbers, special };
  }

  if (gameKey === "superlotto638") {
    const numbers1 = normalizeNumbers(
      item.numbers1 || item.numbers || item.no || item.main || item.drawNumbers,
      1,
      38,
      6
    );

    let zone2Raw = item.numbers2 ?? item.secondZone ?? item.special ?? item.extra;
    let numbers2 = [];

    if (Array.isArray(zone2Raw)) {
      numbers2 = normalizeNumbers(zone2Raw, 1, 8, 1);
    } else {
      const one = toNum(zone2Raw);
      if (Number.isInteger(one) && one >= 1 && one <= 8) numbers2 = [one];
    }

    if (!issue || numbers1.length < 6) return null;
    return {
      game: "superlotto638",
      issue,
      drawDate,
      numbers1,
      numbers2
    };
  }

  return null;
}

function normalizeArray(gameKey, data) {
  if (!Array.isArray(data)) return [];
  return dedupeDraws(data.map(item => normalizeDraw(gameKey, item)).filter(Boolean));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function tryRemote(gameKey) {
  for (const url of REMOTE_SOURCES[gameKey] || []) {
    try {
      const data = await fetchJson(url);
      const normalized = normalizeArray(gameKey, data);
      if (normalized.length > 0) {
        return { ok: true, source: `remote:${url}`, data: normalized };
      }
    } catch {
      // ignore
    }
  }
  return { ok: false, source: null, data: [] };
}

function candidateFiles(gameKey) {
  const aliases = GAME_CONFIG[gameKey].aliases;
  const files = [];

  for (const alias of aliases) {
    files.push(path.join(RAW_DIR, `${alias}.json`));
  }

  files.push(path.join(ROOT, "data", `${gameKey}.json`));
  files.push(path.join(OFFICIAL_DIR, `${gameKey}.json`));

  return uniq(files);
}

function tryLocal(gameKey) {
  for (const file of candidateFiles(gameKey)) {
    if (!exists(file)) continue;
    const data = readJson(file);
    const normalized = normalizeArray(gameKey, data);
    if (normalized.length > 0) {
      return {
        ok: true,
        source: `local:${path.relative(ROOT, file).replace(/\\/g, "/")}`,
        data: normalized
      };
    }
  }
  return { ok: false, source: null, data: [] };
}

async function resolveGame(gameKey) {
  const remote = await tryRemote(gameKey);
  if (remote.ok) return remote;

  const local = tryLocal(gameKey);
  if (local.ok) return local;

  return { ok: false, source: "empty", data: [] };
}

async function main() {
  ensureDir(OFFICIAL_DIR);

  const metaGames = {};
  const errors = [];
  let hasAnyData = false;

  for (const gameKey of Object.keys(GAME_CONFIG)) {
    try {
      const result = await resolveGame(gameKey);
      const outFile = path.join(OFFICIAL_DIR, `${gameKey}.json`);
      writeJson(outFile, result.data);

      metaGames[gameKey] = {
        count: result.data.length,
        source: result.source
      };

      if (result.data.length > 0) {
        hasAnyData = true;
        console.log(`[OK] ${gameKey}: ${result.data.length} from ${result.source}`);
      } else {
        errors.push({ gameKey, error: "no valid data from remote/local sources" });
        console.log(`[WARN] ${gameKey}: no valid data`);
      }
    } catch (err) {
      errors.push({ gameKey, error: err.message });
      const outFile = path.join(OFFICIAL_DIR, `${gameKey}.json`);
      if (!exists(outFile)) writeJson(outFile, []);
      metaGames[gameKey] = { count: 0, source: "error" };
      console.log(`[FAIL] ${gameKey}: ${err.message}`);
    }
  }

  const meta = {
    version: "V66.4",
    mode: "stable-fallback-weighted",
    sourceName: "遠端來源 + raw_data 本地備援 + 舊資料保留",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    games: metaGames,
    errors
  };

  writeJson(path.join(OFFICIAL_DIR, "meta.json"), meta);

  if (!hasAnyData) {
    console.log("[WARN] all games empty, but workflow kept stable output");
  } else {
    console.log("[DONE] V66.4 data ready");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
