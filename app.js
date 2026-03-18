// ===== 工具 =====
function pad2(n) {
  return String(n).padStart(2, "0");
}

// ===== 讀官方最新開獎 =====
async function fetchOfficialResults() {
  try {
    const res = await fetch("data/official/latest.json?_=" + Date.now());
    return await res.json();
  } catch {
    return null;
  }
}

async function getOfficialDraw(type) {
  const data = await fetchOfficialResults();

  const map = {
    bingo: "bingo",
    "649": "lotto649",
    "638": "lotto638",
    "539": "lotto539"
  };

  const key = map[type];
  if (!data || !data[key]) return null;

  return {
    main: data[key].numbers || [],
    special: data[key].special || null
  };
}

// ===== 🔥 讀歷史資料（核心） =====
async function loadHistory(type) {
  try {
    const res = await fetch(`data/extracted/${type}.json?_=${Date.now()}`);
    return await res.json();
  } catch {
    return [];
  }
}

// ===== 🔥 統計熱冷號 =====
function analyzeHotCold(history, maxNumber, take = 6) {
  const freq = Array(maxNumber + 1).fill(0);

  history.forEach(draw => {
    draw.numbers.forEach(n => {
      freq[n]++;
    });
  });

  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1);

  numbers.sort((a, b) => freq[b] - freq[a]);

  const hot = numbers.slice(0, take);
  const cold = numbers.slice(-take);

  return { hot, cold, freq };
}

// ===== 隨機 + 熱號混合 =====
function smartPick(max, count, hot) {
  const result = new Set();

  // 50% 用熱號
  while (result.size < Math.floor(count / 2)) {
    result.add(hot[Math.floor(Math.random() * hot.length)]);
  }

  // 剩下補隨機
  while (result.size < count) {
    result.add(Math.floor(Math.random() * max) + 1);
  }

  return Array.from(result).sort((a, b) => a - b);
}

// ===== 比對 =====
function countHits(a, b) {
  const set = new Set(b);
  return a.filter(x => set.has(x)).length;
}

// ===== 主流程 =====
async function runPrediction(type) {
  const resultEl = document.getElementById("predictionResult");

  resultEl.innerHTML = "⏳ 分析中...";

  // ===== 設定 =====
  const configMap = {
    bingo: { max: 80, count: 10 },
    "649": { max: 49, count: 6 },
    "638": { max: 38, count: 6, specialMax: 8 },
    "539": { max: 39, count: 5 }
  };

  const config = configMap[type];

  // ===== 讀歷史 =====
  const history = await loadHistory(type);

  // ===== 熱冷號 =====
  const { hot, cold } = analyzeHotCold(history, config.max, config.count);

  // ===== 主號 =====
  const main = smartPick(config.max, config.count, hot);

  // ===== 特別號 =====
  let extra = null;
  if (type === "649") extra = Math.floor(Math.random() * 49) + 1;
  if (type === "638") extra = Math.floor(Math.random() * 8) + 1;

  // ===== 官方開獎 =====
  const draw = await getOfficialDraw(type);

  // ===== 比對 =====
  let hit = 0;
  let specialHit = false;

  if (draw) {
    hit = countHits(main, draw.main);

    if (extra && draw.special) {
      specialHit = extra === draw.special;
    }
  }

  // ===== UI =====
  resultEl.innerHTML = `
    <h3>${type} 預測</h3>

    <div>🎯 主號：${main.join(", ")}</div>
    ${extra ? `<div>⭐ 特別號：${extra}</div>` : ""}

    <hr/>

    <div>🔥 熱號：${hot.join(", ")}</div>
    <div>❄️ 冷號：${cold.join(", ")}</div>

    <hr/>

    ${
      draw
        ? `
        <div>📊 官方開獎：${draw.main.join(", ")}</div>
        ${draw.special ? `<div>⭐ 官方特別：${draw.special}</div>` : ""}
        <div>✅ 命中：${hit} 個 ${specialHit ? "+ 特別號中" : ""}</div>
      `
        : `<div>⚠️ 無官方資料</div>`
    }
  `;
}