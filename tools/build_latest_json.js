const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const RAW_DIR = path.join(DOCS_DIR, "raw_data");
const OUT_FILE = path.join(DOCS_DIR, "latest.json");
const OFFICIAL_FILE = path.join(ROOT, "official_latest.json");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeReadJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn(`⚠️ JSON 讀取失敗: ${filePath}`, err.message);
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`✅ 已寫入 ${filePath}`);
}

function safeReadText(filePath, fallback = "") {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.warn(`⚠️ 文字讀取失敗: ${filePath}`, err.message);
    return fallback;
  }
}

function parseStableTime(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function uniqSorted(nums) {
  return [...new Set((nums || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((c) => String(c).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((c) => String(c).trim() !== "")) rows.push(row);

  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] != null ? String(r[idx]).trim() : "";
    });
    return obj;
  });
}

function sortDrawsDesc(draws) {
  return [...draws].sort((a, b) => {
    const pa = Number(a.period || 0);
    const pb = Number(b.period || 0);
    if (pb !== pa) return pb - pa;

    const ta = parseStableTime(a.drawDate || a.lotteryDate || a.date || 0);
    const tb = parseStableTime(b.drawDate || b.lotteryDate || b.date || 0);
    return tb - ta;
  });
}

function dedupeDraws(draws) {
  const out = [];
  const seen = new Set();

  for (const draw of sortDrawsDesc(draws)) {
    const key = `${draw.period || ""}__${draw.drawDate || ""}`;
    if (!draw.period) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(draw);
  }

  return out;
}

function pickNewerDraw(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;

  const ta = parseStableTime(a.drawDate || "");
  const tb = parseStableTime(b.drawDate || "");
  if (tb !== ta) return tb > ta ? b : a;

  const pa = Number(a.period || 0);
  const pb = Number(b.period || 0);
  return pb > pa ? b : a;
}

function mergeLatestIntoHistory(history, latest) {
  if (!latest) return dedupeDraws(history);
  return dedupeDraws([latest, ...history]);
}

function normalizeOfficialDraw(gameKey, draw) {
  if (!draw || typeof draw !== "object") return null;

  if (gameKey === "bingo") {
    return {
      period: draw.period || null,
      drawDate: draw.drawDate || draw.lotteryDate || null,
      redeemableDate: draw.redeemableDate || "",
      numbers: uniqSorted(draw.numbers || draw.drawNumberSize || draw.drawNumberAppear || []),
      orderNumbers: uniqSorted(draw.orderNumbers || []),
      specialNumber: toNum(draw.specialNumber),
      source: draw.source || "official-api"
    };
  }

  if (gameKey === "daily539") {
    return {
      period: draw.period || null,
      drawDate: draw.drawDate || draw.lotteryDate || null,
      redeemableDate: draw.redeemableDate || "",
      numbers: uniqSorted(draw.numbers || draw.drawNumberSize || []),
      orderNumbers: uniqSorted(draw.orderNumbers || []),
      specialNumber: toNum(draw.specialNumber),
      source: draw.source || "official-api"
    };
  }

  if (gameKey === "lotto649") {
    return {
      period: draw.period || null,
      drawDate: draw.drawDate || draw.lotteryDate || null,
      redeemableDate: draw.redeemableDate || "",
      numbers: uniqSorted(draw.numbers || draw.drawNumberSize || []),
      orderNumbers: uniqSorted(draw.orderNumbers || []),
      specialNumber: toNum(
        draw.specialNumber ??
        draw.specialNum ??
        draw.bonusNumber ??
        draw.superNumber
      ),
      source: draw.source || "official-api"
    };
  }

  if (gameKey === "superLotto638") {
    return {
      period: draw.period || null,
      drawDate: draw.drawDate || draw.lotteryDate || null,
      redeemableDate: draw.redeemableDate || "",
      numbers: uniqSorted(draw.numbers || draw.zone1 || draw.drawNumberSize || []),
      orderNumbers: uniqSorted(draw.orderNumbers || []),
      specialNumber: toNum(
        draw.specialNumber ??
        draw.secondAreaNumber ??
        draw.secondNumber ??
        draw.specialNum ??
        draw.bonusNumber ??
        draw.superNumber ??
        draw.zone2
      ),
      source: draw.source || "official-api"
    };
  }

  return null;
}

