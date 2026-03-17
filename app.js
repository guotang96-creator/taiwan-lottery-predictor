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
      maxPick: 10
    },
    lotto649: {
      key: "lotto649",
      name: "大樂透",
      range: 49,
      defaultPick: 6,
      minPick: 6,
      maxPick: 6
    },
    superlotto638: {
      key: "superlotto638",
      name: "威力彩",
      range: 38,
      secondZoneRange: 8,
      defaultPick: 6,
      minPick: 6,
      maxPick: 6
    },
    dailycash: {
      key: "dailycash",
      name: "今彩539",
      range: 39,
      defaultPick: 5,
      minPick: 5,
      maxPick: 5
    }
  };

  const state = {
    game: "bingo",
    historyLimit: 120,
    pickCount: 10,
    data: {
      bingo: [],
      lotto649: [],
      superlotto638: [],
      dailycash: [],
      meta: null
    }
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function sortNum(arr) {
    return [...arr].sort((a, b) => a - b);
  }

  function safeArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function fmtDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("zh-TW", { hour12: false });
  }

  function createStyles() {
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
        background: #081226;
        color: #e5e7eb;
      }
      #app {
        max-width: 860px;
        margin: 0 auto;
        padding: 14px;
      }
      .card {
        background: #0d172b;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 16px;
        padding: 14px;
        margin-bottom: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,.2);
      }
      .title {
        font-size: 22px;
        font-weight: 800;
        margin-bottom: 6px;
      }
      .sub {
        color: #9fb0c9;
        font-size: 13px;
      }
      .grid {
        display: grid;
        gap: 10px;
      }
      .grid-2 { grid-template-columns: 1fr 1fr; }
      .grid-3 { grid-template-columns: repeat(3, 1fr); }
      @media (max-width: 700px) {
        .grid-2, .grid-3 { grid-template-columns: 1fr; }
      }
      label {
        display: block;
        font-size: 13px;
        margin-bottom: 6px;
        color: #c7d5ea;
      }
      select, button {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.10);
        background: #1b2940;
        color: #fff;
        padding: 12px;
        font-size: 15px;
      }
      button {
        cursor: pointer;
        font-weight: 800;
      }
      .btn-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .section-title {
        font-size: 16px;
        font-weight: 800;
        margin-bottom: 10px;
      }
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px dashed rgba(255,255,255,.08);
      }
      .row:last-child {
        border-bottom: 0;
      }
      .small { font-size: 12px; color: #9fb0c9; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .pill-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ball {
        min-width: 44px;
        height: 44px;
        border-radius: 999px;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        font-weight: 800;
        background: #2563eb;
      }
      .ball.red { background: #dc2626; }
      .ball.green { background: #059669; }
      .ball.gray { background: #3b4758; }
      .note {
        margin-top: 10px;
        background: rgba(37,99,235,.12);
        color: #dbeafe;
        border: 1px solid rgba(37,99,235,.28);
        padding: 10px 12px;
        border-radius: 12px;
        font-size: 13px;
      }
      .warn {
        background: rgba(245,158,11,.10);
        color: #fde68a;
        border: 1px solid rgba(245,158,11,.25);
      }
      .stat-box {
        background: #08101f;
        border: 1px solid rgba(255,255,255,.05);
        border-radius: 12px;
        padding: 12px;
      }
      .stat-title {
        color: #9fb0c9;
        font-size: 12px;
        margin-bottom: 6px;
      }
      .stat-value {
        font-size: 20px;
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);
  }

  function renderApp() {
    byId("app").innerHTML = `
      <div class="card">
        <div class="title">台灣彩券預測 V66.5</div>
        <div class="sub">穩定修正版｜只讀 official｜不再使用 fake 資料</div>
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
              <option value="60">最近 60 期</option>
              <option value="120" selected>最近 120 期</option>
              <option value="240">最近 240 期</option>
              <option value="500">最近 500 期</option>
            </select>
          </div>
          <div>
            <label>預測顆數</label>
            <select id="pickCount"></select>
          </div>
        </div>
        <div style="height:10px;"></div>
        <div class="btn-row">
          <button id="btnAnalyze">開始分析</button>
          <button id="btnReload">重新讀取資料</button>
        </div>
      </div>

      <div class="card">
        <div class="section-title">資料狀態</div>
        <div id="metaInfo"></div>
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
        <div class="section-title">尾數 / 連號 / 拖牌</div>
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
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `${i} 顆`;
      if (i === state.pickCount) option.selected = true;
      el.appendChild(option);
    }

    if (state.pickCount < game.minPick || state.pickCount > game.maxPick) {
      state.pickCount = game.defaultPick;
      el.value = String(state.pickCount);
    }
  }

  async function fetchJson(url) {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`讀取失敗 ${url} (${res.status})`);
    return res.json();
  }

  function normalizeDraws(gameKey, rows) {
    if (!Array.isArray(rows)) return [];

    const normalized = rows.map((row) => {
      if (!row || typeof row !== "object") return null;

      const issue = row.issue ? String(row.issue) : "";
      const drawDate = row.drawDate ? String(row.drawDate) : "";

      if (gameKey === "superlotto638") {
        const numbers1 = Array.isArray(row.numbers1)
          ? row.numbers1.filter(n => Number.isInteger(n) && n >= 1 && n <= 38).slice(0, 6)
          : [];

        let numbers2 = [];
        if (Array.isArray(row.numbers2)) {
          numbers2 = row.numbers2.filter(n => Number.isInteger(n) && n >= 1 && n <= 8).slice(0, 1);
        } else if (Number.isInteger(row.numbers2) && row.numbers2 >= 1 && row.numbers2 <= 8) {
          numbers2 = [row.numbers2];
        }

        if (!issue || numbers1.length < 6) return null;
        return { game: "superlotto638", issue, drawDate, numbers1, numbers2 };
      }

      if (gameKey === "lotto649") {
        const numbers = Array.isArray(row.numbers)
          ? row.numbers.filter(n => Number.isInteger(n) && n >= 1 && n <= 49).slice(0, 6)
          : [];
        const special = Number.isInteger(row.special) && row.special >= 1 && row.special <= 49
          ? row.special
          : null;

        if (!issue || numbers.length < 6) return null;
        return { game: "lotto649", issue, drawDate, numbers, special };
      }

      if (gameKey === "dailycash") {
        const numbers = Array.isArray(row.numbers)
          ? row.numbers.filter(n => Number.isInteger(n) && n >= 1 && n <= 39).slice(0, 5)
          : [];
        if (!issue || numbers.length < 5) return null;
        return { game: "dailycash", issue, drawDate, numbers };
      }

      if (gameKey === "bingo") {
        const numbers = Array.isArray(row.numbers)
          ? row.numbers.filter(n => Number.isInteger(n) && n >= 1 && n <= 80).slice(0, 20)
          : [];
        if (!issue || numbers.length < 10) return null;
        return { game: "bingo", issue, drawDate, numbers };
      }

      return null;
    }).filter(Boolean);

    return normalized;
  }

  async function loadAllData() {
    const [bingoRaw, lotto649Raw, superlotto638Raw, dailycashRaw, meta] = await Promise.all([
      fetchJson(DATA_FILES.bingo).catch(() => []),
      fetchJson(DATA_FILES.lotto649).catch(() => []),
      fetchJson(DATA_FILES.superlotto638).catch(() => []),
      fetchJson(DATA_FILES.dailycash).catch(() => []),
      fetchJson(DATA_FILES.meta).catch(() => null)
    ]);

    state.data = {
      bingo: normalizeDraws("bingo", bingoRaw),
      lotto649: normalizeDraws("lotto649", lotto649Raw),
      superlotto638: normalizeDraws("superlotto638", superlotto638Raw),
      dailycash: normalizeDraws("dailycash", dailycashRaw),
      meta
    };
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
    if (state.game === "superlotto638") {
      if (Array.isArray(draw.numbers2)) return draw.numbers2;
      if (typeof draw.numbers2 === "number") return [draw.numbers2];
      return [];
    }
    if (state.game === "lotto649") {
      if (typeof draw.special === "number") return [draw.special];
      return [];
    }
    return [];
  }

  function calcFrequency(draws, range, selector = extractMainNumbers) {
    const arr = Array.from({ length: range + 1 }, (_, i) => ({ number: i, count: 0 })).slice(1);
    draws.forEach(draw => {
      selector(draw).forEach(n => {
        if (n >= 1 && n <= range) arr[n - 1].count += 1;
      });
    });
    return arr;
  }

  function calcMiss(draws, range, selector = extractMainNumbers) {
    const res = [];
    for (let n = 1; n <= range; n += 1) {
      let miss = 0;
      for (const draw of draws) {
        if (selector(draw).includes(n)) break;
        miss += 1;
      }
      res.push({ number: n, miss });
    }
    return res;
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
    let totalGroups = 0;
    let maxLen = 0;

    draws.forEach(draw => {
      const nums = sortNum(selector(draw));
      let streak = 1;
      for (let i = 1; i < nums.length; i += 1) {
        if (nums[i] === nums[i - 1] + 1) {
          streak += 1;
        } else {
          if (streak >= 2) {
            totalGroups += 1;
            maxLen = Math.max(maxLen, streak);
          }
          streak = 1;
        }
      }
      if (streak >= 2) {
        totalGroups += 1;
        maxLen = Math.max(maxLen, streak);
      }
    });

    return { totalGroups, maxLen };
  }

  function calcRepeatFromPrev(draws, selector = extractMainNumbers) {
    let totalRepeat = 0;
    let totalPairs = 0;

    for (let i = 0; i < draws.length - 1; i += 1) {
      const a = new Set(selector(draws[i]));
      const b = new Set(selector(draws[i + 1]));
      const repeat = [...a].filter(n => b.has(n));
      totalRepeat += repeat.length;
      totalPairs += 1;
    }

    return totalPairs ? Number((totalRepeat / totalPairs).toFixed(2)) : 0;
  }

  function scoreNumbers(draws, config) {
    const freq = calcFrequency(draws, config.range);
    const miss = calcMiss(draws, config.range);
    const tailsTop = calcTailStats(draws).slice(0, 4).map(x => x.tail);

    const latestSet = new Set(extractMainNumbers(draws[0] || {}));
    const prevSet = new Set(extractMainNumbers(draws[1] || {}));

    const freqMap = new Map(freq.map(x => [x.number, x.count]));
    const missMap = new Map(miss.map(x => [x.number, x.miss]));
    const maxFreq = Math.max(...freq.map(x => x.count), 1);
    const maxMiss = Math.max(...miss.map(x => x.miss), 1);

    const scores = [];
    for (let n = 1; n <= config.range; n += 1) {
      const f = freqMap.get(n) || 0;
      const m = missMap.get(n) || 0;
      let score = 0;

      score += (f / maxFreq) * 38;
      score += (m / maxMiss) * 22;
      if (tailsTop.includes(n % 10)) score += 8;
      if (!latestSet.has(n)) score += 6;
      if (prevSet.has(n)) score += 7;
      if (latestSet.has(n - 1) || latestSet.has(n + 1)) score += 5;
      if (prevSet.has(n - 1) || prevSet.has(n + 1)) score += 4;

      scores.push({
        number: n,
        freq: f,
        miss: m,
        score: Number(score.toFixed(2))
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  function pickMainNumbers(draws, config, count) {
    const ranked = scoreNumbers(draws, config);
    const selected = [];

    for (const item of ranked) {
      if (selected.includes(item.number)) continue;
      const nearCount = selected.filter(n => Math.abs(n - item.number) <= 1).length;
      if (nearCount >= 2) continue;
      selected.push(item.number);
      if (selected.length >= count) break;
    }

    if (selected.length < count) {
      for (const item of ranked) {
        if (!selected.includes(item.number)) {
          selected.push(item.number);
          if (selected.length >= count) break;
        }
      }
    }

    return sortNum(selected.slice(0, count));
  }

  function pickSecondNumber(draws) {
    if (state.game === "superlotto638") {
      const freq = calcFrequency(
        draws,
        GAME_CONFIG.superlotto638.secondZoneRange,
        draw => extractSecondNumbers(draw)
      );
      return freq.sort((a, b) => b.count - a.count)[0]?.number || 1;
    }

    if (state.game === "lotto649") {
      const freq = calcFrequency(draws, 49, draw => extractSecondNumbers(draw));
      return freq.sort((a, b) => b.count - a.count)[0]?.number || 1;
    }

    return null;
  }

  function renderMeta() {
    const meta = state.data.meta || {};
    const gameData = getCurrentDraws();
    const source = meta.sourceName || meta.source || meta.mode || "台灣彩券資料";

    byId("metaInfo").innerHTML = `
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
        <div class="small mono">${fmtDateTime(meta.updatedAt || meta.generatedAt)}</div>
      </div>
    `;
  }

  function renderPrediction(draws) {
    const config = GAME_CONFIG[state.game];
    const wrap = byId("prediction");

    if (!draws.length) {
      wrap.innerHTML = `<div class="note warn">目前沒有可分析資料。</div>`;
      return;
    }

    const main = pickMainNumbers(draws, config, state.pickCount);
    const second = pickSecondNumber(draws);

    let html = `<div class="pill-wrap">${main.map(n => `<span class="ball">${pad2(n)}</span>`).join("")}</div>`;

    if (state.game === "superlotto638") {
      html += `
        <div style="margin-top:12px;" class="small">第二區推薦</div>
        <div class="pill-wrap" style="margin-top:8px;">
          <span class="ball red">${pad2(second)}</span>
        </div>
      `;
    }

    if (state.game === "lotto649") {
      html += `
        <div style="margin-top:12px;" class="small">特別號參考</div>
        <div class="pill-wrap" style="margin-top:8px;">
          <span class="ball green">${pad2(second)}</span>
        </div>
      `;
    }

    html += `
      <div class="note">
        V66.5 預測邏輯：只使用 official 歷史資料，綜合熱門、冷門、尾數、缺失期數、鄰近號、拖牌與連號分布加權分析。
      </div>
    `;

    wrap.innerHTML = html;
  }

  function renderSummary(draws) {
    const config = GAME_CONFIG[state.game];
    const freq = calcFrequency(draws, config.range);
    const miss = calcMiss(draws, config.range);
    const hot = [...freq].sort((a, b) => b.count - a.count)[0];
    const cold = [...miss].sort((a, b) => b.miss - a.miss)[0];
    const latest = draws[0];
    const totalNums = draws.reduce((sum, d) => sum + extractMainNumbers(d).length, 0);

    byId("summaryStats").innerHTML = `
      <div class="stat-box">
        <div class="stat-title">分析期數</div>
        <div class="stat-value">${draws.length}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">統計號碼總數</div>
        <div class="stat-value">${totalNums}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最熱號</div>
        <div class="stat-value">${hot ? pad2(hot.number) : "—"}</div>
        <div class="small">出現 ${hot?.count ?? 0} 次</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最冷號</div>
        <div class="stat-value">${cold ? pad2(cold.number) : "—"}</div>
        <div class="small">遺漏 ${cold?.miss ?? 0} 期</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最新期別</div>
        <div class="stat-value mono" style="font-size:16px;">${latest?.issue || "—"}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最新開獎日期</div>
        <div class="stat-value" style="font-size:15px;">${latest?.drawDate || "—"}</div>
      </div>
    `;
  }

  function renderHotCold(draws) {
    const config = GAME_CONFIG[state.game];
    const hot = calcFrequency(draws, config.range).sort((a, b) => b.count - a.count).slice(0, 10);
    const cold = calcMiss(draws, config.range).sort((a, b) => b.miss - a.miss).slice(0, 10);

    byId("hotCold").innerHTML = `
      <div class="stat-box">
        <div class="stat-title">熱門號碼 Top 10</div>
        <div class="pill-wrap">${hot.map(x => `<span class="ball">${pad2(x.number)}</span>`).join("")}</div>
        <div class="small" style="margin-top:8px;">${hot.map(x => `${pad2(x.number)}(${x.count})`).join("、")}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">冷門號碼 Top 10</div>
        <div class="pill-wrap">${cold.map(x => `<span class="ball gray">${pad2(x.number)}</span>`).join("")}</div>
        <div class="small" style="margin-top:8px;">${cold.map(x => `${pad2(x.number)}(${x.miss})`).join("、")}</div>
      </div>
    `;
  }

  function renderPatterns(draws) {
    const tails = calcTailStats(draws).slice(0, 5);
    const cons = calcConsecutive(draws);
    const repeatAvg = calcRepeatFromPrev(draws);

    byId("patternStats").innerHTML = `
      <div class="stat-box">
        <div class="stat-title">熱門尾數</div>
        <div class="small">${tails.map(x => `${x.tail}尾(${x.count})`).join("、")}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">平均拖牌</div>
        <div class="stat-value">${repeatAvg}</div>
        <div class="small">與前一期重複號平均</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">連號總群數</div>
        <div class="stat-value">${cons.totalGroups}</div>
      </div>
      <div class="stat-box">
        <div class="stat-title">最長連號</div>
        <div class="stat-value">${cons.maxLen}</div>
      </div>
    `;
  }

  function renderLatest(draws) {
    const latest = draws.slice(0, 5);
    byId("latestDraw").innerHTML = latest.map(draw => {
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
    }).join("") || `<div class="small">沒有資料</div>`;
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
      state.pickCount = GAME_CONFIG[state.game].defaultPick;
      buildPickOptions();
      analyze();
    });

    byId("historyLimit").addEventListener("change", e => {
      state.historyLimit = Number(e.target.value) || 120;
      analyze();
    });

    byId("pickCount").addEventListener("change", e => {
      state.pickCount = Number(e.target.value) || GAME_CONFIG[state.game].defaultPick;
      analyze();
    });

    byId("btnAnalyze").addEventListener("click", analyze);

    byId("btnReload").addEventListener("click", async () => {
      try {
        await loadAllData();
        analyze();
      } catch (err) {
        console.error(err);
      }
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
      byId("metaInfo").innerHTML = `<div class="note warn">資料載入失敗：${err.message}</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
