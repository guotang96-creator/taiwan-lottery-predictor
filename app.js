(() => {
  const APP_VERSION = "V91 自動學習排程版";
  const STORAGE_KEY = "taiwan_lottery_prediction_history_v91";
  const OPS_KEY = "taiwan_lottery_recent_ops_v91";
  const SETTINGS_KEY = "taiwan_lottery_dashboard_settings_v91";
  const WEIGHTS_KEY = "taiwan_lottery_learning_weights_v91";
  const AUTO_STATE_KEY = "taiwan_lottery_auto_state_v91";
  const AUTO_REFRESH_MS = 5 * 60 * 1000;

  const JSON_CANDIDATES = [
    "./docs/latest.json",
    "./latest.json",
    "./data/latest.json",
    "/taiwan-lottery-predictor/docs/latest.json",
    "/taiwan-lottery-predictor/latest.json",
    "/taiwan-lottery-predictor/data/latest.json"
  ];

  const CSV_CANDIDATES = {
    bingo: [
      "./docs/raw_data/bingo.csv",
      "./raw_data/bingo.csv",
      "/taiwan-lottery-predictor/docs/raw_data/bingo.csv",
      "/taiwan-lottery-predictor/raw_data/bingo.csv"
    ],
    daily539: [
      "./docs/raw_data/539.csv",
      "./raw_data/539.csv",
      "/taiwan-lottery-predictor/docs/raw_data/539.csv",
      "/taiwan-lottery-predictor/raw_data/539.csv"
    ],
    lotto649: [
      "./docs/raw_data/lotto.csv",
      "./raw_data/lotto.csv",
      "/taiwan-lottery-predictor/docs/raw_data/lotto.csv",
      "/taiwan-lottery-predictor/raw_data/lotto.csv"
    ],
    superLotto638: [
      "./docs/raw_data/power.csv",
      "./raw_data/power.csv",
      "/taiwan-lottery-predictor/docs/raw_data/power.csv",
      "/taiwan-lottery-predictor/raw_data/power.csv"
    ]
  };

  const GAME_CONFIG = {
    bingo: {
      code: "bingo",
      key: "bingo",
      label: "Bingo Bingo",
      min: 1,
      max: 80,
      mainCount: () => Number(document.getElementById("bingoCount")?.value || 10),
      historyMainCount: 20,
      specialLabel: "超級獎號",
      specialMin: 1,
      specialMax: 80
    },
    "539": {
      code: "539",
      key: "daily539",
      label: "今彩539",
      min: 1,
      max: 39,
      mainCount: () => 5,
      historyMainCount: 5,
      specialLabel: "",
      specialMin: null,
      specialMax: null
    },
    "649": {
      code: "649",
      key: "lotto649",
      label: "大樂透",
      min: 1,
      max: 49,
      mainCount: () => 6,
      historyMainCount: 6,
      specialLabel: "特別號",
      specialMin: 1,
      specialMax: 49
    },
    "638": {
      code: "638",
      key: "superLotto638",
      label: "威力彩",
      min: 1,
      max: 38,
      mainCount: () => 6,
      historyMainCount: 6,
      specialLabel: "第二區",
      specialMin: 1,
      specialMax: 8
    }
  };

  const state = {
    latestJson: null,
    latestJsonPath: "",
    currentGameCode: null,
    currentModes: [],
    currentLatestDraw: null,
    autoTimer: null,
    autoRefreshing: false,
    lastAutoRefreshAt: null,
    history: {
      bingo: [],
      daily539: [],
      lotto649: [],
      superLotto638: []
    },
    historySourcePath: {
      bingo: "",
      daily539: "",
      lotto649: "",
      superLotto638: ""
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function range(min, max) {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
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

  function setBadge(text, ok = true) {
    const badge = $("resultBadge");
    if (!badge) return;
    badge.textContent = text;
    if (ok) {
      badge.style.background = "rgba(255,255,255,.08)";
      badge.style.color = "#ffffff";
      badge.style.border = "1px solid rgba(255,255,255,.10)";
    } else {
      badge.style.background = "rgba(255,193,7,.15)";
      badge.style.color = "#ffe08a";
      badge.style.border = "1px solid rgba(255,193,7,.25)";
    }
  }

  function showToast(text) {
    try {
      const old = document.getElementById("v91Toast");
      if (old) old.remove();

      const el = document.createElement("div");
      el.id = "v91Toast";
      el.textContent = text;
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "110px";
      el.style.transform = "translateX(-50%)";
      el.style.background = "rgba(6,17,32,.95)";
      el.style.color = "#fff";
      el.style.padding = "12px 18px";
      el.style.borderRadius = "999px";
      el.style.zIndex = "3000";
      el.style.fontWeight = "800";
      el.style.fontSize = "14px";
      el.style.border = "1px solid rgba(255,255,255,.1)";
      el.style.boxShadow = "0 10px 30px rgba(0,0,0,.28)";
      document.body.appendChild(el);

      setTimeout(() => {
        el.style.transition = "opacity .2s ease";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 220);
      }, 1400);
    } catch {}
  }

  function formatDate(value) {
    if (!value) return "—";
    const raw = String(value).trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      return `${m[1]}-${m[2]}-${m[3]} ${m[4] || "00"}:${m[5] || "00"}`;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function toLocaleDateText(value) {
    if (!value) return "尚未取得";
    const raw = String(value).trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      return `${m[1]}/${m[2]}/${m[3]} ${m[4] || "00"}:${m[5] || "00"}`;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString("zh-TW");
  }

  function getSetCount() {
    return Math.max(1, Math.min(5, Number($("setCount")?.value || 3)));
  }

  function normalizeSpecialValue(value, min = 1, max = 99) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    if (min != null && num < min) return null;
    if (max != null && num > max) return null;
    return num;
  }

  function sanitizeDraw(gameCode, draw) {
    if (!draw || typeof draw !== "object") return null;
    const cfg = GAME_CONFIG[gameCode];
    if (!cfg) return draw;

    return {
      ...draw,
      numbers: Array.isArray(draw.numbers)
        ? draw.numbers.map(v => Number(v)).filter(v => Number.isFinite(v))
        : [],
      orderNumbers: Array.isArray(draw.orderNumbers)
        ? draw.orderNumbers.map(v => Number(v)).filter(v => Number.isFinite(v))
        : [],
      specialNumber: normalizeSpecialValue(draw.specialNumber, cfg.specialMin, cfg.specialMax)
    };
  }

  function defaultLearningWeights() {
    return {
      bingo: { freq: 2.0, miss: 1.3, tail: 0.15, latestPenalty: -1.2, special: 1.0 },
      "539": { freq: 2.0, miss: 1.3, tail: 0.15, latestPenalty: -1.2, special: 0 },
      "649": { freq: 2.0, miss: 1.3, tail: 0.15, latestPenalty: -1.2, special: 1.4 },
      "638": { freq: 2.0, miss: 1.3, tail: 0.15, latestPenalty: -1.2, special: 1.8 }
    };
  }

  function readLearningWeights() {
    try {
      const raw = JSON.parse(localStorage.getItem(WEIGHTS_KEY) || "null");
      const defaults = defaultLearningWeights();
      if (!raw || typeof raw !== "object") return defaults;
      return {
        bingo: { ...defaults.bingo, ...(raw.bingo || {}) },
        "539": { ...defaults["539"], ...(raw["539"] || {}) },
        "649": { ...defaults["649"], ...(raw["649"] || {}) },
        "638": { ...defaults["638"], ...(raw["638"] || {}) }
      };
    } catch {
      return defaultLearningWeights();
    }
  }

  function writeLearningWeights(weights) {
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
  }

  function clampWeight(value, min, max) {
    return Math.max(min, Math.min(max, Number(value)));
  }

  function getLearningWeights(gameCode) {
    const all = readLearningWeights();
    return all[gameCode] || defaultLearningWeights()[gameCode];
  }

  function resetLearningWeights() {
    writeLearningWeights(defaultLearningWeights());
  }

  function readAutoState() {
    try {
      const raw = JSON.parse(localStorage.getItem(AUTO_STATE_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeAutoState(data) {
    localStorage.setItem(AUTO_STATE_KEY, JSON.stringify(data || {}));
  }

  async function fetchFirstText(paths) {
    const errors = [];
    for (const path of paths) {
      try {
        const res = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) {
          errors.push(`${path}: HTTP ${res.status}`);
          continue;
        }
        return { path, text: await res.text() };
      } catch (err) {
        errors.push(`${path}: ${err.message}`);
      }
    }
    throw new Error(errors.join(" | "));
  }

  async function fetchFirstJson(paths) {
    const result = await fetchFirstText(paths);
    return { path: result.path, json: JSON.parse(result.text) };
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
    return normalizeSpecialValue(raw, min, max);
  }

  function normalizeHistoryRows(gameKey, rows) {
    const cfg = Object.values(GAME_CONFIG).find(g => g.key === gameKey);
    if (!cfg) return [];

    const normalized = rows.map(row => {
      const period = inferPeriod(row);
      const drawDate = inferDate(row);

      if (gameKey === "bingo") {
        const numbers = extractNumbersFromRow(row, cfg.min, cfg.max, 20);
        const specialNumber = inferSpecial(
          row,
          ["special", "specialnumber", "supernumber", "超級獎號"],
          cfg.specialMin,
          cfg.specialMax
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
          cfg.specialMin,
          cfg.specialMax
        );

        if (specialNumber == null) {
          const seqKeys = findSequentialNumberKeys(row);
          if (seqKeys.length >= 7) {
            specialNumber = normalizeSpecialValue(row[seqKeys[6]], cfg.specialMin, cfg.specialMax);
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
          cfg.specialMin,
          cfg.specialMax
        );

        if (specialNumber == null) {
          specialNumber = normalizeSpecialValue(firstMatchValue(row, ["second"]), cfg.specialMin, cfg.specialMax);
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
      .filter(item => item.numbers.length >= Math.min(cfg.historyMainCount, 3));
  }

  async function loadHistoryCsv(gameKey) {
    const paths = CSV_CANDIDATES[gameKey];
    const result = await fetchFirstText(paths);
    const rows = parseCsv(result.text);
    return {
      path: result.path,
      data: normalizeHistoryRows(gameKey, rows)
    };
  }

  function toSortableTime(draw) {
    const raw = String(draw?.drawDate || "").replace(" ", "T");
    const dateValue = raw ? new Date(raw).getTime() : 0;
    const safeDate = Number.isFinite(dateValue) ? dateValue : 0;
    const safePeriod = Number(draw?.period || 0);
    return { safeDate, safePeriod };
  }

  function sortDrawsDesc(draws) {
    return [...draws].sort((a, b) => {
      const ta = toSortableTime(a);
      const tb = toSortableTime(b);
      if (tb.safeDate !== ta.safeDate) return tb.safeDate - ta.safeDate;
      return tb.safePeriod - ta.safePeriod;
    });
  }

  function getLatestDraw(gameKey) {
    const raw =
      state.latestJson?.[gameKey]?.latestOfficial ||
      state.latestJson?.[gameKey]?.latest ||
      state.latestJson?.officialLatest?.[gameKey] ||
      null;

    const gameCodeMap = {
      bingo: "bingo",
      daily539: "539",
      lotto649: "649",
      superLotto638: "638"
    };

    return sanitizeDraw(gameCodeMap[gameKey], raw);
  }

  function getHistory(gameKey, limit) {
    const gameCodeMap = {
      bingo: "bingo",
      daily539: "539",
      lotto649: "649",
      superLotto638: "638"
    };
    const gameCode = gameCodeMap[gameKey];

    const history = (state.history[gameKey] || [])
      .map(item => sanitizeDraw(gameCode, item))
      .filter(Boolean);

    const latest = getLatestDraw(gameKey);
    const merged = [...history];

    if (latest) {
      const latestKey = `${latest.period || ""}__${latest.drawDate || ""}`;
      const idx = merged.findIndex(item => `${item.period || ""}__${item.drawDate || ""}` === latestKey);
      if (idx >= 0) merged[idx] = latest;
      else merged.push(latest);
    }

    const deduped = new Map();
    for (const item of merged) {
      const key = `${item.period || ""}__${item.drawDate || ""}`;
      if (!deduped.has(key)) deduped.set(key, item);
      else if ((item.numbers?.length || 0) >= (deduped.get(key).numbers?.length || 0)) deduped.set(key, item);
    }

    return sortDrawsDesc([...deduped.values()]).slice(0, limit);
  }

  function frequencyAnalysis(draws, min, max) {
    const freq = new Map(range(min, max).map(n => [n, 0]));
    draws.forEach(draw => {
      (draw.numbers || []).forEach(n => {
        freq.set(n, (freq.get(n) || 0) + 1);
      });
    });

    const arr = [...freq.entries()].map(([number, count]) => ({ number, count }));
    return {
      hot: [...arr].sort((a, b) => b.count - a.count || a.number - b.number).slice(0, 10),
      cold: [...arr].sort((a, b) => a.count - b.count || a.number - b.number).slice(0, 10),
      map: freq
    };
  }

  function missAnalysis(draws, min, max) {
    return range(min, max)
      .map(n => {
        let miss = 0;
        let found = false;
        for (const draw of draws) {
          if ((draw.numbers || []).includes(n)) {
            found = true;
            break;
          }
          miss += 1;
        }
        return { number: n, miss: found ? miss : draws.length };
      })
      .sort((a, b) => b.miss - a.miss || a.number - b.number)
      .slice(0, 10);
  }

  function missMap(draws, min, max) {
    const map = new Map();
    range(min, max).forEach(n => {
      let miss = 0;
      let found = false;
      for (const draw of draws) {
        if ((draw.numbers || []).includes(n)) {
          found = true;
          break;
        }
        miss += 1;
      }
      map.set(n, found ? miss : draws.length);
    });
    return map;
  }

  function tailAnalysis(draws) {
    const tails = new Map(Array.from({ length: 10 }, (_, i) => [i, 0]));
    draws.forEach(draw => {
      (draw.numbers || []).forEach(n => {
        const t = n % 10;
        tails.set(t, (tails.get(t) || 0) + 1);
      });
    });

    return [...tails.entries()]
      .map(([tail, count]) => ({ tail, count }))
      .sort((a, b) => b.count - a.count || a.tail - b.tail)
      .slice(0, 6);
  }

  function consecutiveAnalysis(draws) {
    const pairs = new Map();
    draws.forEach(draw => {
      const nums = [...(draw.numbers || [])].sort((a, b) => a - b);
      for (let i = 0; i < nums.length - 1; i += 1) {
        if (nums[i + 1] === nums[i] + 1) {
          const key = `${pad2(nums[i])}-${pad2(nums[i + 1])}`;
          pairs.set(key, (pairs.get(key) || 0) + 1);
        }
      }
    });

    return [...pairs.entries()]
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count || a.pair.localeCompare(b.pair))
      .slice(0, 8);
  }

  function computeTailHotness(draws) {
    const map = new Map(Array.from({ length: 10 }, (_, i) => [i, 0]));
    draws.forEach(draw => {
      (draw.numbers || []).forEach(n => {
        map.set(n % 10, (map.get(n % 10) || 0) + 1);
      });
    });
    return map;
  }

  function buildScorePool(gameCode, draws, min, max, latestDraw) {
    const freq = frequencyAnalysis(draws, min, max).map;
    const miss = missMap(draws, min, max);
    const tailHot = computeTailHotness(draws);
    const latestNums = new Set(latestDraw?.numbers || []);
    const weights = getLearningWeights(gameCode);

    return range(min, max)
      .map(number => {
        const f = freq.get(number) || 0;
        const m = miss.get(number) || 0;
        const t = tailHot.get(number % 10) || 0;
        const latestPenalty = latestNums.has(number) ? weights.latestPenalty : 0;

        const score =
          f * weights.freq +
          m * weights.miss +
          t * weights.tail +
          latestPenalty;

        return { number, score };
      })
      .sort((a, b) => b.score - a.score || a.number - b.number);
  }

  function buildSecondAreaPool(gameCode, draws, min = 1, max = 8) {
    const map = new Map(range(min, max).map(n => [n, 0]));
    const miss = new Map(range(min, max).map(n => [n, 0]));
    const weights = getLearningWeights(gameCode);

    draws.forEach(draw => {
      const s = Number(draw.specialNumber);
      if (Number.isFinite(s) && s >= min && s <= max) {
        map.set(s, (map.get(s) || 0) + 1);
      }
    });

    range(min, max).forEach(n => {
      let missCount = 0;
      let found = false;
      for (const draw of draws) {
        if (Number(draw.specialNumber) === n) {
          found = true;
          break;
        }
        missCount += 1;
      }
      miss.set(n, found ? missCount : draws.length);
    });

    return range(min, max)
      .map(n => ({
        number: n,
        score: (map.get(n) || 0) * weights.special + (miss.get(n) || 0) * 1.1
      }))
      .sort((a, b) => b.score - a.score || a.number - b.number);
  }

  function buildSpecialPool649(gameCode, draws, min = 1, max = 49) {
    const map = new Map(range(min, max).map(n => [n, 0]));
    const miss = new Map(range(min, max).map(n => [n, 0]));
    const weights = getLearningWeights(gameCode);

    draws.forEach(draw => {
      const s = Number(draw.specialNumber);
      if (Number.isFinite(s) && s >= min && s <= max) {
        map.set(s, (map.get(s) || 0) + 1);
      }
    });

    range(min, max).forEach(n => {
      let missCount = 0;
      let found = false;
      for (const draw of draws) {
        if (Number(draw.specialNumber) === n) {
          found = true;
          break;
        }
        missCount += 1;
      }
      miss.set(n, found ? missCount : draws.length);
    });

    return range(min, max)
      .map(n => ({
        number: n,
        score: (map.get(n) || 0) * weights.special + (miss.get(n) || 0) * 1.05
      }))
      .sort((a, b) => b.score - a.score || a.number - b.number);
  }

  function pickNumbersFromPool(pool, count, strategy, shift = 0) {
    if (!pool.length) return [];

    if (strategy === "safe") {
      return pool.slice(shift, shift + count).map(x => x.number).sort((a, b) => a - b);
    }

    if (strategy === "balanced") {
      const top = pool.slice(0, count * 3 + shift);
      const picked = [];
      for (let i = shift; i < top.length && picked.length < count; i += 2) {
        if (!picked.includes(top[i]?.number)) picked.push(top[i].number);
      }
      for (let i = 0; i < top.length && picked.length < count; i += 1) {
        if (!picked.includes(top[i]?.number)) picked.push(top[i].number);
      }
      return picked.sort((a, b) => a - b);
    }

    const top = pool.slice(0, count * 4 + shift);
    const picked = [];
    for (let i = shift; i < top.length && picked.length < count; i += 3) {
      const n = top[i]?.number;
      if (n != null && !picked.includes(n)) picked.push(n);
    }
    for (let i = 1; i < top.length && picked.length < count; i += 2) {
      const n = top[i]?.number;
      if (n != null && !picked.includes(n)) picked.push(n);
    }
    for (const item of top) {
      if (picked.length >= count) break;
      if (!picked.includes(item.number)) picked.push(item.number);
    }
    return picked.sort((a, b) => a - b);
  }

  function buildPredictionModes(gameCode, draws, latestDraw) {
    const cfg = GAME_CONFIG[gameCode];
    const pickCount = cfg.mainCount();
    const setCount = getSetCount();
    const pool = buildScorePool(gameCode, draws, cfg.min, cfg.max, latestDraw);

    const baseModes = [
      { mode: "保守組", desc: "偏重高頻熱號與穩定分布", strategy: "safe", shift: 0 },
      { mode: "平衡組", desc: "兼顧熱號、遺漏與尾數平衡", strategy: "balanced", shift: 0 },
      { mode: "進攻組", desc: "提高冷熱混搭與追擊波動", strategy: "attack", shift: 0 },
      { mode: "延伸組", desc: "延伸熱門池，避開過度集中", strategy: "safe", shift: 1 },
      { mode: "衝刺組", desc: "加大變化幅度，做高低搭配", strategy: "attack", shift: 1 }
    ];

    const spPool638 = gameCode === "638" ? buildSecondAreaPool("638", draws, 1, 8) : [];
    const spPool649 = gameCode === "649" ? buildSpecialPool649("649", draws, 1, 49) : [];

    return baseModes.slice(0, setCount).map((item, idx) => {
      let specialNumber = null;

      if (gameCode === "649") {
        specialNumber =
          spPool649[idx]?.number ??
          spPool649[0]?.number ??
          normalizeSpecialValue(latestDraw?.specialNumber, 1, 49) ??
          null;
      }

      if (gameCode === "638") {
        specialNumber =
          spPool638[idx]?.number ??
          spPool638[0]?.number ??
          normalizeSpecialValue(latestDraw?.specialNumber, 1, 8) ??
          1;
      }

      if (gameCode === "bingo") {
        specialNumber = normalizeSpecialValue(latestDraw?.specialNumber, 1, 80);
      }

      return {
        mode: item.mode,
        desc: item.desc,
        numbers: pickNumbersFromPool(pool, pickCount, item.strategy, item.shift),
        specialNumber
      };
    });
  }

  function countHits(predicted, actual) {
    const actualSet = new Set(actual || []);
    return (predicted || []).filter(n => actualSet.has(n)).length;
  }

  function countSpecialHit(predictedSpecial, actualSpecial, gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    const p = normalizeSpecialValue(predictedSpecial, cfg.specialMin, cfg.specialMax);
    const a = normalizeSpecialValue(actualSpecial, cfg.specialMin, cfg.specialMax);
    if (p == null || a == null) return 0;
    return p === a ? 1 : 0;
  }

  function simulatePredictionForIndex(gameCode, historyDraws) {
    const cfg = GAME_CONFIG[gameCode];
    const target = historyDraws[0];
    const train = historyDraws.slice(1);
    if (!target || train.length < 5) return null;

    const modes = buildPredictionModes(gameCode, train, train[0]);
    const bestHit = Math.max(...modes.map(mode => countHits(mode.numbers, target.numbers)));

    return {
      period: target.period,
      hit: bestHit,
      targetNumbers: target.numbers,
      pickCount: cfg.mainCount()
    };
  }

  function runBacktest(gameCode, historyDraws) {
    const windows = [30, 50, 100];

    return windows.map(windowSize => {
      const usable = historyDraws.slice(0, windowSize + 10);
      const results = [];

      for (let i = 0; i < Math.min(windowSize, usable.length - 5); i += 1) {
        const segment = usable.slice(i);
        const result = simulatePredictionForIndex(gameCode, segment);
        if (result) results.push(result);
      }

      if (!results.length) {
        return { windowSize, samples: 0, avgHit: 0, hit1: 0, hit2: 0, hit3: 0 };
      }

      const totalHit = results.reduce((sum, r) => sum + r.hit, 0);

      return {
        windowSize,
        samples: results.length,
        avgHit: (totalHit / results.length).toFixed(2),
        hit1: results.filter(r => r.hit >= 1).length,
        hit2: results.filter(r => r.hit >= 2).length,
        hit3: results.filter(r => r.hit >= 3).length
      };
    });
  }

  function readPredictionHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writePredictionHistory(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
  }

  function savePredictionRecord(gameCode, latestDraw, modes) {
    const cfg = GAME_CONFIG[gameCode];
    const list = readPredictionHistory();
    const safeLatest = sanitizeDraw(gameCode, latestDraw);

    const record = {
      id: `${gameCode}_${Date.now()}`,
      gameCode,
      gameKey: cfg.key,
      gameLabel: cfg.label,
      createdAt: new Date().toISOString(),
      referencePeriod: safeLatest?.period || "",
      referenceDrawDate: safeLatest?.drawDate || "",
      learningWeights: getLearningWeights(gameCode),
      modes: modes.map(mode => ({
        mode: mode.mode,
        numbers: mode.numbers || [],
        specialNumber: normalizeSpecialValue(mode.specialNumber, cfg.specialMin, cfg.specialMax)
      })),
      checked: false,
      learned: false,
      resultPeriod: "",
      resultDrawDate: "",
      resultNumbers: [],
      resultSpecialNumber: null,
      bestHit: 0,
      specialHit: 0
    };

    const deduped = list.filter(item => !(item.gameCode === gameCode && item.referencePeriod === record.referencePeriod));
    deduped.unshift(record);
    writePredictionHistory(deduped);
    return record;
  }

  function applyLearningFromRecord(record) {
    if (!record || !record.checked || record.learned) return false;

    const weightsAll = readLearningWeights();
    const gameCode = record.gameCode;
    const current = { ...(weightsAll[gameCode] || defaultLearningWeights()[gameCode]) };

    const totalPredicted = Math.max(
      ...record.modes.map(mode => Array.isArray(mode.numbers) ? mode.numbers.length : 0),
      1
    );

    const hitRate = Number(record.bestHit || 0) / totalPredicted;
    const specialBoost = Number(record.specialHit || 0) > 0 ? 0.04 : -0.02;

    if (hitRate >= 0.5) {
      current.freq = clampWeight(current.freq + 0.08, 0.8, 4.0);
      current.miss = clampWeight(current.miss + 0.05, 0.4, 3.5);
      current.tail = clampWeight(current.tail + 0.01, 0.01, 0.8);
    } else if (hitRate >= 0.3) {
      current.freq = clampWeight(current.freq + 0.03, 0.8, 4.0);
      current.miss = clampWeight(current.miss + 0.02, 0.4, 3.5);
    } else {
      current.freq = clampWeight(current.freq - 0.04, 0.8, 4.0);
      current.miss = clampWeight(current.miss - 0.03, 0.4, 3.5);
      current.tail = clampWeight(current.tail - 0.005, 0.01, 0.8);
    }

    current.special = clampWeight((current.special || 1) + specialBoost, 0.2, 3.5);

    if (hitRate < 0.25) {
      current.latestPenalty = clampWeight(current.latestPenalty - 0.05, -3.0, 0);
    } else {
      current.latestPenalty = clampWeight(current.latestPenalty + 0.03, -3.0, 0);
    }

    weightsAll[gameCode] = current;
    writeLearningWeights(weightsAll);
    record.learned = true;
    return true;
  }

  function updatePredictionTracking() {
    const list = readPredictionHistory();
    let changed = false;
    let learnedCount = 0;

    for (const item of list) {
      const latest = getLatestDraw(item.gameKey);
      if (!latest || !latest.period) continue;

      const latestPeriodNum = Number(latest.period || 0);
      const refPeriodNum = Number(item.referencePeriod || 0);

      if (latestPeriodNum > refPeriodNum && !item.checked) {
        const bestHit = Math.max(...item.modes.map(mode => countHits(mode.numbers || [], latest.numbers || [])));
        const bestSpecialHit = Math.max(...item.modes.map(mode => countSpecialHit(mode.specialNumber, latest.specialNumber, item.gameCode)));

        item.checked = true;
        item.resultPeriod = latest.period || "";
        item.resultDrawDate = latest.drawDate || "";
        item.resultNumbers = latest.numbers || [];
        item.resultSpecialNumber = latest.specialNumber ?? null;
        item.bestHit = bestHit;
        item.specialHit = bestSpecialHit;
        changed = true;
      }

      if (applyLearningFromRecord(item)) {
        learnedCount += 1;
        changed = true;
      }
    }

    if (changed) writePredictionHistory(list);
    return { list, learnedCount };
  }

  function clearPredictionHistory() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function getTrackingSummary(gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    const list = readPredictionHistory().filter(item => item.gameCode === gameCode);
    const checked = list.filter(item => item.checked);
    const waiting = list.filter(item => !item.checked);

    const avgHit = checked.length
      ? (checked.reduce((sum, item) => sum + Number(item.bestHit || 0), 0) / checked.length).toFixed(2)
      : "0.00";

    return {
      total: list.length,
      checked: checked.length,
      waiting: waiting.length,
      avgHit,
      hit1: checked.filter(item => Number(item.bestHit || 0) >= 1).length,
      hit2: checked.filter(item => Number(item.bestHit || 0) >= 2).length,
      hit3: checked.filter(item => Number(item.bestHit || 0) >= 3).length,
      recent: list.slice(0, 5),
      cfg
    };
  }

  function getTrackingRollup() {
    const gameCodes = ["bingo", "649", "638", "539"];
    let total = 0;
    let checked = 0;
    let waiting = 0;
    let avgAccumulator = 0;
    let avgCount = 0;

    gameCodes.forEach(code => {
      const summary = getTrackingSummary(code);
      total += Number(summary.total || 0);
      checked += Number(summary.checked || 0);
      waiting += Number(summary.waiting || 0);

      const avg = Number(summary.avgHit || 0);
      if (!Number.isNaN(avg) && Number(summary.checked || 0) > 0) {
        avgAccumulator += avg;
        avgCount += 1;
      }
    });

    return {
      total,
      checked,
      waiting,
      avgHit: avgCount ? (avgAccumulator / avgCount).toFixed(2) : "0.00"
    };
  }

  function getOps() {
    try {
      const data = JSON.parse(localStorage.getItem(OPS_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveOps(list) {
    localStorage.setItem(OPS_KEY, JSON.stringify(list.slice(0, 12)));
  }

  function pushOp(text) {
    const list = getOps();
    list.unshift({ text, time: new Date().toISOString() });
    saveOps(list);
    renderOps();
  }

  function renderOps() {
    const box = $("v84RecentOps");
    if (!box) return;

    const list = getOps();
    if (!list.length) {
      box.innerHTML = `<div class="v84-recent-item">尚未有操作紀錄</div>`;
      return;
    }

    box.innerHTML = list.slice(0, 6).map(item => `
      <div class="v84-recent-item">
        <div style="font-weight:800;margin-bottom:6px;">${escapeHtml(item.text)}</div>
        <div style="font-size:12px;opacity:.72;">${escapeHtml(toLocaleDateText(item.time))}</div>
      </div>
    `).join("");
  }

  function saveUiSettings() {
    const payload = {
      lotterySelect: $("lotterySelect")?.value || "bingo",
      setCount: $("setCount")?.value || "3",
      historyPeriods: $("historyPeriods")?.value || "50",
      bingoCount: $("bingoCount")?.value || "10"
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  }

  function restoreUiSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (raw.lotterySelect && $("lotterySelect")) $("lotterySelect").value = raw.lotterySelect;
      if (raw.setCount && $("setCount")) $("setCount").value = raw.setCount;
      if (raw.historyPeriods && $("historyPeriods")) $("historyPeriods").value = raw.historyPeriods;
      if (raw.bingoCount && $("bingoCount")) $("bingoCount").value = raw.bingoCount;
    } catch {}
  }

  function renderBalls(numbers, specialNumber = null, specialLabel = "", type = "dark") {
    const ballClass = type === "light" ? "ball main" : "ball";
    const main = (numbers || [])
      .map(n => `<span class="${ballClass}">${pad2(n)}</span>`)
      .join("");

    const safeSpecial =
      specialNumber === null || specialNumber === undefined || specialNumber === ""
        ? null
        : Number(specialNumber);

    const special = Number.isFinite(safeSpecial)
      ? `
        <div class="special-box">
          ${specialLabel ? `<span>${escapeHtml(specialLabel)}</span>` : ""}
          <span class="ball special">${pad2(safeSpecial)}</span>
        </div>
      `
      : "";

    if (!main && !special) return `<span class="text-muted">無資料</span>`;
    return `${main}${special}`;
  }

  function renderTagList(items, type) {
    if (!items.length) return `<span class="text-muted">無資料</span>`;

    if (type === "tail") {
      return items.map(item => `<span class="badge">尾${item.tail}（${item.count}）</span>`).join("");
    }

    if (type === "pair") {
      return items.map(item => `<span class="badge">${item.pair}（${item.count}）</span>`).join("");
    }

    if (type === "miss") {
      return items.map(item => `<span class="badge">${pad2(item.number)}（${item.miss}）</span>`).join("");
    }

    return items.map(item => `<span class="badge">${pad2(item.number)}（${item.count}）</span>`).join("");
  }

  function renderLatestFive(draws, gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    if (!draws.length) return `<div class="text-muted">尚無資料</div>`;

    return sortDrawsDesc(draws).slice(0, 5).map(draw => `
      <div class="latest-five-item">
        <div class="latest-five-issue">
          第 ${escapeHtml(draw.period || "—")} 期｜${escapeHtml(formatDate(draw.drawDate || ""))}
        </div>
        <div class="ball-row">
          ${renderBalls(draw.numbers || [], draw.specialNumber, cfg.specialLabel, "light")}
        </div>
      </div>
    `).join("");
  }

  function renderBacktest(backtests) {
    return `
      <div class="result-grid">
        ${backtests.map(item => `
          <div class="result-card">
            <div class="card-title">近 ${item.windowSize} 期回測</div>
            <div class="text-block">
              樣本數：${item.samples}<br>
              平均命中：${item.avgHit}<br>
              命中 1 碼以上：${item.hit1}<br>
              命中 2 碼以上：${item.hit2}<br>
              命中 3 碼以上：${item.hit3}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderModes(modes, gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    return `
      <div class="group-list">
        ${modes.map(mode => `
          <div class="result-card highlight-card">
            <div class="card-title">${escapeHtml(mode.mode)}</div>
            <div class="text-block" style="margin-bottom:12px;">${escapeHtml(mode.desc)}</div>
            <div class="ball-row">
              ${renderBalls(mode.numbers, mode.specialNumber, cfg.specialLabel, "light")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderLearningWeights(gameCode) {
    const w = getLearningWeights(gameCode);

    return `
      <div class="result-grid">
        <div class="result-card">
          <div class="card-title">熱號權重</div>
          <div class="text-block">${w.freq.toFixed(2)}</div>
        </div>
        <div class="result-card">
          <div class="card-title">遺漏權重</div>
          <div class="text-block">${w.miss.toFixed(2)}</div>
        </div>
        <div class="result-card">
          <div class="card-title">尾數權重</div>
          <div class="text-block">${w.tail.toFixed(2)}</div>
        </div>
        <div class="result-card">
          <div class="card-title">避開上期權重</div>
          <div class="text-block">${w.latestPenalty.toFixed(2)}</div>
        </div>
        <div class="result-card full-width">
          <div class="card-title">特別號 / 第二區權重</div>
          <div class="text-block">${Number(w.special || 0).toFixed(2)}</div>
        </div>
      </div>
    `;
  }

  function getDataStatus(gameCode, draws, latestDraw) {
    const historyPath = state.historySourcePath[GAME_CONFIG[gameCode].key] || "";
    const latestPath = state.latestJsonPath || "";
    const generatedAt = state.latestJson?.generatedAt || "";
    const source = latestDraw?.source || state.latestJson?.source || "unknown";
    const latestStamp = latestDraw?.drawDate || "";
    const lagMin = latestStamp
      ? Math.max(0, Math.floor((Date.now() - new Date(String(latestStamp).replace(" ", "T")).getTime()) / 60000))
      : null;

    let syncText = "—";
    let compareText = "—";
    let refreshText = state.lastAutoRefreshAt
      ? `系統最近自動檢查：${toLocaleDateText(state.lastAutoRefreshAt)}`
      : "等待第一次自動檢查";

    if (gameCode === "bingo") {
      if (lagMin === null || Number.isNaN(lagMin)) {
        syncText = "未知";
        compareText = "無法判定";
      } else if (lagMin <= 15) {
        syncText = `正常（落後約 ${lagMin} 分鐘）`;
        compareText = "與官方站接近同步";
      } else if (lagMin <= 60) {
        syncText = `稍慢（落後約 ${lagMin} 分鐘）`;
        compareText = "可能比官方站慢一到數期";
      } else {
        syncText = `偏慢（落後約 ${lagMin} 分鐘）`;
        compareText = "大機率落後官方站最新 Bingo";
      }
    }

    return {
      generatedAt,
      source,
      latestPath,
      historyPath,
      historyCount: draws.length,
      bingoSyncText: syncText,
      bingoCompareText: compareText,
      refreshText
    };
  }

  function renderStatus(status, gameCode) {
    return `
      <div class="result-grid">
        <div class="result-card">
          <div class="card-title">版本</div>
          <div class="text-block">${escapeHtml(APP_VERSION)}</div>
        </div>
        <div class="result-card">
          <div class="card-title">資料最後更新</div>
          <div class="text-block">${escapeHtml(formatDate(status.generatedAt))}</div>
        </div>
        <div class="result-card">
          <div class="card-title">最新資料來源</div>
          <div class="text-block">${escapeHtml(status.source)}</div>
        </div>
        <div class="result-card">
          <div class="card-title">JSON 載入路徑</div>
          <div class="text-block">${escapeHtml(status.latestPath || "—")}</div>
        </div>
        <div class="result-card">
          <div class="card-title">歷史 CSV 路徑</div>
          <div class="text-block">${escapeHtml(status.historyPath || "—")}</div>
        </div>
        <div class="result-card">
          <div class="card-title">歷史學習期數</div>
          <div class="text-block">${escapeHtml(String(status.historyCount))} 期</div>
        </div>
        <div class="result-card full-width">
          <div class="card-title">自動檢查狀態</div>
          <div class="text-block">${escapeHtml(status.refreshText)}</div>
        </div>
        ${
          gameCode === "bingo"
            ? `
              <div class="result-card full-width">
                <div class="card-title">Bingo 即時同步狀態</div>
                <div class="text-block">${escapeHtml(status.bingoSyncText)}｜${escapeHtml(status.bingoCompareText)}</div>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  function renderHints(status, gameCode) {
    if (gameCode !== "bingo") {
      return `
        <div class="result-card highlight-card">
          <div class="card-title">資料提示</div>
          <div class="text-block">
            系統會每 5 分鐘自動檢查新資料。只有出現新一期時，才會自動比對與學習，不會重複學同一批資料。
          </div>
        </div>
      `;
    }

    return `
      <div class="result-card highlight-card">
        <div class="card-title">Bingo 官方比對提示</div>
        <div class="text-block">
          官方比對：${escapeHtml(status.bingoCompareText)}<br>
          自動檢查：${escapeHtml(status.refreshText)}
        </div>
      </div>
    `;
  }

  function renderTracking(gameCode) {
    const summary = getTrackingSummary(gameCode);
    const cfg = summary.cfg;

    return `
      <div class="result-grid">
        <div class="result-card"><div class="card-title">已儲存預測</div><div class="text-block">${summary.total} 筆</div></div>
        <div class="result-card"><div class="card-title">已完成比對</div><div class="text-block">${summary.checked} 筆</div></div>
        <div class="result-card"><div class="card-title">等待開獎比對</div><div class="text-block">${summary.waiting} 筆</div></div>
        <div class="result-card"><div class="card-title">平均命中</div><div class="text-block">${summary.avgHit}</div></div>
        <div class="result-card"><div class="card-title">命中 1 碼以上</div><div class="text-block">${summary.hit1} 筆</div></div>
        <div class="result-card"><div class="card-title">命中 2 碼以上</div><div class="text-block">${summary.hit2} 筆</div></div>
        <div class="result-card"><div class="card-title">命中 3 碼以上</div><div class="text-block">${summary.hit3} 筆</div></div>
      </div>

      <div class="v84-toolbar">
        <button id="v84InlineSaveBtn" class="toolbar-btn" type="button">儲存本次預測</button>
        <button id="v84InlineClearBtn" class="toolbar-btn" type="button">清空命中紀錄</button>
        <button id="v91InlineResetWeightsBtn" class="toolbar-btn" type="button">重置學習權重</button>
      </div>

      <div class="group-list" style="margin-top:14px;">
        ${
          summary.recent.length
            ? summary.recent.map(item => `
              <div class="result-card">
                <div class="card-title">${escapeHtml(item.gameLabel)}</div>
                <div class="text-block" style="margin-bottom:10px;">
                  建立：${escapeHtml(formatDate(item.createdAt))}<br>
                  參考期數：${escapeHtml(item.referencePeriod || "—")}<br>
                  ${item.checked ? `比對期數：${escapeHtml(item.resultPeriod || "—")}` : "尚未比對"}<br>
                  學習狀態：${item.learned ? "已學習" : (item.checked ? "待學習" : "等待比對")}
                </div>

                <div class="group-list" style="margin-bottom:12px;">
                  ${item.modes.map(mode => `
                    <div class="group-item">
                      <div class="group-label">${escapeHtml(mode.mode)}</div>
                      <div class="ball-row">${renderBalls(mode.numbers || [], mode.specialNumber, cfg.specialLabel, "light")}</div>
                    </div>
                  `).join("")}
                </div>

                ${
                  item.checked
                    ? `
                      <div class="text-block">
                        最佳命中：${item.bestHit} 碼
                        ${item.resultSpecialNumber != null ? `｜特別號/第二區命中：${item.specialHit ? "是" : "否"}` : ""}
                      </div>
                      <div class="group-item" style="margin-top:10px;">
                        <div class="group-label">實際開獎</div>
                        <div class="ball-row">${renderBalls(item.resultNumbers || [], item.resultSpecialNumber, cfg.specialLabel, "light")}</div>
                      </div>
                    `
                    : `<div class="text-block">等待下一期開獎後自動比對</div>`
                }
              </div>
            `).join("")
            : `<div class="result-card"><div class="text-block">目前尚無預測紀錄，先按上方按鈕儲存本次預測。</div></div>`
        }
      </div>
    `;
  }

  function renderHeroKpis(gameCode) {
    const box = $("v84HeroKpis");
    if (!box) return;

    const latestDraw = state.currentLatestDraw;
    const stat = getTrackingRollup();

    box.innerHTML = `
      <div class="v84-kpi-card">
        <div class="v84-kpi-label">目前彩種</div>
        <div class="v84-kpi-value">${escapeHtml(gameCode ? GAME_CONFIG[gameCode].label : "待選擇")}</div>
        <div class="v84-kpi-note">目前顯示中的預測頁</div>
      </div>
      <div class="v84-kpi-card">
        <div class="v84-kpi-label">最新期數</div>
        <div class="v84-kpi-value">${escapeHtml(latestDraw?.period || "—")}</div>
        <div class="v84-kpi-note">${escapeHtml(latestDraw?.drawDate ? toLocaleDateText(latestDraw.drawDate) : "尚未載入")}</div>
      </div>
      <div class="v84-kpi-card">
        <div class="v84-kpi-label">已儲存預測</div>
        <div class="v84-kpi-value">${stat.total}</div>
        <div class="v84-kpi-note">命中追蹤資料庫</div>
      </div>
      <div class="v84-kpi-card">
        <div class="v84-kpi-label">平均命中</div>
        <div class="v84-kpi-value">${stat.avgHit}</div>
        <div class="v84-kpi-note">跨彩種統計</div>
      </div>
    `;
  }

  function renderMiniStats() {
    const box = $("v84MiniStats");
    if (!box) return;
    const s = getTrackingRollup();

    box.innerHTML = `
      <div class="v84-mini-stat">
        <span>已儲存預測</span>
        <strong>${s.total}</strong>
      </div>
      <div class="v84-mini-stat">
        <span>已完成比對</span>
        <strong>${s.checked}</strong>
      </div>
      <div class="v84-mini-stat">
        <span>等待比對</span>
        <strong>${s.waiting}</strong>
      </div>
      <div class="v84-mini-stat">
        <span>平均命中</span>
        <strong>${s.avgHit}</strong>
      </div>
    `;
  }

  function updateTopStatus(gameCode) {
    const latestDraw = state.currentLatestDraw;

    if ($("v84CurrentGameBadge")) {
      $("v84CurrentGameBadge").textContent = gameCode ? `目前彩種：${GAME_CONFIG[gameCode].label}` : "尚未選擇彩種";
    }
    if ($("v84SiteStateBadge")) {
      $("v84SiteStateBadge").textContent = state.autoRefreshing ? "自動更新中" : "系統運作中";
    }
    if ($("v84DataStateText")) {
      $("v84DataStateText").textContent = latestDraw ? "已載入最新資料" : "待載入";
    }
    if ($("v84LastUpdateText")) {
      $("v84LastUpdateText").textContent = latestDraw?.drawDate ? toLocaleDateText(latestDraw.drawDate) : "尚未取得";
    }
    if ($("v84TrackingStateText")) {
      $("v84TrackingStateText").textContent = state.autoRefreshing ? "更新中" : "可用";
    }
  }

  function injectAnchors() {
    const el = $("predictionResult");
    if (!el || !el.innerHTML || el.innerHTML.includes('id="anchor-status"')) return;

    el.innerHTML = el.innerHTML
      .replace(/資料狀態/g, '<div id="anchor-status" class="section-anchor"></div>資料狀態')
      .replace(/命中追蹤/g, '<div id="anchor-tracking" class="section-anchor"></div>命中追蹤')
      .replace(/自動學習權重/g, '<div id="anchor-learning" class="section-anchor"></div>自動學習權重')
      .replace(/AI 推薦組合/g, '<div id="anchor-ai" class="section-anchor"></div>AI 推薦組合')
      .replace(/回測表現/g, '<div id="anchor-backtest" class="section-anchor"></div>回測表現')
      .replace(/熱號分析/g, '<div id="anchor-analysis" class="section-anchor"></div>熱號分析')
      .replace(/最新五期/g, '<div id="anchor-latest" class="section-anchor"></div>最新五期');
  }

  function bindInlineTrackingButtons() {
    const saveBtn = $("v84InlineSaveBtn");
    const clearBtn = $("v84InlineClearBtn");
    const resetBtn = $("v91InlineResetWeightsBtn");

    if (saveBtn) saveBtn.onclick = () => saveCurrentPrediction();
    if (clearBtn) clearBtn.onclick = () => clearPredictionRecords();
    if (resetBtn) {
      resetBtn.onclick = () => {
        resetLearningWeights();
        if (state.currentGameCode) renderPrediction(state.currentGameCode);
        showToast("已重置學習權重");
      };
    }
  }

  function getDataStatusForCurrent(gameCode, draws, latestDraw) {
    return getDataStatus(gameCode, draws, latestDraw);
  }

  function renderPrediction(gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    const historyPeriods = Number($("historyPeriods")?.value || 50);

    state.currentGameCode = gameCode;

    const latestDraw = sanitizeDraw(gameCode, getLatestDraw(cfg.key));
    const draws = getHistory(cfg.key, historyPeriods);
    const fullHistory = getHistory(cfg.key, 120);
    const status = getDataStatusForCurrent(gameCode, draws, latestDraw);

    const frequency = frequencyAnalysis(draws, cfg.min, cfg.max);
    const miss = missAnalysis(draws, cfg.min, cfg.max);
    const tails = tailAnalysis(draws);
    const consecutive = consecutiveAnalysis(draws);
    const modes = buildPredictionModes(gameCode, draws, latestDraw);
    const backtests = runBacktest(gameCode, fullHistory);

    state.currentModes = modes;
    state.currentLatestDraw = latestDraw;

    const container = $("predictionResult");
    const titleEl = $("resultGameName");
    if (titleEl) titleEl.textContent = `${cfg.label}｜${APP_VERSION}`;
    setBadge("已完成", true);

    container.innerHTML = `
      <div class="v84-main">
        <div class="v84-panel">
          <div class="result-header">
            <div>
              <h2 style="margin:0;">${escapeHtml(cfg.label)} 智慧預測結果</h2>
              <p class="result-subtitle">版本：${escapeHtml(APP_VERSION)}｜推薦組數：${getSetCount()} 組</p>
            </div>
            <div class="badge">${state.autoRefreshing ? "自動更新中" : "已完成分析"}</div>
          </div>
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>資料狀態</h3>
              <p>來源、更新時間、載入路徑與樣本期數</p>
            </div>
          </div>
          ${renderStatus(status, gameCode)}
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>資料提示</h3>
              <p>目前同步狀態與刷新建議</p>
            </div>
          </div>
          ${renderHints(status, gameCode)}
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>命中追蹤</h3>
              <p>本地預測紀錄與自動比對結果</p>
            </div>
          </div>
          ${renderTracking(gameCode)}
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>最新一期</h3>
              <p>官方最新資料摘要</p>
            </div>
          </div>

          <div class="result-grid">
            <div class="result-card">
              <div class="card-title">最新期數</div>
              <div class="text-block">${escapeHtml(latestDraw?.period || "—")}</div>
            </div>
            <div class="result-card">
              <div class="card-title">開獎時間</div>
              <div class="text-block">${escapeHtml(formatDate(latestDraw?.drawDate || ""))}</div>
            </div>
            <div class="result-card full-width">
              <div class="card-title">最新號碼</div>
              <div class="ball-row">${renderBalls(latestDraw?.numbers || [], latestDraw?.specialNumber, cfg.specialLabel, "light")}</div>
              <div class="text-block" style="margin-top:10px;">歷史學習期數：${draws.length} 期</div>
            </div>
          </div>
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>自動學習權重</h3>
              <p>依命中追蹤結果自動調整中的模型權重</p>
            </div>
          </div>
          ${renderLearningWeights(gameCode)}
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>AI 推薦組合</h3>
              <p>依目前設定自動生成的推薦號碼</p>
            </div>
          </div>
          ${renderModes(modes, gameCode)}
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>回測表現</h3>
              <p>近 30 / 50 / 100 期模擬命中結果</p>
            </div>
          </div>
          ${renderBacktest(backtests)}
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>熱號分析</h3>
              <p>近期高頻號碼</p>
            </div>
          </div>
          <div class="ball-row">${renderTagList(frequency.hot, "count")}</div>
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>冷號分析</h3>
              <p>近期低頻號碼</p>
            </div>
          </div>
          <div class="ball-row">${renderTagList(frequency.cold, "count")}</div>
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>拖號 / 遺漏分析</h3>
              <p>近期較久未出的號碼</p>
            </div>
          </div>
          <div class="ball-row">${renderTagList(miss, "miss")}</div>
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>連號偵測</h3>
              <p>近期常見連號組合</p>
            </div>
          </div>
          <div class="ball-row">
            ${consecutive.length ? renderTagList(consecutive, "pair") : `<span class="text-muted">無資料</span>`}
          </div>
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>尾數分析</h3>
              <p>近期熱門尾數分布</p>
            </div>
          </div>
          <div class="ball-row">${renderTagList(tails, "tail")}</div>
        </div>

        <div class="v84-section">
          <div class="v84-section-head">
            <div>
              <h3>最新五期</h3>
              <p>最近五期實際開獎資料</p>
            </div>
          </div>
          <div class="latest-five-list">${renderLatestFive(draws, gameCode)}</div>
        </div>
      </div>
    `;

    bindInlineTrackingButtons();
    renderHeroKpis(gameCode);
    renderMiniStats();
    renderOps();
    updateTopStatus(gameCode);
    injectAnchors();
  }

  function saveCurrentPrediction() {
    if (!state.currentGameCode) {
      showToast("請先執行一次預測");
      return;
    }
    if (!state.currentLatestDraw) {
      showToast("目前沒有可儲存的最新期數資料");
      return;
    }
    if (!state.currentModes || !state.currentModes.length) {
      showToast("目前沒有可儲存的預測組合");
      return;
    }

    const record = savePredictionRecord(
      state.currentGameCode,
      sanitizeDraw(state.currentGameCode, state.currentLatestDraw),
      state.currentModes.map(mode => ({
        ...mode,
        specialNumber: normalizeSpecialValue(
          mode.specialNumber,
          GAME_CONFIG[state.currentGameCode].specialMin,
          GAME_CONFIG[state.currentGameCode].specialMax
        )
      }))
    );

    pushOp(`已儲存 ${record.gameLabel} 預測`);
    renderMiniStats();
    renderHeroKpis(state.currentGameCode);
    renderPrediction(state.currentGameCode);
    showToast("已儲存本次預測");
  }

  function clearPredictionRecords() {
    clearPredictionHistory();
    renderMiniStats();
    renderHeroKpis(state.currentGameCode);
    if (state.currentGameCode) renderPrediction(state.currentGameCode);
    showToast("已清空命中紀錄");
  }

  async function initData() {
    const latestResult = await fetchFirstJson(JSON_CANDIDATES);
    state.latestJson = latestResult.json;
    state.latestJsonPath = latestResult.path;

    const [bingoHistory, daily539History, lotto649History, superLotto638History] = await Promise.all([
      loadHistoryCsv("bingo").catch(() => ({ data: [], path: "" })),
      loadHistoryCsv("daily539").catch(() => ({ data: [], path: "" })),
      loadHistoryCsv("lotto649").catch(() => ({ data: [], path: "" })),
      loadHistoryCsv("superLotto638").catch(() => ({ data: [], path: "" }))
    ]);

    state.history.bingo = bingoHistory.data;
    state.history.daily539 = daily539History.data;
    state.history.lotto649 = lotto649History.data;
    state.history.superLotto638 = superLotto638History.data;

    state.historySourcePath.bingo = bingoHistory.path || "";
    state.historySourcePath.daily539 = daily539History.path || "";
    state.historySourcePath.lotto649 = lotto649History.path || "";
    state.historySourcePath.superLotto638 = superLotto638History.path || "";
  }

  function getPeriodSnapshot() {
    return {
      bingo: getLatestDraw("bingo")?.period || "",
      daily539: getLatestDraw("daily539")?.period || "",
      lotto649: getLatestDraw("lotto649")?.period || "",
      superLotto638: getLatestDraw("superLotto638")?.period || ""
    };
  }

  async function refreshAllDataSilently() {
    if (state.autoRefreshing) return;
    state.autoRefreshing = true;
    updateTopStatus(state.currentGameCode);

    try {
      const before = state.latestJson ? getPeriodSnapshot() : {};
      await initData();
      const after = getPeriodSnapshot();
      const trackingResult = updatePredictionTracking();

      const changedGames = Object.keys(after).filter(key => String(before[key] || "") !== String(after[key] || ""));
      const hasNewDraw = changedGames.length > 0;

      state.lastAutoRefreshAt = new Date().toISOString();
      writeAutoState({
        lastAutoRefreshAt: state.lastAutoRefreshAt,
        lastPeriods: after
      });

      if (state.currentGameCode) renderPrediction(state.currentGameCode);
      else {
        renderHeroKpis(null);
        renderMiniStats();
        updateTopStatus(null);
      }

      if (hasNewDraw) {
        pushOp(`系統自動更新：${changedGames.join("、")} 有新一期`);
        showToast(`已自動更新 ${changedGames.length} 個彩種`);
      } else if (trackingResult.learnedCount > 0) {
        pushOp(`系統自動學習：完成 ${trackingResult.learnedCount} 筆`);
        showToast(`已自動學習 ${trackingResult.learnedCount} 筆`);
      }
    } catch (err) {
      console.error("auto refresh failed:", err);
      pushOp(`自動更新失敗：${err.message || "未知錯誤"}`);
    } finally {
      state.autoRefreshing = false;
      updateTopStatus(state.currentGameCode);
    }
  }

  function startAutoRefresh() {
    if (state.autoTimer) clearInterval(state.autoTimer);
    state.autoTimer = setInterval(() => {
      refreshAllDataSilently();
    }, AUTO_REFRESH_MS);
  }

  async function runPrediction(gameCode) {
    try {
      if (!state.latestJson) await initData();
      saveUiSettings();
      const trackingResult = updatePredictionTracking();
      if (trackingResult.learnedCount > 0) {
        pushOp(`自動學習完成 ${trackingResult.learnedCount} 筆`);
      }
      renderPrediction(gameCode);
      pushOp(`已執行 ${GAME_CONFIG[gameCode].label} 預測`);
    } catch (err) {
      console.error(err);
      showError(err.message || "未知錯誤");
    }
  }

  function showError(message) {
    const container = $("predictionResult");
    if (!container) return;
    setBadge("載入失敗", false);
    container.innerHTML = `
      <div class="v84-panel">
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">資料載入失敗</div>
          <div class="empty-text">${escapeHtml(message || "未知錯誤")}</div>
        </div>
      </div>
    `;
  }

  function bindBottomNav() {
    document.querySelectorAll(".bottom-nav .nav-pill").forEach((btn, index) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".bottom-nav .nav-pill").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");

        if (index === 0) window.scrollTo({ top: 0, behavior: "smooth" });
        if (index === 1) $("controlSection")?.scrollIntoView({ behavior: "smooth" });
        if (index === 2) $("predictionSection")?.scrollIntoView({ behavior: "smooth" });
        if (index === 3) {
          const latestAnchor = $("anchor-latest");
          if (latestAnchor) latestAnchor.scrollIntoView({ behavior: "smooth" });
          else $("predictionSection")?.scrollIntoView({ behavior: "smooth" });
        }
      });
    });
  }

  function wireToolbar() {
    const saveBtn = $("v84SaveBtn");
    const clearBtn = $("v84ClearBtn");
    const topBtn = $("v84TopBtn");
    const resetWeightsBtn = $("v90ResetWeightsBtn");

    if (saveBtn) saveBtn.onclick = () => saveCurrentPrediction();
    if (clearBtn) clearBtn.onclick = () => clearPredictionRecords();
    if (topBtn) topBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

    if (resetWeightsBtn) {
      resetWeightsBtn.onclick = () => {
        resetLearningWeights();
        if (state.currentGameCode) renderPrediction(state.currentGameCode);
        showToast("已重置學習權重");
      };
    }

    ["lotterySelect", "setCount", "historyPeriods", "bingoCount"].forEach(id => {
      const el = $(id);
      if (el && !el.dataset.boundV91) {
        el.dataset.boundV91 = "1";
        el.addEventListener("change", () => {
          saveUiSettings();
          if (id === "lotterySelect" && el.value) {
            runPrediction(el.value);
          }
        });
      }
    });
  }

  window.runPrediction = runPrediction;
  window.saveCurrentPrediction = saveCurrentPrediction;
  window.clearPredictionRecords = clearPredictionRecords;
  window.resetLearningWeights = resetLearningWeights;
  window.refreshAllDataSilently = refreshAllDataSilently;

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      restoreUiSettings();
      const autoState = readAutoState();
      if (autoState?.lastAutoRefreshAt) state.lastAutoRefreshAt = autoState.lastAutoRefreshAt;

      wireToolbar();
      bindBottomNav();
      renderOps();
      renderMiniStats();
      renderHeroKpis(null);
      updateTopStatus(null);

      await initData();
      const trackingResult = updatePredictionTracking();
      if (trackingResult.learnedCount > 0) {
        pushOp(`初始化自動學習 ${trackingResult.learnedCount} 筆`);
      }

      setBadge("待預測", true);

      if ($("resultGameName")) {
        $("resultGameName").textContent = `${APP_VERSION}｜請先選擇彩種並開始預測`;
      }

      const defaultGame = $("lotterySelect")?.value || "bingo";
      await runPrediction(defaultGame);
      startAutoRefresh();
    } catch (err) {
      console.error(err);
      showError(err.message || "初始化失敗");
    }
  });
})();