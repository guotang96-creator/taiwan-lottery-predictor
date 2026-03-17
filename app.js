// V66.1 官方資料自動更新版（前端）
// 不用 Python / 手機版 / 直接讀 data/official/*.json

(() => {
  const DATA_FILES = {
    bingo: "./data/official/bingo.json",
    lotto649: "./data/official/lotto649.json",
    superlotto638: "./data/official/superlotto638.json",
    dailycash: "./data/official/dailycash.json",
    meta: "./data/official/meta.json"
  };

  const GAME_CONFIG = {
    bingo: {
      key: "bingo",
      name: "賓果賓果",
      range: 80,
      defaultPick: 10,
      minPick: 1,
      maxPick: 10,
      bonus: false
    },
    lotto649: {
      key: "lotto649",
      name: "大樂透",
      range: 49,
      defaultPick: 6,
      minPick: 6,
      maxPick: 6,
      bonus: true
    },
    superlotto638: {
      key: "superlotto638",
      name: "威力彩",
      range: 38,
      defaultPick: 6,
      minPick: 6,
      maxPick: 6,
      bonus: true,
      secondZoneRange: 8
    },
    dailycash: {
      key: "dailycash",
      name: "今彩539",
      range: 39,
      defaultPick: 5,
      minPick: 5,
      maxPick: 5,
      bonus: false
    }
  };

  const state = {
    game: "bingo",
    historyLimit: 60,
    pickCount: 10,
    data: {
      bingo: [],
      lotto649: [],
      superlotto638: [],
      dailycash: [],
      meta: null
    }
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function numSort(arr) {
    return [...arr].sort((a, b) => a - b);
  }

  function uniq(arr) {
    return [...new Set(arr)];
  }

  function safeArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function fmtDateTime(value) {
    if (!value) return "—";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString("zh-TW", { hour12: false });
    } catch {
      return String(value);
    }
  }

  function createStyles() {
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
        background: #0f172a;
        color: #e5e7eb;
      }
      #app {
        max-width: 780px;
        margin: 0 auto;
        padding: 14px;
      }
      .card {
        background: #111827;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 16px;
        padding: 14px;
        margin-bottom: 12px;
        box-shadow: 0 8px 28px rgba(0,0,0,.18);
      }
      .title {
        font-size: 22px;
        font-weight: 800;
        margin-bottom: 8px;
      }
      .sub {
        font-size: 13px;
        color: #9ca3af;
      }
      .grid {
        display: grid;
        gap: 10px;
      }
      .grid-2 {
        grid-template-columns: 1fr 1fr;
      }
      .grid-3 {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (max-width: 640px) {
        .grid-2, .grid-3 {
          grid-template-columns: 1fr;
        }
      }
      label {
        display: block;
        font-size: 13px;
        margin-bottom: 6px;
        color: #cbd5e1;
      }
      select, input, button {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.1);
        background: #1f2937;
        color: #fff;
        padding: 12px;
        font-size: 15px;
      }
      button {
        cursor: pointer;
        font-weight: 700;
      }
      .btn-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .pill-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ball {
        min-width: 44px;
        height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        font-weight: 800;
        background: #2563eb;
        color: white;
        font-size: 16px;
      }
      .ball.red { background: #dc2626; }
      .ball.green { background: #059669; }
      .ball.gray { background: #374151; }
      .stat-box {
        background: #0b1220;
        border-radius: 12px;
        padding: 12px;
        border: 1px solid rgba(255,255,255,.06);
      }
      .stat-title {
        font-size: 12px;
        color: #94a3b8;
        margin-bottom: 6px;
      }
      .stat-value {
        font-size: 18px;
        font-weight: 800;
      }
      .small {
        font-size: 12px;
        color: #9ca3af;
      }
      .section-title {
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 10px;
      }
      .divider {
        height: 1px;
        background: rgba(255,255,255,.08);
        margin: 12px 0;
      }
      .list {
        display: grid;
        gap: 8px;
      }
      .row {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px dashed rgba(255,255,255,.08);
      }
      .row:last-child {
        border-bottom: 0;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .note {
        background: rgba(37,99,235,.1);
        color: #bfdbfe;
        border: 1px solid rgba(37,99,235,.25);
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 13px;
      }
      .warn {
        background: rgba(245,158,11,.08);
        color: #fde68a;
        border: 1px solid rgba(245,158,11,.22);
      }
    `;
    document.head.appendChild(style);
  }

  function renderApp() {
    const app = byId("app");
    app.innerHTML = `
      <div class="card">
        <div class="title">台灣彩券預測 V66.1</div>
        <div class="sub">官方資料自動更新版｜手機版｜免 Python</div>
      </div>

      <div class="card">
        <div class="grid grid-3">
          <div>
            <label>彩種</label>
            <select id="gameSelect">
              <option value="bingo">賓果賓果</option>
              <option value="lotto649">大樂透</option>
              <option value="superlotto638">威力彩</option>
              <option value="dailycash">今彩539</option>
            </select>
          </div>
          <div>
            <label>分析期數</label>
            <select id="historyLimit">
              <option value="30">最近 30 期</option>
              <option value="60" selected>最近 60 期</option>
              <option value="120">最近 120 期</option>
              <option value="240">最近 240 期</option>
            </select>
          </div>
          <div>
            <label>預測顆數</label>
            <select id="pickCount"></select>
          </div>
        </div>
        <div class="divider"></div>
        <div class="btn-row">
          <button id="btnAnalyze">開始分析</button>
          <button id="btnReload">重新讀取資料</button>
        </div>
      </div>

      <div class="card">
        <div class="section-title">資料狀態</div>
        <div id="metaInfo" class="list"></div>
      </div>

      <div class="card">
        <div class="section-title">推薦號碼</div>
        <div id="prediction"></div>
      </div>

      <div class="card">
        <div class="section-title">分析摘要</div>
        <div id="summaryStats" class="grid grid-2"></div>
      </div>

      <div class="card">
        <div class="section-title">熱門號碼 / 冷門號碼</div>
        <div id="hotCold" class="grid grid-2"></div>
      </div>

      <div class="card">
        <div class="section-title">拖號 / 連號 / 尾數</div>
        <div id="patternStats" class="grid grid-2"></div>
      </div>

      <div class="card">
        <div class="section-title">最近開獎</div>
        <div id="latestDraw"></div>
      </div>
    `;
  }

  function buildPickOptions() {
    const game = GAME_CONFIG[state.game];
    const el = byId("pickCount");
    el.innerHTML = "";

    for (let i = game.minPick; i <= game.maxPick; i += 1) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i} 顆`;
      if (i === state.pickCount) opt.selected = true;
      el.appendChild(opt);
    }

    if (state.pickCount < game.minPick || state.pickCount > game.maxPick) {
      state.pickCount = game.defaultPick;
      el.value = String(state.pickCount);
    }
  }

  async function fetchJson(url) {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`讀取失敗：${url} (${res.status})`);
    }
    return res.json();
  }

  async function loadAllData() {
    const [bingo, lotto649, superlotto638, dailycash, meta] = await Promise.all([
      fetchJson(DATA_FILES.bingo).catch(() => []),
      fetchJson(DATA_FILES.lotto649).catch(() => []),
      fetchJson(DATA_FILES.superlotto638).catch(() => []),
      fetchJson(DATA_FILES.dailycash).catch(() => []),
      fetchJson(DATA_FILES.meta).catch(() => null)
    ]);

    state.data = { bingo, lotto649, superlotto638, dailycash, meta };
  }

  function getCurrentDraws() {
    return safeArray(state.data[state.game]);
  }

  function getLimitedDraws() {
    return getCurrentDraws().slice(0, state.historyLimit);
  }

  function extractMainNumbers(draw) {
    if (!draw) return [];
    if (state.game === "superlotto638") return safeArray(draw.numbers1);
    return safeArray(draw.numbers);
  }

  function extractSecondNumbers(draw) {
    if (!draw) return [];
    if (state.game === "superlotto638") return typeof draw.numbers2 === "number" ? [draw.numbers2] : [];
    if (state.game === "lotto649" && typeof draw.special === "number") return [draw.special];
    return [];
  }

  function calcFrequency(draws, range, selector = extractMainNumbers) {
    const map = Array.from({ length: range + 1 }, (_, i) => ({
      number: i,
      count: 0
    }));
    draws.forEach(draw => {
      selector(draw).forEach(n => {
        if (n >= 1 && n <= range) map[n].count += 1;
      });
    });
    return map.slice(1);
  }

  function calcMiss(draws, range, selector = extractMainNumbers) {
    const miss = [];
    for (let n = 1; n <= range; n += 1) {
      let gap = 0;
      for (const draw of draws) {
        const nums = selector(draw);
        if (nums.includes(n)) break;
        gap += 1;
      }
      miss.push({ number: n, miss: gap });
    }
    return miss;
  }

  function calcTailStats(draws, selector = extractMainNumbers) {
    const tails = Array.from({ length: 10 }, (_, i) => ({ tail: i, count: 0 }));
    draws.forEach(draw => {
      selector(draw).forEach(n => {
        tails[n % 10].count += 1;
      });
    });
    return tails.sort((a, b) => b.count - a.count);
  }

  function calcConsecutive(draws, selector = extractMainNumbers) {
    let groups = 0;
    let maxLen = 0;
    const samples = [];

    draws.forEach(draw => {
      const nums = numSort(selector(draw));
      let streak = 1;

      for (let i = 1; i < nums.length; i += 1) {
        if (nums[i] === nums[i - 1] + 1) {
          streak += 1;
          if (streak === 2) groups += 1;
        } else {
          if (streak >= 2) {
            maxLen = Math.max(maxLen, streak);
          }
          streak = 1;
        }
      }
      if (streak >= 2) maxLen = Math.max(maxLen, streak);

      const oneDrawGroups = [];
      let cur = [nums[0]];
      for (let i = 1; i < nums.length; i += 1) {
        if (nums[i] === nums[i - 1] + 1) {
          cur.push(nums[i]);
        } else {
          if (cur.length >= 2) oneDrawGroups.push([...cur]);
          cur = [nums[i]];
        }
      }
      if (cur.length >= 2) oneDrawGroups.push([...cur]);

      if (oneDrawGroups.length) {
        samples.push({
          issue: draw.issue,
          groups: oneDrawGroups
        });
      }
    });

    return { groups, maxLen, samples: samples.slice(0, 8) };
  }

  function calcRepeatFromPrev(draws, selector = extractMainNumbers) {
    let total = 0;
    let count = 0;
    const samples = [];

    for (let i = 0; i < draws.length - 1; i += 1) {
      const curr = new Set(selector(draws[i]));
      const prev = new Set(selector(draws[i + 1]));
      const repeat = [...curr].filter(n => prev.has(n));
      total += repeat.length;
      count += 1;
      if (repeat.length) {
        samples.push({
          issue: draws[i].issue,
          repeat
        });
      }
    }

    return {
      avg: count ? (total / count).toFixed(2) : "0.00",
      samples: samples.slice(0, 8)
    };
  }

  function scoreNumbers(draws, config) {
    const freq = calcFrequency(draws, config.range);
    const miss = calcMiss(draws, config.range);
    const missMap = new Map(miss.map(x => [x.number, x.miss]));
    const latestSet = new Set(extractMainNumbers(draws[0] || {}));
    const prevSet = new Set(extractMainNumbers(draws[1] || {}));
    const tailsTop = calcTailStats(draws).slice(0, 4).map(x => x.tail);
    const freqMax = Math.max(...freq.map(x => x.count), 1);
    const missMax = Math.max(...miss.map(x => x.miss), 1);

    const ranked = freq.map(item => {
      const n = item.number;
      const f = item.count;
      const m = missMap.get(n) || 0;
      let score = 0;

      score += (f / freqMax) * 45;
      score += (m / missMax) * 25;

      if (tailsTop.includes(n % 10)) score += 8;
      if (prevSet.has(n)) score += 7;
      if (!latestSet.has(n)) score += 6;

      const neighbors = [n - 1, n + 1].filter(v => v >= 1 && v <= config.range);
      const neighborHit = neighbors.filter(v => latestSet.has(v) || prevSet.has(v)).length;
      score += neighborHit * 4;

      return {
        number: n,
        freq: f,
        miss: m,
        score: Number(score.toFixed(2))
      };
    });

    return ranked.sort((a, b) => b.score - a.score);
  }

  function pickMainNumbers(draws, config, count) {
    const ranked = scoreNumbers(draws, config);
    const chosen = [];

    for (const item of ranked) {
      if (chosen.includes(item.number)) continue;

      if (chosen.length > 0) {
        const tooDense = chosen.filter(n => Math.abs(n - item.number) <= 1).length >= 2;
        if (tooDense) continue;
      }

      chosen.push(item.number);
      if (chosen.length >= count) break;
    }

    if (chosen.length < count) {
      for (const item of ranked) {
        if (!chosen.includes(item.number)) {
          chosen.push(item.number);
          if (chosen.length >= count) break;
        }
      }
    }

    return numSort(chosen.slice(0, count));
  }

  function pickBonus(draws, gameKey) {
    if (gameKey === "superlotto638") {
      const freq = calcFrequency(draws, 8, draw => (typeof draw.numbers2 === "number" ? [draw.numbers2] : []));
      return freq.sort((a, b) => b.count - a.count)[0]?.number || 1;
    }
    if (gameKey === "lotto649") {
      const specials = calcFrequency(draws, 49, draw => (typeof draw.special === "number" ? [draw.special] : []));
      return specials.sort((a, b) => b.count - a.count)[0]?.number || 1;
    }
    return null;
  }

  function renderMeta() {
    const el = byId("metaInfo");
    const meta = state.data.meta || {};
    const gameData = getCurrentDraws();

    const updateAt = meta.updatedAt || meta.generatedAt;
    const source =
  meta.sourceName ||
  meta.source ||
  meta.mode ||
  "台灣彩券資料";

    el.innerHTML = `
      <div class="row">
        <div>資料來源</div>
        <div class="small">${source}</div>
      </div>
      <div class="row">
        <div>目前彩種</div>
        <div class="small">${GAME_CONFIG[state.game].name}</div>
      </div>
      <div class="row">
  <div>已載入筆數</div>
  <div class="small mono">${gameData.length}</div>
</div>
<div class="row">
  <div>來源模式</div>
  <div class="small">${meta.mode || "standard"}</div>
</div>
      <div class="row">
        <div>最後更新</div>
        <div class="small mono">${fmtDateTime(updateAt)}</div>
      </div>
    `;
  }

  function renderPrediction(draws) {
    const config = GAME_CONFIG[state.game];
    const mainPick = pickMainNumbers(draws, config, state.pickCount);
    const bonusPick = pickBonus(draws, state.game);
    const prediction = byId("prediction");

    if (!draws.length) {
      prediction.innerHTML = `<div class="note warn">目前沒有資料，請先確認 data/official/*.json 是否已更新。</div>`;
      return;
    }

    let html = `
      <div class="pill-wrap">
        ${mainPick.map(n => `<span class="ball">${pad2(n)}</span>`).join("")}
      </div>
    `;

    if (state.game === "superlotto638") {
      html += `
        <div style="margin-top:12px;" class="small">第二區推薦</div>
        <div class="pill-wrap" style="margin-top:8px;">
          <span class="ball red">${pad2(bonusPick)}</span>
        </div>
      `;
    }

    if (state.game === "lotto649") {
      html += `
        <div style="margin-top:12px;" class="small">特別號參考</div>
        <div class="pill-wrap" style="margin-top:8px;">
          <span class="ball green">${pad2(bonusPick)}</span>
        </div>
      `;
    }

    html += `
      <div style="margin-top:12px;" class="note">
        預測邏輯：綜合最近期數的熱號、冷號、拖號、尾數、鄰近號與缺失期數加權，不保證中獎，僅供參考。
      </div>
    `;

    prediction.innerHTML = html;
  }

  function renderSummary(draws) {
    const config = GAME_CONFIG[state.game];
    const freq = calcFrequency(draws, config.range);
    const miss = calcMiss(draws, config.range);
    const topHot = [...freq].sort((a, b) => b.count - a.count)[0];
    const topCold = [...miss].sort((a, b) => b.miss - a.miss)[0];
    const latest = draws[0];
    const totalBalls = draws.reduce((sum, draw) => sum + extractMainNumbers(draw).length, 0);

    byId("summaryStats").innerHTML = `
      <div class="stat-box">
        <div class="stat-title">分析期數</div>
        <div class="stat-value">${draws.length}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">統計號碼總數</div>
        <div class="stat-value">${totalBalls}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最熱號</div>
        <div class="stat-value">${topHot ? pad2(topHot.number) : "—"}</div>
        <div class="small">出現 ${topHot?.count ?? 0} 次</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最冷號</div>
        <div class="stat-value">${topCold ? pad2(topCold.number) : "—"}</div>
        <div class="small">已遺漏 ${topCold?.miss ?? 0} 期</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最新期別</div>
        <div class="stat-value mono">${latest?.issue || "—"}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最新開獎日期</div>
        <div class="stat-value" style="font-size:14px;">${latest?.drawDate || "—"}</div>
      </div>
    `;
  }

  function renderHotCold(draws) {
    const config = GAME_CONFIG[state.game];
    const hot = calcFrequency(draws, config.range)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const cold = calcMiss(draws, config.range)
      .sort((a, b) => b.miss - a.miss)
      .slice(0, 10);

    byId("hotCold").innerHTML = `
      <div class="stat-box">
        <div class="stat-title">熱門號碼 Top 10</div>
        <div class="pill-wrap">
          ${hot.map(x => `<span class="ball">${pad2(x.number)}</span>`).join("")}
        </div>
        <div class="small" style="margin-top:8px;">
          ${hot.map(x => `${pad2(x.number)}(${x.count})`).join("、")}
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-title">冷門號碼 Top 10</div>
        <div class="pill-wrap">
          ${cold.map(x => `<span class="ball gray">${pad2(x.number)}</span>`).join("")}
        </div>
        <div class="small" style="margin-top:8px;">
          ${cold.map(x => `${pad2(x.number)}(${x.miss})`).join("、")}
        </div>
      </div>
    `;
  }

  function renderPatterns(draws) {
    const tails = calcTailStats(draws).slice(0, 5);
    const cons = calcConsecutive(draws);
    const repeat = calcRepeatFromPrev(draws);

    byId("patternStats").innerHTML = `
      <div class="stat-box">
        <div class="stat-title">熱門尾數</div>
        <div class="small">${tails.map(x => `${x.tail}尾(${x.count})`).join("、")}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">拖號平均</div>
        <div class="stat-value">${repeat.avg}</div>
        <div class="small">與前一期重複號碼平均值</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">連號群次數</div>
        <div class="stat-value">${cons.groups}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最長連號長度</div>
        <div class="stat-value">${cons.maxLen}</div>
      </div>
    `;
  }

  function renderLatest(draws) {
    const latest = draws.slice(0, 5);
    const html = latest.map(draw => {
      const main = extractMainNumbers(draw);
      const second = extractSecondNumbers(draw);

      return `
        <div class="row" style="display:block;">
          <div class="small mono">期別：${draw.issue || "—"}｜日期：${draw.drawDate || "—"}</div>
          <div class="pill-wrap" style="margin-top:8px;">
            ${main.map(n => `<span class="ball">${pad2(n)}</span>`).join("")}
            ${second.map(n => `<span class="ball red">${pad2(n)}</span>`).join("")}
          </div>
        </div>
      `;
    }).join("");

    byId("latestDraw").innerHTML = html || `<div class="small">沒有資料</div>`;
  }

  function analyze() {
    const draws = getLimitedDraws();
    renderMeta();
    renderPrediction(draws);
    renderSummary(draws);
    renderHotCold(draws);
    renderPatterns(draws);
    renderLatest(draws);
  }

  function bindEvents() {
    byId("gameSelect").addEventListener("change", e => {
      state.game = e.target.value;
      const config = GAME_CONFIG[state.game];
      state.pickCount = config.defaultPick;
      buildPickOptions();
      analyze();
    });

    byId("historyLimit").addEventListener("change", e => {
      state.historyLimit = Number(e.target.value) || 60;
      analyze();
    });

    byId("pickCount").addEventListener("change", e => {
      state.pickCount = Number(e.target.value) || GAME_CONFIG[state.game].defaultPick;
      analyze();
    });

    byId("btnAnalyze").addEventListener("click", analyze);

    byId("btnReload").addEventListener("click", async () => {
      byId("metaInfo").innerHTML = `<div class="small">資料重新讀取中...</div>`;
      await loadAllData();
      analyze();
    });
  }

  async function init() {
    createStyles();
    renderApp();
    byId("gameSelect").value = state.game;
    byId("historyLimit").value = String(state.historyLimit);
    buildPickOptions();
    bindEvents();

    try {
      await loadAllData();
      analyze();
    } catch (err) {
      console.error(err);
      byId("metaInfo").innerHTML = `
        <div class="note warn">資料載入失敗：${err.message}</div>
      `;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
