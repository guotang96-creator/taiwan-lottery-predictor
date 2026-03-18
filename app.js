const OFFICIAL_LATEST_URL =
  "https://guotang96-creator.github.io/taiwan-lottery-predictor/data/official/latest.json";

let officialLatestData = null;

/* -----------------------------
   基本工具
----------------------------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqueSorted(nums) {
  return [...new Set(nums.map(toNum).filter(n => n > 0))].sort((a, b) => a - b);
}

function pickRandom(arr, count) {
  return shuffle(arr).slice(0, count).sort((a, b) => a - b);
}

function getEl(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = getEl(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = getEl(id);
  if (el) el.innerHTML = html;
}

/* -----------------------------
   官方資料讀取
----------------------------- */
async function loadOfficialLatest() {
  try {
    const res = await fetch(OFFICIAL_LATEST_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data || !data.games) throw new Error("latest.json 格式錯誤");

    officialLatestData = data;
    console.log("✅ latest.json 載入成功", data);
    return data;
  } catch (err) {
    console.error("❌ latest.json 載入失敗", err);
    officialLatestData = null;
    return null;
  }
}

function getGameData(type) {
  if (!officialLatestData || !officialLatestData.games) return [];

  if (type === "bingo") return officialLatestData.games.bingo || [];
  if (type === "649") return officialLatestData.games.lotto649 || [];
  if (type === "638") return officialLatestData.games.superlotto638 || [];
  if (type === "539") return officialLatestData.games.dailycash || [];

  return [];
}

/* -----------------------------
   分析邏輯
----------------------------- */
function analyzeMainZone(records, maxNum, pickCount, historyLimit) {
  const rows = (records || []).slice(0, historyLimit);

  const freq = Array(maxNum + 1).fill(0);

  rows.forEach(row => {
    const nums = uniqueSorted(row.numbers || []);
    nums.forEach(n => {
      if (n >= 1 && n <= maxNum) freq[n]++;
    });
  });

  const allNums = Array.from({ length: maxNum }, (_, i) => i + 1);

  const hot = [...allNums]
    .sort((a, b) => {
      if (freq[b] !== freq[a]) return freq[b] - freq[a];
      return a - b;
    })
    .slice(0, Math.max(pickCount, Math.min(10, maxNum)));

  const cold = [...allNums]
    .sort((a, b) => {
      if (freq[a] !== freq[b]) return freq[a] - freq[b];
      return a - b;
    })
    .slice(0, Math.max(pickCount, Math.min(10, maxNum)));

  const main = hot.slice(0, pickCount).sort((a, b) => a - b);

  return { rows, freq, hot, cold, main };
}

function buildGroupsFromHotCold(hot, cold, setCount, pickCount) {
  const groups = [];
  const basePool = uniqueSorted([...hot, ...cold]);

  for (let i = 0; i < setCount; i++) {
    let pool = shuffle(basePool);
    if (pool.length < pickCount) {
      const extra = Array.from({ length: 80 }, (_, idx) => idx + 1);
      pool = uniqueSorted([...pool, ...extra]);
    }
    groups.push(pool.slice(0, pickCount).sort((a, b) => a - b));
  }

  return groups;
}

function findStreakText(records) {
  if (!records || !records.length) return "目前無官方歷史資料可分析。";

  const sample = records.slice(0, 12);
  const found = [];

  sample.forEach(row => {
    const nums = uniqueSorted(row.numbers || []);
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i + 1] === nums[i] + 1) {
        found.push(`${pad2(nums[i])}-${pad2(nums[i + 1])}`);
      }
    }
  });

  const uniq = [...new Set(found)].slice(0, 6);
  if (!uniq.length) return "近期連號偏少，建議以分散配置為主。";

  return `近期常見連號：${uniq.join("、")}。`;
}

function tailAnalysisText(records) {
  if (!records || !records.length) return "目前無官方歷史資料可分析。";

  const tailCount = Array(10).fill(0);

  records.slice(0, 30).forEach(row => {
    (row.numbers || []).forEach(n => {
      tailCount[n % 10]++;
    });
  });

  const tails = Array.from({ length: 10 }, (_, i) => i)
    .sort((a, b) => tailCount[b] - tailCount[a])
    .slice(0, 4);

  return `近期較活躍尾數：${tails.join("、")}。`;
}

function specialSuggestionText(type, records) {
  if (type === "649") {
    const specials = records
      .map(r => toNum(r.special))
      .filter(n => n > 0);
    const pick = specials.length ? specials[0] : Math.floor(Math.random() * 49) + 1;
    return `<div class="special-box">特別號建議：<span class="ball special">${pad2(pick)}</span></div>`;
  }

  if (type === "638") {
    const zones = records
      .map(r => toNum(r.zone2 || r.second))
      .filter(n => n >= 1 && n <= 8);
    const pick = zones.length ? zones[0] : Math.floor(Math.random() * 8) + 1;
    return `<div class="special-box">第二區建議：<span class="ball special">${pad2(pick)}</span></div>`;
  }

  return "";
}

