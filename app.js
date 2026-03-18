const DATA_PATHS = {
  bingo: "data/official/bingo.json",
  "649": "data/official/lotto649.json",
  "638": "data/official/superlotto638.json",
  "539": "data/official/dailycash.json"
};

let cachedData = {};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function normalizeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function getHistoryPeriods() {
  const el = document.getElementById("historyPeriods");
  return el ? parseInt(el.value, 10) || 50 : 50;
}

function getSetCount() {
  const el = document.getElementById("setCount");
  return el ? parseInt(el.value, 10) || 3 : 3;
}

function getBingoCount() {
  const el = document.getElementById("bingoCount");
  return el ? parseInt(el.value, 10) || 10 : 10;
}

async function fetchGameData(type) {
  if (cachedData[type]) return cachedData[type];

  const path = DATA_PATHS[type];
  if (!path) return [];

  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    cachedData[type] = Array.isArray(json) ? json : [];
    return cachedData[type];
  } catch (err) {
    console.error("讀取資料失敗:", type, err);
    cachedData[type] = [];
    return [];
  }
}

function pickFields(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

function extractNumbersFromRow(row, maxMain, mode) {
  const result = [];

  if (mode === "bingo") {
    for (let i = 1; i <= 20; i++) {
      const val = pickFields(row, [
        `獎號${i}`,
        `號碼${i}`,
        `num${i}`,
        `${i}`
      ]);
      const num = normalizeNumber(val);
      if (num !== null && num >= 1 && num <= 80) result.push(num);
    }
    return result;
  }

  for (let i = 1; i <= maxMain; i++) {
    const val = pickFields(row, [
      `獎號${i}`,
      `號碼${i}`,
      `num${i}`,
      `${i}`
    ]);
    const num = normalizeNumber(val);
    if (num !== null) result.push(num);
  }

  return result;
}

function extractSpecialNumber(row, type) {
  if (type === "649") {
    return normalizeNumber(
      pickFields(row, ["特別號", "特別號碼", "special", "specialNumber"])
    );
  }

  if (type === "638") {
    return normalizeNumber(
      pickFields(row, ["第二區", "第二區號", "special", "zone2", "second"])
    );
  }

  return null;
}

function getGameConfig(type) {
  if (type === "bingo") {
    return { name: "Bingo Bingo", max: 80, count: getBingoCount(), mode: "bingo" };
  }
  if (type === "649") {
    return { name: "大樂透", max: 49, count: 6, mode: "normal" };
  }
  if (type === "638") {
    return { name: "威力彩", max: 38, count: 6, mode: "normal" };
  }
  return { name: "今彩 539", max: 39, count: 5, mode: "normal" };
}

function buildFrequencyMap(draws, max) {
  const freq = new Map();
  for (let i = 1; i <= max; i++) freq.set(i, 0);

  draws.forEach(arr => {
    arr.forEach(n => {
      if (freq.has(n)) freq.set(n, freq.get(n) + 1);
    });
  });

  return freq;
}

function sortByHot(freqMap) {
  return [...freqMap.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] - b[0];
    })
    .map(x => x[0]);
}

function sortByCold(freqMap) {
  return [...freqMap.entries()]
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0] - b[0];
    })
    .map(x => x[0]);
}

function buildMainPrediction(hotList, coldList, count, max) {
  const result = [];
  const used = new Set();

  const hotTake = Math.max(2, Math.ceil(count * 0.6));
  const coldTake = Math.max(1, count - hotTake);

  for (const n of hotList) {
    if (!used.has(n)) {
      result.push(n);
      used.add(n);
    }
    if (result.length >= hotTake) break;
  }

  for (const n of coldList) {
    if (!used.has(n)) {
      result.push(n);
      used.add(n);
    }
    if (result.length >= hotTake + coldTake) break;
  }

  for (let i = 1; i <= max; i++) {
    if (!used.has(i)) {
      result.push(i);
      used.add(i);
    }
    if (result.length >= count) break;
  }

  return result.sort((a, b) => a - b).slice(0, count);
}

function rotateRecommendation(source, offset, count) {
  const out = [];
  const used = new Set();
  for (let i = 0; i < source.length; i++) {
    const n = source[(i + offset) % source.length];
    if (!used.has(n)) {
      out.push(n);
      used.add(n);
    }
    if (out.length >= count) break;
  }
  return out.sort((a, b) => a - b);
}

function buildGroupPredictions(hotList, coldList, setCount, count) {
  const combined = [...hotList.slice(0, Math.max(count * 3, 15)), ...coldList.slice(0, Math.max(count * 2, 10))];
  const uniq = [...new Set(combined)];
  const groups = [];

  for (let i = 0; i < setCount; i++) {
    groups.push(rotateRecommendation(uniq, i * 2, count));
  }

  return groups;
}

