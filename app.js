const DATA_PATHS = [
  "./data/official/latest.json",
  "./latest.json",
  "./data/latest.json"
];

let OFFICIAL_DATA = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function uniqueRandomNumbers(max, count) {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  const result = [];
  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result.sort((a, b) => a - b);
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("fetchJSON failed:", url, err.message);
    return null;
  }
}

async function loadOfficialData() {
  if (OFFICIAL_DATA) return OFFICIAL_DATA;

  for (const path of DATA_PATHS) {
    const data = await fetchJSON(path);
    if (data) {
      OFFICIAL_DATA = data;
      console.log("官方資料載入成功:", path);
      return OFFICIAL_DATA;
    }
  }

  OFFICIAL_DATA = {};
  console.warn("官方資料載入失敗，全部 fallback");
  return OFFICIAL_DATA;
}

function getGameConfig(type) {
  const map = {
    bingo: {
      keys: ["bingo", "bingo", "bingoBingo"],
      name: "Bingo Bingo",
      max: 80,
      pick: () => parseInt(document.getElementById("bingoCount")?.value || "10", 10),
      specialLabel: "超級獎號"
    },
    "649": {
      keys: ["lotto649", "649", "lotto"],
      name: "大樂透",
      max: 49,
      pick: () => 6,
      specialLabel: "特別號"
    },
    "638": {
      keys: ["superlotto638", "638", "power"],
      name: "威力彩",
      max: 38,
      pick: () => 6,
      secondMax: 8,
      specialLabel: "第二區"
    },
    "539": {
      keys: ["dailycash", "539", "dailycash539"],
      name: "今彩 539",
      max: 39,
      pick: () => 5,
      specialLabel: ""
    }
  };
  return map[type];
}

function normalizeNumberArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(v => Number(v))
    .filter(v => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
}

function pickFirstDefined(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] != null) return obj[key];
  }
  return null;
}

function normalizeDrawRecord(raw, type) {
  if (!raw || typeof raw !== "object") return null;

  const issue =
    raw.issue ||
    raw.period ||
    raw.draw ||
    raw.drawTerm ||
    raw.term ||
    raw.round ||
    raw.no ||
    "";

  const date =
    raw.date ||
    raw.drawDate ||
    raw.openDate ||
    raw.lotteryDate ||
    raw.day ||
    "";

  let numbers =
    raw.numbers ||
    raw.drawNumbers ||
    raw.mainNumbers ||
    raw.num ||
    raw.result ||
    raw.nos ||
    [];

  numbers = normalizeNumberArray(numbers);

  if (!numbers.length) {
    const maybe = [];
    for (let i = 1; i <= 20; i++) {
      const v = raw[`n${i}`] ?? raw[`no${i}`] ?? raw[`num${i}`] ?? raw[`ball${i}`] ?? raw[`m${i}`];
      if (v != null && v !== "") maybe.push(Number(v));
    }
    numbers = normalizeNumberArray(maybe);
  }

  let special =
    raw.special ||
    raw.specialNumber ||
    raw.bonus ||
    raw.bonusNumber ||
    raw.extra ||
    raw.secondArea ||
    raw.zone2 ||
    raw.second ||
    null;

  if (type === "638") {
    special =
      raw.secondArea ||
      raw.zone2 ||
      raw.second ||
      raw.special ||
      raw.specialNumber ||
      null;
  }

  if (special != null && special !== "") {
    special = Number(special);
    if (!Number.isFinite(special)) special = null;
  } else {
    special = null;
  }

  return {
    issue: String(issue || ""),
    date: String(date || ""),
    numbers,
    special
  };
}

function extractDrawListByType(data, type) {
  const cfg = getGameConfig(type);
  if (!cfg) return [];

  let source = null;

  for (const key of cfg.keys) {
    if (data && data[key]) {
      source = data[key];
      break;
    }
  }

  if (!source && data && data.games) {
    for (const key of cfg.keys) {
      if (data.games[key]) {
        source = data.games[key];
        break;
      }
    }
  }

  if (!source) return [];

  let list = [];

  if (Array.isArray(source)) {
    list = source;
  } else if (Array.isArray(source.latest)) {
    list = source.latest;
  } else if (Array.isArray(source.history)) {
    list = source.history;
  } else if (Array.isArray(source.records)) {
    list = source.records;
  } else if (Array.isArray(source.draws)) {
    list = source.draws;
  } else if (Array.isArray(source.data)) {
    list = source.data;
  } else if (Array.isArray(source.items)) {
    list = source.items;
  }

  return list
    .map(item => normalizeDrawRecord(item, type))
    .filter(item => item && item.numbers.length > 0);
}