/* -----------------------------
   最新五期 UI
----------------------------- */
function renderLatestFiveSection(title, records, type) {
  if (!records || !records.length) {
    return `
      <div class="result-card full-width">
        <div class="card-title">最新五期號碼</div>
        <div class="text-block">目前尚無 ${title} 最新五期資料。</div>
      </div>
    `;
  }

  return `
    <div class="result-card full-width">
      <div class="card-title">最新五期號碼</div>
      <div class="latest-five-list">
        ${records.slice(0, 5).map(row => {
          const extraText =
            type === "649" && row.special
              ? `｜特別號 ${pad2(row.special)}`
              : type === "638" && (row.zone2 || row.second)
              ? `｜第二區 ${pad2(row.zone2 || row.second)}`
              : "";

          return `
            <div class="latest-five-item">
              <div class="latest-five-issue">第 ${row.issue} 期${row.date ? `｜${row.date}` : ""}${extraText}</div>
              <div class="ball-row">
                ${(row.numbers || [])
                  .map(n => `<span class="ball">${pad2(n)}</span>`)
                  .join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

/* -----------------------------
   畫面渲染
----------------------------- */
function renderBalls(numbers, type = "") {
  return `
    <div class="ball-row">
      ${numbers.map(n => `<span class="ball ${type}">${pad2(n)}</span>`).join("")}
    </div>
  `;
}

function updateHeader(gameName, badgeText) {
  setText("resultGameName", gameName);
  setText("resultBadge", badgeText);
}

function buildPredictionHTML(config) {
  const {
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
  } = config;

  return `
    <div class="result-grid">
      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${renderBalls(main, "main")}
      </div>

      ${extra ? `
        <div class="result-card">
          <div class="card-title">${type === "649" ? "特別號" : type === "638" ? "第二區" : "附加建議"}</div>
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

      ${renderLatestFiveSection(gameName, latestFive, type)}

      <div class="result-card full-width">
        <div class="card-title">AI 分析摘要</div>
        <div class="text-block">
          ${gameName} 本次預測依據最新五期與近期官方開獎分布，綜合熱冷號、連號、尾數節奏做排序，建議搭配自己的投注習慣交叉參考。
        </div>
      </div>
    </div>
  `;
}

function showEmptyState(message = "請先選擇彩種並開始預測") {
  const resultEl = getEl("predictionResult");
  if (!resultEl) return;

  resultEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <div class="empty-title">尚未預測</div>
      <div class="empty-text">${message}</div>
    </div>
  `;
}

/* -----------------------------
   預測主流程
----------------------------- */
async function runPrediction(type) {
  const resultEl = getEl("predictionResult");
  if (!resultEl) return;

  resultEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">資料分析中</div><div class="empty-text">正在讀取最新官方資料...</div></div>`;

  if (!officialLatestData) {
    await loadOfficialLatest();
  }

  const setCount = parseInt(getEl("setCount")?.value || "3", 10);
  const historyPeriods = parseInt(getEl("historyPeriods")?.value || "50", 10);
  const bingoCount = parseInt(getEl("bingoCount")?.value || "10", 10);

  let gameName = "";
  let maxNum = 0;
  let pickCount = 0;

  if (type === "bingo") {
    gameName = "Bingo Bingo";
    maxNum = 80;
    pickCount = bingoCount;
  } else if (type === "649") {
    gameName = "大樂透";
    maxNum = 49;
    pickCount = 6;
  } else if (type === "638") {
    gameName = "威力彩";
    maxNum = 38;
    pickCount = 6;
  } else if (type === "539") {
    gameName = "今彩 539";
    maxNum = 39;
    pickCount = 5;
  } else {
    showEmptyState("未知彩種");
    return;
  }

  const records = getGameData(type);

  let main = [];
  let hot = [];
  let cold = [];
  let groups = [];
  let streak = "";
  let tails = "";
  let extra = "";

  if (records && records.length) {
    const analysis = analyzeMainZone(records, maxNum, pickCount, historyPeriods);

    hot = analysis.hot;
    cold = analysis.cold;
    main = analysis.main;
    groups = buildGroupsFromHotCold(hot, cold, setCount, pickCount).map(g =>
      g.map(n => (n > maxNum ? ((n - 1) % maxNum) + 1 : n)).sort((a, b) => a - b)
    );

    if (!groups.length) {
      groups = Array.from({ length: setCount }, () =>
        pickRandom(Array.from({ length: maxNum }, (_, i) => i + 1), pickCount)
      );
    }

    streak = findStreakText(records);
    tails = tailAnalysisText(records);
    extra = specialSuggestionText(type, records);
  } else {
    const pool = Array.from({ length: maxNum }, (_, i) => i + 1);
    main = pickRandom(pool, pickCount);
    hot = pickRandom(pool, Math.max(pickCount, 5));
    cold = pickRandom(pool, Math.max(pickCount, 5));
    groups = Array.from({ length: setCount }, () => pickRandom(pool, pickCount));
    streak = "目前尚未讀到官方完整歷史資料，先以示意結果顯示。";
    tails = "目前尚未讀到官方完整歷史資料，尾數分析暫以示意顯示。";
    extra = type === "649"
      ? `<div class="special-box">特別號建議：<span class="ball special">${pad2(Math.floor(Math.random() * 49) + 1)}</span></div>`
      : type === "638"
      ? `<div class="special-box">第二區建議：<span class="ball special">${pad2(Math.floor(Math.random() * 8) + 1)}</span></div>`
      : "";
  }

  updateHeader(gameName, "已完成");

  resultEl.innerHTML = buildPredictionHTML({
    type,
    gameName,
    main,
    groups,
    hot,
    cold,
    streak,
    tails,
    extra,
    latestFive: records.slice(0, 5)
  });
}

/* -----------------------------
   初始化
----------------------------- */
window.runPrediction = runPrediction;

window.addEventListener("DOMContentLoaded", async () => {
  setText("resultGameName", "請先選擇彩種並開始預測");
  setText("resultBadge", "待預測");
  showEmptyState("按上方按鈕後，這裡會顯示主推薦、熱號、冷號、連號、尾數分析與最新五期號碼。");

  await loadOfficialLatest();

  if (!officialLatestData) {
    const resultEl = getEl("predictionResult");
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <div class="empty-title">抓不到 latest.json</div>
          <div class="empty-text">
            目前無法讀取官方最新五期資料，請稍後重整，或確認 GitHub Pages / latest.json 是否已更新。
          </div>
        </div>
      `;
    }
  }
});