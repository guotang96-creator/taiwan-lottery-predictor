(() => {
  const APP_VERSION = "V79 資料狀態版";

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
      key: "bingo",
      label: "Bingo Bingo",
      min: 1,
      max: 80,
      mainCount: () => Number(document.getElementById("bingoCount")?.value || 10),
      historyMainCount: 20,
      specialLabel: "超級獎號"
    },
    "539": {
      key: "daily539",
      label: "今彩539",
      min: 1,
      max: 39,
      mainCount: () => 5,
      historyMainCount: 5,
      specialLabel: ""
    },
    "649": {
      key: "lotto649",
      label: "大樂透",
      min: 1,
      max: 49,
      mainCount: () => 6,
      historyMainCount: 6,
      specialLabel: "特別號"
    },
    "638": {
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

  function range(min, max) {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  function uniqSorted(arr) {
    return [...new Set(arr)].sort((a, b) => a - b);
  }

  function numericArray(arr, min, max) {
    if (!Array.isArray(arr)) return [];
    return uniqSorted(
      arr
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v >= min && v <= max)
    );
  }

  function setBadge(text, ok = true) {
    const badge = $("resultBadge");
    if (!badge) return;
    badge.textContent = text;
    badge.style.background = ok ? "#e8f7ea" : "#fff4e5";
    badge.style.color = ok ? "#147a2e" : "#8a4b00";
  }

  function injectStyles() {
    if (document.getElementById("v79-style")) return;

    const style = document.createElement("style");
    style.id = "v79-style";
    style.textContent = `
      .result-wrap{display:flex;flex-direction:column;gap:16px}
      .section-card,.summary-card{
        background:#fff;border:1px solid #ececec;border-radius:18px;
        padding:16px;box-shadow:0 4px 14px rgba(0,0,0,.06)
      }
      .section-title,.summary-title{
        font-size:18px;font-weight:800;color:#222;margin:0 0 10px 0
      }
      .summary-grid{
        display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px
      }
      .summary-item{background:#f8fafc;border-radius:14px;padding:12px}
      .summary-item-label{font-size:13px;color:#666;margin-bottom:6px}
      .summary-item-value{font-size:16px;font-weight:700;color:#222;line-height:1.6}
      .prediction-sets{display:grid;gap:12px}
      .prediction-set{background:#f8fafc;border-radius:14px;padding:14px;border:1px solid #edf2f7}
      .set-title{font-size:15px;font-weight:800;margin-bottom:10px;color:#222}
      .mode-badge{
        display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;
        background:#eef2ff;color:#2f3b8f;font-size:12px;font-weight:800;margin-bottom:10px
      }
      .status-grid{
        display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px
      }
      .status-card{
        background:#f8fafc;border-radius:14px;padding:12px;border:1px solid #edf2f7
      }
      .status-title{
        font-size:13px;color:#666;margin-bottom:6px
      }
      .status-value{
        font-size:15px;font-weight:800;color:#222;line-height:1.6;word-break:break-word
      }
      .ball{
        display:inline-flex;align-items:center;justify-content:center;
        width:40px;height:40px;border-radius:999px;background:#d81b60;
        color:#fff;font-weight:800;margin:4px 6px 4px 0;box-shadow:0 2px 6px rgba(0,0,0,.12)
      }
      .ball.special{background:#ff9800}
      .stats-wrap{display:flex;flex-wrap:wrap;gap:8px}
      .stat-chip{
        display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;
        background:#f3f4f6;color:#333;font-size:14px;font-weight:700
      }
      .mini-list{display:flex;flex-direction:column;gap:10px}
      .mini-row{background:#f8fafc;border-radius:14px;padding:12px}
      .mini-row-head{
        display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;
        font-size:13px;color:#666;margin-bottom:8px
      }
      .mini-row-balls{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
      .mini-special-wrap{
        display:inline-flex;align-items:center;gap:8px;
        margin-left:8px;vertical-align:middle
      }
      .mini-label{font-size:13px;color:#666;font-weight:700}
      .text-muted{color:#888}
      .ok-text{color:#147a2e;font-weight:800}
      .warn-text{color:#8a4b00;font-weight:800}
      .error-box{
        background:#fff3f3;border:1px solid #f3b7b7;color:#a40000;
        border-radius:16px;padding:16px;line-height:1.8
      }
      .source-note{font-size:12px;color:#666;margin-top:6px}
      .backtest-grid{
        display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px
      }
      .backtest-card{
        background:#f8fafc;border-radius:14px;padding:12px;border:1px solid #edf2f7
      }
      .backtest-title{
        font-size:14px;font-weight:800;color:#222;margin-bottom:6px
      }
      .backtest-line{font-size:13px;color:#444;line-height:1.8}
    `;
    document.head.appendChild(style);
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

  function pickNumbersFromPool(pool, count, strategy) {
    if (!pool.length) return [];

    if (strategy === "safe") {
      return pool.slice(0, count).map(x => x.number).sort((a, b) => a - b);
    }

    if (strategy === "balanced") {
      const top = pool.slice(0, count * 2);
      const picked = [];
      for (let i = 0; i < top.length && picked.length < count; i += 2) {
        picked.push(top[i].number);
      }
      for (let i = 1; i < top.length && picked.length < count; i += 2) {
        if (!picked.includes(top[i].number)) picked.push(top[i].number);
      }
      return picked.sort((a, b) => a - b);
    }

    const top = pool.slice(0, count * 3);
    const picked = [];
    for (let i = 0; i < top.length && picked.length < count; i += 1) {
      const idx = i % 3 === 0 ? i : Math.min(i + 2, top.length - 1);
      const n = top[idx]?.number;
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
    const pool = buildScorePool(draws, cfg.min, cfg.max, latestDraw);

    const safeNumbers = pickNumbersFromPool(pool, pickCount, "safe");
    const balancedNumbers = pickNumbersFromPool(pool, pickCount, "balanced");
    const attackNumbers = pickNumbersFromPool(pool, pickCount, "attack");

    let safeSpecial = null;
    let balancedSpecial = null;
    let attackSpecial = null;

    if (gameCode === "649") {
      safeSpecial = latestDraw?.specialNumber ?? null;
      balancedSpecial = latestDraw?.specialNumber ?? null;
      attackSpecial = latestDraw?.specialNumber ?? null;
    }

    if (gameCode === "638") {
      const spPool = buildSecondAreaPool(draws);
      safeSpecial = spPool[0]?.number ?? latestDraw?.specialNumber ?? 1;
      balancedSpecial = spPool[1]?.number ?? spPool[0]?.number ?? latestDraw?.specialNumber ?? 1;
      attackSpecial = spPool[2]?.number ?? spPool[0]?.number ?? latestDraw?.specialNumber ?? 1;
    }

    if (gameCode === "bingo") {
      safeSpecial = latestDraw?.specialNumber ?? null;
      balancedSpecial = latestDraw?.specialNumber ?? null;
      attackSpecial = latestDraw?.specialNumber ?? null;
    }

    return [
      {
        mode: "保守組",
        desc: "偏重高頻熱號與穩定分布",
        numbers: safeNumbers,
        specialNumber: safeSpecial
      },
      {
        mode: "平衡組",
        desc: "兼顧熱號、遺漏與尾數平衡",
        numbers: balancedNumbers,
        specialNumber: balancedSpecial
      },
      {
        mode: "進攻組",
        desc: "提高冷熱混搭與追擊波動",
        numbers: attackNumbers,
        specialNumber: attackSpecial
      }
    ];
  }

  function countHits(predicted, actual) {
    const actualSet = new Set(actual || []);
    return (predicted || []).filter(n => actualSet.has(n)).length;
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

  function renderBalls(numbers, specialNumber = null, specialLabel = "") {
    const main = (numbers || []).map(n => `<span class="ball">${pad2(n)}</span>`).join("");

    const special = specialNumber !== null && specialNumber !== undefined
      ? `
        <span class="mini-special-wrap">
          ${specialLabel ? `<span class="mini-label">${escapeHtml(specialLabel)}</span>` : ""}
          <span class="ball special">${pad2(specialNumber)}</span>
        </span>
      `
      : "";

    if (!main && !special) return `<span class="text-muted">無資料</span>`;
    return `${main}${special}`;
  }

  function renderTagList(items, type) {
    if (!items.length) return `<span class="text-muted">無資料</span>`;

    if (type === "tail") {
      return items.map(item => `<span class="stat-chip">尾${item.tail}（${item.count}）</span>`).join("");
    }

    if (type === "pair") {
      return items.map(item => `<span class="stat-chip">${item.pair}（${item.count}）</span>`).join("");
    }

    if (type === "miss") {
      return items.map(item => `<span class="stat-chip">${pad2(item.number)}（${item.miss}）</span>`).join("");
    }

    return items.map(item => `<span class="stat-chip">${pad2(item.number)}（${item.count}）</span>`).join("");
  }

  function renderLatestFive(draws, gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    if (!draws.length) return `<div class="text-muted">尚無資料</div>`;

    return sortDrawsDesc(draws).slice(0, 5).map(draw => `
      <div class="mini-row">
        <div class="mini-row-head">
          <span>第 ${escapeHtml(draw.period || "—")} 期</span>
          <span>${escapeHtml(formatDate(draw.drawDate || ""))}</span>
        </div>
        <div class="mini-row-balls">
          ${renderBalls(draw.numbers || [], draw.specialNumber, cfg.specialLabel)}
        </div>
      </div>
    `).join("");
  }

  function renderBacktest(backtests) {
    return `
      <div class="backtest-grid">
        ${backtests.map(item => `
          <div class="backtest-card">
            <div class="backtest-title">近 ${item.windowSize} 期回測</div>
            <div class="backtest-line">樣本數：${item.samples}</div>
            <div class="backtest-line">平均命中：${item.avgHit}</div>
            <div class="backtest-line">命中 1 碼以上：${item.hit1}</div>
            <div class="backtest-line">命中 2 碼以上：${item.hit2}</div>
            <div class="backtest-line">命中 3 碼以上：${item.hit3}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderModes(modes, gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    return `
      <div class="prediction-sets">
        ${modes.map(mode => `
          <div class="prediction-set">
            <div class="mode-badge">${escapeHtml(mode.mode)}</div>
            <div class="set-title">${escapeHtml(mode.desc)}</div>
            <div>${renderBalls(mode.numbers, mode.specialNumber, cfg.specialLabel)}</div>
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
    const lagMin = latestStamp ? Math.max(0, Math.floor((Date.now() - new Date(latestStamp).getTime()) / 60000)) : null;

    let syncText = "—";
    if (gameCode === "bingo") {
      if (lagMin === null) {
        syncText = "未知";
      } else if (lagMin <= 15) {
        syncText = `正常（落後約 ${lagMin} 分鐘）`;
      } else if (lagMin <= 60) {
        syncText = `稍慢（落後約 ${lagMin} 分鐘）`;
      } else {
        syncText = `偏慢（落後約 ${lagMin} 分鐘）`;
      }
    }

    return {
      generatedAt,
      source,
      latestPath,
      historyPath,
      historyCount: draws.length,
      bingoSyncText: syncText
    };
  }

  function renderStatus(status, gameCode) {
    return `
      <div class="status-grid">
        <div class="status-card">
          <div class="status-title">版本</div>
          <div class="status-value">${escapeHtml(APP_VERSION)}</div>
        </div>
        <div class="status-card">
          <div class="status-title">資料最後更新</div>
          <div class="status-value">${escapeHtml(formatDate(status.generatedAt))}</div>
        </div>
        <div class="status-card">
          <div class="status-title">最新資料來源</div>
          <div class="status-value">${escapeHtml(status.source)}</div>
        </div>
        <div class="status-card">
          <div class="status-title">JSON 載入路徑</div>
          <div class="status-value">${escapeHtml(status.latestPath || "—")}</div>
        </div>
        <div class="status-card">
          <div class="status-title">歷史 CSV 路徑</div>
          <div class="status-value">${escapeHtml(status.historyPath || "—")}</div>
        </div>
        <div class="status-card">
          <div class="status-title">歷史學習期數</div>
          <div class="status-value">${escapeHtml(String(status.historyCount))} 期</div>
        </div>
        ${gameCode === "bingo" ? `
          <div class="status-card">
            <div class="status-title">Bingo 即時同步狀態</div>
            <div class="status-value ${status.bingoSyncText.includes("正常") ? "ok-text" : "warn-text"}">${escapeHtml(status.bingoSyncText)}</div>
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderPrediction(gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    const historyPeriods = Number($("historyPeriods")?.value || 50);

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

    const container = $("predictionResult");
    const titleEl = $("resultGameName");

    if (titleEl) {
      titleEl.textContent = `${cfg.label}｜V79 資料狀態版 + 官方最新資料`;
    }

    setBadge("已完成", true);

    container.innerHTML = `
      <div class="result-wrap">
        <div class="section-card">
          <div class="section-title">資料狀態</div>
          ${renderStatus(status, gameCode)}
        </div>

        <div class="summary-card">
          <div class="summary-title">最新一期</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-item-label">最新期數</div>
              <div class="summary-item-value">${escapeHtml(latestDraw?.period || "—")}</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">開獎時間</div>
              <div class="summary-item-value">${escapeHtml(formatDate(latestDraw?.drawDate || ""))}</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">最新號碼</div>
              <div class="summary-item-value">${renderBalls(latestDraw?.numbers || [], latestDraw?.specialNumber, cfg.specialLabel)}</div>
            </div>
          </div>
          <div class="source-note">歷史學習期數：${draws.length} 期</div>
        </div>

        <div class="section-card">
          <div class="section-title">AI 三模式推薦</div>
          ${renderModes(modes, gameCode)}
        </div>

        <div class="section-card">
          <div class="section-title">回測表現</div>
          ${renderBacktest(backtests)}
        </div>

        <div class="section-card">
          <div class="section-title">熱號分析</div>
          <div class="stats-wrap">${renderTagList(frequency.hot, "count")}</div>
        </div>

        <div class="section-card">
          <div class="section-title">冷號分析</div>
          <div class="stats-wrap">${renderTagList(frequency.cold, "count")}</div>
        </div>

        <div class="section-card">
          <div class="section-title">拖號 / 遺漏分析</div>
          <div class="stats-wrap">${renderTagList(miss, "miss")}</div>
        </div>

        <div class="section-card">
          <div class="section-title">連號偵測</div>
          <div class="stats-wrap">
            ${consecutive.length ? renderTagList(consecutive, "pair") : `<span class="text-muted">無資料</span>`}
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">尾數分析</div>
          <div class="stats-wrap">${renderTagList(tails, "tail")}</div>
        </div>

        <div class="section-card">
          <div class="section-title">最新五期</div>
          <div class="mini-list">${renderLatestFive(draws, gameCode)}</div>
        </div>
      </div>
    `;
  }

  function showError(message) {
    const container = $("predictionResult");
    if (!container) return;
    setBadge("失敗", false);
    container.innerHTML = `
      <div class="error-box">
        <div style="font-size:20px;font-weight:800;margin-bottom:8px;">資料載入失敗</div>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  }

  async function initData() {
    injectStyles();

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

    console.log("[V79] latest loaded:", latestResult.path);
    console.log("[V79] history counts:", {
      bingo: state.history.bingo.length,
      daily539: state.history.daily539.length,
      lotto649: state.history.lotto649.length,
      superLotto638: state.history.superLotto638.length
    });
  }

  async function runPrediction(gameCode) {
    try {
      if (!state.latestJson) {
        await initData();
      }
      renderPrediction(gameCode);
    } catch (err) {
      console.error(err);
      showError(err.message || "未知錯誤");
    }
  }

  window.runPrediction = runPrediction;

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await initData();
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