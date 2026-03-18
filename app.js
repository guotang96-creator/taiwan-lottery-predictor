const DATA_CANDIDATE_BASES = [
  "./data/official",
  "/data/official",
  "https://guotang96-creator.github.io/taiwan-lottery-predictor/data/official"
];

const GAME_CONFIG = {
  bingo: {
    name: "Bingo Bingo",
    latestKey: "bingo",
    file: "bingo.json",
    max: 80,
    pickDefault: () => parseInt(document.getElementById("bingoCount").value, 10) || 10
  },
  "649": {
    name: "大樂透",
    latestKey: "lotto649",
    file: "lotto649.json",
    max: 49,
    pickDefault: () => 6
  },
  "638": {
    name: "威力彩",
    latestKey: "superlotto638",
    file: "superlotto638.json",
    max: 38,
    pickDefault: () => 6
  },
  "539": {
    name: "今彩 539",
    latestKey: "dailycash",
    file: "dailycash.json",
    max: 39,
    pickDefault: () => 5
  }
};

const cacheStore = {
  baseUrl: null,
  latest: null,
  history: {}
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function uniqSorted(arr) {
  return [...new Set(arr.map(Number).filter(n => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
}

function setHeader(gameName, badgeText) {
  const titleEl = document.getElementById("resultGameName");
  const badgeEl = document.getElementById("resultBadge");
  if (titleEl) titleEl.textContent = gameName;
  if (badgeEl) badgeEl.textContent = badgeText;
}

function renderBalls(numbers, cls = "") {
  return `
    <div class="ball-row">
      ${numbers.map(n => `<span class="ball ${cls}">${pad2(n)}</span>`).join("")}
    </div>
  `;
}

function showLoading(text = "資料分析中，請稍候...") {
  const resultEl = document.getElementById("predictionResult");
  if (!resultEl) return;
  resultEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <div class="empty-title">載入中</div>
      <div class="empty-text">${text}</div>
    </div>
  `;
}

function showError(text = "資料讀取失敗") {
  const resultEl = document.getElementById("predictionResult");
  if (!resultEl) return;
  resultEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">❌</div>
      <div class="empty-title">發生錯誤</div>
      <div class="empty-text">${text}</div>
    </div>
  `;
}

async function tryFetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function detectWorkingBaseUrl() {
  if (cacheStore.baseUrl) return cacheStore.baseUrl;

  const logs = [];

  for (const base of DATA_CANDIDATE_BASES) {
    const testUrl = `${base}/latest.json`;
    try {
      const data = await tryFetchJson(testUrl);
      if (data && data.games) {
        cacheStore.baseUrl = base;
        console.log("✅ 使用資料路徑:", base);
        return base;
      }
      logs.push(`路徑可連但格式不符: ${testUrl}`);
    } catch (err) {
      logs.push(`失敗: ${testUrl} -> ${err.message}`);
    }
  }

  console.error("❌ 全部資料路徑都失敗", logs);
  throw new Error(`找不到可用資料路徑：\n${logs.join("\n")}`);
}

async function fetchFromBase(fileName) {
  const base = await detectWorkingBaseUrl();
  return tryFetchJson(`${base}/${fileName}`);
}

async function loadLatestJson() {
  if (cacheStore.latest) return cacheStore.latest;
  const data = await fetchFromBase("latest.json");
  cacheStore.latest = data;
  return data;
}

async function loadHistoryJson(type) {
  if (cacheStore.history[type]) return cacheStore.history[type];
  const config = GAME_CONFIG[type];
  const data = await fetchFromBase(config.file);
  cacheStore.history[type] = Array.isArray(data) ? data : [];
  return cacheStore.history[type];
}

function normalizeHistoryRow(row) {
  const numbers = uniqSorted(row.numbers || []);
  return {
    issue: row.issue ? String(row.issue) : "",
    date: row.date || "",
    numbers,
    special: row.special ?? null,
    zone2: row.zone2 ?? row.second ?? null
  };
}

function normalizeHistoryRows(rows) {
  return (rows || [])
    .map(normalizeHistoryRow)
    .filter(r => r.issue && r.numbers.length > 0);
}

function getLatestRows(type, latestJson) {
  const key = GAME_CONFIG[type].latestKey;
  const rows = latestJson?.games?.[key];
  return Array.isArray(rows) ? rows.map(normalizeHistoryRow) : [];
}

function countFrequencies(rows, max) {
  const freq = Array(max + 1).fill(0);
  rows.forEach(row => {
    row.numbers.forEach(n => {
      if (n >= 1 && n <= max) freq[n] += 1;
    });
  });
  return freq;
}

function pickHotNumbers(freq, count, max) {
  return Array.from({ length: max }, (_, i) => i + 1)
    .sort((a, b) => {
      if (freq[b] !== freq[a]) return freq[b] - freq[a];
      return a - b;
    })
    .slice(0, count);
}

function pickColdNumbers(freq, count, max) {
  return Array.from({ length: max }, (_, i) => i + 1)
    .sort((a, b) => {
      if (freq[a] !== freq[b]) return freq[a] - freq[b];
      return a - b;
    })
    .slice(0, count);
}

function buildMainPrediction(hot, cold, pickCount) {
  const hotNeed = Math.ceil(pickCount * 0.7);
  const coldNeed = pickCount - hotNeed;
  return uniqSorted([...hot.slice(0, hotNeed), ...cold.slice(0, coldNeed)]).slice(0, pickCount);
}

function rotateArray(arr, step) {
  const len = arr.length;
  if (!len) return [];
  const s = step % len;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

function buildGroups(hot, cold, setCount, pickCount, max) {
  const pool = uniqSorted([...hot, ...cold, ...Array.from({ length: max }, (_, i) => i + 1)]);
  const groups = [];
  for (let i = 0; i < setCount; i++) {
    const rotated = rotateArray(pool, i * 3);
    groups.push(rotated.slice(0, pickCount).sort((a, b) => a - b));
  }
  return groups;
}

function analyzeStreak(rows) {
  const map = new Map();

  rows.forEach(row => {
    const nums = row.numbers;
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i + 1] === nums[i] + 1) {
        const key = `${pad2(nums[i])}-${pad2(nums[i + 1])}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
  });

  const result = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k}（${v}次）`);

  return result.length ? `近期常見連號：${result.join("、")}` : "近期連號偏少，建議分散配置。";
}

function analyzeTails(rows) {
  const tails = Array(10).fill(0);

  rows.forEach(row => {
    row.numbers.forEach(n => {
      tails[n % 10] += 1;
    });
  });

  const top = Array.from({ length: 10 }, (_, i) => i)
    .sort((a, b) => tails[b] - tails[a])
    .slice(0, 4);

  return `近期較活躍尾數：${top.join("、")}`;
}

function analyzeSpecial(type, rows) {
  if (type === "649") {
    const vals = rows.map(r => Number(r.special)).filter(n => Number.isFinite(n) && n > 0);
    if (!vals.length) return "";
    return `<div class="special-box">特別號建議：<span class="ball special">${pad2(vals[0])}</span></div>`;
  }

  if (type === "638") {
    const vals = rows.map(r => Number(r.zone2)).filter(n => Number.isFinite(n) && n > 0);
    if (!vals.length) return "";
    return `<div class="special-box">第二區建議：<span class="ball special">${pad2(vals[0])}</span></div>`;
  }

  return "";
}

function renderLatestFive(type, rows) {
  if (!rows.length) {
    return `
      <div class="result-card full-width">
        <div class="card-title">最新五期號碼</div>
        <div class="text-block">目前沒有最新五期資料。</div>
      </div>
    `;
  }

  return `
    <div class="result-card full-width">
      <div class="card-title">最新五期號碼</div>
      <div class="latest-five-list">
        ${rows.slice(0, 5).map(row => {
          let extra = "";

          if (type === "649" && row.special) {
            extra = `｜特別號 ${pad2(row.special)}`;
          } else if (type === "638" && row.zone2) {
            extra = `｜第二區 ${pad2(row.zone2)}`;
          }

          return `
            <div class="latest-five-item">
              <div class="latest-five-issue">
                第 ${row.issue} 期${row.date ? `｜${row.date}` : ""}${extra}
              </div>
              ${renderBalls(row.numbers)}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function buildResultHtml({
  type,
  gameName,
  main,
  groups,
  hot,
  cold,
  streak,
  tails,
  extra,
  latestFive
}) {
  return `
    <div class="result-grid">
      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${renderBalls(main, "main")}
      </div>

      ${extra ? `
      <div class="result-card">
        <div class="card-title">${type === "649" ? "特別號" : "第二區"}</div>
        ${extra}
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
        ${renderBalls(hot.slice(0, main.length), "hot")}
      </div>

      <div class="result-card">
        <div class="card-title">冷號參考</div>
        ${renderBalls(cold.slice(0, main.length), "cold")}
      </div>

      <div class="result-card">
        <div class="card-title">連號偵測</div>
        <div class="text-block">${streak}</div>
      </div>

      <div class="result-card">
        <div class="card-title">尾數分析</div>
        <div class="text-block">${tails}</div>
      </div>

      ${renderLatestFive(type, latestFive)}

      <div class="result-card full-width">
        <div class="card-title">AI 分析摘要</div>
        <div class="text-block">
          ${gameName} 本次預測依據官方歷史資料與最新五期真實開獎結果，綜合熱號、冷號、連號與尾數節奏進行排序，建議搭配自己的習慣交叉參考。
        </div>
      </div>
    </div>
  `;
}

async function runPrediction(type) {
  const config = GAME_CONFIG[type];
  const resultEl = document.getElementById("predictionResult");
  const setCount = parseInt(document.getElementById("setCount").value, 10) || 3;
  const historyPeriods = parseInt(document.getElementById("historyPeriods").value, 10) || 50;
  const pickCount = config.pickDefault();

  setHeader(config.name, "分析中");
  showLoading(`正在讀取 ${config.name} 官方資料...`);

  try {
    const [latestJson, historyRaw] = await Promise.all([
      loadLatestJson(),
      loadHistoryJson(type)
    ]);

    const latestRows = getLatestRows(type, latestJson);
    const historyRows = normalizeHistoryRows(historyRaw).sort((a, b) => String(b.issue).localeCompare(String(a.issue)));

    const analysisRows = historyRows.slice(0, historyPeriods);
    const freq = countFrequencies(analysisRows, config.max);

    const hot = pickHotNumbers(freq, Math.max(pickCount, 10), config.max);
    const cold = pickColdNumbers(freq, Math.max(pickCount, 10), config.max);
    const main = buildMainPrediction(hot, cold, pickCount);
    const groups = buildGroups(hot, cold, setCount, pickCount, config.max);
    const streak = analyzeStreak(analysisRows);
    const tails = analyzeTails(analysisRows);
    const extra = analyzeSpecial(type, latestRows.length ? latestRows : analysisRows);

    setHeader(config.name, "已完成");

    resultEl.innerHTML = buildResultHtml({
      type,
      gameName: config.name,
      main,
      groups,
      hot,
      cold,
      streak,
      tails,
      extra,
      latestFive: latestRows
    });
  } catch (err) {
    console.error(err);
    setHeader(config.name, "失敗");
    showError(`讀取 ${config.name} 官方資料失敗。請確認 latest.json 與各彩種 json 已部署成功。`);
  }
}

window.runPrediction = runPrediction;

window.addEventListener("DOMContentLoaded", async () => {
  setHeader("請先選擇彩種並開始預測", "待預測");

  try {
    const base = await detectWorkingBaseUrl();
    console.log("目前使用資料來源:", base);
  } catch (err) {
    console.error(err);
  }
});