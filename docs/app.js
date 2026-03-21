(() => {
  "use strict";

  const BUILD = window.__APP_BUILD__ || "93.1.3";
  const APP_VERSION = `V93.1.3 GitHub Pages 強化學習增強版（build ${BUILD}）`;

  const STORAGE_KEY = "taiwan_lottery_prediction_history_v9313";
  const OPS_KEY = "taiwan_lottery_recent_ops_v9313";
  const SETTINGS_KEY = "taiwan_lottery_dashboard_settings_v9313";
  const WEIGHTS_KEY = "taiwan_lottery_learning_weights_v9313";
  const AUTO_STATE_KEY = "taiwan_lottery_auto_state_v9313";

  const GENERAL_REFRESH_MS = 5 * 60 * 1000;
  const BINGO_FAST_REFRESH_MS = 60 * 1000;

  const JSON_CANDIDATES = ["./latest.json"];
  const CSV_CANDIDATES = {
    bingo: ["./raw_data/bingo.csv"],
    daily539: ["./raw_data/539.csv"],
    lotto649: ["./raw_data/lotto649.csv", "./raw_data/649.csv"],
    superlotto638: ["./raw_data/superlotto638.csv", "./raw_data/638.csv", "./raw_data/power.csv"]
  };

  const GAME_META = {
    bingo: { key: "bingo", title: "BINGO BINGO", max: 80, pick: 10 },
    daily539: { key: "daily539", title: "今彩539", max: 39, pick: 5 },
    lotto649: { key: "lotto649", title: "大樂透", max: 49, pick: 6 },
    superlotto638_area1: { key: "superlotto638_area1", title: "威力彩第一區", max: 38, pick: 6 },
    superlotto638_area2: { key: "superlotto638_area2", title: "威力彩第二區", max: 8, pick: 1 }
  };

  const AI_CONFIG = {
    recentWindow: 120,
    longWindow: 300,
    recencyBoost: 1.85,
    superRecentBoost: 2.35,
    hotWeight: 1.35,
    coldWeight: 0.92,
    tailWeight: 1.10,
    dragWeight: 1.18,
    pairWeight: 1.20,
    streakWeight: 1.12,
    missPenalty: 0.92,
    hitReward: 1.16,
    exploreRate: 0.12,
    rebalanceFactor: 0.18,
    bingoRecentDays: 7,
    bingoTodayBoost: 3.2,
    bingoRecentDayBoost: 1.45
  };

  const state = {
    initialized: false,
    loading: false,
    latest: null,
    data: {
      bingo: [],
      daily539: [],
      lotto649: [],
      superlotto638: []
    },
    weights: loadLearningWeights(),
    settings: loadSettings(),
    history: loadJson(STORAGE_KEY, []),
    ops: loadJson(OPS_KEY, []),
    autoState: loadJson(AUTO_STATE_KEY, {}),
    timers: {}
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }

  function safeText(v, fallback = "-") {
    if (v === null || v === undefined || v === "") return fallback;
    return String(v);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("loadJson failed:", key, err);
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("saveJson failed:", key, err);
    }
  }

  function loadSettings() {
    return {
      selectedGame: "bingo",
      bingoPickCount: 10,
      predictionSetCount: 5,
      ...(loadJson(SETTINGS_KEY, {}) || {})
    };
  }

  function saveSettings() {
    saveJson(SETTINGS_KEY, state.settings);
  }

  function logOp(type, detail = {}) {
    const item = {
      time: nowIso(),
      type,
      detail
    };
    state.ops.unshift(item);
    state.ops = state.ops.slice(0, 100);
    saveJson(OPS_KEY, state.ops);
  }

  function appendHistory(item) {
    state.history.unshift(item);
    state.history = state.history.slice(0, 300);
    saveJson(STORAGE_KEY, state.history);
  }

  function getDefaultLearningWeights() {
    return {
      bingo: createDefaultGameWeights(80),
      daily539: createDefaultGameWeights(39),
      lotto649: createDefaultGameWeights(49),
      superlotto638: {
        area1: createDefaultGameWeights(38),
        area2: createDefaultGameWeights(8)
      }
    };
  }

  function createDefaultGameWeights(maxNumber) {
    const numberWeights = {};
    const tailWeights = {};
    const pairWeights = {};
    const dragWeights = {};

    for (let i = 1; i <= maxNumber; i++) numberWeights[i] = 1;
    for (let i = 0; i <= 9; i++) tailWeights[i] = 1;

    return {
      numberWeights,
      tailWeights,
      pairWeights,
      dragWeights,
      hitCount: 0,
      missCount: 0,
      lastUpdated: null
    };
  }

  function deepMergeWeights(base, extra) {
    if (!extra || typeof extra !== "object") return base;
    const out = Array.isArray(base) ? [...base] : { ...base };
    Object.keys(extra).forEach((key) => {
      if (
        base[key] &&
        typeof base[key] === "object" &&
        !Array.isArray(base[key]) &&
        extra[key] &&
        typeof extra[key] === "object" &&
        !Array.isArray(extra[key])
      ) {
        out[key] = deepMergeWeights(base[key], extra[key]);
      } else {
        out[key] = extra[key];
      }
    });
    return out;
  }

  function loadLearningWeights() {
    try {
      const raw = localStorage.getItem(WEIGHTS_KEY);
      if (!raw) return getDefaultLearningWeights();
      const parsed = JSON.parse(raw);
      return deepMergeWeights(getDefaultLearningWeights(), parsed);
    } catch (err) {
      console.warn("loadLearningWeights failed:", err);
      return getDefaultLearningWeights();
    }
  }

  function saveLearningWeights(weights) {
    try {
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
    } catch (err) {
      console.warn("saveLearningWeights failed:", err);
    }
  }

  function toInt(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function uniqSorted(nums) {
    return [...new Set(nums.filter((n) => Number.isFinite(n)).map((n) => toInt(n)))].sort((a, b) => a - b);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toDateKey(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
  }

  function formatLocalTime(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "-";
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  function parseCsv(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    if (!lines.length) return [];
    const headers = splitCsvLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? "";
      });
      rows.push(row);
    }
    return rows;
  }

  function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === '"') {
        if (inQuote && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  async function fetchTextFromCandidates(candidates) {
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) return await res.text();
      } catch (err) {
        console.warn("fetch failed:", url, err);
      }
    }
    return "";
  }

  async function fetchJsonFromCandidates(candidates) {
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("fetch json failed:", url, err);
      }
    }
    return null;
  }

  function pickField(row, keys, fallback = "") {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
    }
    return fallback;
  }

  function extractNumbersFromRow(row, maxNumber = 80) {
    const nums = [];
    Object.keys(row).forEach((key) => {
      const value = row[key];
      if (value === null || value === undefined || value === "") return;
      if (/^(period|drawterm|issue|date|lotterydate|ddate|drawdate|redeemabledate|seq|id|special|bonus|zone2|area2|second)$/i.test(key)) return;

      if (typeof value === "string" && value.includes(" ")) {
        value.split(/\s+/).forEach((part) => {
          const n = Number(part);
          if (Number.isInteger(n) && n >= 1 && n <= maxNumber) nums.push(n);
        });
        return;
      }

      if (typeof value === "string" && value.includes("|")) {
        value.split("|").forEach((part) => {
          const n = Number(part);
          if (Number.isInteger(n) && n >= 1 && n <= maxNumber) nums.push(n);
        });
        return;
      }

      if (typeof value === "string" && value.includes(",")) {
        value.split(",").forEach((part) => {
          const n = Number(part);
          if (Number.isInteger(n) && n >= 1 && n <= maxNumber) nums.push(n);
        });
        return;
      }

      const n = Number(value);
      if (Number.isInteger(n) && n >= 1 && n <= maxNumber) nums.push(n);
    });
    return uniqSorted(nums);
  }

  function normalizeBingoRows(rows) {
    return rows
      .map((row) => {
        const numbers = extractNumbersFromRow(row, 80);
        const drawTerm = pickField(row, ["drawTerm", "period", "issue", "term"], "");
        const drawDate = pickField(row, ["dDate", "drawDate", "lotteryDate", "date"], "");
        return {
          game: "bingo",
          drawTerm: safeText(drawTerm, ""),
          drawDate,
          numbers: numbers.slice(0, 20)
        };
      })
      .filter((x) => x.numbers.length >= 10);
  }

  function normalize539Rows(rows) {
    return rows
      .map((row) => {
        const numbers = extractNumbersFromRow(row, 39).slice(0, 5);
        const drawTerm = pickField(row, ["period", "drawTerm", "issue", "term"], "");
        const drawDate = pickField(row, ["lotteryDate", "drawDate", "date"], "");
        return {
          game: "daily539",
          drawTerm: safeText(drawTerm, ""),
          drawDate,
          numbers
        };
      })
      .filter((x) => x.numbers.length === 5);
  }

  function normalize649Rows(rows) {
    return rows
      .map((row) => {
        const drawTerm = pickField(row, ["period", "drawTerm", "issue", "term"], "");
        const drawDate = pickField(row, ["lotteryDate", "drawDate", "date"], "");

        let numbers = [];

        const preferredKeys = [
          "num1", "num2", "num3", "num4", "num5", "num6",
          "n1", "n2", "n3", "n4", "n5", "n6",
          "drawNumber1", "drawNumber2", "drawNumber3", "drawNumber4", "drawNumber5", "drawNumber6",
          "No1", "No2", "No3", "No4", "No5", "No6",
          "NO1", "NO2", "NO3", "NO4", "NO5", "NO6"
        ];

        preferredKeys.forEach((key) => {
          const n = Number(row[key]);
          if (Number.isInteger(n) && n >= 1 && n <= 49) {
            numbers.push(n);
          }
        });

        if (numbers.length !== 6) {
          numbers = extractNumbersFromRow(row, 49).slice(0, 6);
        }

        return {
          game: "lotto649",
          drawTerm: safeText(drawTerm, ""),
          drawDate,
          numbers: uniqSorted(numbers)
        };
      })
      .filter((x) => x.numbers.length === 6);
  }

  function normalize638Rows(rows) {
    return rows
      .map((row) => {
        let area1 = [];
        let area2 = [];

        Object.keys(row).forEach((key) => {
          const v = row[key];
          const n = Number(v);
          if (!Number.isInteger(n)) return;

          if (/sec|special|zone2|area2|second|bonus/i.test(key)) {
            if (n >= 1 && n <= 8) area2.push(n);
          } else if (/^n\d+$/i.test(key) || /^num\d+$/i.test(key) || /^no\d+$/i.test(key) || /^[1-6]$/.test(key) || /drawnumber/i.test(key)) {
            if (n >= 1 && n <= 38) area1.push(n);
          }
        });

        if (!area1.length) {
          const allNums = [];
          Object.keys(row).forEach((key) => {
            if (/sec|special|zone2|area2|second|bonus/i.test(key)) return;
            const n = Number(row[key]);
            if (Number.isInteger(n) && n >= 1 && n <= 38) allNums.push(n);
          });
          area1 = uniqSorted(allNums).slice(0, 6);
        }

        if (!area2.length) {
          const maybe = Object.keys(row)
            .filter((key) => /sec|special|zone2|area2|second|bonus/i.test(key))
            .map((key) => Number(row[key]))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8);

          if (maybe.length) {
            area2 = [maybe[0]];
          } else {
            const allNums = Object.values(row)
              .map((v) => Number(v))
              .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8);
            if (allNums.length) area2 = [allNums[allNums.length - 1]];
          }
        }

        const drawTerm = pickField(row, ["period", "drawTerm", "issue", "term"], "");
        const drawDate = pickField(row, ["lotteryDate", "drawDate", "date"], "");

        return {
          game: "superlotto638",
          drawTerm: safeText(drawTerm, ""),
          drawDate,
          area1: uniqSorted(area1).slice(0, 6),
          area2: uniqSorted(area2).slice(0, 1)
        };
      })
      .filter((x) => x.area1.length === 6 && x.area2.length === 1);
  }

  function sortByDateTermDesc(arr) {
    return [...arr].sort((a, b) => {
      const ta = new Date(a.drawDate || 0).getTime();
      const tb = new Date(b.drawDate || 0).getTime();
      if (tb !== ta) return tb - ta;
      return String(b.drawTerm).localeCompare(String(a.drawTerm), "zh-Hant-u-co-pinyin-nu-latn");
    });
  }

  function countFrequency(draws, maxNumber) {
    const freq = Array(maxNumber + 1).fill(0);
    draws.forEach((draw) => {
      draw.forEach((n) => {
        if (n >= 1 && n <= maxNumber) freq[n]++;
      });
    });
    return freq;
  }

  function getTopHotAndCold(freq) {
    const pairs = [];
    for (let i = 1; i < freq.length; i++) {
      pairs.push([i, freq[i]]);
    }
    pairs.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const hotCount = Math.max(3, Math.round((freq.length - 1) * 0.15));
    const coldCount = Math.max(3, Math.round((freq.length - 1) * 0.15));
    const hot = new Set(pairs.slice(0, hotCount).map((x) => x[0]));
    const cold = new Set(pairs.slice(-coldCount).map((x) => x[0]));
    return { hot, cold };
  }

  function getWeightsForGame(gameKey) {
    if (gameKey === "superlotto638_area1") return state.weights.superlotto638.area1;
    if (gameKey === "superlotto638_area2") return state.weights.superlotto638.area2;
    return state.weights[gameKey];
  }

  function getDrawsFromRows(rows, field = "numbers") {
    return rows.map((x) => x[field]).filter((x) => Array.isArray(x) && x.length);
  }

  function groupBingoDrawsByDate(rows) {
    const map = {};
    rows.forEach((row) => {
      const dateKey = toDateKey(row.drawDate);
      if (!dateKey) return;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(row);
    });

    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const ta = new Date(a.drawDate || 0).getTime();
        const tb = new Date(b.drawDate || 0).getTime();
        if (ta !== tb) return ta - tb;
        return String(a.drawTerm).localeCompare(String(b.drawTerm), "zh-Hant-u-co-pinyin-nu-latn");
      });
    });

    return map;
  }

  function getBingoLearningRows(rows) {
    if (!rows.length) return [];
    const grouped = groupBingoDrawsByDate(rows);
    const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    if (!dateKeys.length) return [];

    const todayKey = dateKeys[0];
    const selected = [];

    grouped[todayKey].forEach((row) => {
      selected.push({ ...row, __bingoWeight: AI_CONFIG.bingoTodayBoost });
    });

    for (let i = 1; i < Math.min(dateKeys.length, AI_CONFIG.bingoRecentDays + 1); i++) {
      const dayRows = grouped[dateKeys[i]];
      const dayWeight = Math.max(1, AI_CONFIG.bingoRecentDayBoost - i * 0.08);
      dayRows.forEach((row) => {
        selected.push({ ...row, __bingoWeight: dayWeight });
      });
    }

    return selected.sort((a, b) => {
      const ta = new Date(b.drawDate || 0).getTime();
      const tb = new Date(a.drawDate || 0).getTime();
      return ta - tb;
    });
  }

  function buildWeightedFrequency(rows, maxNumber, field = "numbers", customWeightFn = null) {
    const out = Array(maxNumber + 1).fill(0);

    rows.forEach((row, idx) => {
      const draw = row[field];
      if (!Array.isArray(draw)) return;

      let weight = 1;
      if (typeof customWeightFn === "function") {
        weight = customWeightFn(row, idx);
      } else {
        if (idx < 20) weight *= AI_CONFIG.superRecentBoost;
        else if (idx < AI_CONFIG.recentWindow) weight *= AI_CONFIG.recencyBoost;
      }

      draw.forEach((n) => {
        if (n >= 1 && n <= maxNumber) out[n] += weight;
      });
    });

    return out;
  }

  function buildWeightedTailFrequency(rows, field = "numbers", customWeightFn = null) {
    const out = Array(10).fill(0);

    rows.forEach((row, idx) => {
      const draw = row[field];
      if (!Array.isArray(draw)) return;

      let weight = 1;
      if (typeof customWeightFn === "function") {
        weight = customWeightFn(row, idx);
      } else {
        if (idx < 20) weight *= AI_CONFIG.superRecentBoost;
        else if (idx < AI_CONFIG.recentWindow) weight *= AI_CONFIG.recencyBoost;
      }

      draw.forEach((n) => {
        out[n % 10] += weight;
      });
    });

    return out;
  }

  function buildWeightedPairFrequency(rows, field = "numbers", customWeightFn = null) {
    const out = {};
    rows.forEach((row, idx) => {
      const draw = row[field];
      if (!Array.isArray(draw)) return;
      let weight = 1;
      if (typeof customWeightFn === "function") {
        weight = customWeightFn(row, idx);
      } else {
        if (idx < 20) weight *= AI_CONFIG.superRecentBoost;
        else if (idx < AI_CONFIG.recentWindow) weight *= AI_CONFIG.recencyBoost;
      }

      const sorted = [...draw].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const key = `${sorted[i]}-${sorted[j]}`;
          out[key] = (out[key] || 0) + weight;
        }
      }
    });
    return out;
  }

  function buildWeightedDragFrequency(rows, field = "numbers", customWeightFn = null) {
    const out = {};
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i][field];
      const curr = rows[i - 1][field];
      if (!Array.isArray(prev) || !Array.isArray(curr)) continue;

      let weight = 1;
      if (typeof customWeightFn === "function") {
        weight = customWeightFn(rows[i - 1], i - 1);
      } else {
        if (i < 20) weight *= AI_CONFIG.superRecentBoost;
        else if (i < AI_CONFIG.recentWindow) weight *= AI_CONFIG.recencyBoost;
      }

      prev.forEach((a) => {
        curr.forEach((b) => {
          if (a === b) return;
          const key = `${a}->${b}`;
          out[key] = (out[key] || 0) + weight;
        });
      });
    }
    return out;
  }

  function buildWeightedStreak(rows, maxNumber, field = "numbers", customWeightFn = null) {
    const out = Array(maxNumber + 1).fill(0);
    rows.forEach((row, idx) => {
      const draw = row[field];
      if (!Array.isArray(draw)) return;

      let weight = 1;
      if (typeof customWeightFn === "function") {
        weight = customWeightFn(row, idx);
      } else {
        if (idx < 20) weight *= AI_CONFIG.superRecentBoost;
        else if (idx < AI_CONFIG.recentWindow) weight *= AI_CONFIG.recencyBoost;
      }

      const set = new Set(draw);
      draw.forEach((n) => {
        if (set.has(n - 1) || set.has(n + 1)) out[n] += weight;
      });
    });
    return out;
  }

  function computeScoreMap(gameKey, rows, maxNumber, pickCount, field = "numbers") {
    const weights = getWeightsForGame(gameKey);
    const recentRows = rows.slice(0, AI_CONFIG.longWindow);

    const customWeightFn =
      gameKey === "bingo"
        ? (row, idx) => {
            let weight = row.__bingoWeight || 1;
            if (idx < 10) weight *= 1.12;
            return weight;
          }
        : null;

    const weightedFreq = buildWeightedFrequency(recentRows, maxNumber, field, customWeightFn);
    const rawFreq = countFrequency(getDrawsFromRows(recentRows, field), maxNumber);
    const weightedTail = buildWeightedTailFrequency(recentRows, field, customWeightFn);
    const weightedPair = buildWeightedPairFrequency(recentRows, field, customWeightFn);
    const weightedDrag = buildWeightedDragFrequency(recentRows, field, customWeightFn);
    const weightedStreak = buildWeightedStreak(recentRows, maxNumber, field, customWeightFn);
    const { hot, cold } = getTopHotAndCold(rawFreq);

    const scores = [];

    for (let n = 1; n <= maxNumber; n++) {
      const tail = n % 10;
      let score = 0;

      score += weightedFreq[n] * 1.8;
      score += (weightedTail[tail] || 0) * AI_CONFIG.tailWeight * 0.4;
      score += (weightedStreak[n] || 0) * AI_CONFIG.streakWeight * 0.55;

      if (hot.has(n)) score *= AI_CONFIG.hotWeight;
      if (cold.has(n)) score *= AI_CONFIG.coldWeight + AI_CONFIG.rebalanceFactor;

      const memWeight = Number(weights.numberWeights[n] || 1);
      const memTail = Number(weights.tailWeights[tail] || 1);

      score *= memWeight;
      score *= 1 + (memTail - 1) * 0.35;

      const recentTop = recentRows.slice(0, Math.min(12, recentRows.length)).map((r) => r[field]).filter(Boolean);
      let pairScore = 0;
      let dragScore = 0;

      recentTop.forEach((draw) => {
        draw.forEach((m) => {
          if (m === n) return;
          const pairKey = [Math.min(m, n), Math.max(m, n)].join("-");
          pairScore += weightedPair[pairKey] || 0;
          const dragKey = `${m}->${n}`;
          dragScore += weightedDrag[dragKey] || 0;
        });
      });

      score += pairScore * 0.025 * AI_CONFIG.pairWeight;
      score += dragScore * 0.02 * AI_CONFIG.dragWeight;

      if (Math.random() < AI_CONFIG.exploreRate) {
        score *= 1 + Math.random() * 0.06;
      }

      scores.push({ number: n, score });
    }

    scores.sort((a, b) => b.score - a.score || a.number - b.number);

    return {
      scores,
      hotNumbers: [...hot].sort((a, b) => a - b),
      coldNumbers: [...cold].sort((a, b) => a - b),
      rawFreq,
      weightedFreq,
      weightedTail
    };
  }

  function rebalancePickList(scoreList, hotNumbers, coldNumbers, pickCount) {
    const hotSet = new Set(hotNumbers);
    const coldSet = new Set(coldNumbers);

    const hotTarget = Math.max(1, Math.round(pickCount * 0.45));
    const coldTarget = Math.max(1, Math.round(pickCount * 0.18));

    const hotPool = [];
    const coldPool = [];
    const midPool = [];

    scoreList.forEach((item) => {
      if (hotSet.has(item.number)) hotPool.push(item.number);
      else if (coldSet.has(item.number)) coldPool.push(item.number);
      else midPool.push(item.number);
    });

    const picked = [];
    hotPool.slice(0, hotTarget).forEach((n) => picked.push(n));
    coldPool.slice(0, coldTarget).forEach((n) => {
      if (!picked.includes(n)) picked.push(n);
    });

    [...midPool, ...hotPool, ...coldPool].forEach((n) => {
      if (!picked.includes(n) && picked.length < pickCount) picked.push(n);
    });

    return picked.slice(0, pickCount).sort((a, b) => a - b);
  }

  function makePredictionSets(baseList, maxNumber, pickCount, setCount) {
    const results = [];
    const pool = [...baseList];
    for (let i = 0; i < setCount; i++) {
      const offset = i * Math.max(1, Math.floor(pickCount / 2));
      const take = [];
      for (let j = 0; j < pool.length && take.length < pickCount; j++) {
        const idx = (offset + j) % pool.length;
        const n = pool[idx];
        if (!take.includes(n)) take.push(n);
      }
      while (take.length < pickCount) {
        const n = 1 + Math.floor(Math.random() * maxNumber);
        if (!take.includes(n)) take.push(n);
      }
      results.push(take.sort((a, b) => a - b));
    }
    return results;
  }

  function predictBingo(rows) {
    const learningRows = getBingoLearningRows(rows);
    const pickCount = clamp(Number(state.settings.bingoPickCount || 10), 1, 10);
    const setCount = clamp(Number(state.settings.predictionSetCount || 5), 1, 10);

    const analysis = computeScoreMap("bingo", learningRows, 80, pickCount, "numbers");
    const baseList = rebalancePickList(
      analysis.scores,
      analysis.hotNumbers,
      analysis.coldNumbers,
      Math.max(pickCount * 3, 20)
    );

    const sets = makePredictionSets(baseList, 80, pickCount, setCount);

    const grouped = groupBingoDrawsByDate(rows);
    const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    const todayCount = dateKeys.length ? grouped[dateKeys[0]].length : 0;

    return {
      gameKey: "bingo",
      title: "BINGO BINGO",
      mode: "今日全部期數 + 近7日輔助學習",
      sourceCount: learningRows.length,
      todayCount,
      sets,
      analysis
    };
  }

  function predictStandard(gameKey, rows, maxNumber, pickCount, field = "numbers") {
    const recentRows = rows.slice(0, AI_CONFIG.longWindow);
    const setCount = clamp(Number(state.settings.predictionSetCount || 5), 1, 10);

    const analysis = computeScoreMap(gameKey, recentRows, maxNumber, pickCount, field);
    const baseList = rebalancePickList(
      analysis.scores,
      analysis.hotNumbers,
      analysis.coldNumbers,
      Math.max(pickCount * 3, 18)
    );
    const sets = makePredictionSets(baseList, maxNumber, pickCount, setCount);

    return {
      gameKey,
      title: GAME_META[gameKey]?.title || gameKey,
      mode: "近期強化學習",
      sourceCount: recentRows.length,
      sets,
      analysis
    };
  }

  function predictSuperLotto(rows) {
    const area1 = predictStandard("superlotto638_area1", rows, 38, 6, "area1");
    const area2 = predictStandard("superlotto638_area2", rows, 8, 1, "area2");
    const setCount = Math.min(area1.sets.length, area2.sets.length);
    const sets = [];
    for (let i = 0; i < setCount; i++) {
      sets.push({
        area1: area1.sets[i],
        area2: area2.sets[i][0]
      });
    }
    return {
      gameKey: "superlotto638",
      title: "威力彩",
      mode: "雙區分開強化學習",
      sourceCount: rows.length,
      sets,
      area1,
      area2
    };
  }

  function updateLearningByResult(gameKey, predictedSet, actualSet) {
    if (!Array.isArray(predictedSet) || !Array.isArray(actualSet)) return;
    const w = getWeightsForGame(gameKey);
    const actual = new Set(actualSet);
    const predicted = [...predictedSet];
    const hitCount = predicted.filter((n) => actual.has(n)).length;
    const isHit = hitCount > 0;
    const multiplier = isHit ? AI_CONFIG.hitReward : AI_CONFIG.missPenalty;

    predicted.forEach((n) => {
      const curr = Number(w.numberWeights[n] || 1);
      let next = curr * multiplier;
      next = clamp(next, 0.7, 2.8);
      w.numberWeights[n] = Number(next.toFixed(4));
    });

    predicted.forEach((n) => {
      const tail = n % 10;
      const curr = Number(w.tailWeights[tail] || 1);
      let next = curr * (isHit ? 1.05 : 0.98);
      next = clamp(next, 0.8, 2.2);
      w.tailWeights[tail] = Number(next.toFixed(4));
    });

    const sorted = [...predicted].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}-${sorted[j]}`;
        const curr = Number(w.pairWeights[key] || 1);
        let next = curr * (hitCount >= 2 ? 1.04 : 0.995);
        next = clamp(next, 0.85, 2.5);
        w.pairWeights[key] = Number(next.toFixed(4));
      }
    }

    w.hitCount += isHit ? 1 : 0;
    w.missCount += isHit ? 0 : 1;
    w.lastUpdated = nowIso();
  }

  function autoLearnAllGames() {
    try {
      const bingoRows = state.data.bingo;
      const d539Rows = state.data.daily539;
      const l649Rows = state.data.lotto649;
      const s638Rows = state.data.superlotto638;

      if (bingoRows.length >= 2) {
        const pred = predictBingo(bingoRows.slice(1));
        const actual = bingoRows[0].numbers;
        if (pred.sets[0]) updateLearningByResult("bingo", pred.sets[0], actual);
      }

      if (d539Rows.length >= 2) {
        const pred = predictStandard("daily539", d539Rows.slice(1), 39, 5);
        const actual = d539Rows[0].numbers;
        if (pred.sets[0]) updateLearningByResult("daily539", pred.sets[0], actual);
      }

      if (l649Rows.length >= 2) {
        const pred = predictStandard("lotto649", l649Rows.slice(1), 49, 6);
        const actual = l649Rows[0].numbers;
        if (pred.sets[0]) updateLearningByResult("lotto649", pred.sets[0], actual);
      }

      if (s638Rows.length >= 2) {
        const pred = predictSuperLotto(s638Rows.slice(1));
        const actual1 = s638Rows[0].area1;
        const actual2 = s638Rows[0].area2;
        if (pred.sets[0]) {
          updateLearningByResult("superlotto638_area1", pred.sets[0].area1, actual1);
          updateLearningByResult("superlotto638_area2", [pred.sets[0].area2], actual2);
        }
      }

      saveLearningWeights(state.weights);
      logOp("autoLearnAllGames", { at: nowIso() });
    } catch (err) {
      console.warn("autoLearnAllGames failed:", err);
    }
  }

  function renderVersion() {
    $all("[data-app-version]").forEach((el) => {
      el.textContent = APP_VERSION;
    });

    const versionEl = $("#appVersion");
    if (versionEl) {
      if ("value" in versionEl) versionEl.value = APP_VERSION;
      else versionEl.textContent = APP_VERSION;
    }
  }

  function formatNumberBalls(nums) {
    return nums.map((n) => `<span class="ball">${pad2(n)}</span>`).join("");
  }

  function renderLatestDrawCard(title, drawTerm, drawDate, numbers) {
    return `
      <div class="set-item">
        <div class="set-title">${title}</div>
        <div class="card-sub">期別：${safeText(drawTerm)}｜時間：${formatLocalTime(drawDate)}</div>
        <div class="set-balls">
          ${
            Array.isArray(numbers) && numbers.length
              ? formatNumberBalls(numbers)
              : '<span class="empty">尚無資料</span>'
          }
        </div>
      </div>
    `;
  }

  function renderLatestSuperLottoCard(title, drawTerm, drawDate, area1, area2) {
    return `
      <div class="set-item">
        <div class="set-title">${title}</div>
        <div class="card-sub">期別：${safeText(drawTerm)}｜時間：${formatLocalTime(drawDate)}</div>
        <div class="set-row">
          <div class="set-area">第一區</div>
          <div class="set-balls">
            ${
              Array.isArray(area1) && area1.length
                ? formatNumberBalls(area1)
                : '<span class="empty">尚無資料</span>'
            }
          </div>
        </div>
        <div class="set-row">
          <div class="set-area">第二區</div>
          <div class="set-balls">
            ${
              Array.isArray(area2) && area2.length
                ? formatNumberBalls(area2)
                : '<span class="empty">尚無資料</span>'
            }
          </div>
        </div>
      </div>
    `;
  }

  function renderLatestDraws() {
    const root = $("#latestDrawOutput");
    if (!root) return;

    const bingo = state.data.bingo?.[0];
    const d539 = state.data.daily539?.[0];
    const l649 = state.data.lotto649?.[0];
    const s638 = state.data.superlotto638?.[0];

    root.innerHTML = `
      <div class="set-list">
        ${renderLatestDrawCard("BINGO BINGO", bingo?.drawTerm, bingo?.drawDate, bingo?.numbers)}
        ${renderLatestDrawCard("今彩539", d539?.drawTerm, d539?.drawDate, d539?.numbers)}
        ${renderLatestDrawCard("大樂透", l649?.drawTerm, l649?.drawDate, l649?.numbers)}
        ${renderLatestSuperLottoCard("威力彩", s638?.drawTerm, s638?.drawDate, s638?.area1, s638?.area2)}
      </div>
    `;
  }

  function renderPrediction(result) {
    const root = $("#predictionOutput");
    if (!root) return;

    if (!result) {
      root.innerHTML = `<div class="empty">暫無預測資料</div>`;
      return;
    }

    if (result.gameKey === "superlotto638") {
      root.innerHTML = `
        <div class="card">
          <div class="card-title">${result.title}</div>
          <div class="card-sub">模式：${result.mode}｜學習期數：${result.sourceCount}</div>
          <div class="set-list">
            ${result.sets
              .map(
                (set, idx) => `
                  <div class="set-item">
                    <div class="set-title">第 ${idx + 1} 組</div>
                    <div class="set-row">
                      <div class="set-area">第一區</div>
                      <div class="set-balls">${formatNumberBalls(set.area1)}</div>
                    </div>
                    <div class="set-row">
                      <div class="set-area">第二區</div>
                      <div class="set-balls">${formatNumberBalls([set.area2])}</div>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="card">
        <div class="card-title">${result.title}</div>
        <div class="card-sub">
          模式：${result.mode}
          ${result.gameKey === "bingo" ? `｜今日已學習期數：${result.todayCount}` : ""}
          ｜總學習期數：${result.sourceCount}
        </div>
        <div class="set-list">
          ${result.sets
            .map(
              (set, idx) => `
                <div class="set-item">
                  <div class="set-title">第 ${idx + 1} 組</div>
                  <div class="set-balls">${formatNumberBalls(set)}</div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderStats() {
    const versionEl = $("#appVersion");
    if (versionEl) {
      if ("value" in versionEl) versionEl.value = APP_VERSION;
      else versionEl.textContent = APP_VERSION;
    }

    const bingoCountEl = $("#bingoDataCount");
    if (bingoCountEl) bingoCountEl.textContent = String(state.data.bingo.length);

    const d539CountEl = $("#daily539DataCount");
    if (d539CountEl) d539CountEl.textContent = String(state.data.daily539.length);

    const l649CountEl = $("#lotto649DataCount");
    if (l649CountEl) l649CountEl.textContent = String(state.data.lotto649.length);

    const s638CountEl = $("#superlotto638DataCount");
    if (s638CountEl) s638CountEl.textContent = String(state.data.superlotto638.length);

    const latestEl = $("#latestUpdateTime");
    if (latestEl) {
      const rawTime =
        state.latest?.updatedAt ||
        state.latest?.updateTime ||
        state.latest?.generatedAt ||
        state.latest?.time ||
        nowIso();

      latestEl.textContent = formatLocalTime(rawTime);
    }

    $all("[data-app-version]").forEach((el) => {
      el.textContent = APP_VERSION;
    });
  }

  function getCurrentPrediction() {
    const game = state.settings.selectedGame || "bingo";
    if (game === "bingo") return predictBingo(state.data.bingo);
    if (game === "daily539") return predictStandard("daily539", state.data.daily539, 39, 5);
    if (game === "lotto649") return predictStandard("lotto649", state.data.lotto649, 49, 6);
    if (game === "superlotto638") return predictSuperLotto(state.data.superlotto638);
    return null;
  }

  function refreshPrediction() {
    try {
      const result = getCurrentPrediction();
      renderPrediction(result);
      renderLatestDraws();
      appendHistory({
        time: nowIso(),
        historyKey: state.settings.selectedGame,
        game: state.settings.selectedGame,
        result
      });
      renderStats();
    } catch (err) {
      console.error("refreshPrediction failed:", err);
    }
  }

  function bindUi() {
    const gameSelect = $("#gameSelect");
    if (gameSelect) {
      gameSelect.value = state.settings.selectedGame;
      gameSelect.addEventListener("change", (e) => {
        state.settings.selectedGame = e.target.value;
        saveSettings();
        refreshPrediction();
      });
    }

    const bingoPickCount = $("#bingoPickCount");
    if (bingoPickCount) {
      bingoPickCount.value = String(state.settings.bingoPickCount);
      bingoPickCount.addEventListener("change", (e) => {
        state.settings.bingoPickCount = clamp(Number(e.target.value || 10), 1, 10);
        saveSettings();
        refreshPrediction();
      });
    }

    const predictionSetCount = $("#predictionSetCount");
    if (predictionSetCount) {
      predictionSetCount.value = String(state.settings.predictionSetCount);
      predictionSetCount.addEventListener("change", (e) => {
        state.settings.predictionSetCount = clamp(Number(e.target.value || 5), 1, 10);
        saveSettings();
        refreshPrediction();
      });
    }

    const runBtn = $("#runPredictionBtn");
    if (runBtn) {
      runBtn.addEventListener("click", () => {
        refreshPrediction();
      });
    }

    const relearnBtn = $("#relearnBtn");
    if (relearnBtn) {
      relearnBtn.addEventListener("click", () => {
        autoLearnAllGames();
        refreshPrediction();
      });
    }

    const resetAiBtn = $("#resetAiBtn");
    if (resetAiBtn) {
      resetAiBtn.addEventListener("click", () => {
        state.weights = getDefaultLearningWeights();
        saveLearningWeights(state.weights);
        logOp("resetAiWeights", {});
        refreshPrediction();
      });
    }
  }

  async function loadLatestJson() {
    const json = await fetchJsonFromCandidates(JSON_CANDIDATES);
    state.latest = json || { updatedAt: nowIso() };
  }

  async function loadGameData() {
    const [bingoText, d539Text, l649Text, s638Text] = await Promise.all([
      fetchTextFromCandidates(CSV_CANDIDATES.bingo),
      fetchTextFromCandidates(CSV_CANDIDATES.daily539),
      fetchTextFromCandidates(CSV_CANDIDATES.lotto649),
      fetchTextFromCandidates(CSV_CANDIDATES.superlotto638)
    ]);

    state.data.bingo = sortByDateTermDesc(normalizeBingoRows(parseCsv(bingoText)));
    state.data.daily539 = sortByDateTermDesc(normalize539Rows(parseCsv(d539Text)));
    state.data.lotto649 = sortByDateTermDesc(normalize649Rows(parseCsv(l649Text)));
    state.data.superlotto638 = sortByDateTermDesc(normalize638Rows(parseCsv(s638Text)));

    logOp("loadGameData", {
      bingo: state.data.bingo.length,
      daily539: state.data.daily539.length,
      lotto649: state.data.lotto649.length,
      superlotto638: state.data.superlotto638.length
    });
  }

  async function reloadAll() {
    if (state.loading) return;
    state.loading = true;
    try {
      await loadLatestJson();
      await loadGameData();
      autoLearnAllGames();
      renderVersion();
      refreshPrediction();
      renderStats();
    } catch (err) {
      console.error("reloadAll failed:", err);
    } finally {
      state.loading = false;
    }
  }

  function startSchedulers() {
    clearSchedulers();

    state.timers.general = setInterval(() => {
      reloadAll();
    }, GENERAL_REFRESH_MS);

    state.timers.bingo = setInterval(async () => {
      try {
        const bingoText = await fetchTextFromCandidates(CSV_CANDIDATES.bingo);
        const newRows = sortByDateTermDesc(normalizeBingoRows(parseCsv(bingoText)));
        if (newRows.length) {
          state.data.bingo = newRows;
          autoLearnAllGames();
          renderLatestDraws();
          if (state.settings.selectedGame === "bingo") refreshPrediction();
          renderStats();
          logOp("bingoFastRefresh", { count: newRows.length });
        }
      } catch (err) {
        console.warn("bingo fast refresh failed:", err);
      }
    }, BINGO_FAST_REFRESH_MS);
  }

  function clearSchedulers() {
    Object.values(state.timers).forEach((id) => {
      if (id) clearInterval(id);
    });
    state.timers = {};
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    renderVersion();
    bindUi();
    await reloadAll();
    startSchedulers();

    window.__LOTTERY_APP__ = {
      state,
      reloadAll,
      refreshPrediction,
      predictBingo,
      predictStandard,
      predictSuperLotto,
      autoLearnAllGames
    };

    console.log(APP_VERSION);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
