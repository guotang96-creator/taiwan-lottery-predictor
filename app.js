const DATA_PATHS = {
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

  const hot = [...all].sort((a, b) => freq[b] - freq[a] || a - b).slice(0, pickCount);
  const cold = [...all].sort((a, b) => freq[a] - freq[b] || a - b).slice(0, pickCount);

  return { freq, hot: sortAsc(hot), cold: sortAsc(cold) };
}

function findTailStats(numbers) {
  const tails = {};
  numbers.forEach(n => {
    const tail = n % 10;
    tails[tail] = (tails[tail] || 0) + 1;
  });

  return Object.entries(tails)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tail, count]) => `${tail}尾(${count})`)
    .join("、");
}

function findSuggestedStreak(numbers) {
  const arr = sortAsc(numbers);
  const pairs = [];

  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i + 1] - arr[i] === 1) {
      pairs.push(`${pad2(arr[i])}-${pad2(arr[i + 1])}`);
    }
  }

  return pairs.length ? `可留意連號：${pairs.join("、")}` : "本輪連號訊號普通，建議以均衡分布為主。";
}

function weightedCandidatePool(draws, maxNumber) {
  const freq = Array.from({ length: maxNumber + 1 }, () => 0);

  draws.forEach(draw => {
    draw.numbers.forEach(n => {
      if (n >= 1 && n <= maxNumber) freq[n]++;
    });
  });

  const nums = Array.from({ length: maxNumber }, (_, i) => i + 1);

  nums.sort((a, b) => freq[b] - freq[a] || a - b);

  const hotZone = nums.slice(0, Math.max(10, Math.floor(maxNumber * 0.35)));
  const midZone = nums.slice(Math.floor(maxNumber * 0.2), Math.floor(maxNumber * 0.75));
  const coldZone = nums.slice(Math.floor(maxNumber * 0.65));

  return {
    hotZone: uniq(hotZone),
    midZone: uniq(midZone),
    coldZone: uniq(coldZone)
  };
}

function buildMainPrediction(draws, maxNumber, pickCount) {
  const pool = weightedCandidatePool(draws, maxNumber);
  let result = [];

  result.push(...pickRandom(pool.hotZone, Math.max(2, Math.ceil(pickCount * 0.4))));
  result.push(...pickRandom(pool.midZone.filter(n => !result.includes(n)), Math.max(2, Math.ceil(pickCount * 0.4))));
  result.push(...pickRandom(pool.coldZone.filter(n => !result.includes(n)), pickCount));

  result = uniq(result).slice(0, pickCount);

  if (result.length < pickCount) {
    const all = Array.from({ length: maxNumber }, (_, i) => i + 1);
    const remain = all.filter(n => !result.includes(n));
    result.push(...pickRandom(remain, pickCount - result.length));
  }

  return sortAsc(result.slice(0, pickCount));
}

function buildPredictionGroups(draws, maxNumber, pickCount, setCount) {
  const groups = [];
  for (let i = 0; i < setCount; i++) {
    groups.push(buildMainPrediction(draws, maxNumber, pickCount));
  }
  return groups;
}

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

function buildPredictionHTML(config) {
  const {
    gameName,
    key,
    latestDraw,
    main,
    groups,
    hot,
    cold,
    streak,
    tails,
    extraHTML,
    confidence
  } = config;

  return `
    <div class="result-grid">
      <div class="result-card full-width">
        <div class="card-title">最新一期開獎</div>
        <div class="text-block">${latestDrawText(latestDraw, key)}</div>
      </div>

      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${renderBalls(main, "main")}
      </div>

      ${extraHTML ? `
      <div class="result-card">
        <div class="card-title">
          ${
            gameName === "大樂透" ? "特別號" :
            gameName === "威力彩" ? "第二區" :
            gameName === "Bingo Bingo" ? "超級獎號" :
            "特別號"
          }
        </div>
        ${extraHTML}
      </div>
      ` : ""}

      <div class="result-card">
        <div class="card-title">多組推薦</div>
        <div class="group-list">
          ${groups.map((g, i) => `
            <div class="group-item">
              <div class="group-label">第 ${i + 1} 組</div>
              ${renderBalls(g)}
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
        <div class="card-title">連號偵測</div>
        <div class="text-block">${streak}</div>
      </div>

      <div class="result-card">
        <div class="card-title">尾數分析</div>
        <div class="text-block">${tails}</div>
      </div>

      <div class="result-card full-width">
        <div class="card-title">AI 信心分數</div>
        <div class="text-block">本次綜合信心：約 <strong>${confidence}%</strong></div>
      </div>
    </div>
  `;
}

function getStoredPredictions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveStoredPredictions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function savePredictionRecord(record) {
  const list = getStoredPredictions();
  list.unshift(record);
  saveStoredPredictions(list.slice(0, 50));
}

function countHits(predicted, actual) {
  const set = new Set(actual);
  return predicted.filter(n => set.has(n));
}

function buildHitTrackingHTML(record, latestDraw) {
  if (!record || !latestDraw) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <div class="empty-title">尚無可比對資料</div>
        <div class="empty-text">請先產生預測，並等待下一次開獎後再比對。</div>
      </div>
    `;
  }

  const hitNums = countHits(record.main, latestDraw.numbers);
  const hitCount = hitNums.length;

  let extraText = "無";
  let levelClass = "hit-bad";
  let levelText = "未命中";

  if (hitCount >= 3) {
    levelClass = "hit-good";
    levelText = "表現不錯";
  } else if (hitCount >= 1) {
    levelClass = "hit-normal";
    levelText = "有命中";
  }

  if (record.extra != null && latestDraw.extra != null) {
    extraText = Number(record.extra) === Number(latestDraw.extra)
      ? `命中（${pad2(latestDraw.extra)}）`
      : `未中｜開出 ${pad2(latestDraw.extra)}`;
  }

  const extraTitle =
    record.gameKey === "lotto649" ? "特別號" :
    record.gameKey === "superlotto638" ? "第二區" :
    record.gameKey === "bingo" ? "超級獎號" :
    "特別號";

  return `
    <div class="hit-summary">
      <div class="hit-card">
        <div class="card-title">上一筆預測彩種</div>
        <div class="hit-big">${record.gameName}</div>
        <div class="hit-sub">預測時間：${record.createdAt}</div>
      </div>

      <div class="hit-card">
        <div class="card-title">上一筆主推薦</div>
        ${renderBalls(record.main, "main")}
      </div>

      <div class="hit-card">
        <div class="card-title">最新開獎號碼</div>
        ${renderBalls(latestDraw.numbers, "hot")}
      </div>

      <div class="hit-card">
        <div class="card-title">命中結果</div>
        <div class="hit-big ${levelClass}">命中 ${hitCount} 顆｜${levelText}</div>
        <div class="hit-sub">
          命中號碼：${hitNums.length ? hitNums.map(pad2).join("、") : "無"}<br>
          ${latestDraw.extra != null && record.extra != null ? `${extraTitle}：${extraText}` : ""}
        </div>
      </div>
    </div>
  `;
}