function normalizeHistoryRows(gameKey, rows) {
  if (!Array.isArray(rows)) return [];

  if (gameKey === "bingo") {
    return rows.map((row) => ({
      period: row.period || null,
      drawDate: row.drawDate || row.lotteryDate || row.date || null,
      redeemableDate: row.redeemableDate || "",
      numbers: uniqSorted(
        row.numbers ||
        row.drawNumberSize ||
        [
          row.n1,row.n2,row.n3,row.n4,row.n5,row.n6,row.n7,row.n8,row.n9,row.n10,
          row.n11,row.n12,row.n13,row.n14,row.n15,row.n16,row.n17,row.n18,row.n19,row.n20
        ]
      ),
      orderNumbers: uniqSorted(row.orderNumbers || []),
      specialNumber: toNum(row.specialNumber),
      source: row.source || "csv"
    })).filter((r) => r.period && r.numbers.length);
  }

  if (gameKey === "daily539") {
    return rows.map((row) => ({
      period: row.period || null,
      drawDate: row.drawDate || row.lotteryDate || row.date || null,
      redeemableDate: row.redeemableDate || "",
      numbers: uniqSorted(
        row.numbers || [row.n1,row.n2,row.n3,row.n4,row.n5]
      ),
      orderNumbers: [],
      specialNumber: toNum(row.specialNumber),
      source: row.source || "csv"
    })).filter((r) => r.period && r.numbers.length);
  }

  if (gameKey === "lotto649") {
    return rows.map((row) => ({
      period: row.period || null,
      drawDate: row.drawDate || row.lotteryDate || row.date || null,
      redeemableDate: row.redeemableDate || "",
      numbers: uniqSorted(
        row.numbers || [row.n1,row.n2,row.n3,row.n4,row.n5,row.n6]
      ),
      orderNumbers: [],
      specialNumber: toNum(
        row.specialNumber ??
        row.specialNum ??
        row.bonusNumber ??
        row.superNumber
      ),
      source: row.source || "csv"
    })).filter((r) => r.period && r.numbers.length);
  }

  if (gameKey === "superLotto638") {
    return rows.map((row) => ({
      period: row.period || null,
      drawDate: row.drawDate || row.lotteryDate || row.date || null,
      redeemableDate: row.redeemableDate || "",
      numbers: uniqSorted(
        row.numbers || [row.n1,row.n2,row.n3,row.n4,row.n5,row.n6]
      ),
      orderNumbers: [],
      specialNumber: toNum(
        row.specialNumber ??
        row.secondAreaNumber ??
        row.secondNumber ??
        row.specialNum ??
        row.bonusNumber ??
        row.superNumber ??
        row.zone2
      ),
      source: row.source || "csv"
    })).filter((r) => r.period && r.numbers.length);
  }

  return [];
}

function buildGamePayload(gameKey, historyDraws, officialLatestMap) {
  const sortedHistory = sortDrawsDesc(dedupeDraws(historyDraws));
  const officialLatest = normalizeOfficialDraw(gameKey, officialLatestMap?.[gameKey] || null);
  const merged = mergeLatestIntoHistory(sortedHistory, officialLatest);

  const csvLatest = sortedHistory[0] || null;
  const latest = pickNewerDraw(officialLatest, csvLatest);

  return {
    latestOfficial: officialLatest || csvLatest || null,
    latest: latest,
    recentOfficial: officialLatest
      ? mergeLatestIntoHistory(sortedHistory.slice(0, 20), officialLatest).slice(0, 5)
      : merged.slice(0, 5),
    recent: merged.slice(0, 5),
    history: merged.slice(0, 20)
  };
}

function loadCsvRows(fileName) {
  const filePath = path.join(RAW_DIR, fileName);
  const text = safeReadText(filePath, "");
  if (!text.trim()) return [];
  return parseCSV(text);
}

function main() {
  const officialRaw = safeReadJson(OFFICIAL_FILE, {});
  const officialLatestMap = officialRaw?.officialLatest || officialRaw || {};

  const bingoRows = normalizeHistoryRows("bingo", loadCsvRows("bingo.csv"));
  const daily539Rows = normalizeHistoryRows("daily539", loadCsvRows("539.csv"));
  const lotto649Rows = normalizeHistoryRows("lotto649", loadCsvRows("lotto.csv"));
  const superLotto638Rows = normalizeHistoryRows("superLotto638", loadCsvRows("power.csv"));

  const output = {
    generatedAt: new Date().toISOString(),
    source: "build_latest_json",
    officialLatest: {
      bingo: normalizeOfficialDraw("bingo", officialLatestMap.bingo),
      daily539: normalizeOfficialDraw("daily539", officialLatestMap.daily539),
      lotto649: normalizeOfficialDraw("lotto649", officialLatestMap.lotto649),
      superLotto638: normalizeOfficialDraw("superLotto638", officialLatestMap.superLotto638)
    },
    bingo: buildGamePayload("bingo", bingoRows, officialLatestMap),
    daily539: buildGamePayload("daily539", daily539Rows, officialLatestMap),
    lotto649: buildGamePayload("lotto649", lotto649Rows, officialLatestMap),
    superLotto638: buildGamePayload("superLotto638", superLotto638Rows, officialLatestMap)
  };

  safeWriteJson(OUT_FILE, output);

  console.log("===== docs/latest.json preview =====");
  console.log(JSON.stringify({
    generatedAt: output.generatedAt,
    bingoLatest: output.bingo?.latest || null,
    daily539Latest: output.daily539?.latest || null,
    lotto649Latest: output.lotto649?.latest || null,
    superLotto638Latest: output.superLotto638?.latest || null
  }, null, 2));
}

main();
