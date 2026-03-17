/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OFFICIAL_DIR = path.join(ROOT, "data", "official");
const RAW_DIR = path.join(ROOT, "raw_data");

const GAME_CONFIG = {
  lotto649: {
    aliases: ["lotto649", "649", "biglotto", "lotto_649"],
    minCount: 6
  },
  superlotto638: {
    aliases: ["superlotto638", "638", "power", "powerlotto", "super_lotto_638"],
    minCount: 6
  },
  dailycash: {
    aliases: ["dailycash", "539", "daily_cash", "cash539"],
    minCount: 5
  },
  bingo: {
    aliases: ["bingo", "bingobingo", "bingo_bingo"],
    minCount: 10
  }
};

// 可自行再加來源；有抓到且格式正確才會覆蓋
const REMOTE_SOURCES = {
  lotto649: [
    "https://api.taiwanlottery.io/lotto649"
  ],
  superlotto638: [
    "https://api.taiwanlottery.io/superlotto638"
  ],
  dailycash: [
    "https://api.taiwanlottery.io/dailycash"
  ],
  bingo: [
    "https://api.taiwanlottery.io/bingo"
  ]
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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDateString(v) {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  return s;
}

function sortDescByIssue(arr) {
  return [...arr].sort((a, b) => {
    const ia = Number(a.issue || 0);
    const ib = Number(b.issue || 0);
    if (ib !== ia) return ib - ia;
    return String(b.drawDate || "").localeCompare(String(a.drawDate || ""));
  });
}

function dedupeDraws(draws, gameKey) {
  const seen = new Set();
  const out = [];

  for (const draw of draws) {
    const key = JSON.stringify({
      issue: draw.issue,
      drawDate: draw.drawDate,
      numbers: draw.numbers,
      numbers1: draw.numbers1,
      numbers2: draw.numbers2,
      special: draw.special,
      gameKey
    });

    if (!seen.has(key)) {
      seen.add(key);
      out.push(draw);
    }
  }

  return sortDescByIssue(out);
}

function normalizeNumbers(arr, min, max) {
  if (!Array.isArray(arr)) return [];
  const cleaned = arr
    .map(v => num(v))
    .filter(v => Number.isInteger(v) && v >= min && v <= max);

  return uniq(cleaned).sort((a, b) => a - b);
}

function normalizeIssue(v) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[^\d]/g, "");
}

function normalizeDraw(gameKey, item) {
  if (!item || typeof item !== "object") return null;

  const issue = normalizeIssue(item.issue || item.period || item.drawNo || item.draw || item.id);
  const drawDate = toDateString(item.drawDate || item.date || item.draw_date || item.opendate);

  if (gameKey === "lotto649") {
    const numbers = normalizeNumbers(
      item.numbers || item.no || item.main || item.drawNumbers,
      1,
      49
    ).slice(0, 6);

    const special = num(item.special ?? item.specialNumber ?? item.bonus ?? item.extra);

    if (!issue || numbers.length < 6) return null;
    return { game: gameKey, issue, drawDate, numbers, special: special || null };
  }

  if (gameKey === "superlotto638") {
    const numbers1 = normalizeNumbers(
      item.numbers1 || item.numbers || item.main || item.drawNumbers,
      1,
      38
    ).slice(0, 6);

    const numbers2 = num(item.numbers2 ?? item.special ?? item.secondZone ?? item.extra);

    if (!issue || numbers1.length < 6) return null;
    return { game: gameKey, issue, drawDate, numbers1, numbers2: numbers2 || null };
  }

  if (gameKey === "dailycash") {
    const numbers = normalizeNumbers(
      item.numbers || item.no || item.main || item.drawNumbers,
      1,
      39
    ).slice(0, 5);

    if (!issue || numbers.length < 5) return null;
    return { game: gameKey, issue, drawDate, numbers };
  }

  if (gameKey === "bingo") {
    const numbers = normalizeNumbers(
      item.numbers || item.no || item.main || item.drawNumbers,
      1,
      80
    ).slice(0, 20);

    if (!issue || numbers.length < 10) return null;
    return { game: gameKey, issue, drawDate, numbers };
  }

  return null;
}

function normalizeArray(gameKey, data) {
  if (!Array.isArray(data)) return [];
  return dedupeDraws(
    data.map(item => normalizeDraw(gameKey, item)).filter(Boolean),
    gameKey
  );
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

async function tryRemote(gameKey) {
  const urls = REMOTE_SOURCES[gameKey] || [];

  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      const normalized = normalizeArray(gameKey, data);
      if (normalized.length > 0) {
        return {
          ok: true,
          source: `remote:${url}`,
          data: normalized
        };
      }
    } catch (err) {
      // continue
    }
  }

  return {
    ok: false,
    source: null,
    data: []
  };
}

function candidateFiles(gameKey) {
  const aliases = GAME_CONFIG[gameKey].aliases;
  const names = uniq(
    aliases.flatMap(name => [
      `${name}.json`,
      `${name}.js`,
      `${name}.txt`
    ])
  );

  return [
    ...names.map(name => path.join(RAW_DIR, name)),
    path.join(ROOT, "data", `${gameKey}.json`),
    path.join(OFFICIAL_DIR, `${gameKey}.json`)
  ];
}

function tryLocal(gameKey) {
  for (const file of candidateFiles(gameKey)) {
    if (!exists(file)) continue;

    const parsed = readJson(file);
    const normalized = normalizeArray(gameKey, parsed);

    if (normalized.length > 0) {
      return {
        ok: true,
        source: `local:${path.relative(ROOT, file).replace(/\\/g, "/")}`,
        data: normalized
      };
    }
  }

  return {
    ok: false,
    source: null,
    data: []
  };
}

async function resolveGame(gameKey) {
  const remote = await tryRemote(gameKey);
  if (remote.ok) return remote;

  const local = tryLocal(gameKey);
  if (local.ok) return local;

  return {
    ok: false,
    source: "empty",
    data: []
  };
}

async function main() {
  ensureDir(OFFICIAL_DIR);

  const summary = {};
  const errors = [];
  let hasAnyData = false;

  for (const gameKey of Object.keys(GAME_CONFIG)) {
    try {
      const result = await resolveGame(gameKey);
      const outFile = path.join(OFFICIAL_DIR, `${gameKey}.json`);

      writeJson(outFile, result.data);

      summary[gameKey] = {
        count: result.data.length,
        source: result.source
      };

      if (result.data.length > 0) {
        hasAnyData = true;
        console.log(`[OK] ${gameKey}: ${result.data.length} from ${result.source}`);
      } else {
        errors.push({
          gameKey,
          error: "no valid data from remote/local sources"
        });
        console.log(`[WARN] ${gameKey}: no valid data`);
      }
    } catch (err) {
      errors.push({
        gameKey,
        error: err.message
      });

      const outFile = path.join(OFFICIAL_DIR, `${gameKey}.json`);
      if (!exists(outFile)) {
        writeJson(outFile, []);
      }

      summary[gameKey] = {
        count: 0,
        source: "error"
      };

      console.log(`[FAIL] ${gameKey}: ${err.message}`);
    }
  }

  const meta = {
    version: "V66.3",
    mode: "stable-fallback",
    sourceName: "遠端來源 + raw_data 本地備援 + 舊資料保留",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    games: summary,
    errors
  };

  writeJson(path.join(OFFICIAL_DIR, "meta.json"), meta);

  if (!hasAnyData) {
    console.log("[WARN] all games empty, but workflow kept stable output");
  } else {
    console.log("[DONE] V66.3 data ready");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