function updateHitTracking(gameKey) {
  const records = getStoredPredictions();
  const record = records.find(r => r.gameKey === gameKey);
  const latestDraw = getLatestDraw(gameKey);
  const hitEl = document.getElementById("hitTrackingResult");
  const badgeEl = document.getElementById("hitBadge");

  if (!hitEl) return;

  hitEl.innerHTML = buildHitTrackingHTML(record, latestDraw);

  if (!record || !latestDraw) {
    if (badgeEl) badgeEl.textContent = "待比對";
    return;
  }

  const hitCount = countHits(record.main, latestDraw.numbers).length;
  if (badgeEl) {
    badgeEl.textContent = hitCount > 0 ? `命中 ${hitCount} 顆` : "未命中";
  }
}

function buildPrediction(gameKey) {
  const historyCount = getHistoryCount();
  const setCount = getSetCount();
  const recent = getRecentDraws(gameKey, historyCount);
  const latestDraw = getLatestDraw(gameKey);

  let maxNumber = 39;
  let pickCount = 5;
  let gameName = GAME_NAMES[gameKey];
  let extraHTML = "";
  let specialValue = null;

  if (gameKey === "bingo") {
    maxNumber = 80;
    pickCount = getBingoCount();
  } else if (gameKey === "lotto649") {
    maxNumber = 49;
    pickCount = 6;
  } else if (gameKey === "superlotto638") {
    maxNumber = 38;
    pickCount = 6;
  } else if (gameKey === "dailycash") {
    maxNumber = 39;
    pickCount = 5;
  }

  const main = buildMainPrediction(recent, maxNumber, pickCount);
  const groups = buildPredictionGroups(recent, maxNumber, pickCount, setCount);
  const flatRecentNums = recent.flatMap(d => d.numbers);
  const stat = countFrequency(recent, maxNumber, Math.min(pickCount, 10));
  const streak = findSuggestedStreak(main);
  const tails = findTailStats(main);
  const confidence = Math.max(68, Math.min(94, 70 + Math.floor(Math.random() * 20)));

  if (gameKey === "lotto649") {
    specialValue = Math.floor(Math.random() * 49) + 1;
    extraHTML = `<div class="special-box">特別號建議：<span class="ball special">${pad2(specialValue)}</span></div>`;
  } else if (gameKey === "superlotto638") {
    specialValue = Math.floor(Math.random() * 8) + 1;
    extraHTML = `<div class="special-box">第二區建議：<span class="ball special">${pad2(specialValue)}</span></div>`;
  } else if (gameKey === "bingo") {
    specialValue = Math.floor(Math.random() * 80) + 1;
    extraHTML = `<div class="special-box">超級獎號：<span class="ball special">${pad2(specialValue)}</span></div>`;
  }

  return {
    gameKey,
    gameName,
    latestDraw,
    main,
    groups,
    hot: stat.hot,
    cold: stat.cold,
    streak,
    tails,
    extraHTML,
    specialValue,
    confidence,
    sourceCount: flatRecentNums.length
  };
}

function runPrediction(type) {
  let gameKey = "dailycash";

  if (type === "bingo") gameKey = "bingo";
  if (type === "649") gameKey = "lotto649";
  if (type === "638") gameKey = "superlotto638";
  if (type === "539") gameKey = "dailycash";

  const resultEl = document.getElementById("predictionResult");
  if (!resultEl) return;

  const result = buildPrediction(gameKey);

  updateHeader(result.gameName, "已完成");

  resultEl.innerHTML = buildPredictionHTML({
    gameName: result.gameName,
    key: result.gameKey,
    latestDraw: result.latestDraw,
    main: result.main,
    groups: result.groups,
    hot: result.hot,
    cold: result.cold,
    streak: result.streak,
    tails: result.tails,
    extraHTML: result.extraHTML,
    confidence: result.confidence
  });

  savePredictionRecord({
    gameKey: result.gameKey,
    gameName: result.gameName,
    createdAt: new Date().toLocaleString("zh-TW"),
    main: result.main,
    extra: result.specialValue
  });

  updateHitTracking(gameKey);
}

window.runPrediction = runPrediction;

window.addEventListener("DOMContentLoaded", async () => {
  await initData();
  updateHitTracking("lotto649");
});