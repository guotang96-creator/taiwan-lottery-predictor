(() => {
  const APP_VERSION = "V85.1 按鈕互動優化版";
  const STORAGE_KEY = "taiwan_lottery_prediction_history_v84";
  const OPS_KEY = "taiwan_lottery_recent_ops_v84";
  const SETTINGS_KEY = "taiwan_lottery_dashboard_settings_v84";

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
      specialLabel: "超級獎號"
    },
    "539": {
      code: "539",
      key: "daily539",
      label: "今彩539",
      min: 1,
      max: 39,
      mainCount: () => 5,
      historyMainCount: 5,
      specialLabel: ""
    },
    "649": {
      code: "649",
      key: "lotto649",
      label: "大樂透",
      min: 1,
      max: 49,
      mainCount: () => 6,
      historyMainCount: 6,
      specialLabel: "特別號"
    },
    "638": {
      code: "638",
      key: "superLotto638",
      label: "威力彩",
      min: 1,
      max: 38,
      mainCount: () => 6,
      historyMainCount: 6,
      specialMin: 1,
      specialMax: 8,
      specialLabel: "第二區"
    }
  };

  const state = {
    latestJson: null,
    latestJsonPath: "",
    currentGameCode: null,
    currentModes: [],
    currentLatestDraw: null,
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

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function toLocaleDateText(value) {
    if (!value) return "尚未取得";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("zh-TW");
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

  function getSetCount() {
    return Math.max(1, Math.min(5, Number($("setCount")?.value || 3)));
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
    const num = Number(raw);
    if (Number.isFinite(num) && num >= min && num <= max) return num;
    return null;
  }

  function normalizeHistoryRows(gameKey, rows) {
    const cfg = Object.values(GAME_CONFIG).find(g => g.key === gameKey);
    if (!cfg) return [];

    const normalized = rows.map(row => {
      const period = inferPeriod(row);
      const drawDate = inferDate(row);

      if (gameKey === "bingo") {
        const numbers = extractNumbersFromRow(row, cfg.min, cfg.max, 20);
        return {
          period,
          drawDate,
          redeemableDate: "",
          numbers,
          orderNumbers: numbers.slice(),
          specialNumber: null,
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
    const dateValue = draw?.drawDate ? new Date(draw.drawDate).getTime() : 0;
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
    return state.latestJson?.[gameKey]?.latestOfficial ||
      state.latestJson?.[gameKey]?.latest ||
      state.latestJson?.officialLatest?.[gameKey] ||
      null;
  }

  function getHistory(gameKey, limit) {
    const history = state.history[gameKey] || [];
    const latest = getLatestDraw(gameKey);

    const merged = [...history];
    if (latest) {
      const latestKey = `${latest.period || ""}__${latest.drawDate || ""}`;
      const idx = merged.findIndex(item => `${item.period || ""}__${item.drawDate || ""}` === latestKey);
      if (idx >= 0) {
        merged[idx] = latest;
      } else {
        merged.push(latest);
      }
    }

    const dedupedMap = new Map();
    for (const item of merged) {
      const key = `${item.period || ""}__${item.drawDate || ""}`;
      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, item);
      } else {
        const oldItem = dedupedMap.get(key);
        if ((item.numbers?.length || 0) >= (oldItem.numbers?.length || 0)) {
          dedupedMap.set(key, item);
        }
      }
    }

    return sortDrawsDesc([...dedupedMap.values()]).slice(0, limit);
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

  function buildScorePool(draws, min, max, latestDraw) {
    const freq = frequencyAnalysis(draws, min, max).map;
    const miss = missMap(draws, min, max);
    const tailHot = computeTailHotness(draws);
    const latestNums = new Set(latestDraw?.numbers || []);

    return range(min, max)
      .map(number => {
        const f = freq.get(number) || 0;
        const m = miss.get(number) || 0;
        const t = tailHot.get(number % 10) || 0;
        const latestPenalty = latestNums.has(number) ? -1.2 : 0;
        const score = f * 2.0 + m * 1.3 + t * 0.15 + latestPenalty;
        return { number, score };
      })
      .sort((a, b) => b.score - a.score || a.number - b.number);
  }

  function buildSecondAreaPool(draws) {
    const map = new Map(range(1, 8).map(n => [n, 0]));
    const miss = new Map(range(1, 8).map(n => [n, 0]));

    draws.forEach(draw => {
      const s = Number(draw.specialNumber);
      if (Number.isFinite(s) && s >= 1 && s <= 8) {
        map.set(s, (map.get(s) || 0) + 1);
      }
    });

    range(1, 8).forEach(n => {
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

    return range(1, 8)
      .map(n => ({
        number: n,
        score: (map.get(n) || 0) * 2 + (miss.get(n) || 0) * 1.2
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
    const pool = buildScorePool(draws, cfg.min, cfg.max, latestDraw);

    const baseModes = [
      { mode: "保守組", desc: "偏重高頻熱號與穩定分布", strategy: "safe", shift: 0 },
      { mode: "平衡組", desc: "兼顧熱號、遺漏與尾數平衡", strategy: "balanced", shift: 0 },
      { mode: "進攻組", desc: "提高冷熱混搭與追擊波動", strategy: "attack", shift: 0 },
      { mode: "延伸組", desc: "延伸熱門池，避開過度集中", strategy: "safe", shift: 1 },
      { mode: "衝刺組", desc: "加大變化幅度，做高低搭配", strategy: "attack", shift: 1 }
    ];

    const spPool = gameCode === "638" ? buildSecondAreaPool(draws) : [];

    return baseModes.slice(0, setCount).map((item, idx) => {
      let specialNumber = null;

      if (gameCode === "649") {
        specialNumber = latestDraw?.specialNumber ?? null;
      }

      if (gameCode === "638") {
        specialNumber =
          spPool[idx]?.number ??
          spPool[0]?.number ??
          latestDraw?.specialNumber ??
          1;
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

  function countSpecialHit(predictedSpecial, actualSpecial) {
    if (predictedSpecial == null || actualSpecial == null) return 0;
    return Number(predictedSpecial) === Number(actualSpecial) ? 1 : 0;
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
        return {
          windowSize,
          samples: 0,
          avgHit: 0,
          hit1: 0,
          hit2: 0,
          hit3: 0
        };
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

    const record = {
      id: `${gameCode}_${Date.now()}`,
      gameCode,
      gameKey: cfg.key,
      gameLabel: cfg.label,
      createdAt: new Date().toISOString(),
      referencePeriod: latestDraw?.period || "",
      referenceDrawDate: latestDraw?.drawDate || "",
      modes: modes.map(mode => ({
        mode: mode.mode,
        numbers: mode.numbers || [],
        specialNumber: mode.specialNumber ?? null
      })),
      checked: false,
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

  function updatePredictionTracking() {
    const list = readPredictionHistory();
    let changed = false;

    for (const item of list) {
      const latest = getLatestDraw(item.gameKey);
      if (!latest || !latest.period) continue;

      const latestPeriodNum = Number(latest.period || 0);
      const refPeriodNum = Number(item.referencePeriod || 0);

      if (latestPeriodNum > refPeriodNum) {
        const bestHit = Math.max(...item.modes.map(mode => countHits(mode.numbers || [], latest.numbers || [])));
        const bestSpecialHit = Math.max(...item.modes.map(mode => countSpecialHit(mode.specialNumber, latest.specialNumber)));

        item.checked = true;
        item.resultPeriod = latest.period || "";
        item.resultDrawDate = latest.drawDate || "";
        item.resultNumbers = latest.numbers || [];
        item.resultSpecialNumber = latest.specialNumber ?? null;
        item.bestHit = bestHit;
        item.specialHit = bestSpecialHit;
        changed = true;
      }
    }

    if (changed) writePredictionHistory(list);
    return list;
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
      setCount: $("setCount")?.value || "3",
      historyPeriods: $("historyPeriods")?.value || "50",
      bingoCount: $("bingoCount")?.value || "10"
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  }

  function restoreUiSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (raw.setCount && $("setCount")) $("setCount").value = raw.setCount;
      if (raw.historyPeriods && $("historyPeriods")) $("historyPeriods").value = raw.historyPeriods;
      if (raw.bingoCount && $("bingoCount")) $("bingoCount").value = raw.bingoCount;
    } catch {}
  }

  function renderBalls(numbers, specialNumber = null, specialLabel = "", type = "dark") {
    const ballClass = type === "light" ? "ball main" : "ball";
    const main = (numbers || []).map(n => `<span class="${ballClass}">${pad2(n)}</span>`).join("");

    const special = specialNumber !== null && specialNumber !== undefined
      ? `
        <div class="special-box">
          ${specialLabel ? `<span>${escapeHtml(specialLabel)}</span>` : ""}
          <span class="ball special">${pad2(specialNumber)}</span>
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

  function getDataStatus(gameCode, draws, latestDraw) {
    const historyPath = state.historySourcePath[GAME_CONFIG[gameCode].key] || "";
    const latestPath = state.latestJsonPath || "";
    const generatedAt = state.latestJson?.generatedAt || "";
    const source = latestDraw?.source || state.latestJson?.source || "unknown";
    const latestStamp = latestDraw?.drawDate || "";
    const lagMin = latestStamp
      ? Math.max(0, Math.floor((Date.now() - new Date(latestStamp).getTime()) / 60000))
      : null;

    let syncText = "—";
    let compareText = "—";
    let refreshText = "資料已更新";

    if (gameCode === "bingo") {
      if (lagMin === null) {
        syncText = "未知";
        compareText = "無法判定";
        refreshText = "請稍後重整頁面";
      } else if (lagMin <= 15) {
        syncText = `正常（落後約 ${lagMin} 分鐘）`;
        compareText = "與官方站接近同步";
        refreshText = "目前資料新鮮，可直接使用";
      } else if (lagMin <= 60) {
        syncText = `稍慢（落後約 ${lagMin} 分鐘）`;
        compareText = "可能比官方站慢一到數期";
        refreshText = "可稍後再重整，或等待 workflow 更新";
      } else {
        syncText = `偏慢（落後約 ${lagMin} 分鐘）`;
        compareText = "大機率落後官方站最新 Bingo";
        refreshText = "建議稍後重新整理，或先查看官方站最新期別";
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
        ${
          gameCode === "bingo"
            ? `
              <div class="result-card full-width">
                <div class="card-title">Bingo 即時同步狀態</div>
                <div class="text-block">${escapeHtml(status.bingoSyncText)}</div>
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
            目前資料已載入完成。若你剛更新過 GitHub 檔案但畫面沒變，請用網址加參數重整，例如 <b>?v=84</b>。
          </div>
        </div>
      `;
    }

    return `
      <div class="result-card highlight-card">
        <div class="card-title">Bingo 官方比對提示</div>
        <div class="text-block">
          官方比對：${escapeHtml(status.bingoCompareText)}<br>
          刷新建議：${escapeHtml(status.refreshText)}
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
        <button id="v84InlineSaveBtn" type="button">儲存本次預測</button>
        <button id="v84InlineClearBtn" type="button">清空命中紀錄</button>
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
                  ${item.checked ? `比對期數：${escapeHtml(item.resultPeriod || "—")}` : "尚未比對"}
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
      $("v84SiteStateBadge").textContent = gameCode ? "系統運作中" : "系統待命中";
    }
    if ($("v84DataStateText")) {
      $("v84DataStateText").textContent = latestDraw ? "已載入最新資料" : "待載入";
    }
    if ($("v84LastUpdateText")) {
      $("v84LastUpdateText").textContent = latestDraw?.drawDate ? toLocaleDateText(latestDraw.drawDate) : "尚未取得";
    }
    if ($("v84TrackingStateText")) {
      $("v84TrackingStateText").textContent = "可用";
    }
  }

  function injectAnchors() {
    const el = $("predictionResult");
    if (!el || !el.innerHTML || el.innerHTML.includes('id="anchor-status"')) return;

    el.innerHTML = el.innerHTML
      .replace(/資料狀態/g, '<div id="anchor-status" class="section-anchor"></div>資料狀態')
      .replace(/命中追蹤/g, '<div id="anchor-tracking" class="section-anchor"></div>命中追蹤')
      .replace(/AI 推薦組合/g, '<div id="anchor-ai" class="section-anchor"></div>AI 推薦組合')
      .replace(/回測表現/g, '<div id="anchor-backtest" class="section-anchor"></div>回測表現')
      .replace(/熱號分析/g, '<div id="anchor-overview" class="section-anchor"></div><div id="anchor-analysis" class="section-anchor"></div>熱號分析')
      .replace(/最新五期/g, '<div id="anchor-latest" class="section-anchor"></div>最新五期');
  }

  function bindInlineTrackingButtons() {
    const saveBtn = $("v84InlineSaveBtn");
    const clearBtn = $("v84InlineClearBtn");

    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = "1";
      saveBtn.addEventListener("click", () => saveCurrentPrediction());
    }

    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = "1";
      clearBtn.addEventListener("click", () => clearPredictionRecords());
    }
  }

  function renderPrediction(gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    const historyPeriods = Number($("historyPeriods")?.value || 50);

    state.currentGameCode = gameCode;
    updatePredictionTracking();

    const latestDraw = getLatestDraw(cfg.key);
    const draws = getHistory(cfg.key, historyPeriods);
    const fullHistory = getHistory(cfg.key, 120);
    const status = getDataStatus(gameCode, draws, latestDraw);

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

    if (titleEl) {
      titleEl.textContent = `${cfg.label}｜${APP_VERSION}`;
    }

    setBadge("已完成", true);

    container.innerHTML = `
      <div class="v84-main">
        <div class="v84-panel">
          <div class="result-header">
            <div>
              <h2 style="margin:0;">${escapeHtml(cfg.label)} 智慧預測結果</h2>
              <p class="result-subtitle">版本：${escapeHtml(APP_VERSION)}｜推薦組數：${getSetCount()} 組</p>
            </div>
            <div class="badge">已完成分析</div>
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
    pushOp(`已執行 ${cfg.label} 預測`);
  }

  function saveCurrentPrediction() {
    if (!state.currentGameCode || !state.currentLatestDraw || !state.currentModes?.length) return;
    savePredictionRecord(state.currentGameCode, state.currentLatestDraw, state.currentModes);
    renderPrediction(state.currentGameCode);
    alert("已儲存本次預測，之後會自動追蹤命中。");
  }

  function clearPredictionRecords() {
    clearPredictionHistory();
    renderMiniStats();
    renderHeroKpis(state.currentGameCode);
    if (state.currentGameCode) renderPrediction(state.currentGameCode);
    alert("已清空命中紀錄。");
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

    console.log("[V84] latest loaded:", latestResult.path);
    console.log("[V84] history counts:", {
      bingo: state.history.bingo.length,
      daily539: state.history.daily539.length,
      lotto649: state.history.lotto649.length,
      superLotto638: state.history.superLotto638.length
    });
  }

  async function runPrediction(gameCode) {
    try {
      if (!state.latestJson) await initData();
      saveUiSettings();
      renderPrediction(gameCode);
    } catch (err) {
      console.error(err);
      showError(err.message || "未知錯誤");
    }
  }

  function wireToolbar() {
    const saveBtn = $("v84SaveBtn");
    const clearBtn = $("v84ClearBtn");
    const topBtn = $("v84TopBtn");

    if (saveBtn && !saveBtn.dataset.boundV84) {
      saveBtn.dataset.boundV84 = "1";
      saveBtn.addEventListener("click", () => saveCurrentPrediction());
    }

    if (clearBtn && !clearBtn.dataset.boundV84) {
      clearBtn.dataset.boundV84 = "1";
      clearBtn.addEventListener("click", () => clearPredictionRecords());
    }

    if (topBtn && !topBtn.dataset.boundV84) {
      topBtn.dataset.boundV84 = "1";
      topBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    ["setCount", "historyPeriods", "bingoCount"].forEach(id => {
      const el = $(id);
      if (el && !el.dataset.boundV84) {
        el.dataset.boundV84 = "1";
        el.addEventListener("change", saveUiSettings);
      }
    });
  }

  window.runPrediction = runPrediction;
  window.saveCurrentPrediction = saveCurrentPrediction;
  window.clearPredictionRecords = clearPredictionRecords;

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      restoreUiSettings();
      wireToolbar();
      renderOps();
      renderMiniStats();
      renderHeroKpis(null);
      updateTopStatus(null);

      await initData();
      updatePredictionTracking();
      setBadge("待預測", true);

      if ($("resultGameName")) {
        $("resultGameName").textContent = `${APP_VERSION}｜請先選擇彩種並開始預測`;
      }
    } catch (err) {
      console.error(err);
      showError(err.message || "初始化失敗");
    }
  });
})();
(() => {
  function v851$(id) {
    return document.getElementById(id);
  }

  function getGameLabel(code) {
    const map = {
      bingo: "Bingo Bingo",
      "649": "大樂透",
      "638": "威力彩",
      "539": "今彩539"
    };
    return map[code] || "Bingo Bingo";
  }

  function getHeroButtonText(code) {
    const map = {
      bingo: "立即預測 Bingo",
      "649": "立即預測 大樂透",
      "638": "立即預測 威力彩",
      "539": "立即預測 今彩539"
    };
    return map[code] || "立即預測 Bingo";
  }

  function syncCurrentGameUi() {
    const select = v851$("lotterySelect");
    const code = select?.value || "bingo";
    const label = getGameLabel(code);

    const badge = v851$("v84CurrentGameBadge");
    if (badge) {
      badge.textContent = `目前彩種：${label}`;
    }

    const heroBtn = v851$("heroQuickPredictBtn");
    if (heroBtn) {
      heroBtn.textContent = getHeroButtonText(code);
      heroBtn.setAttribute("onclick", `quickPredict('${code}', this)`);
    }

    document.querySelectorAll(".v84-game-card").forEach(card => {
      card.style.outline = "";
      card.style.transform = "";
    });

    const cardMap = {
      bingo: 0,
      "649": 1,
      "638": 2,
      "539": 3
    };

    const cards = document.querySelectorAll(".v84-game-card");
    const activeCard = cards[cardMap[code]];
    if (activeCard) {
      activeCard.style.outline = "2px solid rgba(103,232,249,.85)";
      activeCard.style.transform = "translateY(-2px)";
    }
  }

  function bindV851SelectSync() {
    const select = v851$("lotterySelect");
    if (!select || select.dataset.v851Bound === "1") return;

    select.dataset.v851Bound = "1";
    select.addEventListener("change", syncCurrentGameUi);
  }

  function initV851() {
    bindV851SelectSync();
    syncCurrentGameUi();
  }

  const originalRunPrediction = window.runPrediction;
  if (typeof originalRunPrediction === "function" && !originalRunPrediction.__v851Wrapped) {
    window.runPrediction = function () {
      const result = originalRunPrediction.apply(this, arguments);
      setTimeout(() => {
        syncCurrentGameUi();
      }, 80);
      return result;
    };
    window.runPrediction.__v851Wrapped = true;
  }

  const originalQuickPredict = window.quickPredict;
  if (typeof originalQuickPredict === "function" && !originalQuickPredict.__v851Wrapped) {
    window.quickPredict = function (gameCode, btn) {
      const select = v851$("lotterySelect");
      if (select) select.value = gameCode;
      syncCurrentGameUi();
      return originalQuickPredict.apply(this, arguments);
    };
    window.quickPredict.__v851Wrapped = true;
  }

  const originalSelectGame = window.selectGame;
  if (typeof originalSelectGame === "function" && !originalSelectGame.__v851Wrapped) {
    window.selectGame = function (gameCode, btn) {
      const select = v851$("lotterySelect");
      if (select) select.value = gameCode;
      syncCurrentGameUi();
      return originalSelectGame.apply(this, arguments);
    };
    window.selectGame.__v851Wrapped = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initV851);
  } else {
    initV851();
  }
})();