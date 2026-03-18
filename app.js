const OFFICIAL_DATA_PATHS = {
  bingo: [
    "data/official/bingo.json",
    "data/official/bingo_bingo.json",
    "data/official/賓果賓果.json"
  ],
  lotto649: [
    "data/official/lotto649.json",
    "const DATA_PATHS = {
  bingo: "data/official/bingo.json",
  lotto649: "data/official/lotto649.json",
  superlotto638: "data/official/superlotto638.json",
  dailycash: "data/official/dailycash.json",
  meta: "data/official/meta.json"
};

const GAME_NAMES = {
  bingo: "Bingo Bingo",
  lotto649: "大樂透",
  superlotto638: "威力彩",
  dailycash: "今彩539"
};

const STORAGE_KEY = "tw_lottery_predictions_v69_3";

let cache = {
  bingo: [],
  lotto649: [],
  superlotto638: [],
  dailycash: [],
  meta: null
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function uniq(arr) {
  return [...new Set(arr)];
}

function sortAsc(arr) {
  return [...arr].sort((a, b) => a - b);
}

function pickRandom(arr, count) {
  const pool = [...arr];
  const out = [];
  while (pool.length && out.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

async function loadJSON(url) {
  const res = await fetch(url + `?t=${Date.now()}`);
  if (!res.ok) throw new Error(`載入失敗: ${url}`);
  return res.json();
}

async function initData() {
  try {
    const [bingo, lotto649, superlotto638, dailycash, meta] = await Promise.all([
      loadJSON(DATA_PATHS.bingo),
      loadJSON(DATA_PATHS.lotto649),
      loadJSON(DATA_PATHS.superlotto638),
      loadJSON(DATA_PATHS.dailycash),
      loadJSON(DATA_PATHS.meta).catch(() => null)
    ]);

    cache.bingo = Array.isArray(bingo) ? bingo : [];
    cache.lotto649 = Array.isArray(lotto649) ? lotto649 : [];
    cache.superlotto638 = Array.isArray(superlotto638) ? superlotto638 : [];
    cache.dailycash = Array.isArray(dailycash) ? dailycash : [];
    cache.meta = meta;

    console.log("✅ 官方資料載入完成", {
      bingo: cache.bingo.length,
      lotto649: cache.lotto649.length,
      superlotto638: cache.superlotto638.length,
      dailycash: cache.dailycash.length
    });
  } catch (err) {
    console.error(err);
    alert("官方資料載入失敗，請稍後再試");
  }
}

function getHistoryCount() {
  const el = document.getElementById("historyPeriods");
  return parseInt(el?.value || "50", 10);
}

function getSetCount() {
  const el = document.getElementById("setCount");
  return parseInt(el?.value || "3", 10);
}

function getBingoCount() {
  const el = document.getElementById("bingoCount");
  return parseInt(el?.value || "10", 10);
}

function normalizeDraw(draw, key) {
  if (!draw) return null;

  const numbers = Array.isArray(draw.numbers)
    ? draw.numbers.map(Number).filter(n => !Number.isNaN(n))
    : [];

  let extra = null;
  if (draw.extra !== undefined && draw.extra !== null && draw.extra !== "") {
    const n = Number(draw.extra);
    if (!Number.isNaN(n)) extra = n;
  }

  return {
    date: draw.date || draw.drawDate || "",
    period: draw.period || draw.issue || "",
    numbers: sortAsc(numbers),
    extra
  };
}

function getRecentDraws(key, count) {
  const list = cache[key] || [];
  return list.slice(0, count).map(item => normalizeDraw(item, key)).filter(Boolean);
}

function getLatestDraw(key) {
  const list = getRecentDraws(key, 1);
  return list[0] || null;
}

function countFrequency(draws, maxNumber, pickCount) {
  const freq = Array.from({ length: maxNumber + 1 }, () => 0);

  draws.forEach(draw => {
    draw.numbers.forEach(n => {
      if (n >= 1 && n <= maxNumber) freq[n]++;
    });
  });

  const all = Array.from({ length: maxNumber }, (_, i) => i + 1);

  const hot = [...all]./official/大樂透.json"
  ],
  superlotto638: [
    "data/official/superlotto638.json",
    "data/official/威力彩.json"
  ],
  dailycash: [
    "data/official/dailycash.json",
    "data/official/今彩539.json",
    "data/official/539.json"
  ]
};

const state = {
  cache: {}
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function uniq(arr) {
  return [...new Set(arr)];
}

function sortAsc(arr) {
  return [...arr].sort((a, b) => a - b);
}

function intersectionCount(a, b) {
  const bs = new Set(b);
  return a.filter(x => bs.has(x)).length;
}

function getTailStats(nums) {
  const map = {};
  nums.forEach(n => {
    const t = n % 10;
    map[t] = (map[t] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([tail, count]) => `${tail}尾×${count}`)
    .join("、");
}

function getConsecutiveText(nums) {
  const sorted = sortAsc(nums);
  if (!sorted.length) return "無資料";

  const groups = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current.push(sorted[i]);
    } else {
      if (current.length >= 2) groups.push([...current]);
      current = [sorted[i]];
    }
  }

  if (current.length >= 2) groups.push([...current]);

  if (!groups.length) return "本次主推薦未形成明顯連號，屬於分散型配置。";
  return `偵測到連號：${groups.map(g => g.map(pad2).join("-")).join("、")}`;
}

function makeBallRow(numbers, type = "") {
  return `
    <div class="ball-row">
      ${numbers.map(n => `<span class="ball ${type}">${pad2(n)}</span>`).join("")}
    </div>
  `;
}

function updateHeader(gameName, badgeText) {
  const titleEl = document.getElementById("resultGameName");
  const badgeEl = document.getElementById("resultBadge");
  if (titleEl) titleEl.textContent = gameName;
  if (badgeEl) badgeEl.textContent = badgeText;
}

function getSetCount() {
  return parseInt(document.getElementById("setCount")?.value || "3", 10);
}

function getHistoryPeriods() {
  return parseInt(document.getElementById("historyPeriods")?.value || "50", 10);
}

function getBingoCount() {
  return parseInt(document.getElementById("bingoCount")?.value || "10", 10);
}

async function fetchJsonFirst(paths) {
  for (const path of paths) {
    try {
      const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) continue;

      const data = await res.json();

      if (Array.isArray(data) && data.length) return data;
      if (Array.isArray(data?.content) && data.content.length) return data.content;
      if (Array.isArray(data?.data) && data.data.length) return data.data;
    } catch (err) {
      // ignore
    }
  }
  return [];
}

function parseNumber(v) {
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row, type) {
  if (!row || typeof row !== "object") return null;

  const rawDate =
    row["開獎日期"] ||
    row["drawDate"] ||
    row["date"] ||
    row["DrawDate"] ||
    "";

  if (type === "bingo") {
    const nums = [];
    for (let i = 1; i <= 20; i++) {
      const n =
        parseNumber(row[`獎號${i}`]) ??
        parseNumber(row[`num${i}`]) ??
        parseNumber(row[`Num${i}`]);
      if (n != null) nums.push(n);
    }

    const superNum =
      parseNumber(row["超級獎號"]) ??
      parseNumber(row["super"]) ??
      parseNumber(row["special"]);

    if (!nums.length) return null;

    return {
      date: rawDate,
      numbers: sortAsc(nums),
      extra: superNum
    };
  }

  if (type === "lotto649") {
    const nums = [];
    for (let i = 1; i <= 6; i++) {
      const n =
        parseNumber(row[`獎號${i}`]) ??
        parseNumber(row[`num${i}`]) ??
        parseNumber(row[`Num${i}`]);
      if (n != null) nums.push(n);
    }

    const special =
      parseNumber(row["特別號"]) ??
      parseNumber(row["special"]) ??
      parseNumber(row["特別號碼"]);

    if (nums.length < 6) return null;

    return {
      date: rawDate,
      numbers: sortAsc(nums),
      extra: special
    };
  }

  if (type === "superlotto638") {
    const nums = [];
    for (let i = 1; i <= 6; i++) {
      const n =
        parseNumber(row[`獎號${i}`]) ??
        parseNumber(row[`num${i}`]) ??
        parseNumber(row[`Num${i}`]);
      if (n != null) nums.push(n);
    }

    const zone2 =
      parseNumber(row["第二區"]) ??
      parseNumber(row["第二區號"]) ??
      parseNumber(row["special"]) ??
      parseNumber(row["zone2"]);

    if (nums.length < 6) return null;

    return {
      date: rawDate,
      numbers: sortAsc(nums),
      extra: zone2
    };
  }

  if (type === "dailycash") {
    const nums = [];
    for (let i = 1; i <= 5; i++) {
      const n =
        parseNumber(row[`獎號${i}`]) ??
        parseNumber(row[`num${i}`]) ??
        parseNumber(row[`Num${i}`]);
      if (n != null) nums.push(n);
    }

    if (nums.length < 5) return null;

    return {
      date: rawDate,
      numbers: sortAsc(nums),
      extra: null
    };
  }

  return null;
}

async function loadOfficialData(type) {
  if (state.cache[type]) return state.cache[type];

  const raw = await fetchJsonFirst(OFFICIAL_DATA_PATHS[type] || []);
  const normalized = raw
    .map(row => normalizeRow(row, type))
    .filter(Boolean)
    .filter(item => Array.isArray(item.numbers) && item.numbers.length);

  state.cache[type] = normalized;
  return normalized;
}

function buildFrequencyMap(draws, maxNumber) {
  const freq = Array.from({ length: maxNumber + 1 }, () => 0);
  draws.forEach(d => {
    d.numbers.forEach(n => {
      if (n >= 1 && n <= maxNumber) freq[n] += 1;
    });
  });
  return freq;
}

function buildMissMap(draws, maxNumber) {
  const miss = Array.from({ length: maxNumber + 1 }, () => 0);

  for (let n = 1; n <= maxNumber; n++) {
    let missCount = 0;
    for (const d of draws) {
      if (d.numbers.includes(n)) break;
      missCount++;
    }
    miss[n] = missCount;
  }

  return miss;
}

function pickTopNumbersByScore(scoreMap, count, maxNumber) {
  const list = [];
  for (let n = 1; n <= maxNumber; n++) {
    list.push({ n, score: scoreMap[n] || 0 });
  }

  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.n - b.n;
  });

  return sortAsc(list.slice(0, count).map(x => x.n));
}

function pickHotNumbers(freq, count, maxNumber) {
  const arr = [];
  for (let n = 1; n <= maxNumber; n++) arr.push({ n, v: freq[n] || 0 });
  arr.sort((a, b) => b.v - a.v || a.n - b.n);
  return sortAsc(arr.slice(0, count).map(x => x.n));
}

function pickColdNumbers(freq, count, maxNumber) {
  const arr = [];
  for (let n = 1; n <= maxNumber; n++) arr.push({ n, v: freq[n] || 0 });
  arr.sort((a, b) => a.v - b.v || a.n - b.n);
  return sortAsc(arr.slice(0, count).map(x => x.n));
}

function makeMainPrediction(draws, maxNumber, pickCount) {
  const freq = buildFrequencyMap(draws, maxNumber);
  const miss = buildMissMap(draws, maxNumber);
  const score = Array.from({ length: maxNumber + 1 }, () => 0);

  for (let n = 1; n <= maxNumber; n++) {
    const f = freq[n] || 0;
    const m = miss[n] || 0;
    score[n] = f * 1.7 + Math.min(m, 12) * 0.9;
  }

  return {
    main: pickTopNumbersByScore(score, pickCount, maxNumber),
    hot: pickHotNumbers(freq, Math.min(Math.max(pickCount, 5), 10), maxNumber),
    cold: pickColdNumbers(freq, Math.min(Math.max(pickCount, 5), 10), maxNumber),
    freq,
    miss,
    score
  };
}

function mutatePrediction(baseNums, hot, cold, maxNumber, count, seed) {
  const set = new Set(baseNums);

  if (seed % 2 === 0 && hot.length) {
    set.add(hot[seed % hot.length]);
  }
  if (seed % 3 === 0 && cold.length) {
    set.add(cold[seed % cold.length]);
  }

  while (set.size > count) {
    const arr = sortAsc([...set]);
    set.delete(arr[arr.length - 1]);
  }

  let filler = 1 + (seed % maxNumber);
  while (set.size < count) {
    set.add(filler);
    filler++;
    if (filler > maxNumber) filler = 1;
  }

  return sortAsc([...set]).slice(0, count);
}

function buildPredictionGroups(main, hot, cold, maxNumber, count, setCount) {
  const groups = [];
  for (let i = 0; i < setCount; i++) {
    groups.push(mutatePrediction(main, hot, cold, maxNumber, count, i + 1));
  }
  return groups;
}

function evaluateHits(draws, maxNumber, pickCount, recentWindows = [10, 30, 50]) {
  const result = {};

  recentWindows.forEach(windowSize => {
    const usable = draws.slice(0, windowSize + 1);
    if (usable.length < 2) {
      result[windowSize] = { avgHit: 0, bestHit: 0, samples: 0 };
      return;
    }

    const hits = [];

    for (let i = 1; i < usable.length; i++) {
      const history = usable.slice(i, i + Math.min(windowSize, usable.length - i));
      if (!history.length) continue;

      const prediction = makeMainPrediction(history, maxNumber, pickCount).main;
      const actual = usable[i - 1].numbers;
      hits.push(intersectionCount(prediction, actual));
    }

    result[windowSize] = {
      avgHit: hits.length ? +(sum(hits) / hits.length).toFixed(2) : 0,
      bestHit: hits.length ? Math.max(...hits) : 0,
      samples: hits.length
    };
  });

  return result;
}

function confidenceFromMetrics(hitStats, main, hot) {
  const avg10 = hitStats[10]?.avgHit || 0;
  const avg30 = hitStats[30]?.avgHit || 0;
  const avg50 = hitStats[50]?.avgHit || 0;

  const consistency = avg10 * 0.5 + avg30 * 0.3 + avg50 * 0.2;
  const hotOverlap = main.filter(n => hot.includes(n)).length;

  let score = 55 + consistency * 8 + hotOverlap * 3;

  if (score > 98) score = 98;
  if (score < 40) score = 40;

  return Math.round(score);
}

function confidenceLabel(score) {
  if (score >= 85) return "高信心";
  if (score >= 70) return "中高信心";
  if (score >= 60) return "中等信心";
  return "參考模式";
}

function buildExplosionGroup(main, hot, maxNumber, count) {
  const merged = uniq([...main, ...hot]).filter(n => n >= 1 && n <= maxNumber);
  return sortAsc(merged).slice(0, count);
}

function latestDrawText(draw, key) {
  if (!draw) return "查無最新一期資料";

  const base = `${draw.date || "未知日期"}｜${draw.numbers.map(pad2).join("、")}`;

  if (key === "lotto649" && draw.extra != null) {
    return `${base}｜特別號 ${pad2(draw.extra)}`;
  }

  if (key === "superlotto638" && draw.extra != null) {
    return `${base}｜第二區 ${pad2(draw.extra)}`;
  }

  if (key === "bingo" && draw.extra != null) {
    return `${base}｜超級獎號 ${pad2(draw.extra)}`;
  }

  return base;
}

function renderPredictionHTML(config) {
  const {
    gameName,
    main,
    groups,
    hot,
    cold,
    streak,
    tails,
    extraHTML,
    latestText,
    hitStats,
    confidenceScore,
    explosion
  } = config;

  return `
    <div class="result-grid">
      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${makeBallRow(main, "main")}
      </div>

      <div class="result-card">
        <div class="card-title">AI 信心分數</div>
        <div class="text-block"><strong>${confidenceScore} 分</strong>｜${confidenceLabel(confidenceScore)}</div>
      </div>

      ${extraHTML ? `
      <div class="result-card">
        <div class="card-title">特別區 / 第二區</div>
        ${extraHTML}
      </div>
      ` : ""}

      <div class="result-card">
        <div class="card-title">爆發組</div>
        ${makeBallRow(explosion, "hot")}
      </div>

      <div class="result-card full-width">
        <div class="card-title">多組推薦</div>
        <div class="group-list">
          ${groups.map((g, i) => `
            <div class="group-item">
              <div class="group-label">第 ${i + 1} 組</div>
              ${makeBallRow(g)}
            </div>
          `).join("")}
        </div>
      </div>

      <div class="result-card">
        <div class="card-title">熱號參考</div>
        ${makeBallRow(hot, "hot")}
      </div>

      <div class="result-card">
        <div class="card-title">冷號參考</div>
        ${makeBallRow(cold, "")}
      </div>

      <div class="result-card">
        <div class="card-title">連號偵測</div>
        <div class="text-block">${streak}</div>
      </div>

      <div class="result-card">
        <div class="card-title">尾數分析</div>
        <div class="text-block">${tails}</div>
      </div>

      <div class="result-card">
        <div class="card-title">近10期命中率</div>
        <div class="text-block">平均命中：${hitStats[10]?.avgHit ?? 0}｜最佳：${hitStats[10]?.bestHit ?? 0}</div>
      </div>

      <div class="result-card">
        <div class="card-title">近30期命中率</div>
        <div class="text-block">平均命中：${hitStats[30]?.avgHit ?? 0}｜最佳：${hitStats[30]?.bestHit ?? 0}</div>
      </div>

      <div class="result-card">
        <div class="card-title">近50期命中率</div>
        <div class="text-block">平均命中：${hitStats[50]?.avgHit ?? 0}｜最佳：${hitStats[50]?.bestHit ?? 0}</div>
      </div>

      <div class="result-card">
        <div class="card-title">最新一期參考</div>
        <div class="text-block">${latestText}</div>
      </div>

      <div class="result-card full-width">
        <div class="card-title">AI 分析摘要</div>
        <div class="text-block">
          ${gameName} 本次預測依據官方歷史資料的近期熱度、遺漏值、尾數結構、連號分布與回測命中表現綜合產生。
          主推薦適合當核心組，爆發組適合搭配偏進攻打法，多組推薦則可分散下注風險。
        </div>
      </div>
    </div>
  `;
}

function showError(message) {
  const resultEl = document.getElementById("predictionResult");
  updateHeader("資料載入失敗", "異常");
  resultEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <div class="empty-title">讀取官方資料失敗</div>
      <div class="empty-text">${message}</div>
    </div>
  `;
}

async function runPrediction(type) {
  const resultEl = document.getElementById("predictionResult");
  if (!resultEl) return;

  updateHeader("分析中...", "計算中");
  resultEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <div class="empty-title">正在分析官方資料</div>
      <div class="empty-text">請稍候，系統正在計算熱號、冷號、命中率與信心分數。</div>
    </div>
  `;

  const typeMap = {
    bingo: {
      key: "bingo",
      gameName: "Bingo Bingo",
      maxNumber: 80,
      pickCount: getBingoCount()
    },
    "649": {
      key: "lotto649",
      gameName: "大樂透",
      maxNumber: 49,
      pickCount: 6
    },
    "638": {
      key: "superlotto638",
      gameName: "威力彩",
      maxNumber: 38,
      pickCount: 6
    },
    "539": {
      key: "dailycash",
      gameName: "今彩 539",
      maxNumber: 39,
      pickCount: 5
    }
  };

  const cfg = typeMap[type];
  if (!cfg) {
    showError("未知彩種。");
    return;
  }

  try {
    const allDraws = await loadOfficialData(cfg.key);

    if (!allDraws.length) {
      showError("找不到官方資料，請確認 data/official 內已成功產生對應 JSON。");
      return;
    }

    const historyPeriods = getHistoryPeriods();
    const recentDraws = allDraws.slice(0, historyPeriods);
    const latest = allDraws[0];
    const setCount = getSetCount();

    const pred = makeMainPrediction(recentDraws, cfg.maxNumber, cfg.pickCount);
    const groups = buildPredictionGroups(
      pred.main,
      pred.hot,
      pred.cold,
      cfg.maxNumber,
      cfg.pickCount,
      setCount
    );

    const hitStats = evaluateHits(
      allDraws.slice(0, 80),
      cfg.maxNumber,
      cfg.pickCount,
      [10, 30, 50]
    );

    const confidenceScore = confidenceFromMetrics(hitStats, pred.main, pred.hot);
    const explosion = buildExplosionGroup(pred.main, pred.hot, cfg.maxNumber, cfg.pickCount);

    let extraHTML = "";

    if (cfg.key === "lotto649") {
      const specialGuess = pred.hot.find(n => !pred.main.includes(n)) || pred.cold[0] || pred.main[0];
      extraHTML = `<div class="special-box">特別號建議：<span class="ball special">${pad2(specialGuess)}</span></div>`;
    } else if (cfg.key === "superlotto638") {
      const zone2Freq = {};
      recentDraws.forEach(d => {
        if (d.extra != null) zone2Freq[d.extra] = (zone2Freq[d.extra] || 0) + 1;
      });
      const zone2 = Object.entries(zone2Freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 1;
      extraHTML = `<div class="special-box">第二區建議：<span class="ball special">${pad2(zone2)}</span></div>`;
    } else if (cfg.key === "bingo") {
      const superFreq = {};
      recentDraws.forEach(d => {
        if (d.extra != null) superFreq[d.extra] = (superFreq[d.extra] || 0) + 1;
      });
      const superNum = Object.entries(superFreq).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (superNum) {
        extraHTML = `<div class="special-box">超級獎號參考：<span class="ball special">${pad2(superNum)}</span></div>`;
      }
    }

    updateHeader(cfg.gameName, "已完成");
    resultEl.innerHTML = renderPredictionHTML({
      gameName: cfg.gameName,
      main: pred.main,
      groups,
      hot: pred.hot,
      cold: pred.cold,
      streak: getConsecutiveText(pred.main),
      tails: getTailStats(pred.main),
      extraHTML,
      latestText: latestDrawText(latest, cfg.key),
      hitStats,
      confidenceScore,
      explosion
    });
  } catch (err) {
    console.error(err);
    showError("分析時發生錯誤，請稍後重試。");
  }
}

window.runPrediction = runPrediction;