function analyzeStreak(draws) {
  let found = [];

  for (const draw of draws.slice(0, 20)) {
    const sorted = [...draw].sort((a, b) => a - b);
    let temp = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) {
        temp.push(sorted[i]);
      } else {
        if (temp.length >= 2) found.push([...temp]);
        temp = [sorted[i]];
      }
    }
    if (temp.length >= 2) found.push([...temp]);
  }

  if (!found.length) return "近期連號偏少，建議保留 1 組輕連號配置。";

  const top = found
    .slice(0, 3)
    .map(g => g.map(pad2).join("-"))
    .join("、");

  return `近期常見連號：${top}`;
}

function analyzeTails(draws) {
  const tailFreq = new Map();
  for (let i = 0; i <= 9; i++) tailFreq.set(i, 0);

  draws.forEach(draw => {
    draw.forEach(n => {
      tailFreq.set(n % 10, tailFreq.get(n % 10) + 1);
    });
  });

  const top = [...tailFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(x => x[0]);

  return `熱門尾數：${top.join("、")}`;
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

function buildPredictionHTML(config) {
  const { gameName, main, groups, hot, cold, streak, tails, extra, lastDrawText } = config;

  return `
    <div class="result-grid">
      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${renderBalls(main, "main")}
      </div>

      ${
        extra
          ? `<div class="result-card">
              <div class="card-title">特別區 / 第二區</div>
              ${extra}
            </div>`
          : ""
      }

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
        <div class="card-title">最新一期參考</div>
        <div class="text-block">${lastDrawText}</div>
      </div>
    </div>
  `;
}

async function runPrediction(type) {
  const resultEl = document.getElementById("predictionResult");
  if (!resultEl) return;

  const config = getGameConfig(type);
  updateHeader(config.name, "分析中...");
  resultEl.innerHTML = `<div class="empty-state"><div class="empty-title">資料分析中...</div></div>`;

  const raw = await fetchGameData(type);
  const periods = getHistoryPeriods();
  const setCount = getSetCount();

  if (!raw.length) {
    updateHeader(config.name, "無資料");
    resultEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">找不到資料</div>
        <div class="empty-text">請確認 data/official 對應的 json 檔案是否存在且內容正確。</div>
      </div>
    `;
    return;
  }

  const rows = raw.slice(0, periods);

  const draws = rows
    .map(row => extractNumbersFromRow(row, config.count, config.mode))
    .filter(arr => Array.isArray(arr) && arr.length >= config.count);

  if (!draws.length) {
    updateHeader(config.name, "格式錯誤");
    resultEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">資料格式無法解析</div>
        <div class="empty-text">目前 json 已讀到，但欄位格式和預測程式不相容。</div>
      </div>
    `;
    return;
  }

  const freqMap = buildFrequencyMap(draws, config.max);
  const hotList = sortByHot(freqMap);
  const coldList = sortByCold(freqMap);

  const main = buildMainPrediction(hotList, coldList, config.count, config.max);
  const groups = buildGroupPredictions(hotList, coldList, setCount, config.count);
  const hot = hotList.slice(0, config.count);
  const cold = coldList.slice(0, config.count);

  const latestRow = rows[0];
  const latestDraw = draws[0];
  const latestDate = pickFields(latestRow, ["開獎日期", "date", "drawDate"]) || "未知日期";

  let extra = "";
  let lastDrawText = `${latestDate}｜${latestDraw.map(pad2).join(", ")}`;

  if (type === "649") {
    const sp = extractSpecialNumber(latestRow, type);
    const suggestSp = hotList.find(n => !main.includes(n)) || 1;
    extra = `<div class="special-box">特別號建議：<span class="ball special">${pad2((suggestSp % 49) || 1)}</span></div>`;
    if (sp !== null) lastDrawText += `｜特別號：${pad2(sp)}`;
  }

  if (type === "638") {
    const sp = extractSpecialNumber(latestRow, type);
    const zone2 = sp !== null ? sp : Math.max(1, ((main[0] + main[1]) % 8) || 1);
    extra = `<div class="special-box">第二區建議：<span class="ball special">${pad2(zone2)}</span></div>`;
    if (sp !== null) lastDrawText += `｜第二區：${pad2(sp)}`;
  }

  updateHeader(config.name, "已完成");
  resultEl.innerHTML = buildPredictionHTML({
    gameName: config.name,
    main,
    groups,
    hot,
    cold,
    streak: analyzeStreak(draws),
    tails: analyzeTails(draws),
    extra,
    lastDrawText
  });
}