// ==============================
// 台灣彩券 AI 預測系統 V71
// 真歷史分析 / 熱冷號 / 連號 / 尾數 / 分區平衡 / 命中比對
// ==============================

// ---------- 基本工具 ----------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function unique(arr) {
  return [...new Set(arr)];
}

function sortAsc(arr) {
  return [...arr].sort((a, b) => a - b);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function countHits(a, b) {
  const set = new Set(b);
  return a.filter(x => set.has(x)).length;
}

function getTail(n) {
  return n % 10;
}

function chunkRange(num, max) {
  const third = Math.ceil(max / 3);
  if (num <= third) return 1;
  if (num <= third * 2) return 2;
  return 3;
}

function buildRangeMap(max) {
  const map = {};
  for (let i = 1; i <= max; i++) {
    map[i] = chunkRange(i, max);
  }
  return map;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

// ---------- 讀官方最新資料 ----------
async function fetchJSON(url) {
  try {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(), {
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("fetchJSON failed:", url, err);
    return null;
  }
}

async function fetchOfficialResults() {
  const latest = await fetchJSON("data/official/latest.json");
  return latest || null;
}

async function getOfficialDraw(type) {
  const data = await fetchOfficialResults();
  if (!data) return null;

  const map = {
    bingo: "bingo",
    "649": "lotto649",
    "638": "lotto638",
    "539": "lotto539"
  };

  const key = map[type];
  if (!key || !data[key]) return null;

  return {
    main: safeArray(data[key].numbers),
    special: data[key].special ?? null
  };
}

// ---------- 讀歷史資料 ----------
async function loadHistory(type) {
  // 你目前的資料結構可能是這幾種，這裡做容錯
  const candidates = [
    `data/extracted/${type}.json`,
    `data/official/${type}.json`,
    `data/${type}.json`
  ];

  for (const url of candidates) {
    const data = await fetchJSON(url);
    if (!data) continue;

    if (Array.isArray(data)) return normalizeHistoryRows(data, type);
    if (Array.isArray(data.records)) return normalizeHistoryRows(data.records, type);
    if (Array.isArray(data.data)) return normalizeHistoryRows(data.data, type);
    if (Array.isArray(data.content)) return normalizeHistoryRows(data.content, type);
  }

  return [];
}

// ---------- 歷史格式標準化 ----------
function normalizeHistoryRows(rows, type) {
  return rows
    .map(row => normalizeHistoryRow(row, type))
    .filter(Boolean);
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractMainNumbers(row) {
  if (Array.isArray(row.numbers)) {
    return row.numbers.map(Number).filter(Number.isFinite);
  }

  const keys = Object.keys(row || {});
  const numKeys = keys.filter(k => /^n\d+$/i.test(k) || /^num\d+$/i.test(k) || /^number\d+$/i.test(k));
  if (numKeys.length) {
    return numKeys
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
      .map(k => Number(row[k]))
      .filter(Number.isFinite);
  }

  const ballKeys = [
    "獎號1","獎號2","獎號3","獎號4","獎號5","獎號6","獎號7","獎號8","獎號9","獎號10",
    "獎號11","獎號12","獎號13","獎號14","獎號15","獎號16","獎號17","獎號18","獎號19","獎號20"
  ];

  const values = [];
  for (const k of ballKeys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
      const n = Number(row[k]);
      if (Number.isFinite(n)) values.push(n);
    }
  }
  return values;
}

function normalizeHistoryRow(row, type) {
  const numbers = extractMainNumbers(row);

  if (!numbers.length) return null;

  const special =
    row.special ??
    row.second ??
    row["特別號"] ??
    row["第二區"] ??
    row["super"] ??
    null;

  return {
    drawNo: row.drawNo || row.issue || row["期別"] || "",
    date: row.date || row.drawDate || row["開獎日期"] || "",
    numbers: numbers.map(Number).filter(Number.isFinite),
    special: special === null || special === "" ? null : Number(special)
  };
}

// ---------- 歷史分析 ----------
function analyzeFrequency(history, maxNumber, mainCount) {
  const freq = Array(maxNumber + 1).fill(0);

  history.forEach(draw => {
    draw.numbers.forEach(n => {
      if (n >= 1 && n <= maxNumber) freq[n]++;
    });
  });

  const all = Array.from({ length: maxNumber }, (_, i) => i + 1);

  const hot = [...all]
    .sort((a, b) => freq[b] - freq[a] || a - b)
    .slice(0, mainCount + 4);

  const cold = [...all]
    .sort((a, b) => freq[a] - freq[b] || a - b)
    .slice(0, mainCount + 4);

  return { freq, hot, cold };
}

function analyzeRecentMissing(history, maxNumber) {
  const miss = Array(maxNumber + 1).fill(history.length);

  for (let i = history.length - 1; i >= 0; i--) {
    const draw = history[i];
    draw.numbers.forEach(n => {
      if (miss[n] === history.length) {
        miss[n] = history.length - 1 - i;
      }
    });
  }

  return miss;
}

function analyzeTails(history, maxNumber) {
  const tailFreq = Array(10).fill(0);
  history.forEach(draw => {
    draw.numbers.forEach(n => {
      tailFreq[getTail(n)]++;
    });
  });

  const ranked = Array.from({ length: 10 }, (_, i) => i)
    .sort((a, b) => tailFreq[b] - tailFreq[a]);

  return {
    tailFreq,
    hotTails: ranked.slice(0, 4),
    coldTails: ranked.slice(-4)
  };
}

function analyzeConsecutive(history) {
  let withStreak = 0;
  let maxStreak = 0;
  const streakPairs = {};

  history.forEach(draw => {
    const nums = sortAsc(draw.numbers);
    let localHas = false;
    let currentStreak = 1;

    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === nums[i - 1] + 1) {
        localHas = true;
        currentStreak++;
        const key = `${nums[i - 1]}-${nums[i]}`;
        streakPairs[key] = (streakPairs[key] || 0) + 1;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }

    maxStreak = Math.max(maxStreak, currentStreak);
    if (localHas) withStreak++;
  });

  const topPairs = Object.entries(streakPairs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    withStreak,
    maxStreak,
    topPairs
  };
}

function analyzeRanges(history, maxNumber) {
  const rangeMap = buildRangeMap(maxNumber);
  const rangeFreq = { 1: 0, 2: 0, 3: 0 };

  history.forEach(draw => {
    draw.numbers.forEach(n => {
      rangeFreq[rangeMap[n]]++;
    });
  });

  return rangeFreq;
}

function analyzeSpecial(history, specialMax) {
  if (!specialMax) return null;

  const freq = Array(specialMax + 1).fill(0);

  history.forEach(draw => {
    if (Number.isFinite(draw.special) && draw.special >= 1 && draw.special <= specialMax) {
      freq[draw.special]++;
    }
  });

  const nums = Array.from({ length: specialMax }, (_, i) => i + 1);
  const hot = [...nums].sort((a, b) => freq[b] - freq[a]).slice(0, 3);
  const cold = [...nums].sort((a, b) => freq[a] - freq[b]).slice(0, 3);

  return { freq, hot, cold };
}

// ---------- 權重計算 ----------
function buildWeights(history, maxNumber, mainCount) {
  const { freq, hot, cold } = analyzeFrequency(history, maxNumber, mainCount);
  const missing = analyzeRecentMissing(history, maxNumber);
  const { hotTails } = analyzeTails(history, maxNumber);
  const rangeMap = buildRangeMap(maxNumber);

  const weights = {};

  for (let n = 1; n <= maxNumber; n++) {
    let score = 0;

    // 熱度
    score += freq[n] * 1.4;

    // 遺漏期數
    score += clamp(missing[n], 0, 15) * 1.2;

    // 熱尾數
    if (hotTails.includes(getTail(n))) score += 6;

    // 熱號加分
    if (hot.includes(n)) score += 10;

    // 冷號少量保留
    if (cold.includes(n)) score += 3;

    // 區間平均化微調
    if (rangeMap[n] === 2) score += 2;

    weights[n] = Math.max(score, 1);
  }

  return { weights, freq, hot, cold, missing, hotTails };
}

function weightedPick(pool, weights) {
  const total = pool.reduce((acc, n) => acc + (weights[n] || 1), 0);
  let r = Math.random() * total;

  for (const n of pool) {
    r -= (weights[n] || 1);
    if (r <= 0) return n;
  }

  return pool[pool.length - 1];
}

// ---------- 預測策略 ----------
function generateMainSet(maxNumber, count, weights) {
  const chosen = new Set();
  const rangeMap = buildRangeMap(maxNumber);

  while (chosen.size < count) {
    const pool = [];
    for (let i = 1; i <= maxNumber; i++) {
      if (!chosen.has(i)) pool.push(i);
    }

    const candidate = weightedPick(pool, weights);
    chosen.add(candidate);
  }

  let result = sortAsc([...chosen]);

  // 區間平衡微調：避免全部擠同區
  const rangeCount = { 1: 0, 2: 0, 3: 0 };
  result.forEach(n => rangeCount[rangeMap[n]]++);

  const tooHeavyRange = Object.keys(rangeCount).find(k => rangeCount[k] >= Math.max(4, count - 1));
  if (tooHeavyRange) {
    const replaceIndex = result.findIndex(n => String(rangeMap[n]) === String(tooHeavyRange));
    const otherPool = [];
    for (let i = 1; i <= maxNumber; i++) {
      if (!result.includes(i) && String(rangeMap[i]) !== String(tooHeavyRange)) {
        otherPool.push(i);
      }
    }
    if (replaceIndex >= 0 && otherPool.length) {
      result[replaceIndex] = weightedPick(otherPool, weights);
      result = sortAsc(unique(result));
      while (result.length < count) {
        const fillPool = [];
        for (let i = 1; i <= maxNumber; i++) {
          if (!result.includes(i)) fillPool.push(i);
        }
        result.push(weightedPick(fillPool, weights));
        result = sortAsc(unique(result));
      }
    }
  }

  // 連號控制：保留適量連號，不全砍
  result = enforceSoftConsecutive(result, maxNumber, weights);

  return sortAsc(result);
}

function enforceSoftConsecutive(numbers, maxNumber, weights) {
  let nums = sortAsc(numbers);

  let consecutivePairs = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) consecutivePairs++;
  }

  // 太密集就拆一點
  if (consecutivePairs >= 3) {
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === nums[i - 1] + 1) {
        const removeIdx = i;
        const pool = [];
        for (let n = 1; n <= maxNumber; n++) {
          if (!nums.includes(n) && Math.abs(n - nums[i - 1]) > 1) pool.push(n);
        }
        if (pool.length) {
          nums[removeIdx] = weightedPick(pool, weights);
          break;
        }
      }
    }
    nums = sortAsc(unique(nums));
  }

  return nums;
}

