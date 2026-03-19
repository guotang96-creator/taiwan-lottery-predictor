(() => {
  const APP_VERSION = "V75.1 AI 官方即時版";

  const DATA_CANDIDATES = [
    "./docs/latest.json",
    "./latest.json",
    "./data/latest.json",
    "/taiwan-lottery-predictor/docs/latest.json",
    "/taiwan-lottery-predictor/latest.json",
    "/taiwan-lottery-predictor/data/latest.json"
  ];

  const GAME_CONFIG = {
    bingo: {
      key: "bingo",
      label: "Bingo Bingo",
      pickCount: () => Number(document.getElementById("bingoCount")?.value || 10),
      min: 1,
      max: 80,
      specialLabel: "超級獎號"
    },
    "539": {
      key: "daily539",
      label: "今彩539",
      pickCount: () => 5,
      min: 1,
      max: 39,
      specialLabel: ""
    },
    "649": {
      key: "lotto649",
      label: "大樂透",
      pickCount: () => 6,
      min: 1,
      max: 49,
      specialLabel: "特別號"
    },
    "638": {
      key: "superLotto638",
      label: "威力彩",
      pickCount: () => 6,
      min: 1,
      max: 38,
      specialMin: 1,
      specialMax: 8,
      specialLabel: "第二區"
    }
  };

  const state = {
    data: null
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

  async function fetchFirstJson(paths) {
    const errors = [];

    for (const path of paths) {
      try {
        const res = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) {
          errors.push(`${path}: HTTP ${res.status}`);
          continue;
        }
        const json = await res.json();
        return { path, json };
      } catch (err) {
        errors.push(`${path}: ${err.message}`);
      }
    }

    throw new Error(errors.join(" | "));
  }

  function setBadge(text, ok = true) {
    const badge = $("resultBadge");
    if (!badge) return;
    badge.textContent = text;
    badge.style.background = ok ? "#e8f7ea" : "#fff4e5";
    badge.style.color = ok ? "#147a2e" : "#8a4b00";
  }

  function injectStyles() {
    if (document.getElementById("ai-app-style")) return;

    const style = document.createElement("style");
    style.id = "ai-app-style";
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
    `;
    document.head.appendChild(style);
  }

  function renderBalls(numbers, specialNumber = null, specialLabel = "") {
    const main = (numbers || []).map(n => `<span class="ball">${pad2(n)}</span>`).join("");
    const special = specialNumber !== null && specialNumber !== undefined
      ? `<span class="mini-special-wrap">${specialLabel ? `<span class="mini-label">${escapeHtml(specialLabel)}</span>` : ""}<span class="ball special">${pad2(specialNumber)}</span></span>`
      : "";
    return main || `<span class="text-muted">無資料</span>${special}`;
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

  function getLatestDraw(gameKey) {
    return state.data?.[gameKey]?.latestOfficial || state.data?.[gameKey]?.latest || null;
  }

  function buildLatestHistory(gameKey) {
    const latest = getLatestDraw(gameKey);
    return latest ? [latest] : [];
  }

  function frequencyAnalysis(draws, min, max) {
    const freq = new Map(range(min, max).map(n => [n, 0]));
    draws.forEach(draw => {
      (draw.numbers || []).forEach(n => freq.set(n, (freq.get(n) || 0) + 1));
    });
    const arr = [...freq.entries()].map(([number, count]) => ({ number, count }));
    return {
      hot: [...arr].sort((a, b) => b.count - a.count || a.number - b.number).slice(0, 10),
      cold: [...arr].sort((a, b) => a.count - b.count || a.number - b.number).slice(0, 10)
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

  function buildScorePool(draws, min, max, latestDraw) {
    const freq = frequencyAnalysis(draws, min, max);
    const miss = missAnalysis(draws, min, max);
    const freqMap = new Map(freq.hot.concat(freq.cold).map(x => [x.number, x.count]));
    const missMap = new Map(miss.map(x => [x.number, x.miss]));
    const latestNums = new Set(latestDraw?.numbers || []);

    return range(min, max)
      .map(number => {
        const count = freqMap.get(number) || 0;
        const missCount = missMap.get(number) || 0;
        const avoidLatestPenalty = latestNums.has(number) ? -1.2 : 0;
        const score = count * 2 + missCount * 1.4 + avoidLatestPenalty;
        return { number, score };
      })
      .sort((a, b) => b.score - a.score || a.number - b.number);
  }

  function buildPredictionSets(gameCode, draws, latestDraw, setCount) {
    const cfg = GAME_CONFIG[gameCode];
    const count = cfg.pickCount();
    const pool = buildScorePool(draws, cfg.min, cfg.max, latestDraw);
    const sets = [];

    for (let s = 0; s < setCount; s += 1) {
      const picked = [];
      const used = new Set();

      for (const item of [...pool.slice(s), ...pool.slice(0, s)]) {
        if (picked.length >= count) break;
        if (used.has(item.number)) continue;
        picked.push(item.number);
        used.add(item.number);
      }

      const sorted = picked.sort((a, b) => a - b);

      let specialNumber = null;
      if (gameCode === "649") specialNumber = latestDraw?.specialNumber ?? null;
      if (gameCode === "638") specialNumber = latestDraw?.specialNumber ?? null;
      if (gameCode === "bingo") specialNumber = latestDraw?.specialNumber ?? null;

      sets.push({
        numbers: sorted,
        specialNumber
      });
    }

    return sets;
  }

  function renderLatestFive(draws, gameCode) {
    const cfg = GAME_CONFIG[gameCode];
    if (!draws.length) return `<div class="text-muted">尚無資料</div>`;

    return draws.map(draw => `
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
    const latestDraw = getLatestDraw(cfg.key);
    const historyPeriods = Number($("historyPeriods")?.value || 50);
    const setCount = Number($("setCount")?.value || 3);

    const baseHistory = buildLatestHistory(cfg.key);
    const draws = baseHistory.slice(0, historyPeriods);

    const frequency = frequencyAnalysis(draws, cfg.min, cfg.max);
    const miss = missAnalysis(draws, cfg.min, cfg.max);
    const tails = tailAnalysis(draws);
    const consecutive = consecutiveAnalysis(draws);
    const sets = buildPredictionSets(gameCode, draws, latestDraw, setCount);

    const container = $("predictionResult");
    const titleEl = $("resultGameName");

    if (titleEl) {
      titleEl.textContent = `${cfg.label}｜AI 歷史學習預測 + 官方最新資料`;
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
          <div class="stats-wrap">${renderTagList(consecutive, "pair")}</div>
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
    const result = await fetchFirstJson(DATA_CANDIDATES);
    state.data = result.json;
    console.log("[Lottery] loaded:", result.path, state.data);
  }

  async function runPrediction(gameCode) {
    try {
      if (!state.data) {
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