function renderBalls(numbers, type = "") {
  return `
    <div class="ball-row">
      ${numbers.map(n => `<span class="ball ${type}">${pad2(n)}</span>`).join("")}
    </div>
  `;
}

function renderLatestFive(draws, type) {
  const cfg = getGameConfig(type);

  if (!draws || !draws.length) {
    return `
      <div class="result-card full-width">
        <div class="card-title">最新五期號碼</div>
        <div class="text-block">目前抓不到官方最新資料，請確認 latest.json 是否存在，或 workflow 是否已成功更新。</div>
      </div>
    `;
  }

  const latestFive = draws.slice(0, 5);

  return `
    <div class="result-card full-width">
      <div class="card-title">最新五期號碼</div>
      <div class="latest-five-list">
        ${latestFive.map(draw => `
          <div class="latest-item">
            <div class="latest-meta">
              <span class="latest-issue">第 ${draw.issue || "-"} 期</span>
              <span class="latest-date">${draw.date || "-"}</span>
            </div>
            <div class="latest-balls-wrap">
              ${renderBalls(draw.numbers)}
              ${
                draw.special != null
                  ? `<div class="special-box">${cfg.specialLabel}：<span class="ball special">${pad2(draw.special)}</span></div>`
                  : ""
              }
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function analyzeHotCold(draws, maxNum, takeCount) {
  const freq = new Map();

  for (let i = 1; i <= maxNum; i++) freq.set(i, 0);

  draws.forEach(draw => {
    draw.numbers.forEach(n => {
      if (freq.has(n)) freq.set(n, freq.get(n) + 1);
    });
  });

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const hot = sorted.slice(0, takeCount).map(x => x[0]).sort((a, b) => a - b);
  const cold = sorted.slice(-takeCount).map(x => x[0]).sort((a, b) => a - b);

  return { hot, cold };
}

function analyzeTails(draws) {
  const tails = Array(10).fill(0);
  draws.forEach(draw => {
    draw.numbers.forEach(n => {
      tails[n % 10]++;
    });
  });

  const sorted = tails
    .map((count, tail) => ({ tail, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return sorted.map(x => `尾數 ${x.tail}`).join("、");
}

function analyzeStreak(draws) {
  const latest = draws[0];
  if (!latest || !latest.numbers.length) return "無法分析連號";

  const nums = [...latest.numbers].sort((a, b) => a - b);
  const streaks = [];

  let group = [nums[0]];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) {
      group.push(nums[i]);
    } else {
      if (group.length >= 2) streaks.push([...group]);
      group = [nums[i]];
    }
  }
  if (group.length >= 2) streaks.push([...group]);

  if (!streaks.length) return "近一期未出現明顯連號，建議保留 1 組連號做搭配。";
  return `近一期可留意連號：${streaks.map(g => g.map(pad2).join("-")).join("、")}`;
}

function buildPredictionFromHistory(type, draws) {
  const cfg = getGameConfig(type);
  const pickCount = cfg.pick();
  const setCount = parseInt(document.getElementById("setCount")?.value || "3", 10);
  const historyPeriods = parseInt(document.getElementById("historyPeriods")?.value || "50", 10);

  const usedDraws = draws.slice(0, historyPeriods);
  const { hot, cold } = analyzeHotCold(usedDraws, cfg.max, pickCount);
  const tails = analyzeTails(usedDraws);
  const streak = analyzeStreak(usedDraws);

  const basePool = [...new Set([...hot, ...uniqueRandomNumbers(cfg.max, pickCount * 2)])]
    .filter(n => n >= 1 && n <= cfg.max);

  while (basePool.length < pickCount * 2) {
    const n = Math.floor(Math.random() * cfg.max) + 1;
    if (!basePool.includes(n)) basePool.push(n);
  }

  const main = [...basePool]
    .sort(() => Math.random() - 0.5)
    .slice(0, pickCount)
    .sort((a, b) => a - b);

  const groups = Array.from({ length: setCount }, () => uniqueRandomNumbers(cfg.max, pickCount));

  let extra = "";
  if (type === "638") {
    const second = Math.floor(Math.random() * 8) + 1;
    extra = `<div class="special-box">第二區建議：<span class="ball special">${pad2(second)}</span></div>`;
  } else if (type === "649") {
    const special = Math.floor(Math.random() * 49) + 1;
    extra = `<div class="special-box">特別號參考：<span class="ball special">${pad2(special)}</span></div>`;
  }

  return {
    gameName: cfg.name,
    main,
    groups,
    hot,
    cold,
    streak,
    tails,
    extra,
    latestFiveHTML: renderLatestFive(draws, type)
  };
}

function buildFallbackPrediction(type) {
  const cfg = getGameConfig(type);
  const pickCount = cfg.pick();
  const setCount = parseInt(document.getElementById("setCount")?.value || "3", 10);

  let extra = "";
  if (type === "638") {
    extra = `<div class="special-box">第二區建議：<span class="ball special">${pad2(uniqueRandomNumbers(8, 1)[0])}</span></div>`;
  } else if (type === "649") {
    extra = `<div class="special-box">特別號參考：<span class="ball special">${pad2(uniqueRandomNumbers(49, 1)[0])}</span></div>`;
  }

  return {
    gameName: cfg.name,
    main: uniqueRandomNumbers(cfg.max, pickCount),
    groups: Array.from({ length: setCount }, () => uniqueRandomNumbers(cfg.max, pickCount)),
    hot: uniqueRandomNumbers(cfg.max, pickCount),
    cold: uniqueRandomNumbers(cfg.max, pickCount),
    streak: "目前無官方歷史資料，先以隨機示意顯示。",
    tails: "目前無官方歷史資料，尾數分析暫不可用。",
    extra,
    latestFiveHTML: `
      <div class="result-card full-width">
        <div class="card-title">最新五期號碼</div>
        <div class="text-block">尚未讀到官方 latest.json，請確認 GitHub Actions 已更新成功。</div>
      </div>
    `
  };
}

function buildPredictionHTML(config) {
  const { gameName, main, groups, hot, cold, streak, tails, extra, latestFiveHTML } = config;

  return `
    <div class="result-grid">
      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${renderBalls(main, "main")}
      </div>

      ${
        extra
          ? `<div class="result-card">
              <div class="card-title">特別區資訊</div>
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

      ${latestFiveHTML}

      <div class="result-card full-width">
        <div class="card-title">AI 分析摘要</div>
        <div class="text-block">
          ${gameName} 本次預測已依據近期官方資料、熱冷分布、連號與尾數節奏做綜合排序，建議搭配自己的習慣做交叉參考。
        </div>
      </div>
    </div>
  `;
}

function updateHeader(gameName, badgeText) {
  const titleEl = document.getElementById("resultGameName");
  const badgeEl = document.getElementById("resultBadge");
  if (titleEl) titleEl.textContent = gameName;
  if (badgeEl) badgeEl.textContent = badgeText;
}

async function runPrediction(type) {
  const resultEl = document.getElementById("predictionResult");
  if (!resultEl) return;

  resultEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <div class="empty-title">資料分析中</div>
      <div class="empty-text">正在讀取官方資料與整理最新五期號碼…</div>
    </div>
  `;

  const cfg = getGameConfig(type);
  updateHeader(cfg.name, "分析中");

  const data = await loadOfficialData();
  const draws = extractDrawListByType(data, type);

  let config;
  if (draws.length > 0) {
    config = buildPredictionFromHistory(type, draws);
    updateHeader(cfg.name, "已完成");
  } else {
    config = buildFallbackPrediction(type);
    updateHeader(cfg.name, "無官方資料");
  }

  resultEl.innerHTML = buildPredictionHTML(config);
}

window.runPrediction = runPrediction;