function generateSpecial(specialMax, specialAnalysis) {
  if (!specialMax) return null;

  const weights = {};
  for (let i = 1; i <= specialMax; i++) {
    weights[i] = 1 + (specialAnalysis?.freq?.[i] || 0);
    if (specialAnalysis?.hot?.includes(i)) weights[i] += 5;
  }

  const pool = Array.from({ length: specialMax }, (_, i) => i + 1);
  return weightedPick(pool, weights);
}

// ---------- 文案分析 ----------
function buildStreakText(consecutiveInfo) {
  if (!consecutiveInfo) return "無資料";

  const pairText = consecutiveInfo.topPairs.length
    ? consecutiveInfo.topPairs.map(([pair, cnt]) => `${pair}（${cnt}次）`).join("、")
    : "近期無明顯強勢連號";

  return `近期期數中有連號的次數：${consecutiveInfo.withStreak}；最長連號長度：約 ${consecutiveInfo.maxStreak}。熱門連號：${pairText}`;
}

function buildTailText(tailAnalysis) {
  if (!tailAnalysis) return "無資料";

  return `熱尾數：${tailAnalysis.hotTails.join("、")}；冷尾數：${tailAnalysis.coldTails.join("、")}`;
}

function buildAiSummary(gameName, main, hot, cold, historyCount) {
  return `${gameName} 本次以近 ${historyCount} 期歷史資料為基礎，綜合熱號、冷號回補、尾數活躍、連號密度與區間平衡後產生推薦。主推薦偏向「熱號帶冷號」的混合結構，避免全熱或全冷，提升組合穩定度。`;
}

