const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const RAW_DIR = path.join(DOCS_DIR, "raw_data");
const OUT_FILE = path.join(DOCS_DIR, "latest.json");
const OFFICIAL_LATEST_FILE = path.join(ROOT, "official_latest.json");

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
  if (direct) return normalizeDateTime(String(direct));

  const raw = row.__raw || [];
  const candidate = raw.find(v => /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(String(v)));
  return candidate ? normalizeDateTime(String(candidate)) : "";
}

function inferSpecial(row, aliases, min, max) {
  const raw = firstMatchValue(row, aliases);
  const num = Number(raw);
  if (Number.isFinite(num) && num >= min && num <= max) return num;
  return null;
}

function normalizeDateTime(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return raw;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")} ${String(m[4] || "00").padStart(2, "0")}:${String(m[5] || "00").padStart(2, "0")}`;
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
        source: "history-csv"
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
        source: "history-csv"
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
        source: "history-csv"
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
        source: "history-csv"
      };
    }

    return null;
  }).filter(Boolean);

  return normalized
    .filter(item => item.period || item.drawDate || (item.numbers && item.numbers.length))
    .filter(item => item.numbers.length >= Math.min(cfg.mainCount, 3));
}

function parseStableTime(value) {
  if (!value) return 0;
  const raw = String(value).trim().replace(" ", "T");
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function sortDrawsDesc(draws) {
  return [...draws].sort((a, b) => {
    const ta = parseStableTime(a.drawDate || "");
    const tb = parseStableTime(b.drawDate || "");
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

function readOfficialLatest() {
  if (!fs.existsSync(OFFICIAL_LATEST_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(OFFICIAL_LATEST_FILE, "utf8"));
  } catch {
    return {};
  }
}

function normalizeOfficialDraw(gameKey, draw) {
  if (!draw || typeof draw !== "object") return null;

  const cfg = GAME_CONFIG[gameKey];
  if (!cfg) return null;

  const normalized = {
    period: String(draw.period || "").trim(),
    drawDate: normalizeDateTime(draw.drawDate || draw.lotteryDate || ""),
    redeemableDate: normalizeDateTime(draw.redeemableDate || ""),
    numbers: uniqSorted((draw.numbers || []).map(Number).filter(n => Number.isFinite(n) && n >= cfg.min && n <= cfg.max)),
    orderNumbers: Array.isArray(draw.orderNumbers)
      ? draw.orderNumbers.map(Number).filter(Number.isFinite)
      : [],
    specialNumber: draw.specialNumber == null ? null : Number(draw.specialNumber),
    source: draw.source || "official-api"
  };

  if (!normalized.orderNumbers.length) {
    normalized.orderNumbers = [...normalized.numbers];
  }

  if (gameKey === "daily539") normalized.specialNumber = null;
  if (!normalized.period && !normalized.drawDate && !normalized.numbers.length) return null;

  return normalized;
}

function mergeLatestIntoHistory(historyDraws, latestDraw) {
  if (!latestDraw) return sortDrawsDesc(dedupeDraws(historyDraws));
  return sortDrawsDesc(dedupeDraws([latestDraw, ...historyDraws]));
}

function buildGamePayload(gameKey, historyDraws, officialLatestMap) {
  const sortedHistory = sortDrawsDesc(dedupeDraws(historyDraws));
  const officialLatest = normalizeOfficialDraw(gameKey, officialLatestMap?.[gameKey] || null);
  const merged = mergeLatestIntoHistory(sortedHistory, officialLatest);
  const latest = officialLatest || merged[0] || null;

  return {
    latestOfficial: officialLatest || merged[0] || null,
    latest: latest,
    recentOfficial: officialLatest ? mergeLatestIntoHistory(sortedHistory.slice(0, 20), officialLatest).slice(0, 5) : merged.slice(0, 5),
    recent: merged.slice(0, 5),
    history: merged.slice(0, 20)
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
  const officialLatest = readOfficialLatest();

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "official-api",
    bingo: buildGamePayload("bingo", bingoDraws, officialLatest),
    daily539: buildGamePayload("daily539", daily539Draws, officialLatest),
    lotto649: buildGamePayload("lotto649", lotto649Draws, officialLatest),
    superLotto638: buildGamePayload("superLotto638", superLotto638Draws, officialLatest)
  };

  payload.officialLatest = {
    bingo: payload.bingo.latestOfficial,
    daily539: payload.daily539.latestOfficial,
    lotto649: payload.lotto649.latestOfficial,
    superLotto638: payload.superLotto638.latestOfficial
  };

  payload.recentOfficial = {
    bingo: payload.bingo.recentOfficial,
    daily539: payload.daily539.recentOfficial,
    lotto649: payload.lotto649.recentOfficial,
    superLotto638: payload.superLotto638.recentOfficial
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`✅ latest.json 已產生：${OUT_FILE}`);
}

main();