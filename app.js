// ==============================
// 台灣彩券 AI 預測系統 V72
// 真歷史分析 / 熱冷號 / 連號 / 尾數 / 分區平衡 / 命中比對 / 最新五期
// ==============================

// ---------- 基本工具 ----------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function unique(arr) {
  return [...new Set(arr)];
}

function sortAsc(arr) {
  return [...arr].sort((a, b) => a - b);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function countHits(a, b) {
  const set = new Set(b);
  return a.filter(x => set.has(x)).length;
}

function getTail(n) {
  return n % 10;
}

function chunkRange(num, max) {
  const third = Math.ceil(max / 3);
  if (num <= third) return 1;
  if (num <= third * 2) return 2;
  return 3;
}

function buildRangeMap(max) {
  const map = {};
  for (let i = 1; i <= max; i++) {
    map[i] = chunkRange(i, max);
  }
  return map;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

// ---------- 讀 JSON ----------
async function fetchJSON(url) {
  try {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), {
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("fetchJSON failed:", url, err);
    return null;
  }
}

// ---------- 讀官方最新資料 ----------
async function fetchOfficialResults() {
  const latest = await fetchJSON("data/official/latest.json");
  return latest || null;
}

async function getOfficialDraw(type) {
  const data = await fetchOfficialResults();
  if (!data) return null;

  const map = {
    bingo: "bingo",
    "649": "lotto649",
    "638": "lotto638",
    "539": "lotto539"
  };

  const key = map[type];
  if (!key || !data[key]) return null;

  return {
    main: safeArray(data[key].numbers),
    special: data[key].special ?? null,
    drawNo: data[key].drawNo || data[key].issue || "",
    date: data[key].date || data[key].drawDate || ""
  };
}

// ---------- 讀歷史資料 ----------
async function loadHistory(type) {
  const candidates = [
    `data/extracted/${type}.json`,
    `data/official/${type}.json`,
    `data/${type}.json`
  ];

  for (const url of candidates) {
    const data = await fetchJSON(url);
    if (!data) continue;

    if (Array.isArray(data)) return normalizeHistoryRows(data, type);
    if (Array.isArray(data.records)) return normalizeHistoryRows(data.records, type);
    if (Array.isArray(data.data)) return normalizeHistoryRows(data.data, type);
    if (Array.isArray(data.content)) return normalizeHistoryRows(data.content, type);
  }

  return [];
}

// ---------- 歷史格式標準化 ----------
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractMainNumbers(row) {
  if (Array.isArray(row.numbers)) {
    return row.numbers.map(Number).filter(Number.isFinite);
  }

  const keys = Object.keys(row || {});
  const numKeys = keys.filter(k => /^n\d+$/i.test(k) || /^num\d+$/i.test(k) || /^number\d+$/i.test(k));
  if (numKeys.length) {
    return numKeys
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
      .map(k => Number(row[k]))
      .filter(Number.isFinite);
  }

  const ballKeys = [
    "獎號1","獎號2","獎號3","獎號4","獎號5","獎號6","獎號7","獎號8","獎號9","獎號10",
    "獎號11","獎號12","獎號13","獎號14","獎號15","獎號16","獎號17","獎號18","獎號19","獎號20"
  ];

  const values = [];
  for (const k of ballKeys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
      const n = Number(row[k]);
      if (Number.isFinite(n)) values.push(n);
    }
  }
  return values;
}

function normalizeHistoryRow(row, type) {
  const numbers = extractMainNumbers(row);
  if (!numbers.length) return null;

  const special =
    row.special ??
    row.second ??
    row["特別號"] ??
    row["第二區"] ??
    row["super"] ??
    null;

  return {
    drawNo: row.drawNo || row.issue || row["期別"] || "",
    date: row.date || row.drawDate || row["開獎日期"] || "",
    numbers: numbers.map(Number).filter(Number.isFinite),
    special: special === null || special === "" ? null : Number(special)
  };
}

function normalizeHistoryRows(rows, type) {
  return rows
    .map(row => normalizeHistoryRow(row, type))
    .filter(Boolean);
}

// ---------- 歷史分析 ----------
function analyzeFrequency(history, maxNumber, mainCount) {
  const freq = Array(maxNumber + 1).fill(0);

  history.forEach(draw => {
    draw.numbers.forEach(n => {
      if (n >= 1 && n <= maxNumber) freq[n]++;
    });
  });

  const all = Array.from({ length: maxNumber }, (_, i) => i + 1);

  const hot = [...all]
    .sort((a, b) => freq[b] - freq[a] || a - b)
    .slice(0, mainCount + 4);

  const cold = [...all]
    .sort((a, b) => freq[a] - freq[b] || a - b)
    .slice(0, mainCount + 4);

  return { freq, hot, cold };
}

function analyzeRecentMissing(history, maxNumber) {
  const miss = Array(max