// ---------- UI 渲染 ----------
function renderBalls(numbers, type = "") {
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

function buildPredictionHTML(config) {
  const {
    gameName,
    main,
    groups,
    hot,
    cold,
    streak,
    tails,
    extra,
    extraTitle,
    draw,
    hitText,
    aiSummary
  } = config;

  return `
    <div class="result-grid">
      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${renderBalls(main, "main")}
      </div>

      ${
        extra !== null && extra !== undefined
          ? `
          <div class="result-card">
            <div class="card-title">${extraTitle}</div>
            <div class="special-box">
              <span class="ball special">${pad2(extra)}</span>
            </div>
          </div>
        `
          : ""
      }

      <div class="result-card">
        <div class="card-title">多組推薦</div>
        <div class="group-list">
          ${groups.map((g, i) => `
            <div class="group-item">
              <div class="group-label">第 ${i + 1} 組</div>
              ${renderBalls(g.main)}
              ${
                g.extra !== null && g.extra !== undefined
                  ? `<div class="mini-extra">${g.extraTitle}：<span class="ball special">${pad2(g.extra)}</span></div>`
                  : ""
              }
            </div>
          `).join("")}
        </div>
      </div>

      <div class="result-card">
        <div class="card-title">熱號參考</div>
        ${renderBalls(hot, "hot")}
      </div>

      <div class="result-card">
        <div class="card-title">冷號參考</div>
        ${renderBalls(cold, "cold")}
      </div>

      <div class="result-card">
        <div class="card-title">連號分析</div>
        <div class="text-block">${streak}</div>
      </div>

      <div class="result-card">
        <div class="card-title">尾數分析</div>
        <div class="text-block">${tails}</div>
      </div>

      ${
        draw
          ? `
          <div class="result-card full-width">
            <div class="card-title">官方最新開獎比對</div>
            <div class="text-block">
              <div style="margin-bottom:8px;">最新主號：${draw.main.map(pad2).join("、")}</div>
              ${
                draw.special !== null && draw.special !== undefined
                  ? `<div style="margin-bottom:8px;">${gameName === "威力彩" ? "第二區" : "特別號"}：${pad2(draw.special)}</div>`
                  : ""
              }
              <div>${hitText}</div>
            </div>
          </div>
        `
          : ""
      }

      <div class="result-card full-width">
        <div class="card-title">AI 分析摘要</div>
        <div class="text-block">${aiSummary}</div>
      </div>
    </div>
  `;
}

// ---------- 主執行 ----------
async function runPrediction(type) {
  const resultEl = document.getElementById("predictionResult");
  const setCount = parseInt(document.getElementById("setCount")?.value || "3", 10);
  const historyPeriods = parseInt(document.getElementById("historyPeriods")?.value || "50", 10);
  const bingoCount = parseInt(document.getElementById("bingoCount")?.value || "10", 10);

  resultEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <div class="empty-title">分析中</div>
      <div class="empty-text">正在讀取官方歷史資料並計算推薦號碼...</div>
    </div>
  `;

  const configMap = {
    bingo: {
      gameName: "Bingo Bingo",
      max: 80,
      count: bingoCount,
      specialMax: null,
      extraTitle: null
    },
    "649": {
      gameName: "大樂透",
      max: 49,
      count: 6,
      specialMax: 49,
      extraTitle: "特別號建議"
    },
    "638": {
      gameName: "威力彩",
      max: 38,
      count: 6,
      specialMax: 8,
      extraTitle: "第二區建議"
    },
    "539": {
      gameName: "今彩 539",
      max: 39,
      count: 5,
      specialMax: null,
      extraTitle: null
    }
  };

  const cfg = configMap[type];
  if (!cfg) {
    resultEl.innerHTML = `<div class="empty-state"><div class="empty-title">不支援的彩種</div></div>`;
    return;
  }

  updateHeader(cfg.gameName, "分析中");

  const allHistory = await loadHistory(type);
  const history = allHistory.slice(-historyPeriods);

  if (!history.length) {
    updateHeader(cfg.gameName, "無資料");
    resultEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">找不到歷史資料</div>
        <div class="empty-text">請先確認 data/extracted 或 data/official 已產生可用資料。</div>
      </div>
    `;
    return;
  }

  const { weights, hot, cold } = buildWeights(history, cfg.max, cfg.count);
  const tailAnalysis = analyzeTails(history, cfg.max);
  const consecutiveInfo = analyzeConsecutive(history);
  const specialAnalysis = analyzeSpecial(history, cfg.specialMax);

  const main = generateMainSet(cfg.max, cfg.count, weights);
  const extra = generateSpecial(cfg.specialMax, specialAnalysis);

  const groups = Array.from({ length: setCount }, () => ({
    main: generateMainSet(cfg.max, cfg.count, weights),
    extra: generateSpecial(cfg.specialMax, specialAnalysis),
    extraTitle: cfg.extraTitle
  }));

  const draw = await getOfficialDraw(type);

  let hitText = "尚無可比對資料";
  if (draw && Array.isArray(draw.main) && draw.main.length) {
    const hitMain = countHits(main, draw.main);
    let specialText = "";

    if (cfg.gameName === "大樂透" && draw.special !== null && extra !== null) {
      specialText = `；特別號 ${extra === draw.special ? "命中" : "未中"}`;
    }

    if (cfg.gameName === "威力彩" && draw.special !== null && extra !== null) {
      specialText = `；第二區 ${extra === draw.special ? "命中" : "未中"}`;
    }

    hitText = `主號命中 ${hitMain} 個${specialText}`;
  }

  const streakText = buildStreakText(consecutiveInfo);
  const tailText = buildTailText(tailAnalysis);
  const aiSummary = buildAiSummary(cfg.gameName, main, hot, cold, history.length);

  updateHeader(cfg.gameName, "已完成");

  resultEl.innerHTML = buildPredictionHTML({
    gameName: cfg.gameName,
    main,
    groups,
    hot: hot.slice(0, cfg.count),
    cold: cold.slice(0, cfg.count),
    streak: streakText,
    tails: tailText,
    extra,
    extraTitle: cfg.extraTitle,
    draw,
    hitText,
    aiSummary
  });
}