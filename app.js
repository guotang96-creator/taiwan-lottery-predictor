// app.js
(() => {
  const APP_VERSION = "V74.1-official-live";

  const DATA_CANDIDATES = [
    "./latest.json",
    "./data/latest.json",
    "./docs/latest.json",
    "/taiwan-lottery-predictor/latest.json",
    "/taiwan-lottery-predictor/data/latest.json",
    "/taiwan-lottery-predictor/docs/latest.json"
  ];

  const OFFICIAL_CANDIDATES = [
    "./official_latest.json",
    "./data/official_latest.json",
    "./docs/official_latest.json",
    "/taiwan-lottery-predictor/official_latest.json",
    "/taiwan-lottery-predictor/data/official_latest.json",
    "/taiwan-lottery-predictor/docs/official_latest.json"
  ];

  const GAME_CONFIG = {
    bingo: {
      key: "bingo",
      label: "Bingo Bingo",
      count: 10,
      min: 1,
      max: 80,
      latestCount: 20
    },
    "649": {
      key: "lotto649",
      label: "大樂透",
      count: 6,
      min: 1,
      max: 49,
      latestCount: 6,
      specialLabel: "特別號"
    },
    "638": {
      key: "superLotto638",
      label: "威力彩",
      count: 6,
      min: 1,
      max: 38,
      latestCount: 6,
      specialMin: 1,
      specialMax: 8,
      specialLabel: "第二區"
    },
    "539": {
      key: "daily539",
      label: "今彩539",
      count: 5,
      min: 1,
      max: 39,
      latestCount: 5
    }
  };

  const state = {
    latestJson: null,
    officialJson: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uniqNumbers(arr) {
    return [...new Set(arr)];
  }

  function sortAsc(arr) {
    return [...arr].sort((a, b) => a - b);
  }

  function normalizeNumbers(arr, min, max) {
    if (!Array.isArray(arr)) return [];
    return sortAsc(
      uniqNumbers(
        arr
          .map(v => Number(v))
          .filter(v => Number.isFinite(v) && v >= min && v <= max)
      )
    );
  }

  function range(min, max) {
    const out = [];
    for (let i = min; i <= max; i += 1) out.push(i);
    return out;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function fetchJsonFirst(paths) {
    const errors = [];
    for (const path of paths) {
      try {
        const res = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) {
          errors.push(`${path} => HTTP ${res.status}`);
          continue;
        }
        const json = await res.json();
        return { path, json };
      } catch (err) {
        errors.push(`${path} => ${err.message}`);
      }
    }
    throw new Error(errors.join(" | "));
  }

  function pickHistoryContainer(latestJson, gameKey) {
    if (!latestJson || typeof latestJson !== "object") return null;

    const direct = latestJson[gameKey];
    if (direct && typeof direct === "object") return direct;

    const aliases = {
      lotto649: ["649", "lotto_649", "bigLotto"],
      superLotto638: ["638", "superlotto638", "powerLottery"],
      daily539: ["539", "daily_539"],
      bingo: ["bingoBingo"]
    };

    for (const alias of aliases[gameKey] || []) {
      if (latestJson[alias] && typeof latestJson[alias] === "object") {
        return latestJson[alias];
      }
    }

    return null;
  }

  function extractHistoryRows(gameKey) {
    const block = pickHistoryContainer(state.latestJson, gameKey);
    if (!block) return [];

    const possibleArrays = [
      block.history,
      block.records,
      block.draws,
      block.list,
      block.results,
      block.data,
      block.items
    ];

    for (const arr of possibleArrays) {
      if (Array.isArray(arr) && arr.length) return arr;
    }

    if (Array.isArray(block)) return block;
    return [];
  }

  function parseRowToDraw(gameKey, row) {
    const cfg = Object.values(GAME_CONFIG).find(g => g.key === gameKey);
    if (!cfg || !row || typeof row !== "object") return null;

    let numbers = [];
    let specialNumber = null;

    if (Array.isArray(row.numbers)) {
      numbers = normalizeNumbers(row.numbers, cfg.min, cfg.max);
    } else if (Array.isArray(row.drawNumberSize)) {
      numbers = normalizeNumbers(row.drawNumberSize, cfg.min, cfg.max);
    } else if (Array.isArray(row.drawNumbers)) {
      numbers = normalizeNumbers(row.drawNumbers, cfg.min, cfg.max);
    } else {
      const possibleKeys = Object.keys(row).filter(k => /^n\d+$/i.test(k));
      if (possibleKeys.length) {
        numbers = normalizeNumbers(possibleKeys.map(k => row[k]), cfg.min, cfg.max);
      }
    }

    if (gameKey === "superLotto638") {
      specialNumber =
        Number(row.specialNumber ?? row.secondAreaNumber ?? row.specialNum ?? row.bonusNumber) || null;
    } else if (gameKey === "lotto649") {
      specialNumber =
        Number(row.specialNumber ?? row.specialNum ?? row.bonusNumber) || null;
    } else if (gameKey === "bingo") {
      specialNumber =
        Number(row.specialNumber ?? row.superNum ?? row.bonusNumber) || null;
      if (!numbers.length && Array.isArray(row.orderNumbers)) {
        numbers = normalizeNumbers(row.orderNumbers, cfg.min, cfg.max);
      }
    }

    const period = String(row.period ?? row.drawTerm ?? row.term ?? "");
    const drawDate = row.drawDate ?? row.lotteryDate ?? row.date ?? "";
    const redeemableDate = row.redeemableDate ?? "";

    if (!numbers.length) return null;

    return {
      period,
      drawDate,
      redeemableDate,
      numbers,
      specialNumber
    };
  }

  function extractOfficialLatest(gameKey) {
    const official = state.officialJson;
    const latest = state.latestJson;

    const fromOfficial =
      official?.officialLatest?.[gameKey] ||
      official?.[gameKey]?.latestOfficial ||
      official?.[gameKey]?.latest ||
      null;

    const fromLatest =
      latest?.officialLatest?.[gameKey] ||
      latest?.[gameKey]?.latestOfficial ||
      latest?.[gameKey]?.latest ||
      null;

    return fromOfficial || fromLatest || null;
  }

  function getLatestDraw(gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    const historyRows = extractHistoryRows(cfg.key)
      .map(row => parseRowToDraw(cfg.key, row))
      .filter(Boolean)
      .sort((a, b) => Number(b.period || 0) - Number(a.period || 0));

    if (historyRows.length) return historyRows[0];

    const officialRaw = extractOfficialLatest(cfg.key);
    if (!officialRaw) return null;

    return parseRowToDraw(cfg.key, officialRaw);
  }

  function getLatestFive(gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    const rows = extractHistoryRows(cfg.key)
      .map(row => parseRowToDraw(cfg.key, row))
      .filter(Boolean)
      .sort((a, b) => Number(b.period || 0) - Number(a.period || 0));

    const out = rows.slice(0, 5);

    if (!out.length) {
      const latestDraw = getLatestDraw(gameCode);
      return latestDraw ? [latestDraw] : [];
    }

    return out;
  }

  function getHistoryForAnalysis(gameCode, limit) {
    const cfg = GAME_CONFIG[gameCode];
    const rows = extractHistoryRows(cfg.key)
      .map(row => parseRowToDraw(cfg.key, row))
      .filter(Boolean)
      .sort((a, b) => Number(b.period || 0) - Number(a.period || 0))
      .slice(0, limit);

    if (rows.length) return rows;

    const latestDraw = getLatestDraw(gameCode);
    return latestDraw ? [latestDraw] : [];
  }

  function frequencyAnalysis(draws, min, max) {
    const map = new Map();
    range(min, max).forEach(n => map.set(n, 0));

    for (const draw of draws) {
      for (const n of draw.numbers) {
        map.set(n, (map.get(n) || 0) + 1);
      }
    }

    const sorted = [...map.entries()]
      .map(([number, count]) => ({ number, count }))
      .sort((a, b) => b.count - a.count || a.number - b.number);

    return {
      hot: sorted.slice(0, 10),
      cold: [...sorted].reverse().slice(0, 10)
    };
  }

  function overdueAnalysis(draws, min, max) {
    const lastSeen = new Map();
    range(min, max).forEach(n => lastSeen.set(n, Infinity));

    draws.forEach((draw, index) => {
      draw.numbers.forEach(n => {
        if (lastSeen.get(n) === Infinity) lastSeen.set(n, index);
      });
    });

    return [...lastSeen.entries()]
      .map(([number, miss]) => ({
        number,
        miss: miss === Infinity ? draws.length + 1 : miss
      }))
      .sort((a, b) => b.miss - a.miss || a.number - b.number);
  }

  function tailAnalysis(draws) {
    const counts = new Map();
    for (let i = 0; i <= 9; i += 1) counts.set(i, 0);

    for (const draw of draws) {
      for (const n of draw.numbers) {
        const tail = n % 10;
        counts.set(tail, (counts.get(tail) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([tail, count]) => ({ tail, count }))
      .sort((a, b) => b.count - a.count || a.tail - b.tail);
  }

  function consecutiveAnalysis(draws) {
    const pairs = new Map();

    for (const draw of draws) {
      const nums = sortAsc(draw.numbers);
      for (let i = 0; i < nums.length - 1; i += 1) {
        if (nums[i + 1] === nums[i] + 1) {
          const key = `${nums[i]}-${nums[i + 1]}`;
          pairs.set(key, (pairs.get(key) || 0) + 1);
        }
      }
    }

    return [...pairs.entries()]
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count);
  }

  function buildWeightedPool(draws, min, max) {
    const freq = new Map();
    const miss = new Map();

    range(min, max).forEach(n => {
      freq.set(n, 0);
      miss.set(n, draws.length + 1);
    });

    draws.forEach((draw, idx) => {
      draw.numbers.forEach(n => {
        freq.set(n, (freq.get(n) || 0) + 1);
        if (miss.get(n) === draws.length + 1) {
          miss.set(n, idx);
        }
      });
    });

    const scored = range(min, max).map(n => {
      const f = freq.get(n) || 0;
      const m = miss.get(n) || 0;
      const tailBonus = draws.length
        ? draws
            .flatMap(d => d.numbers)
            .filter(x => x % 10 === n % 10).length / 10
        : 0;

      const score = f * 2 + m * 0.8 + tailBonus * 0.2;
      return { number: n, score };
    });

    return scored.sort((a, b) => b.score - a.score || a.number - b.number);
  }

  function pickPredictionSet(pool, count, min, max, latestDrawNumbers) {
    const selected = [];
    const used = new Set();

    const latestSet = new Set(latestDrawNumbers || []);

    for (const item of pool) {
      if (selected.length >= count) break;
      if (used.has(item.number)) continue;
      selected.push(item.number);
      used.add(item.number);
    }

    const candidates = range(min, max).filter(n => !used.has(n));
    const randomFill = shuffle(candidates);

    while (selected.length < count && randomFill.length) {
      selected.push(randomFill.shift());
    }

    let result = sortAsc(selected).slice(0, count);

    const overlap = result.filter(n => latestSet.has(n)).length;
    if (latestSet.size && overlap >= Math.ceil(count * 0.8)) {
      const replacement = range(min, max).find(n => !result.includes(n) && !latestSet.has(n));
      if (replacement) {
        result[result.length - 1] = replacement;
        result = sortAsc(result);
      }
    }

    return result;
  }

  function predictSpecial638(draws) {
    const counts = new Map();
    for (let i = 1; i <= 8; i += 1) counts.set(i, 0);

    for (const draw of draws) {
      const n = Number(draw.specialNumber);
      if (Number.isFinite(n) && n >= 1 && n <= 8) {
        counts.set(n, (counts.get(n) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([number, count]) => ({ number, count }))
      .sort((a, b) => b.count - a.count || a.number - b.number)[0]?.number || 1;
  }

  function predictSpecial649(draws) {
    const counts = new Map();
    for (let i = 1; i <= 49; i += 1) counts.set(i, 0);

    for (const draw of draws) {
      const n = Number(draw.specialNumber);
      if (Number.isFinite(n) && n >= 1 && n <= 49) {
        counts.set(n, (counts.get(n) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([number, count]) => ({ number, count }))
      .sort((a, b) => b.count - a.count || a.number - b.number)[0]?.number || 1;
  }

  function buildPredictions(gameCode, setCount, historyPeriods, bingoCount) {
    const cfg = GAME_CONFIG[gameCode];
    const draws = getHistoryForAnalysis(gameCode, historyPeriods);
    const latestDraw = getLatestDraw(gameCode);
    const pickCount = gameCode === "bingo" ? bingoCount : cfg.count;
    const pool = buildWeightedPool(draws, cfg.min, cfg.max);

    const sets = [];
    for (let i = 0; i < setCount; i += 1) {
      const shiftedPool = [...pool.slice(i), ...pool.slice(0, i)];
      const mainSet = pickPredictionSet(
        shiftedPool,
        pickCount,
        cfg.min,
        cfg.max,
        latestDraw?.numbers || []
      );

      let specialNumber = null;
      if (gameCode === "638") specialNumber = predictSpecial638(draws);
      if (gameCode === "649") specialNumber = predictSpecial649(draws);

      sets.push({
        numbers: mainSet,
        specialNumber
      });
    }

    return {
      draws,
      latestDraw,
      latestFive: getLatestFive(gameCode),
      frequency: frequencyAnalysis(draws, cfg.min, cfg.max),
      overdue: overdueAnalysis(draws, cfg.min, cfg.max),
      tails: tailAnalysis(draws),
      consecutive: consecutiveAnalysis(draws),
      sets
    };
  }

  function renderBalls(numbers, className = "") {
    if (!numbers || !numbers.length) return `<span class="text-muted">無資料</span>`;
    return numbers
      .map(n => `<span class="ball ${className}">${pad2(n)}</span>`)
      .join("");
  }

  function renderMiniRows(draws, gameCode) {
    if (!draws.length) return `<div class="empty-text">尚無最新期數資料</div>`;

    const cfg = GAME_CONFIG[gameCode];

    return draws.map(draw => {
      const special =
        Number.isFinite(Number(draw.specialNumber)) && draw.specialNumber !== null
          ? `
            <span class="mini-special-wrap">
              <span class="mini-label">${cfg.specialLabel || "特別號"}</span>
              <span class="ball special">${pad2(draw.specialNumber)}</span>
            </span>
          `
          : "";

      return `
        <div class="mini-row">
          <div class="mini-row-head">
            <span>第 ${escapeHtml(draw.period || "—")} 期</span>
            <span>${escapeHtml(formatDate(draw.drawDate))}</span>
          </div>
          <div class="mini-row-balls">
            ${renderBalls(draw.numbers)}
            ${special}
          </div>
        </div>
      `;
    }).join("");
  }

  function renderTagList(items, type) {
    if (!items.length) return `<span class="text-muted">無資料</span>`;

    if (type === "pair") {
      return items.slice(0, 6).map(item => {
        const [a, b] = item.pair.split("-").map(Number);
        return `
          <span class="stat-chip">
            ${pad2(a)}-${pad2(b)}（${item.count}）
          </span>
        `;
      }).join("");
    }

    if (type === "tail") {
      return items.slice(0, 6).map(item => `
        <span class="stat-chip">
          尾${item.tail}（${item.count}）
        </span>
      `).join("");
    }

    return items.slice(0, 8).map(item => `
      <span class="stat-chip">
        ${pad2(item.number)}（${item.count ?? item.miss ?? 0}）
      </span>
    `).join("");
  }

  function setBadge(text, ok = true) {
    const badge = $("resultBadge");
    if (!badge) return;
    badge.textContent = text;
    badge.style.background = ok ? "#e8f7ea" : "#fff4e5";
    badge.style.color = ok ? "#147a2e" : "#8a4b00";
  }

  function injectExtraStyles() {
    if (document.getElementById("appjs-extra-style")) return;

    const style = document.createElement("style");
    style.id = "appjs-extra-style";
    style.textContent = `
      .result-wrap{
        display:flex;
        flex-direction:column;
        gap:16px;
      }
      .summary-card,
      .section-card{
        background:#fff;
        border:1px solid #ececec;
        border-radius:18px;
        padding:16px;
        box-shadow:0 4px 14px rgba(0,0,0,.06);
      }
      .summary-title,
      .section-title{
        font-size:18px;
        font-weight:800;
        color:#222;
        margin:0 0 10px 0;
      }
      .summary-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
        gap:12px;
      }
      .summary-item{
        background:#f8fafc;
        border-radius:14px;
        padding:12px;
      }
      .summary-item-label{
        font-size:13px;
        color:#666;
        margin-bottom:6px;
      }
      .summary-item-value{
        font-size:16px;
        font-weight:700;
        color:#222;
        line-height:1.6;
      }
      .prediction-sets{
        display:grid;
        gap:12px;
      }
      .prediction-set{
        background:#f8fafc;
        border-radius:14px;
        padding:14px;
        border:1px solid #edf2f7;
      }
      .set-title{
        font-size:15px;
        font-weight:800;
        margin-bottom:10px;
        color:#222;
      }
      .ball{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:40px;
        height:40px;
        border-radius:999px;
        background:#d81b60;
        color:#fff;
        font-weight:800;
        margin:4px 6px 4px 0;
        box-shadow:0 2px 6px rgba(0,0,0,.12);
      }
      .ball.special{
        background:#ff9800;
      }
      .stats-wrap{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }
      .stat-chip{
        display:inline-flex;
        align-items:center;
        padding:8px 12px;
        border-radius:999px;
        background:#f3f4f6;
        color:#333;
        font-size:14px;
        font-weight:700;
      }
      .mini-list{
        display:flex;
        flex-direction:column;
        gap:10px;
      }
      .mini-row{
        background:#f8fafc;
        border-radius:14px;
        padding:12px;
      }
      .mini-row-head{
        display:flex;
        justify-content:space-between;
        gap:10px;
        flex-wrap:wrap;
        font-size:13px;
        color:#666;
        margin-bottom:8px;
      }
      .mini-row-balls{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:4px;
      }
      .mini-special-wrap{
        display:inline-flex;
        align-items:center;
        gap:8px;
        margin-left:8px;
      }
      .mini-label{
        font-size:13px;
        color:#666;
        font-weight:700;
      }
      .text-muted{
        color:#888;
      }
      .error-box{
        background:#fff3f3;
        border:1px solid #f3b7b7;
        color:#a40000;
        border-radius:16px;
        padding:16px;
        line-height:1.8;
      }
    `;
    document.head.appendChild(style);
  }

  function renderPrediction(gameCode, result) {
    const cfg = GAME_CONFIG[gameCode];
    const container = $("predictionResult");
    const titleEl = $("resultGameName");

    if (!container) return;

    if (titleEl) {
      titleEl.textContent = `${cfg.label}｜官方歷史資料分析 + 最新五期`;
    }

    setBadge("已完成", true);

    const latest = result.latestDraw;
    const latestSpecial =
      latest && latest.specialNumber !== null && latest.specialNumber !== undefined
        ? `
          <div class="summary-item">
            <div class="summary-item-label">${cfg.specialLabel || "特別號"}</div>
            <div class="summary-item-value">${pad2(latest.specialNumber)}</div>
          </div>
        `
        : "";

    container.innerHTML = `
      <div class="result-wrap">
        <div class="summary-card">
          <div class="summary-title">最新一期</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-item-label">最新期數</div>
              <div class="summary-item-value">${escapeHtml(latest?.period || "—")}</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">開獎時間</div>
              <div class="summary-item-value">${escapeHtml(formatDate(latest?.drawDate || ""))}</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">最新號碼</div>
              <div class="summary-item-value">${latest ? renderBalls(latest.numbers) : "—"}</div>
            </div>
            ${latestSpecial}
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">主推薦號碼</div>
          <div class="prediction-sets">
            ${result.sets.map((set, index) => `
              <div class="prediction-set">
                <div class="set-title">第 ${index + 1} 組推薦</div>
                <div>${renderBalls(set.numbers)}</div>
                ${
                  set.specialNumber !== null && set.specialNumber !== undefined
                    ? `
                      <div style="margin-top:10px;">
                        <span class="mini-label">${cfg.specialLabel || "特別號"}</span>
                        <span class="ball special">${pad2(set.specialNumber)}</span>
                      </div>
                    `
                    : ""
                }
              </div>
            `).join("")}
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">熱號分析</div>
          <div class="stats-wrap">${renderTagList(result.frequency.hot, "number")}</div>
        </div>

        <div class="section-card">
          <div class="section-title">冷號分析</div>
          <div class="stats-wrap">${renderTagList(result.frequency.cold, "number")}</div>
        </div>

        <div class="section-card">
          <div class="section-title">拖號 / 遺漏分析</div>
          <div class="stats-wrap">${renderTagList(result.overdue.slice(0, 8), "miss")}</div>
        </div>

        <div class="section-card">
          <div class="section-title">連號偵測</div>
          <div class="stats-wrap">
            ${result.consecutive.length ? renderTagList(result.consecutive, "pair") : `<span class="text-muted">近幾期未偵測到明顯連號</span>`}
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">尾數分析</div>
          <div class="stats-wrap">${renderTagList(result.tails, "tail")}</div>
        </div>

        <div class="section-card">
          <div class="section-title">最新五期</div>
          <div class="mini-list">${renderMiniRows(result.latestFive, gameCode)}</div>
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
    injectExtraStyles();

    let latestResult = null;
    let officialResult = null;

    try {
      latestResult = await fetchJsonFirst(DATA_CANDIDATES);
      state.latestJson = latestResult.json;
    } catch (err) {
      console.warn("latest.json 載入失敗：", err.message);
    }

    try {
      officialResult = await fetchJsonFirst(OFFICIAL_CANDIDATES);
      state.officialJson = officialResult.json;
    } catch (err) {
      console.warn("official_latest.json 載入失敗：", err.message);
    }

    if (!state.latestJson && !state.officialJson) {
      throw new Error("latest.json 與 official_latest.json 都讀不到");
    }

    console.log("[Lottery] APP_VERSION =", APP_VERSION);
    console.log("[Lottery] latest source =", latestResult?.path || "none");
    console.log("[Lottery] official source =", officialResult?.path || "none");
  }

  async function runPrediction(gameCode) {
    try {
      const cfg = GAME_CONFIG[gameCode];
      if (!cfg) throw new Error(`不支援的彩種：${gameCode}`);

      if (!state.latestJson && !state.officialJson) {
        await initData();
      }

      const setCount = Number($("setCount")?.value || 3);
      const historyPeriods = Number($("historyPeriods")?.value || 50);
      const bingoCount = Number($("bingoCount")?.value || 10);

      $("resultGameName").textContent = `${cfg.label}｜分析中...`;
      setBadge("分析中", false);

      const result = buildPredictions(gameCode, setCount, historyPeriods, bingoCount);
      renderPrediction(gameCode, result);
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
    } catch (err) {
      console.error(err);
      showError(err.message || "初始化失敗");
    }
  });
})();
