(() => {
  "use strict";

  const BUILD = window.__APP_BUILD__ || "93.1.1";
  const APP_VERSION = `V93.1.1｜GitHub Pages 最終版｜手機操作優化版`;

  const STORAGE_KEY = "taiwan_lottery_prediction_history_v9311";
  const OPS_KEY = "taiwan_lottery_recent_ops_v9311";
  const SETTINGS_KEY = "taiwan_lottery_dashboard_settings_v9311";
  const WEIGHTS_KEY = "taiwan_lottery_learning_weights_v9311";
  const AUTO_STATE_KEY = "taiwan_lottery_auto_state_v9311";
  const UI_MODE_KEY = "taiwan_lottery_ui_mode_v9311";
  const LEARNING_KEY = "taiwan_lottery_learning_v9311";
  const LAST_FETCH_KEY = "taiwan_lottery_last_fetch_v9311";

  const GENERAL_REFRESH_MS = 5 * 60 * 1000;
  const BINGO_FAST_REFRESH_MS = 60 * 1000;

  const JSON_CANDIDATES = ["./latest.json"];

  const CSV_CANDIDATES = {
  bingo: ["./raw_data/bingo.csv"],
  daily539: ["./raw_data/539.csv"],
  lotto649: ["./raw_data/lotto.csv", "./raw_data/649.csv", "./raw_data/lotto649.csv"],
  power: ["./raw_data/power.csv", "./raw_data/superlotto638.csv", "./raw_data/638.csv"]
};

  const GAME_META = {
    bingo: { label: "BINGO BINGO", max: 80, pick: 10, colorClass: "g-bingo" },
    daily539: { label: "今彩539", max: 39, pick: 5, colorClass: "g-539" },
    lotto649: { label: "大樂透", max: 49, pick: 6, colorClass: "g-649" },
    power: { label: "威力彩", max: 38, pick: 6, colorClass: "g-power" }
  };

  const DEFAULT_SETTINGS = {
    simpleUI: true,
    selectedGame: "bingo",
    bingoPickCount: 10,
    autoRefresh: true
  };

  const DEFAULT_AUTO_STATE = {
    bingo: { lastRunAt: null, lastSuccess: false, lastPeriod: null, nextAt: null },
    daily539: { lastRunAt: null, lastSuccess: false, lastPeriod: null, nextAt: null },
    lotto649: { lastRunAt: null, lastSuccess: false, lastPeriod: null, nextAt: null },
    power: { lastRunAt: null, lastSuccess: false, lastPeriod: null, nextAt: null }
  };

  const LEARNING_DEFAULT = {
    bingo: {
      drawsLearned: 0,
      lastPeriod: null,
      numberWeights: {},
      tailWeights: {},
      pairWeights: {},
      missWeights: {},
      updatedAt: null
    },
    daily539: {
      drawsLearned: 0,
      lastPeriod: null,
      numberWeights: {},
      tailWeights: {},
      pairWeights: {},
      missWeights: {},
      updatedAt: null
    },
    lotto649: {
      drawsLearned: 0,
      lastPeriod: null,
      numberWeights: {},
      tailWeights: {},
      pairWeights: {},
      missWeights: {},
      updatedAt: null
    },
    power: {
      drawsLearned: 0,
      lastPeriod: null,
      zone1Weights: {},
      zone2Weights: {},
      tailWeights: {},
      pairWeights: {},
      missWeights: {},
      updatedAt: null
    }
  };

  const state = {
    initialized: false,
    loading: false,
    root: null,
    settings: readJsonStorage(SETTINGS_KEY, DEFAULT_SETTINGS),
    autoState: { ...DEFAULT_AUTO_STATE, ...readJsonStorage(AUTO_STATE_KEY, {}) },
    lastFetchState: readJsonStorage(LAST_FETCH_KEY, {
      bingo: { lastPeriod: null, updatedAt: null },
      daily539: { lastPeriod: null, updatedAt: null },
      lotto649: { lastPeriod: null, updatedAt: null },
      power: { lastPeriod: null, updatedAt: null }
    }),
    data: {
      bingo: [],
      daily539: [],
      lotto649: [],
      power: []
    },
    latest: {
      bingo: null,
      daily539: null,
      lotto649: null,
      power: null
    },
    predictions: {
      bingo: [],
      daily539: [],
      lotto649: [],
      power: { zone1: [], zone2: null }
    },
    statusText: "初始化中…",
    lastRenderAt: null,
    timers: {
      bingoSchedule: null,
      generalRefresh: null,
      bingoFastRefresh: null
    }
  };

  function readJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      return JSON.parse(raw);
    } catch (err) {
      console.warn("readJsonStorage failed:", key, err);
      return structuredClone(fallback);
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("writeJsonStorage failed:", key, err);
    }
  }

  function nowTs() {
    return new Date().toISOString();
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  function formatOnlyDate(value) {
    if (!value) return "-";
    if (typeof value === "string" && value.includes(" ")) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function formatPeriod(period) {
    return period == null ? "-" : String(period);
  }

  function uniqSorted(nums) {
    return [...new Set((nums || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  }

  function getTail(n) {
    return Number(n) % 10;
  }

  function safeInc(obj, key, amount = 1) {
    obj[key] = (obj[key] || 0) + amount;
  }

  function decayWeights(obj, decay = 0.985, minKeep = 0.0001) {
    for (const k of Object.keys(obj)) {
      obj[k] *= decay;
      if (Math.abs(obj[k]) < minKeep) delete obj[k];
    }
  }

  function pairKey(a, b) {
    const x = Math.min(Number(a), Number(b));
    const y = Math.max(Number(a), Number(b));
    return `${x}-${y}`;
  }

  function normalizeScores(scoreMap) {
    const values = Object.values(scoreMap);
    if (!values.length) return scoreMap;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return scoreMap;
    const out = {};
    for (const [k, v] of Object.entries(scoreMap)) {
      out[k] = (v - min) / (max - min);
    }
    return out;
  }

  function pickTopNumbers(scoreMap, count, exclude = []) {
    const excluded = new Set(exclude.map(Number));
    return Object.entries(scoreMap)
      .filter(([n]) => !excluded.has(Number(n)))
      .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
      .slice(0, count)
      .map(([n]) => Number(n));
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  }

  async function fetchFirstSuccess(candidates, reader) {
    const errors = [];
    for (const url of candidates) {
      try {
        return await reader(url);
      } catch (err) {
        errors.push(`${url}: ${err.message}`);
      }
    }
    throw new Error(errors.join(" | "));
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

  function detectNumberArrayFromObject(obj, maxCount) {
    const candidates = [];

    for (const [k, v] of Object.entries(obj || {})) {
      if (Array.isArray(v)) {
        const nums = v.map(Number).filter(Number.isFinite);
        if (nums.length) candidates.push(nums);
      } else if (typeof v === "string" && /[,、\s]/.test(v)) {
        const nums = v.split(/[,、\s]+/).map(Number).filter(Number.isFinite);
        if (nums.length) candidates.push(nums);
      }
    }

    candidates.sort((a, b) => b.length - a.length);
    const best = candidates[0] || [];
    return uniqSorted(maxCount ? best.slice(0, maxCount) : best);
  }

  function normalizeBingoRows(rows) {
    return (rows || [])
      .map((row) => ({
        period: row.period || row.draw || row.issue || null,
        drawDate: row.drawDate || row.lotteryDate || row.date || null,
        redeemableDate: row.redeemableDate || "",
        numbers: uniqSorted(row.numbers || row.drawNumberAppear || row.drawNumberSize || detectNumberArrayFromObject(row, 20)),
        orderNumbers: uniqSorted(row.orderNumbers || []),
        specialNumber: row.specialNumber != null ? Number(row.specialNumber) : null,
        source: row.source || ""
      }))
      .filter((row) => row.period && row.numbers.length)
      .sort((a, b) => Number(b.period) - Number(a.period));
  }

  function normalize539Rows(rows) {
    return (rows || [])
      .map((row) => ({
        period: row.period || row.draw || row.issue || null,
        drawDate: row.drawDate || row.lotteryDate || row.date || null,
        redeemableDate: row.redeemableDate || "",
        numbers: uniqSorted(row.numbers || row.drawNumberSize || detectNumberArrayFromObject(row, 5)),
        orderNumbers: uniqSorted(row.orderNumbers || []),
        specialNumber: row.specialNumber != null ? Number(row.specialNumber) : null,
        source: row.source || ""
      }))
      .filter((row) => row.period && row.numbers.length)
      .sort((a, b) => Number(b.period) - Number(a.period));
  }

  function normalize649Rows(rows) {
    return (rows || [])
      .map((row) => ({
        period: row.period || row.draw || row.issue || null,
        drawDate: row.drawDate || row.lotteryDate || row.date || null,
        redeemableDate: row.redeemableDate || "",
        numbers: uniqSorted(row.numbers || row.drawNumberSize || detectNumberArrayFromObject(row, 6)),
        orderNumbers: uniqSorted(row.orderNumbers || []),
        specialNumber: row.specialNumber != null ? Number(row.specialNumber) : null,
        source: row.source || ""
      }))
      .filter((row) => row.period && row.numbers.length)
      .sort((a, b) => Number(b.period) - Number(a.period));
  }

  function normalizePowerRows(rows) {
    return (rows || [])
      .map((row) => {
        const zone1 = uniqSorted(
          row.zone1 ||
          row.numbers ||
          row.drawNumberSize ||
          detectNumberArrayFromObject(row, 6)
        );

        const zone2 =
          row.specialNumber != null
            ? Number(row.specialNumber)
            : row.superNumber != null
            ? Number(row.superNumber)
            : row.zone2 != null
            ? Number(row.zone2)
            : row.specialNum != null
            ? Number(row.specialNum)
            : null;

        return {
          period: row.period || row.draw || row.issue || null,
          drawDate: row.drawDate || row.lotteryDate || row.date || null,
          redeemableDate: row.redeemableDate || "",
          zone1,
          zone2: Number.isFinite(zone2) ? zone2 : null,
          orderNumbers: uniqSorted(row.orderNumbers || []),
          source: row.source || ""
        };
      })
      .filter((row) => row.period && row.zone1.length)
      .sort((a, b) => Number(b.period) - Number(a.period));
  }

  function normalizeGameRowsFromLatestJson(json) {
    const out = {
      bingo: [],
      daily539: [],
      lotto649: [],
      power: []
    };

    if (!json || typeof json !== "object") return out;

    const pickArray = (value) => (Array.isArray(value) ? value : []);

    const normalizeBlock = (block, gameKey) => {
      if (!block || typeof block !== "object") return [];

      if (Array.isArray(block)) {
        if (gameKey === "bingo") return normalizeBingoRows(block);
        if (gameKey === "daily539") return normalize539Rows(block);
        if (gameKey === "lotto649") return normalize649Rows(block);
        if (gameKey === "power") return normalizePowerRows(block);
        return [];
      }

      const arr =
        pickArray(block.history).length ? pickArray(block.history) :
        pickArray(block.recentOfficial).length ? pickArray(block.recentOfficial) :
        pickArray(block.recent).length ? pickArray(block.recent) :
        pickArray(block.latestOfficial).length ? pickArray(block.latestOfficial) :
        [];

      const merged = [];
      if (block.latestOfficial && typeof block.latestOfficial === "object") merged.push(block.latestOfficial);
      if (block.latest && typeof block.latest === "object") merged.push(block.latest);
      merged.push(...arr);

      const unique = [];
      const seen = new Set();
      for (const item of merged) {
        const p = item?.period;
        if (!p) continue;
        if (seen.has(String(p))) continue;
        seen.add(String(p));
        unique.push(item);
      }

      if (gameKey === "bingo") return normalizeBingoRows(unique);
      if (gameKey === "daily539") return normalize539Rows(unique);
      if (gameKey === "lotto649") return normalize649Rows(unique);
      if (gameKey === "power") return normalizePowerRows(unique);
      return [];
    };

    out.bingo = normalizeBlock(json.bingo, "bingo");
    out.daily539 = normalizeBlock(json.daily539, "daily539");
    out.lotto649 = normalizeBlock(json.lotto649, "lotto649");

    out.power =
      normalizeBlock(json.superLotto638, "power").length
        ? normalizeBlock(json.superLotto638, "power")
        : normalizeBlock(json.power, "power");

    return out;
  }

  function normalizeGameRowsFromCsv(gameKey, rows) {
    if (gameKey === "bingo") {
      return rows
        .map((row) => {
          const nums = [];
          for (let i = 1; i <= 20; i++) {
            const v = row[`n${i}`] || row[`num${i}`] || row[`ball${i}`];
            if (v !== undefined && v !== "") nums.push(Number(v));
          }
          if (!nums.length && row.numbers) row.numbers.split(/[,、\s]+/).forEach((v) => nums.push(Number(v)));
          return {
            period: row.period || row.issue || row.draw || null,
            drawDate: row.drawDate || row.date || row.lotteryDate || null,
            redeemableDate: row.redeemableDate || "",
            numbers: uniqSorted(nums),
            orderNumbers: [],
            specialNumber: row.specialNumber != null && row.specialNumber !== "" ? Number(row.specialNumber) : null,
            source: "csv"
          };
        })
        .filter((row) => row.period && row.numbers.length)
        .sort((a, b) => Number(b.period) - Number(a.period));
    }

    if (gameKey === "daily539") {
      return rows
        .map((row) => {
          const nums = [];
          for (let i = 1; i <= 5; i++) {
            const v = row[`n${i}`] || row[`num${i}`] || row[`ball${i}`];
            if (v !== undefined && v !== "") nums.push(Number(v));
          }
          if (!nums.length && row.numbers) row.numbers.split(/[,、\s]+/).forEach((v) => nums.push(Number(v)));
          return {
            period: row.period || row.issue || row.draw || null,
            drawDate: row.drawDate || row.date || row.lotteryDate || null,
            redeemableDate: row.redeemableDate || "",
            numbers: uniqSorted(nums),
            orderNumbers: [],
            specialNumber: row.specialNumber != null && row.specialNumber !== "" ? Number(row.specialNumber) : null,
            source: "csv"
          };
        })
        .filter((row) => row.period && row.numbers.length)
        .sort((a, b) => Number(b.period) - Number(a.period));
    }

    if (gameKey === "lotto649") {
      return rows
        .map((row) => {
          const nums = [];
          for (let i = 1; i <= 6; i++) {
            const v = row[`n${i}`] || row[`num${i}`] || row[`ball${i}`];
            if (v !== undefined && v !== "") nums.push(Number(v));
          }
          if (!nums.length && row.numbers) row.numbers.split(/[,、\s]+/).forEach((v) => nums.push(Number(v)));
          return {
            period: row.period || row.issue || row.draw || null,
            drawDate: row.drawDate || row.date || row.lotteryDate || null,
            redeemableDate: row.redeemableDate || "",
            numbers: uniqSorted(nums),
            orderNumbers: [],
            specialNumber: row.specialNumber != null && row.specialNumber !== "" ? Number(row.specialNumber) : null,
            source: "csv"
          };
        })
        .filter((row) => row.period && row.numbers.length)
        .sort((a, b) => Number(b.period) - Number(a.period));
    }

    if (gameKey === "power") {
      return rows
        .map((row) => {
          const zone1 = [];
          for (let i = 1; i <= 6; i++) {
            const v = row[`n${i}`] || row[`num${i}`] || row[`ball${i}`];
            if (v !== undefined && v !== "") zone1.push(Number(v));
          }
          if (!zone1.length && row.zone1) row.zone1.split(/[,、\s]+/).forEach((v) => zone1.push(Number(v)));
          if (!zone1.length && row.numbers) row.numbers.split(/[,、\s]+/).forEach((v) => zone1.push(Number(v)));

          const zone2 =
            row.specialNumber != null && row.specialNumber !== ""
              ? Number(row.specialNumber)
              : row.superNumber != null && row.superNumber !== ""
              ? Number(row.superNumber)
              : row.zone2 != null && row.zone2 !== ""
              ? Number(row.zone2)
              : null;

          return {
            period: row.period || row.issue || row.draw || null,
            drawDate: row.drawDate || row.date || row.lotteryDate || null,
            redeemableDate: row.redeemableDate || "",
            zone1: uniqSorted(zone1),
            zone2: Number.isFinite(zone2) ? zone2 : null,
            orderNumbers: [],
            source: "csv"
          };
        })
        .filter((row) => row.period && row.zone1.length)
        .sort((a, b) => Number(b.period) - Number(a.period));
    }

    return [];
  }

  function getLearningState() {
    const current = readJsonStorage(LEARNING_KEY, null);
    if (!current) {
      writeJsonStorage(LEARNING_KEY, LEARNING_DEFAULT);
      return structuredClone(LEARNING_DEFAULT);
    }
    return {
      ...structuredClone(LEARNING_DEFAULT),
      ...current,
      bingo: { ...structuredClone(LEARNING_DEFAULT.bingo), ...(current.bingo || {}) },
      daily539: { ...structuredClone(LEARNING_DEFAULT.daily539), ...(current.daily539 || {}) },
      lotto649: { ...structuredClone(LEARNING_DEFAULT.lotto649), ...(current.lotto649 || {}) },
      power: { ...structuredClone(LEARNING_DEFAULT.power), ...(current.power || {}) }
    };
  }

  function saveLearningState(stateObj) {
    writeJsonStorage(LEARNING_KEY, stateObj);
    writeJsonStorage(WEIGHTS_KEY, stateObj);
  }

  function learnNumberSet(baseObj, numbers, options = {}) {
    const {
      numberKey = "numberWeights",
      tailKey = "tailWeights",
      pairKeyName = "pairWeights",
      missKey = "missWeights",
      decay = 0.985,
      reward = 1.0,
      pairReward = 0.35,
      tailReward = 0.18
    } = options;

    baseObj[numberKey] ||= {};
    baseObj[tailKey] ||= {};
    baseObj[pairKeyName] ||= {};
    baseObj[missKey] ||= {};

    decayWeights(baseObj[numberKey], decay);
    decayWeights(baseObj[tailKey], decay);
    decayWeights(baseObj[pairKeyName], decay);
    decayWeights(baseObj[missKey], decay);

    const nums = uniqSorted(numbers);

    nums.forEach((n) => {
      safeInc(baseObj[numberKey], String(n), reward);
      safeInc(baseObj[tailKey], String(getTail(n)), tailReward);
    });

    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        safeInc(baseObj[pairKeyName], pairKey(nums[i], nums[j]), pairReward);
      }
    }
  }

  function learnMissPattern(baseObj, universeMax, hitNumbers, missReward = 0.03) {
    baseObj.missWeights ||= {};
    const hitSet = new Set((hitNumbers || []).map(Number));
    for (let i = 1; i <= universeMax; i++) {
      if (!hitSet.has(i)) {
        safeInc(baseObj.missWeights, String(i), missReward);
      } else {
        baseObj.missWeights[String(i)] = 0;
      }
    }
  }

  async function learnFromCurrentData(gameKey) {
    const learning = getLearningState();
    const gameState = learning[gameKey];
    const rows = state.data[gameKey] || [];
    if (!gameState || !rows.length) return;

    const ascendingRows = rows.slice().reverse();

    for (const row of ascendingRows) {
      if (gameState.lastPeriod && String(row.period) <= String(gameState.lastPeriod)) continue;

      if (gameKey === "power") {
        learnNumberSet(gameState, row.zone1, {
          numberKey: "zone1Weights",
          tailKey: "tailWeights",
          pairKeyName: "pairWeights",
          missKey: "missWeights",
          decay: 0.992,
          reward: 1.0,
          pairReward: 0.4,
          tailReward: 0.15
        });
        learnMissPattern(gameState, 38, row.zone1, 0.025);

        gameState.zone2Weights ||= {};
        decayWeights(gameState.zone2Weights, 0.992);
        if (row.zone2 != null) safeInc(gameState.zone2Weights, String(row.zone2), 1.2);
      } else {
        learnNumberSet(gameState, row.numbers, {
          numberKey: "numberWeights",
          tailKey: "tailWeights",
          pairKeyName: "pairWeights",
          missKey: "missWeights",
          decay: gameKey === "bingo" ? 0.996 : 0.992,
          reward: gameKey === "bingo" ? 0.8 : 1.0,
          pairReward: gameKey === "bingo" ? 0.18 : 0.35,
          tailReward: 0.12
        });

        learnMissPattern(gameState, GAME_META[gameKey].max, row.numbers, gameKey === "bingo" ? 0.01 : 0.03);
      }

      gameState.drawsLearned = (gameState.drawsLearned || 0) + 1;
      gameState.lastPeriod = row.period;
      gameState.updatedAt = nowTs();
    }

    saveLearningState(learning);
  }

  function buildLearnedScoreMap(gameKey, maxNumber, recentNumbers = []) {
    const learning = getLearningState();
    const learned = learning[gameKey];
    const scoreMap = {};

    const numWeights = learned?.numberWeights || {};
    const tailWeights = learned?.tailWeights || {};
    const pairWeights = learned?.pairWeights || {};
    const missWeights = learned?.missWeights || {};

    for (let n = 1; n <= maxNumber; n++) {
      let score = 0;
      score += (numWeights[String(n)] || 0) * 1.35;
      score += (tailWeights[String(getTail(n))] || 0) * 0.55;
      score += (missWeights[String(n)] || 0) * 0.85;

      for (const r of recentNumbers) {
        score += (pairWeights[pairKey(n, r)] || 0) * 0.45;
      }

      scoreMap[n] = score;
    }

    return normalizeScores(scoreMap);
  }

  function buildPowerLearnedScores(recentZone1 = []) {
    const learning = getLearningState();
    const learned = learning.power || {};

    const zone1Weights = learned.zone1Weights || {};
    const zone2Weights = learned.zone2Weights || {};
    const tailWeights = learned.tailWeights || {};
    const pairWeights = learned.pairWeights || {};
    const missWeights = learned.missWeights || {};

    const zone1 = {};
    for (let n = 1; n <= 38; n++) {
      let score = 0;
      score += (zone1Weights[String(n)] || 0) * 1.35;
      score += (tailWeights[String(getTail(n))] || 0) * 0.5;
      score += (missWeights[String(n)] || 0) * 0.8;

      for (const r of recentZone1) {
        score += (pairWeights[pairKey(n, r)] || 0) * 0.45;
      }
      zone1[n] = score;
    }

    const zone2 = {};
    for (let n = 1; n <= 8; n++) {
      zone2[n] = zone2Weights[String(n)] || 0;
    }

    return {
      zone1: normalizeScores(zone1),
      zone2: normalizeScores(zone2)
    };
  }

  function sampleRecentNumbers(gameKey, count = 3) {
    const rows = state.data[gameKey] || [];
    const recent = rows.slice(0, count);

    if (gameKey === "power") {
      const out = [];
      recent.forEach((row) => (row.zone1 || []).forEach((n) => out.push(n)));
      return uniqSorted(out).slice(0, 12);
    }

    const out = [];
    recent.forEach((row) => (row.numbers || []).forEach((n) => out.push(n)));
    return uniqSorted(out).slice(0, 12);
  }

  function predictByLearning() {
    const recentBingo = sampleRecentNumbers("bingo", 2);
    const recent539 = sampleRecentNumbers("daily539", 3);
    const recent649 = sampleRecentNumbers("lotto649", 3);
    const recentPower = sampleRecentNumbers("power", 3);

    state.predictions.bingo = pickTopNumbers(
      buildLearnedScoreMap("bingo", 80, recentBingo),
      Number(state.settings.bingoPickCount) || 10
    );

    state.predictions.daily539 = pickTopNumbers(
      buildLearnedScoreMap("daily539", 39, recent539),
      5
    );

    state.predictions.lotto649 = pickTopNumbers(
      buildLearnedScoreMap("lotto649", 49, recent649),
      6
    );

    const powerScores = buildPowerLearnedScores(recentPower);
    state.predictions.power = {
      zone1: pickTopNumbers(powerScores.zone1, 6),
      zone2: pickTopNumbers(powerScores.zone2, 1)[0] || null
    };
  }

  function computeStats(gameKey) {
    const rows = state.data[gameKey] || [];
    const meta = GAME_META[gameKey];
    const counts = {};
    const tailCounts = {};

    for (let i = 1; i <= meta.max; i++) counts[i] = 0;
    for (let i = 0; i <= 9; i++) tailCounts[i] = 0;

    rows.slice(0, Math.min(rows.length, gameKey === "bingo" ? 60 : 80)).forEach((row) => {
      const numbers = gameKey === "power" ? row.zone1 || [] : row.numbers || [];
      numbers.forEach((n) => {
        counts[n] = (counts[n] || 0) + 1;
        tailCounts[getTail(n)] = (tailCounts[getTail(n)] || 0) + 1;
      });
    });

    const hotNumbers = Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
      .slice(0, Math.min(10, meta.max))
      .map(([n]) => Number(n));

    const hotTails = Object.entries(tailCounts)
      .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
      .slice(0, 3)
      .map(([n]) => Number(n));

    return { hotNumbers, hotTails };
  }

  async function loadAllData() {
    state.loading = true;
    state.statusText = "載入資料中…";
    render();

    let latestJson = null;
    try {
      latestJson = await fetchFirstSuccess(JSON_CANDIDATES, fetchJSON);
    } catch (err) {
      console.warn("latest.json load failed:", err.message);
    }

    if (latestJson) {
      const normalized = normalizeGameRowsFromLatestJson(latestJson);
      for (const key of Object.keys(state.data)) {
        if (normalized[key] && normalized[key].length) {
          state.data[key] = normalized[key];
        }
      }
    }

    for (const gameKey of Object.keys(state.data)) {
      if (state.data[gameKey].length) continue;
      try {
        const csvText = await fetchFirstSuccess(CSV_CANDIDATES[gameKey] || [], fetchText);
        const csvRows = parseCSV(csvText);
        state.data[gameKey] = normalizeGameRowsFromCsv(gameKey, csvRows);
      } catch (err) {
        console.warn(`${gameKey} csv load failed:`, err.message);
      }
    }

    for (const gameKey of Object.keys(state.data)) {
      state.latest[gameKey] = state.data[gameKey][0] || null;
    }

    for (const gameKey of Object.keys(state.data)) {
      await learnFromCurrentData(gameKey);
      const latest = state.latest[gameKey];
      if (latest) {
        state.lastFetchState[gameKey] = {
          lastPeriod: latest.period,
          updatedAt: nowTs()
        };
      }
    }

    writeJsonStorage(LAST_FETCH_KEY, state.lastFetchState);
    predictByLearning();
    state.loading = false;
    state.statusText = "資料已更新";
    render();
  }

  function getNextBingoScheduleTime(base = new Date()) {
    const now = new Date(base);
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    const start = new Date(y, m, d, 7, 3, 0, 0);
    const end = new Date(y, m, d, 23, 57, 0, 0);

    if (now < start) return start;
    if (now > end) return new Date(y, m, d + 1, 7, 3, 0, 0);

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = 7 * 60 + 3;
    const diff = currentMins - startMins;
    const nextSlot = Math.floor(diff / 5) * 5 + startMins + 5;
    const h = Math.floor(nextSlot / 60);
    const mm = nextSlot % 60;
    const next = new Date(y, m, d, h, mm, 0, 0);

    if (next > end) return new Date(y, m, d + 1, 7, 3, 0, 0);
    return next;
  }

  async function runBingoAutoUpdateCycle() {
    state.autoState.bingo.lastRunAt = nowTs();
    writeJsonStorage(AUTO_STATE_KEY, state.autoState);

    const prevPeriod = state.lastFetchState.bingo?.lastPeriod || null;
    let success = false;
    let latestPeriod = prevPeriod;

    for (let i = 0; i < 10; i++) {
      try {
        const json = await fetchFirstSuccess(JSON_CANDIDATES, fetchJSON);
        const normalized = normalizeGameRowsFromLatestJson(json);

        if (normalized.bingo.length) {
          state.data.bingo = normalized.bingo;
          state.latest.bingo = normalized.bingo[0] || null;
          latestPeriod = state.latest.bingo?.period || prevPeriod;

          if (String(latestPeriod) !== String(prevPeriod)) {
            success = true;
            break;
          }
        } else {
          const csvText = await fetchFirstSuccess(CSV_CANDIDATES.bingo, fetchText);
          const csvRows = parseCSV(csvText);
          const normalizedCsv = normalizeGameRowsFromCsv("bingo", csvRows);
          if (normalizedCsv.length) {
            state.data.bingo = normalizedCsv;
            state.latest.bingo = normalizedCsv[0] || null;
            latestPeriod = state.latest.bingo?.period || prevPeriod;
            if (String(latestPeriod) !== String(prevPeriod)) {
              success = true;
              break;
            }
          }
        }
      } catch (err) {
        console.warn("runBingoAutoUpdateCycle retry failed:", err.message);
      }

      await new Promise((resolve) => setTimeout(resolve, 15000));
    }

    state.autoState.bingo.lastSuccess = success;
    state.autoState.bingo.lastPeriod = latestPeriod || null;
    state.autoState.bingo.nextAt = getNextBingoScheduleTime().toISOString();

    if (success) {
      state.lastFetchState.bingo = {
        lastPeriod: latestPeriod,
        updatedAt: nowTs()
      };
      writeJsonStorage(LAST_FETCH_KEY, state.lastFetchState);

      await learnFromCurrentData("bingo");
      predictByLearning();
      state.statusText = "BINGO 已抓到新期數並完成自動學習";
    } else {
      state.statusText = "BINGO 自動檢查完成，尚未抓到新期數";
    }

    writeJsonStorage(AUTO_STATE_KEY, state.autoState);
    render();
  }

  function scheduleNextBingoAutoUpdate() {
    if (state.timers.bingoSchedule) clearTimeout(state.timers.bingoSchedule);

    const nextTime = getNextBingoScheduleTime();
    state.autoState.bingo.nextAt = nextTime.toISOString();
    writeJsonStorage(AUTO_STATE_KEY, state.autoState);

    const delay = Math.max(1000, nextTime.getTime() - Date.now());

    state.timers.bingoSchedule = setTimeout(async () => {
      try {
        await runBingoAutoUpdateCycle();
      } finally {
        scheduleNextBingoAutoUpdate();
      }
    }, delay);
  }

  function setupPeriodicRefresh() {
    if (state.timers.generalRefresh) clearInterval(state.timers.generalRefresh);
    if (state.timers.bingoFastRefresh) clearInterval(state.timers.bingoFastRefresh);

    state.timers.generalRefresh = setInterval(async () => {
      if (!state.settings.autoRefresh) return;
      try {
        await loadAllData();
      } catch (err) {
        console.warn("generalRefresh failed:", err.message);
      }
    }, GENERAL_REFRESH_MS);

    state.timers.bingoFastRefresh = setInterval(async () => {
      if (!state.settings.autoRefresh) return;

      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h < 7 || h > 23 || (h === 23 && m > 57)) return;

      try {
        const json = await fetchFirstSuccess(JSON_CANDIDATES, fetchJSON);
        const normalized = normalizeGameRowsFromLatestJson(json);

        if (normalized.bingo.length) {
          const newest = normalized.bingo[0];
          const prev = state.latest.bingo?.period || null;

          if (String(newest.period) !== String(prev)) {
            state.data.bingo = normalized.bingo;
            state.latest.bingo = newest;
            state.lastFetchState.bingo = { lastPeriod: newest.period, updatedAt: nowTs() };
            writeJsonStorage(LAST_FETCH_KEY, state.lastFetchState);

            await learnFromCurrentData("bingo");
            predictByLearning();
            state.statusText = "BINGO 快速輪詢偵測到新資料";
            render();
          }
        }
      } catch (err) {
        console.warn("bingoFastRefresh failed:", err.message);
      }
    }, BINGO_FAST_REFRESH_MS);
  }

  function createBaseStyle() {
    if (document.getElementById("v9311-style")) return;

    const style = document.createElement("style");
    style.id = "v9311-style";
    style.textContent = `
      :root{
        --bg:#0b1220;
        --panel:#111a2b;
        --panel-2:#0f1727;
        --line:rgba(255,255,255,.08);
        --text:#f8fafc;
        --muted:#94a3b8;
        --accent:#38bdf8;
      }
      body.simple-ui{
        background:linear-gradient(180deg,#071019 0%, #0b1220 100%);
        color:var(--text);
        margin:0;
        font-family:Arial,"Microsoft JhengHei",sans-serif;
      }
      body.simple-ui .guide-section,
      body.simple-ui .onboarding-section,
      body.simple-ui .intro-section,
      body.simple-ui .tips-section,
      body.simple-ui .tutorial-section,
      body.simple-ui .hero-guide,
      body.simple-ui .quick-guide,
      body.simple-ui .new-user-guide,
      body.simple-ui .walkthrough-section,
      body.simple-ui .welcome-guide{
        display:none !important;
      }
      #lottery-ai-root-v9311{
        width:min(100%,960px);
        margin:0 auto;
        padding:12px;
        box-sizing:border-box;
      }
      .v93-shell{
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .v93-card{
        background:rgba(17,26,43,.92);
        border:1px solid var(--line);
        border-radius:16px;
        padding:12px;
        box-shadow:0 10px 30px rgba(0,0,0,.18);
      }
      .v93-top{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
      }
      .v93-title{
        font-size:20px;
        font-weight:800;
        margin:0 0 6px;
      }
      .v93-sub{
        color:var(--muted);
        font-size:13px;
        line-height:1.4;
      }
      .v93-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .v93-btn,.v93-select{
        border:none;
        border-radius:12px;
        min-height:42px;
        padding:0 12px;
        background:#1e293b;
        color:#fff;
        cursor:pointer;
      }
      .v93-btn.primary{
        background:linear-gradient(135deg,#0ea5e9,#2563eb);
      }
      .v93-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
      }
      .v93-metrics{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:10px;
      }
      .v93-metric{
        background:rgba(255,255,255,.04);
        border:1px solid var(--line);
        border-radius:14px;
        padding:10px;
      }
      .v93-metric-label{
        color:var(--muted);
        font-size:12px;
        margin-bottom:6px;
      }
      .v93-metric-value{
        font-weight:800;
        font-size:18px;
      }
      .v93-section-title{
        font-size:15px;
        font-weight:800;
        margin:0 0 10px;
      }
      .v93-row{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .num{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:38px;
        height:38px;
        border-radius:999px;
        font-weight:800;
        font-size:14px;
        background:#1f2937;
        border:1px solid rgba(255,255,255,.06);
      }
      .num.small{
        width:32px;
        height:32px;
        font-size:13px;
      }
      .g-bingo .num{ background:linear-gradient(135deg,#2563eb,#0ea5e9); }
      .g-539 .num{ background:linear-gradient(135deg,#16a34a,#22c55e); }
      .g-649 .num{ background:linear-gradient(135deg,#7c3aed,#a855f7); }
      .g-power .num{ background:linear-gradient(135deg,#ea580c,#f97316); }
      .num.zone2{ background:linear-gradient(135deg,#ef4444,#fb7185)!important; }
      .v93-kv{
        display:grid;
        grid-template-columns:100px 1fr;
        gap:8px;
        font-size:13px;
        margin:6px 0;
      }
      .v93-kv .k{ color:var(--muted); }
      .v93-list{
        display:flex;
        flex-direction:column;
        gap:8px;
      }
      .v93-list-item{
        display:flex;
        justify-content:space-between;
        gap:10px;
        padding:8px 10px;
        background:rgba(255,255,255,.03);
        border:1px solid var(--line);
        border-radius:12px;
        font-size:13px;
      }
      .v93-footer{
        text-align:center;
        color:var(--muted);
        font-size:12px;
        padding:6px 0 18px;
      }
      @media (max-width:768px){
        .v93-grid{ grid-template-columns:1fr; }
        .v93-metrics{ grid-template-columns:1fr 1fr; }
        .v93-top{ flex-direction:column; }
        .v93-title{ font-size:18px; }
      }
    `;
    document.head.appendChild(style);
  }

  function applySimpleUIMode() {
    document.body.classList.add("simple-ui");

    const hideSelectors = [
      ".guide-section",
      ".onboarding-section",
      ".intro-section",
      ".tips-section",
      ".tutorial-section",
      ".hero-guide",
      ".quick-guide",
      ".new-user-guide",
      ".walkthrough-section",
      ".welcome-guide"
    ];

    hideSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.display = "none";
      });
    });

    writeJsonStorage(UI_MODE_KEY, { simple: true, updatedAt: nowTs() });
  }

  function ensureRoot() {
    let root =
      document.getElementById("lottery-ai-root-v9311") ||
      document.getElementById("app") ||
      document.getElementById("root") ||
      document.querySelector("[data-lottery-root]");

    if (!root || root.id !== "lottery-ai-root-v9311") {
      const shell = document.createElement("div");
      shell.id = "lottery-ai-root-v9311";

      if (root) {
        root.innerHTML = "";
        root.appendChild(shell);
        root = shell;
      } else {
        document.body.innerHTML = "";
        document.body.appendChild(shell);
        root = shell;
      }
    } else {
      root.innerHTML = "";
    }

    state.root = root;
  }

  function renderBalls(nums, extraClass = "") {
    return (nums || []).map((n) => `<span class="num ${extraClass}">${pad2(n)}</span>`).join("");
  }

  function renderLatestCard(gameKey) {
  const row = state.latest[gameKey];
  const meta = GAME_META[gameKey];
  const stats = computeStats(gameKey);
  const learning = getLearningState()[gameKey];

  let numbersHtml = "-";

  if (gameKey === "power" && row) {
    const zone1 = Array.isArray(row.zone1) ? row.zone1.slice(0, 6) : [];
    const zone2 =
      row.zone2 != null && Number.isFinite(Number(row.zone2))
        ? Number(row.zone2)
        : row.specialNumber != null && Number.isFinite(Number(row.specialNumber))
        ? Number(row.specialNumber)
        : null;

    numbersHtml = `
      <div class="v93-row">${renderBalls(zone1)}</div>
      <div class="v93-row" style="margin-top:8px;">
        ${
          zone2 != null
            ? `<span class="num zone2">${pad2(zone2)}</span>`
            : `<span style="color:#94a3b8;">第二區暫無資料</span>`
        }
      </div>
    `;
  } else if (gameKey === "lotto649" && row) {
    const mainNumbers = Array.isArray(row.numbers) ? row.numbers.slice(0, 6) : [];
    const special =
      row.specialNumber != null && Number.isFinite(Number(row.specialNumber))
        ? Number(row.specialNumber)
        : null;

    numbersHtml = `
      <div class="v93-row">${renderBalls(mainNumbers)}</div>
      <div class="v93-row" style="margin-top:8px;">
        ${
          special != null
            ? `<span class="num zone2">${pad2(special)}</span>`
            : `<span style="color:#94a3b8;">特別號暫無資料</span>`
        }
      </div>
    `;
  } else if (row) {
    numbersHtml = `<div class="v93-row">${renderBalls(row.numbers || [])}</div>`;
  }

  const pickPreview =
    gameKey === "power"
      ? `
        <div class="v93-row">${renderBalls(state.predictions.power.zone1 || [], "small")}</div>
        <div class="v93-row" style="margin-top:8px;">
          ${
            state.predictions.power.zone2 != null
              ? `<span class="num zone2 small">${pad2(state.predictions.power.zone2)}</span>`
              : `<span style="color:#94a3b8;">第二區暫無建議</span>`
          }
        </div>
      `
      : gameKey === "lotto649"
      ? `
        <div class="v93-row">${renderBalls((state.predictions.lotto649 || []).slice(0, 6), "small")}</div>
      `
      : `<div class="v93-row">${renderBalls(state.predictions[gameKey] || [], "small")}</div>`;

  return `
    <section class="v93-card ${meta.colorClass}">
      <h3 class="v93-section-title">${meta.label}</h3>
      <div class="v93-kv"><div class="k">最新期數</div><div>${formatPeriod(row?.period)}</div></div>
      <div class="v93-kv"><div class="k">開獎時間</div><div>${formatDrawDate(row?.drawDate)}</div></div>
      <div class="v93-kv"><div class="k">最新號碼</div><div>${numbersHtml}</div></div>
      <div class="v93-kv"><div class="k">AI推薦</div><div>${pickPreview}</div></div>
      <div class="v93-kv"><div class="k">熱門尾數</div><div>${stats.hotTails.map((n) => `${n}尾`).join("、") || "-"}</div></div>
      <div class="v93-kv"><div class="k">學習期數</div><div>${learning?.drawsLearned || 0}</div></div>
    </section>
  `;
}

  function renderOpsList() {
    const ops = readJsonStorage(OPS_KEY, []);
    if (!ops.length) {
      return `<div class="v93-list-item"><span>尚無操作記錄</span><span>-</span></div>`;
    }

    return ops.slice(0, 8).map((item) => {
      return `<div class="v93-list-item"><span>${item.action || "操作"}</span><span>${formatDateTime(item.at)}</span></div>`;
    }).join("");
  }

  function logOp(action) {
    const ops = readJsonStorage(OPS_KEY, []);
    ops.unshift({ action, at: nowTs() });
    writeJsonStorage(OPS_KEY, ops.slice(0, 30));
  }

  function savePredictionHistory() {
    const history = readJsonStorage(STORAGE_KEY, []);
    history.unshift({
      at: nowTs(),
      predictions: state.predictions,
      latestPeriods: {
        bingo: state.latest.bingo?.period || null,
        daily539: state.latest.daily539?.period || null,
        lotto649: state.latest.lotto649?.period || null,
        power: state.latest.power?.period || null
      }
    });
    writeJsonStorage(STORAGE_KEY, history.slice(0, 50));
  }

  function render() {
    if (!state.root) return;

    const learning = getLearningState();
    const totalLearned =
      (learning.bingo.drawsLearned || 0) +
      (learning.daily539.drawsLearned || 0) +
      (learning.lotto649.drawsLearned || 0) +
      (learning.power.drawsLearned || 0);

    state.lastRenderAt = nowTs();

    state.root.innerHTML = `
      <div class="v93-shell">
        <section class="v93-card">
          <div class="v93-top">
            <div>
              <h1 class="v93-title">台灣彩券 AI 預測系統</h1>
              <div class="v93-sub">${APP_VERSION}</div>
              <div class="v93-sub" style="margin-top:4px;">極簡首頁｜導引已關閉｜BINGO 排程更新｜四种彩票自動學習</div>
            </div>
            <div class="v93-actions">
              <select class="v93-select" id="gameSelect">
                <option value="bingo" ${state.settings.selectedGame === "bingo" ? "selected" : ""}>BINGO</option>
                <option value="daily539" ${state.settings.selectedGame === "daily539" ? "selected" : ""}>539</option>
                <option value="lotto649" ${state.settings.selectedGame === "lotto649" ? "selected" : ""}>大樂透</option>
                <option value="power" ${state.settings.selectedGame === "power" ? "selected" : ""}>威力彩</option>
              </select>
              <select class="v93-select" id="bingoPickCount">
                ${[4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}" ${Number(state.settings.bingoPickCount) === n ? "selected" : ""}>BINGO選${n}顆</option>`).join("")}
              </select>
              <button class="v93-btn primary" id="refreshBtn">立即更新</button>
              <button class="v93-btn" id="predictBtn">重新預測</button>
            </div>
          </div>
        </section>

        <section class="v93-card">
          <div class="v93-metrics">
            <div class="v93-metric">
              <div class="v93-metric-label">系統狀態</div>
              <div class="v93-metric-value">${state.loading ? "更新中" : "已就緒"}</div>
            </div>
            <div class="v93-metric">
              <div class="v93-metric-label">BINGO 下次排程</div>
              <div class="v93-metric-value" style="font-size:14px;">${formatDateTime(state.autoState.bingo.nextAt)}</div>
            </div>
            <div class="v93-metric">
              <div class="v93-metric-label">總學習期數</div>
              <div class="v93-metric-value">${totalLearned}</div>
            </div>
            <div class="v93-metric">
              <div class="v93-metric-label">最後渲染</div>
              <div class="v93-metric-value" style="font-size:14px;">${formatDateTime(state.lastRenderAt)}</div>
            </div>
          </div>
          <div class="v93-sub" style="margin-top:10px;">${state.statusText}</div>
        </section>

        <div class="v93-grid">
          ${renderLatestCard("bingo")}
          ${renderLatestCard("daily539")}
          ${renderLatestCard("lotto649")}
          ${renderLatestCard("power")}
        </div>

        <div class="v93-grid">
          <section class="v93-card">
            <h3 class="v93-section-title">自動更新 / 學習狀態</h3>
            <div class="v93-list">
              <div class="v93-list-item"><span>BINGO 最新期數</span><span>${formatPeriod(state.latest.bingo?.period)}</span></div>
              <div class="v93-list-item"><span>BINGO 上次成功</span><span>${state.autoState.bingo.lastSuccess ? "成功" : "待更新"}</span></div>
              <div class="v93-list-item"><span>BINGO 上次執行</span><span>${formatDateTime(state.autoState.bingo.lastRunAt)}</span></div>
              <div class="v93-list-item"><span>BINGO 下次排程</span><span>${formatDateTime(state.autoState.bingo.nextAt)}</span></div>
              <div class="v93-list-item"><span>539 學習期數</span><span>${learning.daily539.drawsLearned || 0}</span></div>
              <div class="v93-list-item"><span>威力彩學習期數</span><span>${learning.power.drawsLearned || 0}</span></div>
              <div class="v93-list-item"><span>大樂透學習期數</span><span>${learning.lotto649.drawsLearned || 0}</span></div>
            </div>
          </section>

          <section class="v93-card">
            <h3 class="v93-section-title">最近操作</h3>
            <div class="v93-list">${renderOpsList()}</div>
          </section>
        </div>

        <div class="v93-footer">手機操作優化版｜本機學習已啟用｜若要跨裝置同步，需再接 GitHub Actions</div>
      </div>
    `;

    bindUI();
  }

  function bindUI() {
    const refreshBtn = document.getElementById("refreshBtn");
    const predictBtn = document.getElementById("predictBtn");
    const gameSelect = document.getElementById("gameSelect");
    const bingoPickCount = document.getElementById("bingoPickCount");

    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        logOp("手動立即更新");
        state.statusText = "手動更新中…";
        render();
        await loadAllData();
      };
    }

    if (predictBtn) {
      predictBtn.onclick = () => {
        logOp("手動重新預測");
        predictByLearning();
        savePredictionHistory();
        state.statusText = "已重新生成 AI 推薦號碼";
        render();
      };
    }

    if (gameSelect) {
      gameSelect.onchange = (e) => {
        state.settings.selectedGame = e.target.value;
        writeJsonStorage(SETTINGS_KEY, state.settings);
        logOp(`切換遊戲 ${e.target.value}`);
      };
    }

    if (bingoPickCount) {
      bingoPickCount.onchange = (e) => {
        state.settings.bingoPickCount = Number(e.target.value);
        writeJsonStorage(SETTINGS_KEY, state.settings);
        predictByLearning();
        logOp(`BINGO 改為選 ${e.target.value} 顆`);
        render();
      };
    }
  }

  async function bootstrap() {
    if (state.initialized) return;
    state.initialized = true;

    createBaseStyle();
    applySimpleUIMode();
    ensureRoot();
    render();

    try {
      await loadAllData();
      logOp("系統初始化完成");
    } catch (err) {
      console.error(err);
      state.statusText = `初始化失敗：${err.message}`;
      render();
    }

    scheduleNextBingoAutoUpdate();
    setupPeriodicRefresh();
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
