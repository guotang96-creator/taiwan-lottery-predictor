(() => {
  const APP_VERSION = "V76 歷史學習完整版";

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
      "./raw_data/bingo.csv",
      "/taiwan-lottery-predictor/raw_data/bingo.csv"
    ],
    daily539: [
      "./raw_data/539.csv",
      "/taiwan-lottery-predictor/raw_data/539.csv"
    ],
    lotto649: [
      "./raw_data/lotto.csv",
      "/taiwan-lottery-predictor/raw_data/lotto.csv"
    ],
    superLotto638: [
      "./raw_data/power.csv",
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
    history: {
      bingo: [],
      daily539: [],
      lotto649: [],
      superLotto638: []
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
    if (document.getElementById("v76-style")) return;

    const style = document.createElement("style");
    style.id = "v76-style";
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
      .mini-special-wrap{display:inline-flex;align-items:center;gap:8px;margin-left:8px}
      .mini-label{font-size:13px;color:#666;font-weight:700}
      .text-muted{color:#888}
      .error-box{
        background:#fff3f3;border:1px solid #f3b7b7;color:#a40000;
        border-radius:16px;padding:16px;line-height:1.8
      }
      .source-note{
        font-size:12px;color:#666;margin-top:6px
      }
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
    const numberKeys = keys.filter(k => /number|draw|show|open|big|ball|num/i.test(k));

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
    const direct = firstMatchValue(row, ["period", "drawterm", "term", "issue", "期別", "期數"]);
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
        const orderNumbers = numbers.slice();
        const specialNumber = inferSpecial(
          row,
          ["specialnumber", "supernum", "bulleye", "bull_eye", "特別號", "超級獎號"],
          cfg.min,
          cfg.max
        );

        return {
          period,
          drawDate,
          redeemableDate: "",
          numbers,
          orderNumbers,
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
        const numbers = extractNumbersFromRow(row, cfg.min, cfg.max, 6);
        let specialNumber = inferSpecial(
          row,
          ["specialnumber", "specialnum", "bonusnumber", "特別號"],
          1,
          49
        );

        if (specialNumber == null) {
          const nums = numericArray(row.__raw || [], 1, 49);
          if (nums.length >= 7) specialNumber = nums[6];
        }

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
        const numbers = extractNumbersFromRow(row, cfg.min, cfg.max, 6);
        let specialNumber = inferSpecial(
          row,
          ["specialnumber", "specialnum", "secondareanumber", "第二區", "第二區號碼"],
          1,
          8
        );

        if (specialNumber == null) {
          const nums = numericArray(row.__raw || [], 1, 38);
          const small = numericArray(row.__raw || [], 1, 8);
          if (small.length && !numbers.includes(small[small.length - 1])) {
            specialNumber = small[small.length - 1];
          } else if (nums.length >= 7) {
            specialNumber = nums[6];
          }
        }

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
      .filter(item => item.numbers.length >= Math.min(cfg.historyMainCount, 3))
      .sort((a, b) => Number(b.period || 0) - Number(a.period || 0));
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

  function getLatestDraw(gameKey) {
    return state.latestJson?.[gameKey]?.latestOfficial ||
      state.latestJson?.[gameKey]?.latest ||
      state.latestJson?.officialLatest?.[gameKey] ||
      null;
  }

  function getHistory(gameKey, limit) {
    const history = state.history[gameKey] || [];
    const latest = getLatestDraw(gameKey);

    const out = [...history];
    if (latest && !out.some(x => String(x.period) === String(latest.period))) {
      out.unshift(latest);
    }

    return out
      .sort((a, b) => Number(b.period || 0) - Number(a.period || 0))
      .slice(0, limit);
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

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildPredictionSets(gameCode, draws, latestDraw, setCount) {
    const cfg = GAME_CONFIG[gameCode];
    const pickCount = cfg.mainCount();
    const pool = buildScorePool(draws, cfg.min, cfg.max, latestDraw);
    const hot = pool.slice(0, Math.max(pickCount * 2, 12)).map(x => x.number);
    const warm = pool.slice(0, Math.max(pickCount * 3, 18)).map(x => x.number);

    const sets = [];
    for (let s = 0; s < setCount; s += 1) {
      const source = s === 0
        ? hot
        : s === 1
          ? warm
          : shuffle(warm);

      const picked = [];
      for (const n of source) {
        if (!picked.includes(n)) picked.push(n);
        if (picked.length >= pickCount) break;
      }

      let specialNumber = null;
      if (gameCode === "649") {
        specialNumber = latestDraw?.specialNumber ?? null;
      } else if (gameCode === "638") {
        const spMap = new Map();
        draws.forEach(draw => {
          const n = Number(draw.specialNumber);
          if (Number.isFinite(n) && n >= 1 && n <= 8) {
            spMap.set(n, (spMap.get(n) || 0) + 1);
          }
        });
        const best = [...spMap.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
        specialNumber = best ? best[0] : (latestDraw?.specialNumber ?? 1);
      } else if (gameCode === "bingo") {
        specialNumber = latestDraw?.specialNumber ?? null;
      }

      sets.push({
        numbers: [...picked].sort((a, b) => a - b),
        specialNumber
      });
    }

    return sets;
  }

  function renderBalls(numbers, specialNumber = null, specialLabel = "") {
    const main = (numbers || [])
      .map(n => `<span class="ball">${pad2(n)}</span>`)
      .join("");

    const special = specialNumber !== null && specialNumber !== undefined
      ? `
        <span class="mini-special-wrap">
          ${specialLabel ? `<span class="mini-label">${escapeHtml(specialLabel)}</span>` : ""}
          <span class="ball special">${pad2(specialNumber)}</span>
        </span>
      `
      : "";

    return main || `<span class="text-muted">無資料</span>` + special;
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

    return draws.slice(0, 5).map(draw => `
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

  function renderPrediction(gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    const historyPeriods = Number($("historyPeriods")?.value || 50);
    const setCount = Number($("setCount")?.value || 3);

    const latestDraw = getLatestDraw(cfg.key);
    const draws = getHistory(cfg.key, historyPeriods);

    const frequency = frequencyAnalysis(draws, cfg.min, cfg.max);
    const miss = missAnalysis(draws, cfg.min, cfg.max);
    const tails = tailAnalysis(draws);
    const consecutive = consecutiveAnalysis(draws);
    const sets = buildPredictionSets(gameCode, draws, latestDraw, setCount);

    const container = $("predictionResult");
    const titleEl = $("resultGameName");

    if (titleEl) {
      titleEl.textContent = `${cfg.label}｜V76 歷史學習 AI 預測 + 官方最新資料`;
    }

    setBadge("已完成", true);

    container.innerHTML = `
      <div class="result-wrap">
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
          <div class="source-note">
            歷史學習期數：${draws.length} 期
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">AI 主推薦號碼</div>
          <div class="prediction-sets">
            ${sets.map((set, i) => `
              <div class="prediction-set">
                <div class="set-title">第 ${i + 1} 組</div>
                <div>${renderBalls(set.numbers, set.specialNumber, cfg.specialLabel)}</div>
              </div>
            `).join("")}
          </div>
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

    const [bingoHistory, daily539History, lotto649History, superLotto638History] = await Promise.all([
      loadHistoryCsv("bingo").catch(() => ({ data: [] })),
      loadHistoryCsv("daily539").catch(() => ({ data: [] })),
      loadHistoryCsv("lotto649").catch(() => ({ data: [] })),
      loadHistoryCsv("superLotto638").catch(() => ({ data: [] }))
    ]);

    state.history.bingo = bingoHistory.data;
    state.history.daily539 = daily539History.data;
    state.history.lotto649 = lotto649History.data;
    state.history.superLotto638 = superLotto638History.data;

    console.log("[V76] latest loaded:", latestResult.path);
    console.log("[V76] history counts:", {
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