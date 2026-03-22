(() => {
  "use strict";

  const BUILD = window.__APP_BUILD__ || "93.1.9";
  const APP_VERSION = `V93.1.9 | GitHub Pages 最終穩定版`;

  const STORAGE_KEY = "taiwan_lottery_prediction_history_v9319";
  const SETTINGS_KEY = "taiwan_lottery_dashboard_settings_v9319";
  const WEIGHTS_KEY = "taiwan_lottery_learning_weights_v9319";
  const AUTO_STATE_KEY = "taiwan_lottery_auto_state_v9319";

  const GENERAL_REFRESH_MS = 2 * 60 * 1000;
  const BINGO_FAST_REFRESH_MS = 30 * 1000;

  const JSON_CANDIDATES = [
    "./latest.json",
    "latest.json"
  ];

  const CSV_CANDIDATES = {
    bingo: [
      "./raw_data/bingo.csv",
      "raw_data/bingo.csv"
    ],
    daily539: [
      "./raw_data/539.csv",
      "./raw_data/daily539.csv",
      "raw_data/539.csv",
      "raw_data/daily539.csv"
    ],
    biglotto: [
      "./raw_data/biglotto.csv",
      "./raw_data/lotto649.csv",
      "./raw_data/lotto.csv",
      "raw_data/biglotto.csv",
      "raw_data/lotto649.csv",
      "raw_data/lotto.csv"
    ],
    power: [
      "./raw_data/power.csv",
      "./raw_data/powerlotto.csv",
      "raw_data/power.csv",
      "raw_data/powerlotto.csv"
    ]
  };

  const GAME_CONFIG = {
    bingo: {
      key: "bingo",
      label: "BINGO BINGO",
      range: 80,
      pick: 5,
      defaultCount: 5,
      defaultGroup: 1
    },
    daily539: {
      key: "daily539",
      label: "今彩539",
      range: 39,
      pick: 5,
      defaultCount: 5,
      defaultGroup: 1,
      apiUrl:
        "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Daily539Result?period&month=2026-01&endMonth=2026-12&pageNum=1&pageSize=1"
    },
    biglotto: {
      key: "biglotto",
      label: "大樂透",
      range: 49,
      pick: 6,
      defaultCount: 6,
      defaultGroup: 1,
      apiUrl:
        "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Lotto649Result?period&month=2026-01&endMonth=2026-12&pageNum=1&pageSize=1"
    },
    power: {
      key: "power",
      label: "威力彩",
      range: 38,
      pick: 6,
      hasSecondArea: true,
      secondAreaRange: 8,
      secondAreaPick: 1,
      defaultCount: 6,
      defaultGroup: 1,
      apiUrl:
        "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/PowerLottoResult?period&month=2026-01&endMonth=2026-12&pageNum=1&pageSize=1"
    }
  };

  const DEFAULT_WEIGHTS = {
    hot: 1.2,
    recent: 1.1,
    tail: 0.7,
    pair: 0.8,
    gapPenalty: 0.35,
    repeatPenalty: 0.4,
    bonusLearning: 0.16
  };

  const state = {
    latest: {
      bingo: null,
      daily539: null,
      biglotto: null,
      power: null
    },
    history: {
      bingo: [],
      daily539: [],
      biglotto: [],
      power: []
    },
    dataStatus: {
      bingo: "載入中",
      daily539: "載入中",
      biglotto: "載入中",
      power: "載入中"
    },
    settings: loadJson(SETTINGS_KEY, {
      game: "bingo",
      bingoCount: 5,
      groupCount: 1
    }),
    weights: loadJson(WEIGHTS_KEY, { ...DEFAULT_WEIGHTS }),
    recentOps: loadJson(STORAGE_KEY, []),
    autoState: loadJson(AUTO_STATE_KEY, {
      lastUpdateAt: "",
      lastPredictAt: "",
      learnCount: 0
    })
  };

  let generalTimer = null;
  let bingoTimer = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindVersion();
    ensureSelectOptions();
    bindControls();
    syncControlsFromState();
    showLoadingMessage();

    await refreshAll({ silent: true });

    clearInterval(generalTimer);
    clearInterval(bingoTimer);

    generalTimer = setInterval(() => {
      refreshAll({ silent: true }).catch(console.error);
    }, GENERAL_REFRESH_MS);

    bingoTimer = setInterval(() => {
      refreshBingoFastOnly({ silent: true }).catch(console.error);
    }, BINGO_FAST_REFRESH_MS);
  }

  function bindVersion() {
    setTextMulti(
      [
        "#systemVersion",
        "#versionText",
        "#appVersion",
        "[data-role='system-version']",
        "[data-role='version-text']"
      ],
      `${APP_VERSION}（build ${BUILD}）`
    );

    const versionInput = first([
      "#versionInput",
      "#systemVersionInput",
      "[data-role='version-input']"
    ]);
    if (versionInput) versionInput.value = APP_VERSION;
  }

  function ensureSelectOptions() {
    const gameSelect = first([
      "#lotterySelect",
      "#gameSelect",
      "#lotteryType",
      "[data-role='game-select']"
    ]);

    if (gameSelect && gameSelect.options.length === 0) {
      [
        { value: "bingo", label: "BINGO BINGO" },
        { value: "daily539", label: "今彩539" },
        { value: "biglotto", label: "大樂透" },
        { value: "power", label: "威力彩" }
      ].forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.label;
        gameSelect.appendChild(opt);
      });
    }

    const countSelect = first([
      "#bingoCountSelect",
      "#numberCountSelect",
      "#pickCountSelect",
      "[data-role='count-select']"
    ]);
    if (countSelect && countSelect.options.length === 0) {
      refillSelect(countSelect, 1, 10, state.settings.bingoCount || 5, "顆");
    }

    const groupSelect = first([
      "#groupCountSelect",
      "#predictionGroupSelect",
      "[data-role='group-select']"
    ]);
    if (groupSelect && groupSelect.options.length === 0) {
      refillSelect(groupSelect, 1, 10, state.settings.groupCount || 1, "組");
    }
  }

  function bindControls() {
    const gameSelect = first([
      "#lotterySelect",
      "#gameSelect",
      "#lotteryType",
      "[data-role='game-select']"
    ]);

    if (gameSelect) {
      gameSelect.addEventListener("change", (e) => {
        state.settings.game = normalizeGameKey(e.target.value);
        saveJson(SETTINGS_KEY, state.settings);
        syncControlsFromState();
        renderPredictionResult(null);
      });
    }

    const countSelect = first([
      "#bingoCountSelect",
      "#numberCountSelect",
      "#pickCountSelect",
      "[data-role='count-select']"
    ]);

    if (countSelect) {
      countSelect.addEventListener("change", (e) => {
        state.settings.bingoCount = clamp(parseInt(e.target.value || "5", 10), 1, 10);
        saveJson(SETTINGS_KEY, state.settings);
      });
    }

    const groupSelect = first([
      "#groupCountSelect",
      "#predictionGroupSelect",
      "[data-role='group-select']"
    ]);

    if (groupSelect) {
      groupSelect.addEventListener("change", (e) => {
        state.settings.groupCount = clamp(parseInt(e.target.value || "1", 10), 1, 10);
        saveJson(SETTINGS_KEY, state.settings);
      });
    }

    all([
      "#generateBtn",
      "#predictBtn",
      "#startPredictBtn",
      "[data-role='generate-btn']"
    ]).forEach((btn) => btn.addEventListener("click", generatePredictions));

    all([
      "#relearnBtn",
      "#learnBtn",
      "#enhanceLearnBtn",
      "[data-role='relearn-btn']"
    ]).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "學習中...";
        try {
          await strengthenLearning();
        } finally {
          btn.disabled = false;
          btn.textContent = oldText || "強化再學習";
        }
      });
    });

    all([
      "#resetModelBtn",
      "#resetWeightsBtn",
      "[data-role='reset-model-btn']"
    ]).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.weights = { ...DEFAULT_WEIGHTS };
        state.autoState.learnCount = 0;
        saveJson(WEIGHTS_KEY, state.weights);
        saveJson(AUTO_STATE_KEY, state.autoState);
        toast("AI 權重已重置");
        renderStatus();
      });
    });

    all([
      "#topPredictBtn",
      "[data-role='top-predict-btn']"
    ]).forEach((btn) => btn.addEventListener("click", generatePredictions));

    all([
      "#topRelearnBtn",
      "[data-role='top-relearn-btn']"
    ]).forEach((btn) => btn.addEventListener("click", strengthenLearning));

    all([
      "#topResetBtn",
      "[data-role='top-reset-btn']"
    ]).forEach((btn) => {
      btn.addEventListener("click", () => {
        state.weights = { ...DEFAULT_WEIGHTS };
        saveJson(WEIGHTS_KEY, state.weights);
        toast("權重已重置");
      });
    });
  }

  function syncControlsFromState() {
    const game = normalizeGameKey(state.settings.game);

    setValueMulti(
      [
        "#lotterySelect",
        "#gameSelect",
        "#lotteryType",
        "[data-role='game-select']"
      ],
      game
    );

    setValueMulti(
      [
        "#bingoCountSelect",
        "#numberCountSelect",
        "#pickCountSelect",
        "[data-role='count-select']"
      ],
      String(state.settings.bingoCount || 5)
    );

    setValueMulti(
      [
        "#groupCountSelect",
        "#predictionGroupSelect",
        "[data-role='group-select']"
      ],
      String(state.settings.groupCount || 1)
    );

    const config = GAME_CONFIG[game];
    const countSelect = first([
      "#bingoCountSelect",
      "#numberCountSelect",
      "#pickCountSelect",
      "[data-role='count-select']"
    ]);

    if (countSelect) {
      const max = game === "bingo" ? 10 : config.pick;
      refillSelect(
        countSelect,
        1,
        max,
        game === "bingo" ? state.settings.bingoCount || 5 : config.pick,
        "顆"
      );
    }
  }

  async function refreshAll(options = {}) {
    await Promise.all([
      loadLatestJson(),
      loadAllHistoryData()
    ]);

    await Promise.all([
      loadLatestBingo(),
      loadLatestDaily539(),
      loadLatestBigLotto(),
      loadLatestPower()
    ]);

    state.autoState.lastUpdateAt = formatDateTime(new Date());
    saveJson(AUTO_STATE_KEY, state.autoState);

    renderStatus();
    renderLatestResults();

    if (!options.silent) toast("資料已更新");
  }

  async function refreshBingoFastOnly(options = {}) {
    await loadLatestJson();
    await loadAllHistoryData();
    await loadLatestBingo();

    state.autoState.lastUpdateAt = formatDateTime(new Date());
    saveJson(AUTO_STATE_KEY, state.autoState);

    renderStatus();
    renderLatestResults();

    if (!options.silent) toast("BINGO 已快速更新");
  }

  async function loadLatestJson() {
    const json = await fetchJsonWithFallback(JSON_CANDIDATES);
    if (!json || !json.content) return;

    const content = json.content;

    if (content.lotteryBingoLatestPost) {
      state.latest.bingo = normalizeLatestBingo(content.lotteryBingoLatestPost);
    }

    if (content.daily539 || content.daily539LatestPost || content.daily539Res?.[0]) {
      state.latest.daily539 = normalizeLatest539(
        content.daily539 || content.daily539LatestPost || content.daily539Res?.[0]
      );
    }

    if (content.bigLotto || content.lotto649LatestPost || content.lotto649Res?.[0]) {
      state.latest.biglotto = normalizeLatestBigLotto(
        content.bigLotto || content.lotto649LatestPost || content.lotto649Res?.[0]
      );
    }

    if (content.powerLotto || content.powerLottoLatestPost || content.powerLotto638Res?.[0]) {
      state.latest.power = normalizeLatestPower(
        content.powerLotto || content.powerLottoLatestPost || content.powerLotto638Res?.[0]
      );
    }
  }

  async function loadAllHistoryData() {
    const [bingoText, daily539Text, biglottoText, powerText] = await Promise.all([
      fetchTextWithFallback(CSV_CANDIDATES.bingo),
      fetchTextWithFallback(CSV_CANDIDATES.daily539),
      fetchTextWithFallback(CSV_CANDIDATES.biglotto),
      fetchTextWithFallback(CSV_CANDIDATES.power)
    ]);

    state.history.bingo = normalizeHistoryRows("bingo", parseCSV(bingoText));
    state.history.daily539 = normalizeHistoryRows("daily539", parseCSV(daily539Text));
    state.history.biglotto = normalizeHistoryRows("biglotto", parseCSV(biglottoText));
    state.history.power = normalizeHistoryRows("power", parseCSV(powerText));

    state.dataStatus.bingo = getDataStatusText("bingo", state.history.bingo, state.latest.bingo);
    state.dataStatus.daily539 = getDataStatusText("daily539", state.history.daily539, state.latest.daily539);
    state.dataStatus.biglotto = getDataStatusText("biglotto", state.history.biglotto, state.latest.biglotto);
    state.dataStatus.power = getDataStatusText("power", state.history.power, state.latest.power);
  }

  async function loadLatestBingo() {
    if (!state.latest.bingo && state.history.bingo.length) {
      state.latest.bingo = pickLatestFromHistory("bingo", state.history.bingo);
    }
    state.dataStatus.bingo = getDataStatusText("bingo", state.history.bingo, state.latest.bingo);
  }

  async function loadLatestDaily539() {
    try {
      const res = await fetch(GAME_CONFIG.daily539.apiUrl, { cache: "no-store" });
      const json = await res.json();
      const row =
        json?.content?.daily539Res?.[0] ||
        json?.content?.daily539 ||
        json?.content?.daily539LatestPost ||
        null;

      const apiLatest = normalizeLatest539(row);
      if (apiLatest) {
        state.latest.daily539 = apiLatest;
      } else if (!state.latest.daily539 && state.history.daily539.length) {
        state.latest.daily539 = pickLatestFromHistory("daily539", state.history.daily539);
      }
    } catch (_) {
      if (!state.latest.daily539 && state.history.daily539.length) {
        state.latest.daily539 = pickLatestFromHistory("daily539", state.history.daily539);
      }
    }

    state.dataStatus.daily539 = getDataStatusText("daily539", state.history.daily539, state.latest.daily539);
  }

  async function loadLatestBigLotto() {
    try {
      const res = await fetch(GAME_CONFIG.biglotto.apiUrl, { cache: "no-store" });
      const json = await res.json();
      const row =
        json?.content?.lotto649Res?.[0] ||
        json?.content?.bigLotto ||
        json?.content?.lotto649LatestPost ||
        null;

      const apiLatest = normalizeLatestBigLotto(row);
      if (apiLatest) {
        state.latest.biglotto = apiLatest;
      } else if (!state.latest.biglotto && state.history.biglotto.length) {
        state.latest.biglotto = pickLatestFromHistory("biglotto", state.history.biglotto);
      }
    } catch (_) {
      if (!state.latest.biglotto && state.history.biglotto.length) {
        state.latest.biglotto = pickLatestFromHistory("biglotto", state.history.biglotto);
      }
    }

    state.dataStatus.biglotto = getDataStatusText("biglotto", state.history.biglotto, state.latest.biglotto);
  }

  async function loadLatestPower() {
    try {
      const res = await fetch(GAME_CONFIG.power.apiUrl, { cache: "no-store" });
      const json = await res.json();

      const row =
        json?.content?.powerLotto638Res?.[0] ||
        json?.content?.powerLottoRes?.[0] ||
        json?.content?.powerLottoLatestPost ||
        json?.content?.powerLotto ||
        null;

      const apiLatest = normalizeLatestPower(row);
      if (apiLatest) {
        state.latest.power = apiLatest;
      } else if (!state.latest.power && state.history.power.length) {
        state.latest.power = pickLatestFromHistory("power", state.history.power);
      }
    } catch (_) {
      if (!state.latest.power && state.history.power.length) {
        state.latest.power = pickLatestFromHistory("power", state.history.power);
      }
    }

    state.dataStatus.power = getDataStatusText("power", state.history.power, state.latest.power);
  }

  function pickLatestFromHistory(gameKey, rows) {
    if (!Array.isArray(rows) || !rows.length) return null;

    const sorted = [...rows].sort((a, b) => {
      const ta = String(a.term || "");
      const tb = String(b.term || "");
      return tb.localeCompare(ta, "zh-Hant-u-kn-true");
    });

    const row = sorted[0];
    if (!row) return null;

    if (gameKey === "power") {
      return {
        term: row.term || "-",
        time: row.time || "-",
        numbers: Array.isArray(row.numbers) ? row.numbers.slice(0, 6) : [],
        secondArea: Array.isArray(row.secondArea) ? row.secondArea.slice(0, 1) : []
      };
    }

    return {
      term: row.term || "-",
      time: row.time || "-",
      numbers: Array.isArray(row.numbers) ? row.numbers.slice() : []
    };
  }

  function renderStatus() {
    setTextMulti(["#bingoDataCount", "[data-role='bingo-count']", "[data-key='bingo-count']"], String(state.history.bingo.length));
    setTextMulti(["#daily539DataCount", "[data-role='539-count']", "[data-key='daily539-count']"], String(state.history.daily539.length));
    setTextMulti(["#biglottoDataCount", "[data-role='biglotto-count']", "[data-key='biglotto-count']"], String(state.history.biglotto.length));
    setTextMulti(["#powerDataCount", "[data-role='power-count']", "[data-key='power-count']"], String(state.history.power.length));

    setTextMulti(["#lastUpdatedAt", "[data-role='last-updated']", "[data-key='last-updated']"], state.autoState.lastUpdateAt || "-");

    setTextMulti(["#bingoStatusText", "[data-role='bingo-status']", "[data-key='bingo-status']"], state.dataStatus.bingo);
    setTextMulti(["#daily539StatusText", "[data-role='daily539-status']", "[data-key='daily539-status']"], state.dataStatus.daily539);
    setTextMulti(["#biglottoStatusText", "[data-role='biglotto-status']", "[data-key='biglotto-status']"], state.dataStatus.biglotto);
    setTextMulti(["#powerStatusText", "[data-role='power-status']", "[data-key='power-status']"], state.dataStatus.power);
  }

  function renderLatestResults() {
    const container = first([
      "#latestResults",
      "#latestDrawResults",
      ".latest-results",
      "[data-role='latest-results']"
    ]);

    if (!container) {
      renderIntoExistingCards();
      return;
    }

    container.innerHTML = [
      renderLatestCard("bingo", state.latest.bingo),
      renderLatestCard("daily539", state.latest.daily539),
      renderLatestCard("biglotto", state.latest.biglotto),
      renderLatestCard("power", state.latest.power)
    ].join("");
  }

  function renderIntoExistingCards() {
    renderSingleExistingCard("bingo", state.latest.bingo);
    renderSingleExistingCard("daily539", state.latest.daily539);
    renderSingleExistingCard("biglotto", state.latest.biglotto);
    renderSingleExistingCard("power", state.latest.power);
  }

  function renderSingleExistingCard(gameKey, latest) {
    const root = first([
      `[data-game='${gameKey}']`,
      `#${gameKey}LatestCard`,
      `#latest-${gameKey}`,
      `.latest-card.${gameKey}`
    ]);

    if (!root) return;

    const titleEl = root.querySelector(".latest-title, [data-role='title'], [data-key='title']");
    const metaEl = root.querySelector(".latest-meta, [data-role='meta'], [data-key='meta']");
    const ballsEl = root.querySelector(".latest-balls, [data-role='balls'], [data-key='balls']");

    if (!latest) {
      if (titleEl) titleEl.textContent = GAME_CONFIG[gameKey].label;
      if (metaEl) metaEl.textContent = "資料暫無";
      if (ballsEl) ballsEl.innerHTML = `<span class="ball-empty">-</span>`;
      return;
    }

    if (titleEl) titleEl.textContent = GAME_CONFIG[gameKey].label;
    if (metaEl) metaEl.textContent = `期別：${latest.term || "-"}｜時間：${latest.time || "-"}`;
    if (ballsEl) {
      ballsEl.innerHTML = renderBallHtml(latest.numbers || []);
      if (latest.secondArea?.length) {
        ballsEl.innerHTML += `<div class="second-area-wrap" style="margin-top:10px;">第二區：${renderBallHtml(latest.secondArea)}</div>`;
      }
    }
  }

  function renderLatestCard(gameKey, latest) {
    const label = GAME_CONFIG[gameKey].label;

    if (!latest) {
      return `
        <section class="latest-card" data-game="${gameKey}">
          <div class="latest-title">${escapeHtml(label)}</div>
          <div class="latest-meta">資料暫無</div>
          <div class="latest-balls"><span class="ball-empty">-</span></div>
        </section>
      `;
    }

    return `
      <section class="latest-card" data-game="${gameKey}">
        <div class="latest-title">${escapeHtml(label)}</div>
        <div class="latest-meta">期別：${escapeHtml(latest.term || "-")}｜時間：${escapeHtml(latest.time || "-")}</div>
        <div class="latest-balls">
          ${renderBallHtml(latest.numbers || [])}
          ${
            latest.secondArea?.length
              ? `<div class="second-area-wrap" style="margin-top:10px;">第二區：${renderBallHtml(latest.secondArea)}</div>`
              : ""
          }
        </div>
      </section>
    `;
  }

  function generatePredictions() {
    const game = normalizeGameKey(state.settings.game);
    const config = GAME_CONFIG[game];
    const history = state.history[game] || [];

    if (!history.length) {
      renderPredictionResult({
        game,
        groups: [],
        message: `${config.label} 歷史資料尚未載入完成`
      });
      return;
    }

    const groupCount = clamp(parseInt(state.settings.groupCount || "1", 10), 1, 10);
    const pickCount = game === "bingo"
      ? clamp(parseInt(state.settings.bingoCount || "5", 10), 1, 10)
      : config.pick;

    const groups = [];

    for (let i = 0; i < groupCount; i++) {
      if (game === "power") {
        const area1 = predictNumbers({
          rows: history,
          range: config.range,
          count: config.pick,
          offsetSeed: i
        });
        const area2 = predictSecondArea(history, i);
        groups.push({ area1, area2 });
      } else {
        const nums = predictNumbers({
          rows: history,
          range: config.range,
          count: pickCount,
          offsetSeed: i
        });
        groups.push({ numbers: nums });
      }
    }

    state.autoState.lastPredictAt = formatDateTime(new Date());
    saveJson(AUTO_STATE_KEY, state.autoState);

    state.recentOps.unshift({
      time: state.autoState.lastPredictAt,
      game,
      groupCount,
      pickCount
    });
    state.recentOps = state.recentOps.slice(0, 50);
    saveJson(STORAGE_KEY, state.recentOps);

    renderPredictionResult({
      game,
      groups,
      message: `${config.label} 已產生 ${groupCount} 組推薦號碼`
    });
  }

  async function strengthenLearning() {
    const keys = ["bingo", "daily539", "biglotto", "power"];
    let trained = 0;

    keys.forEach((key) => {
      if ((state.history[key] || []).length > 0) trained += 1;
    });

    state.weights.hot = round4(state.weights.hot + 0.02 * trained);
    state.weights.recent = round4(state.weights.recent + 0.015 * trained);
    state.weights.pair = round4(state.weights.pair + 0.012 * trained);
    state.weights.repeatPenalty = round4(Math.max(0.18, state.weights.repeatPenalty - 0.008 * trained));
    state.weights.bonusLearning = round4(state.weights.bonusLearning + 0.01);

    state.autoState.learnCount = (state.autoState.learnCount || 0) + 1;

    saveJson(WEIGHTS_KEY, state.weights);
    saveJson(AUTO_STATE_KEY, state.autoState);

    toast(`強化學習完成（已學習 ${trained} 種彩種）`);
    renderStatus();
  }

  function renderPredictionResult(payload) {
    const container = first([
      "#predictionResults",
      "#recommendationResults",
      ".prediction-results",
      "[data-role='prediction-results']"
    ]);

    if (!container) return;

    if (!payload) {
      container.innerHTML = "";
      return;
    }

    if (!payload.groups?.length) {
      container.innerHTML = `<div class="prediction-empty">${escapeHtml(payload.message || "目前無推薦結果")}</div>`;
      return;
    }

    if (payload.game === "power") {
      container.innerHTML = `
        <div class="prediction-head">${escapeHtml(payload.message)}</div>
        ${payload.groups.map((g, idx) => `
          <div class="prediction-group">
            <div class="prediction-group-title">第 ${idx + 1} 組</div>
            <div class="prediction-row">第一區：${renderBallHtml(g.area1)}</div>
            <div class="prediction-row" style="margin-top:8px;">第二區：${renderBallHtml(g.area2)}</div>
          </div>
        `).join("")}
      `;
      return;
    }

    container.innerHTML = `
      <div class="prediction-head">${escapeHtml(payload.message)}</div>
      ${payload.groups.map((g, idx) => `
        <div class="prediction-group">
          <div class="prediction-group-title">第 ${idx + 1} 組</div>
          <div class="prediction-row">${renderBallHtml(g.numbers)}</div>
        </div>
      `).join("")}
    `;
  }

  function predictNumbers({ rows, range, count, offsetSeed = 0 }) {
    const freq = Array(range + 1).fill(0);
    const recent = Array(range + 1).fill(0);
    const tails = Array(10).fill(0);
    const pairMap = new Map();

    const recentWindow = rows.slice(0, Math.min(rows.length, 30));
    const allWindow = rows.slice(0, Math.min(rows.length, 200));

    allWindow.forEach((row) => {
      row.numbers.forEach((n) => {
        if (n >= 1 && n <= range) {
          freq[n] += 1;
          tails[n % 10] += 1;
        }
      });

      for (let i = 0; i < row.numbers.length; i++) {
        for (let j = i + 1; j < row.numbers.length; j++) {
          const a = Math.min(row.numbers[i], row.numbers[j]);
          const b = Math.max(row.numbers[i], row.numbers[j]);
          const key = `${a}-${b}`;
          pairMap.set(key, (pairMap.get(key) || 0) + 1);
        }
      }
    });

    recentWindow.forEach((row, idx) => {
      const score = Math.max(1, recentWindow.length - idx);
      row.numbers.forEach((n) => {
        if (n >= 1 && n <= range) recent[n] += score;
      });
    });

    const scored = [];
    for (let n = 1; n <= range; n++) {
      const tailBonus = tails[n % 10];
      const hot = freq[n] * state.weights.hot;
      const recentScore = recent[n] * state.weights.recent;
      const tailScore = tailBonus * state.weights.tail * 0.08;
      const total = hot + recentScore + tailScore + Math.random() * 0.2 + offsetSeed * 0.0001;
      scored.push({ n, score: total });
    }

    scored.sort((a, b) => b.score - a.score);

    const selected = [];
    for (const item of scored) {
      if (selected.length >= count) break;

      let penalty = 0;
      selected.forEach((picked) => {
        const a = Math.min(item.n, picked);
        const b = Math.max(item.n, picked);
        const key = `${a}-${b}`;
        penalty += (pairMap.get(key) || 0) * state.weights.pair * 0.08;
        if (Math.abs(item.n - picked) <= 1) penalty += state.weights.gapPenalty;
        if (Math.abs(item.n - picked) === 0) penalty += state.weights.repeatPenalty;
      });

      const adjusted = item.score - penalty;
      if (adjusted >= 0.1 || selected.length < Math.max(2, count - 2)) {
        selected.push(item.n);
      }
    }

    if (selected.length < count) {
      for (const item of scored) {
        if (selected.length >= count) break;
        if (!selected.includes(item.n)) selected.push(item.n);
      }
    }

    return selected.sort((a, b) => a - b).slice(0, count);
  }

  function predictSecondArea(rows, offsetSeed = 0) {
    const range = 8;
    const freq = Array(range + 1).fill(0);

    rows.slice(0, Math.min(rows.length, 200)).forEach((row, idx) => {
      const sec = Array.isArray(row.secondArea) ? row.secondArea[0] : null;
      if (sec >= 1 && sec <= range) {
        freq[sec] += rows.length - idx;
      }
    });

    const scored = [];
    for (let n = 1; n <= range; n++) {
      scored.push({ n, score: freq[n] + Math.random() * 0.1 + offsetSeed * 0.0001 });
    }

    scored.sort((a, b) => b.score - a.score);
    return [scored[0]?.n || 1];
  }

  function getDataStatusText(name, rows, latestDraw) {
    const count = Array.isArray(rows) ? rows.length : 0;
    const hasLatest = !!latestDraw;

    if (name === "bingo") {
      if (hasLatest && count > 0) return "正常";
      if (hasLatest && count === 0) return "最新一期正常，歷史資料不足";
      if (!hasLatest && count > 0) return "歷史資料正常";
      return "載入異常";
    }

    if (name === "power") {
      if (count > 0 && hasLatest) return "正常";
      if (count > 0 && !hasLatest) return "歷史資料正常";
      if (hasLatest) return "最新一期正常，歷史資料不足";
      return "載入異常";
    }

    if (name === "biglotto") {
      if (count > 0) return "正常";
      if (hasLatest) return "最新一期正常，歷史資料不足";
      return "載入異常";
    }

    if (name === "daily539") {
      if (count > 0) return "正常";
      if (hasLatest) return "最新一期正常，歷史資料不足";
      return "載入異常";
    }

    return count > 0 ? "正常" : "載入異常";
  }

  function normalizeHistoryRows(game, rows) {
    return rows.map((row) => {
      if (game === "bingo") return normalizeBingoHistoryRow(row);
      if (game === "daily539") return normalize539HistoryRow(row);
      if (game === "biglotto") return normalizeBigLottoHistoryRow(row);
      if (game === "power") return normalizePowerHistoryRow(row);
      return null;
    }).filter(Boolean);
  }

  function normalizeBingoHistoryRow(row) {
    const term = pickFirst(row, ["drawTerm", "period", "term", "期別"]);
    const time = pickFirst(row, ["dDate", "drawDate", "lotteryDate", "date", "時間"]);

    let numbers = [];
    if (row.drawNumberAppear) numbers = parseNumberList(row.drawNumberAppear);
    else if (row.drawNumberSize) numbers = parseNumberList(row.drawNumberSize);
    else if (row.numbers) numbers = parseNumberList(row.numbers);
    else numbers = collectSequentialNumbers(row, 1, 20);

    if (!numbers.length) return null;

    return {
      term,
      time: formatDateTime(time),
      numbers: numbers.slice(0, 20).sort((a, b) => a - b)
    };
  }

  function normalize539HistoryRow(row) {
    const term = pickFirst(row, ["period", "drawTerm", "term", "期別"]);
    const time = pickFirst(row, ["lotteryDate", "dDate", "drawDate", "date", "時間"]);

    let numbers = [];
    if (row.drawNumberSize) numbers = parseNumberList(row.drawNumberSize);
    else if (row.drawNumberAppear) numbers = parseNumberList(row.drawNumberAppear);
    else if (row.numbers) numbers = parseNumberList(row.numbers);
    else numbers = collectSequentialNumbers(row, 1, 5);

    if (!numbers.length) return null;

    return {
      term,
      time: formatDateTime(time),
      numbers: numbers.slice(0, 5).sort((a, b) => a - b)
    };
  }

  function normalizeBigLottoHistoryRow(row) {
    const term = pickFirst(row, ["period", "drawTerm", "term", "期別"]);
    const time = pickFirst(row, ["lotteryDate", "dDate", "drawDate", "date", "時間"]);

    let numbers = [];
    if (row.drawNumberSize) numbers = parseNumberList(row.drawNumberSize);
    else if (row.drawNumberAppear) numbers = parseNumberList(row.drawNumberAppear);
    else if (row.numbers) numbers = parseNumberList(row.numbers);
    else numbers = collectSequentialNumbers(row, 1, 6);

    if (!numbers.length) return null;

    const secondArea = parseNumberList(
      pickFirst(row, ["specialNum", "bonusNumber", "secondArea", "specialNumber", "特別號"])
    );

    return {
      term,
      time: formatDateTime(time),
      numbers: numbers.slice(0, 6).sort((a, b) => a - b),
      secondArea: secondArea.slice(0, 1)
    };
  }

  function normalizePowerHistoryRow(row) {
    const term = pickFirst(row, ["period", "drawTerm", "term", "期別"]);
    const time = pickFirst(row, ["lotteryDate", "dDate", "drawDate", "date", "時間"]);

    let numbers = [];
    if (row.drawNumberSize) numbers = parseNumberList(row.drawNumberSize);
    else if (row.drawNumberAppear) numbers = parseNumberList(row.drawNumberAppear);
    else if (row.numbers) numbers = parseNumberList(row.numbers);
    else numbers = collectSequentialNumbers(row, 1, 6);

    if (!numbers.length) return null;

    let secondArea = parseNumberList(
      pickFirst(row, ["specialNum", "secondArea", "powerball", "specialNumber", "特別號", "第二區"])
    );

    if (!secondArea.length) {
      secondArea = collectSequentialNumbersFromNamedKeys(row, ["num7", "number7", "second", "special"]);
    }

    return {
      term,
      time: formatDateTime(time),
      numbers: numbers.slice(0, 6).sort((a, b) => a - b),
      secondArea: secondArea.slice(0, 1)
    };
  }

  function normalizeLatestBingo(row) {
    if (!row) return null;

    let numbers = parseNumberList(row.drawNumberAppear || row.drawNumberSize || row.numbers);

    if (!numbers.length && Array.isArray(row.drawNumberAppear)) {
      numbers = row.drawNumberAppear.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
    }

    if (!numbers.length && Array.isArray(row.drawNumberSize)) {
      numbers = row.drawNumberSize.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
    }

    if (!numbers.length) return null;

    return {
      term: row.drawTerm || row.period || row.term || "-",
      time: formatDateTime(row.dDate || row.drawDate || row.lotteryDate || row.date),
      numbers: numbers.slice(0, 20).sort((a, b) => a - b)
    };
  }

  function normalizeLatest539(row) {
    if (!row) return null;
    const numbers = parseNumberList(row.drawNumberSize || row.drawNumberAppear || row.numbers);
    if (!numbers.length) return null;

    return {
      term: row.period || row.drawTerm || row.term || "-",
      time: formatDateTime(row.lotteryDate || row.dDate || row.drawDate || row.date),
      numbers: numbers.slice(0, 5).sort((a, b) => a - b)
    };
  }

  function normalizeLatestBigLotto(row) {
    if (!row) return null;
    const numbers = parseNumberList(row.drawNumberSize || row.drawNumberAppear || row.numbers);
    if (!numbers.length) return null;

    const secondArea = parseNumberList(
      row.specialNum || row.bonusNumber || row.secondArea || row.specialNumber
    );

    return {
      term: row.period || row.drawTerm || row.term || "-",
      time: formatDateTime(row.lotteryDate || row.dDate || row.drawDate || row.date),
      numbers: numbers.slice(0, 6).sort((a, b) => a - b),
      secondArea: secondArea.slice(0, 1)
    };
  }

  function normalizeLatestPower(row) {
    if (!row) return null;

    let numbers = parseNumberList(row.drawNumberSize || row.drawNumberAppear || row.numbers);
    if (!numbers.length) numbers = collectSequentialNumbers(row, 1, 6);

    let secondArea = parseNumberList(row.specialNum || row.secondArea || row.powerball || row.specialNumber);
    if (!secondArea.length) {
      secondArea = collectSequentialNumbersFromNamedKeys(row, ["num7", "number7", "second", "special"]);
    }

    if (!numbers.length) return null;

    return {
      term: row.period || row.drawTerm || row.term || "-",
      time: formatDateTime(row.lotteryDate || row.dDate || row.drawDate || row.date),
      numbers: numbers.slice(0, 6).sort((a, b) => a - b),
      secondArea: secondArea.slice(0, 1)
    };
  }

  async function fetchJsonWithFallback(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const json = await res.json();
        if (json) return json;
      } catch (_) {}
    }
    return null;
  }

  async function fetchTextWithFallback(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const text = await res.text();
        if (text && text.trim()) return text;
      } catch (_) {}
    }
    return "";
  }

  function parseCSV(text) {
    if (!text || !text.trim()) return [];

    const rows = [];
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (!cols.length) continue;

      const row = {};
      headers.forEach((h, idx) => {
        row[String(h || "").trim()] = String(cols[idx] ?? "").trim();
      });
      rows.push(row);
    }

    return rows;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }

    result.push(current);
    return result;
  }

  function parseNumberList(value) {
    if (Array.isArray(value)) {
      return value.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
    }

    if (typeof value === "number") return [value];
    if (!value) return [];

    if (typeof value === "string") {
      return value
        .split(/[^0-9]+/g)
        .map((n) => parseInt(n, 10))
        .filter((n) => Number.isFinite(n));
    }

    return [];
  }

  function collectSequentialNumbers(row, from, to) {
    const values = [];
    for (let i = from; i <= to; i++) {
      const candidates = [`num${i}`, `number${i}`, `n${i}`, `ball${i}`, `${i}`];
      for (const key of candidates) {
        if (row[key] !== undefined && row[key] !== "") {
          const n = parseInt(row[key], 10);
          if (Number.isFinite(n)) {
            values.push(n);
            break;
          }
        }
      }
    }
    return values;
  }

  function collectSequentialNumbersFromNamedKeys(row, keys) {
    const out = [];
    keys.forEach((key) => {
      const n = parseInt(row[key], 10);
      if (Number.isFinite(n)) out.push(n);
    });
    return out;
  }

  function pickFirst(obj, keys) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
    }
    return "";
  }

  function renderBallHtml(numbers) {
    if (!numbers?.length) return `<span class="ball-empty">-</span>`;
    return numbers.map((n) => `<span class="lottery-ball">${pad2(n)}</span>`).join("");
  }

  function showLoadingMessage() {
    const container = first([
      "#predictionResults",
      "#recommendationResults",
      ".prediction-results",
      "[data-role='prediction-results']"
    ]);

    if (container) {
      container.innerHTML = `<div class="prediction-empty">尚未產生推薦號碼</div>`;
    }
  }

  function toast(message) {
    const el = first(["#toast", ".toast", "[data-role='toast']"]);
    if (el) {
      el.textContent = message;
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 1800);
      return;
    }
    console.log(message);
  }

  function normalizeGameKey(value) {
    const v = String(value || "").toLowerCase();
    if (v.includes("539")) return "daily539";
    if (v.includes("big") || v.includes("649") || v.includes("lotto")) return "biglotto";
    if (v.includes("power")) return "power";
    return "bingo";
  }

  function refillSelect(select, min, max, selected, suffix = "顆") {
    if (!select) return;
    const prev = String(selected);
    select.innerHTML = "";
    for (let i = min; i <= max; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i}${suffix}`;
      if (String(i) === prev) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function setTextMulti(selectors, value) {
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.textContent = value;
      });
    });
  }

  function setValueMulti(selectors, value) {
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if ("value" in el) el.value = value;
      });
    });
  }

  function first(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function all(selectors) {
    const result = [];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => result.push(el));
    });
    return result;
  }

  function formatDateTime(input) {
    if (!input) return "-";
    if (input instanceof Date) return formatDateObject(input);

    const dt = new Date(input);
    if (!Number.isNaN(dt.getTime())) return formatDateObject(dt);

    return String(input).replace("T", " ");
  }

  function formatDateObject(dt) {
    const y = dt.getFullYear();
    const m = pad2(dt.getMonth() + 1);
    const d = pad2(dt.getDate());
    const hh = pad2(dt.getHours());
    const mm = pad2(dt.getMinutes());
    const ss = pad2(dt.getSeconds());
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function round4(n) {
    return Math.round(n * 10000) / 10000;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
})();