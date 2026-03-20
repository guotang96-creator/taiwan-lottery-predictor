const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const RAW_DIR = path.join(DOCS_DIR, "raw_data");
const OUT_FILE = path.join(DOCS_DIR, "latest.json");

const FILES = {
  bingo: path.join(RAW_DIR, "bingo.csv"),
  daily539: path.join(RAW_DIR, "539.csv"),
  lotto649: path.join(RAW_DIR, "lotto.csv"),
  superLotto638: path.join(RAW_DIR, "power.csv")
};

const GAME_CONFIG = {
  bingo: { min: 1, max: 80, mainCount: 20, specialLabel: "超級獎號" },
  daily539: { min: 1, max: 39, mainCount: 5, specialLabel: "" },
  lotto649: { min: 1, max: 49, mainCount: 6, specialLabel: "特別號" },
  superLotto638: { min: 1, max: 38, mainCount: 6, specialLabel: "第二區" }
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  out.push(current);
  return out.map(v => v.trim());
}

function parseCsv(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(line => line.trim() !== "");

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    row.__raw = cols;
    rows.push(row);
  }

  return rows;
}

function uniqSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a - b);
}

function numericArray(arr, min, max) {
  if (!Array.isArray(arr)) return [];
  return uniqSorted(
    arr.map(v => Number(v)).filter(v => Number.isFinite(v) && v >= min && v <= max)
  );
}

function firstMatchValue(obj, aliases) {
  const keys = Object.keys(obj);

  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    const key = keys.find(k => k.toLowerCase() === aliasLower);
    if (key && obj[key] !== "") return obj[key];
  }

  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    const key = keys.find(k => k.toLowerCase().includes(aliasLower));
    if (key && obj[key] !== "") return obj[key];
  }

  return "";
}

function findSequentialNumberKeys(row) {
  const keys = Object.keys(row).filter(k => k !== "__raw");
  return keys
    .filter(k => /(^n\d+$)|(^num\d+$)|(^no\d+$)|(^ball\d+$)|(^m\d+$)/i.test(k))
    .sort((a, b) => {
      const na = Number((a.match(/\d+/) || ["0"])[0]);
      const nb = Number((b.match(/\d+/) || ["0"])[0]);
      return na - nb;
    });
}

function extractNumbersFromRow(row, min, max, desiredCount) {
  const seqKeys = findSequentialNumberKeys(row);
  if (seqKeys.length) {
    const nums = numericArray(seqKeys.map(k => row[k]), min, max);
    if (nums.length) return nums.slice(0, desiredCount);
  }

  const keys = Object.keys(row).filter(k => k !== "__raw");
  const numberKeys = keys.filter(k => /number|draw|show|open|big|ball|num|special|second/i.test(k));

  for (const key of numberKeys) {
    const raw = String(row[key] ?? "").trim();
    if (!raw) continue;

    if (raw.includes(" ") || raw.includes("-") || raw.includes("|") || raw.includes("/")) {
      const parts = raw.split(/[\s|/-]+/).filter(Boolean);
      const nums = numericArray(parts, min, max);
      if (nums.length >= Math.min(3, desiredCount)) return nums.slice(0, desiredCount);
    }
  }

  const rawValues = row.__raw || [];
  const nums = numericArray(rawValues, min, max);
  if (nums.length >= desiredCount) return nums.slice(0, desiredCount);

  return nums.slice(0, desiredCount);
}

function inferPeriod(row) {
  const direct = firstMatchValue(row, ["issue", "period", "drawterm", "term", "期別", "期數"]);
  if (direct) return String(direct);

  const raw = row.__raw || [];
  const candidate = raw.find(v => /^\d{6,}$/.test(String(v)));
  return candidate ? String(candidate) : "";
}

function inferDate(row) {
  const direct = firstMatchValue(row, ["date", "drawdate", "lotterydate", "ddate", "開獎日期", "日期"]);
  if (direct) return String(direct);

  const raw = row.__raw || [];
  const candidate = raw.find(v => /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(String(v)));
  return candidate ? String(candidate) : "";
}

function inferSpecial(row, aliases, min, max) {
  const raw = firstMatchValue(row, aliases);
  const num = Number(raw);
  if (Number.isFinite(num) && num >= min && num <= max) return num;
  return null;
}

function normalizeHistoryRows(gameKey, rows) {
  const cfg = GAME_CONFIG[gameKey];
  if (!cfg) return [];

  const normalized = rows.map(row => {
    const period = inferPeriod(row);
    const drawDate = inferDate(row);

    if (gameKey === "bingo") {
      const numbers = extractNumbersFromRow(row, cfg.min, cfg.max, 20);
      const specialNumber = inferSpecial(
        row,
        ["special", "specialnumber", "supernumber", "超級獎號"],
        1,
        80
      );

      return {
        period,
        drawDate,
        redeemableDate: "",
        numbers,
        orderNumbers: numbers.slice(),
        specialNumber,
        source: "official-api"
      };
    }

    if (gameKey === "daily539") {
      const numbers = extractNumbersFromRow(row, cfg.min, cfg.max, 5);
      return {
        period,
        drawDate,
        redeemableDate: "",
        numbers,
        orderNumbers: [],
        specialNumber: null,
        source: "official-api"
      };
    }

    if (gameKey === "lotto649") {
      let numbers = extractNumbersFromRow(row, cfg.min, cfg.max, 6);
      let specialNumber = inferSpecial(
        row,
        ["special", "specialnumber", "specialnum", "bonusnumber", "特別號"],
        1,
        49
      );

      if (specialNumber == null) {
        const seqKeys = findSequentialNumberKeys(row);
        if (seqKeys.length >= 7) {
          const specialRaw = Number(row[seqKeys[6]]);
          if (Number.isFinite(specialRaw) && specialRaw >= 1 && specialRaw <= 49) {
            specialNumber = specialRaw;
          }
        }
      }

      if (numbers.length > 6) numbers = numbers.slice(0, 6);

      return {
        period,
        drawDate,
        redeemableDate: "",
        numbers,
        orderNumbers: [],
        specialNumber,
        source: "official-api"
      };
    }

    if (gameKey === "superLotto638") {
      let numbers = extractNumbersFromRow(row, cfg.min, cfg.max, 6);
      let specialNumber = inferSpecial(
        row,
        ["second", "special", "specialnumber", "specialnum", "secondareanumber", "第二區", "第二區號碼"],
        1,
        8
      );

      if (specialNumber == null) {
        const secondRaw = Number(firstMatchValue(row, ["second"]));
        if (Number.isFinite(secondRaw) && secondRaw >= 1 && secondRaw <= 8) {
          specialNumber = secondRaw;
        }
      }

      if (numbers.length > 6) numbers = numbers.slice(0, 6);

      return {
        period,
        drawDate,
        redeemableDate: "",
        numbers,
        orderNumbers: [],
        specialNumber,
        source: "official-api"
      };
    }

    return null;
  }).filter(Boolean);

  return normalized
    .filter(item => item.period || item.drawDate || (item.numbers && item.numbers.length))
    .filter(item => item.numbers.length >= Math.min(cfg.mainCount, 3));
}

function parseStableDate(value) {
  if (!value) return { time: 0, period: 0 };

  const raw = String(value).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);

  let time = 0;
  if (m) {
    time = Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] || "0"),
      Number(m[5] || "0"),
      Number(m[6] || "0")
    );
  } else {
    const t = new Date(raw).getTime();
    time = Number.isFinite(t) ? t : 0;
  }

  return { time };
}

function sortDrawsDesc(draws) {
  return [...draws].sort((a, b) => {
    const ta = parseStableDate(a.drawDate || "").time;
    const tb = parseStableDate(b.drawDate || "").time;
    if (tb !== ta) return tb - ta;
    return Number(b.period || 0) - Number(a.period || 0);
  });
}

function dedupeDraws(draws) {
  const map = new Map();

  for (const item of draws) {
    const key = `${item.period || ""}__${item.drawDate || ""}`;
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      const oldItem = map.get(key);
      const oldLen = oldItem?.numbers?.length || 0;
      const newLen = item?.numbers?.length || 0;
      if (newLen >= oldLen) {
        map.set(key, item);
      }
    }
  }

  return [...map.values()];
}

function readGameCsv(filePath, gameKey) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(text);
  return normalizeHistoryRows(gameKey, rows);
}

function buildGamePayload(gameKey, draws) {
  const sorted = sortDrawsDesc(dedupeDraws(draws));
  return {
    latestOfficial: sorted[0] || null,
    latest: sorted[0] || null,
    recentOfficial: sorted.slice(0, 5),
    recent: sorted.slice(0, 5),
    history: sorted.slice(0, 20)
  };
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  const bingoDraws = readGameCsv(FILES.bingo, "bingo");
  const daily539Draws = readGameCsv(FILES.daily539, "daily539");
  const lotto649Draws = readGameCsv(FILES.lotto649, "lotto649");
  const superLotto638Draws = readGameCsv(FILES.superLotto638, "superLotto638");

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "official-api",
    bingo: buildGamePayload("bingo", bingoDraws),
    daily539: buildGamePayload("daily539", daily539Draws),
    lotto649: buildGamePayload("lotto649", lotto649Draws),
    superLotto638: buildGamePayload("superLotto638", superLotto638Draws),
    officialLatest: {
      bingo: sortDrawsDesc(bingoDraws)[0] || null,
      daily539: sortDrawsDesc(daily539Draws)[0] || null,
      lotto649: sortDrawsDesc(lotto649Draws)[0] || null,
      superLotto638: sortDrawsDesc(superLotto638Draws)[0] || null
    },
    recentOfficial: {
      bingo: sortDrawsDesc(bingoDraws).slice(0, 5),
      daily539: sortDrawsDesc(daily539Draws).slice(0, 5),
      lotto649: sortDrawsDesc(lotto649Draws).slice(0, 5),
      superLotto638: sortDrawsDesc(superLotto638Draws).slice(0, 5)
    }
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`✅ latest.json 已產生：${OUT_FILE}`);
}

main();