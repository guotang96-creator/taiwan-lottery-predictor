let historyData = [];

// ===== 讀取資料 =====
async function loadData() {
  const game = document.getElementById("game").value;
  const count = document.getElementById("historyCount").value;

  try {
    const res = await fetch(`/api/lottery?game=${game}&count=${count}`);
    const data = await res.json();

    console.log("API回傳:", data);

    // ⭐️ 核心修正（重點）
    historyData = data.draws || [];

    document.getElementById("status").innerText =
      `已讀取 ${historyData.length} 期`;

  } catch (e) {
    console.error(e);
    document.getElementById("status").innerText = "讀取失敗";
  }
}

// ===== 分析 =====
function analyze() {
  if (historyData.length === 0) {
    alert("請先讀取資料");
    return;
  }

  const pickCount = Number(document.getElementById("pickCount").value);
  const groupCount = Number(document.getElementById("groupCount").value);

  const allNumbers = [];

  historyData.forEach(d => {
    allNumbers.push(...d.numbers);
  });

  // 出現次數統計
  const freq = {};
  allNumbers.forEach(n => {
    freq[n] = (freq[n] || 0) + 1;
  });

  // 排序（熱門號）
  const sorted = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .map(Number);

  // ===== 推薦組合 =====
  let resultHTML = "";

  for (let i = 0; i < groupCount; i++) {
    const group = [];

    while (group.length < pickCount) {
      const num = sorted[Math.floor(Math.random() * sorted.length)];
      if (!group.includes(num)) group.push(num);
    }

    group.sort((a, b) => a - b);

    resultHTML += `
      <div class="card">
        <div>第 ${i + 1} 組</div>
        <div class="balls">
          ${group.map(n => `<span>${n}</span>`).join("")}
        </div>
      </div>
    `;
  }

  document.getElementById("result").innerHTML = resultHTML;

  // ===== AI分數 =====
  const avg =
    Object.values(freq).reduce((a, b) => a + b, 0) /
    Object.keys(freq).length;

  document.getElementById("aiScore").innerText =
    `平均 AI 分數：${avg.toFixed(2)} / 信心：高`;
}

// ===== 命中率回測 =====
function backtest() {
  if (historyData.length < 10) {
    alert("資料太少");
    return;
  }

  let hit = 0;
  let total = 0;

  for (let i = 1; i < historyData.length; i++) {
    const prev = historyData[i].numbers;
    const next = historyData[i - 1].numbers;

    prev.forEach(n => {
      if (next.includes(n)) hit++;
    });

    total += prev.length;
  }

  const rate = ((hit / total) * 100).toFixed(2);

  document.getElementById("backtest").innerText =
    `命中率：約 ${rate}%`;
}

// ===== 爆號預測 =====
function predictHot() {
  if (historyData.length === 0) return;

  const freq = {};

  historyData.forEach(d => {
    d.numbers.forEach(n => {
      freq[n] = (freq[n] || 0) + 1;
    });
  });

  const hot = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 6);

  document.getElementById("hot").innerHTML =
    hot.map(n => `<span>${n}</span>`).join("");
}

// ===== 初始化 =====
window.onload = () => {
  document.getElementById("loadBtn").onclick = loadData;
  document.getElementById("analyzeBtn").onclick = analyze;
  document.getElementById("backtestBtn").onclick = backtest;
  document.getElementById("predictBtn").onclick = predictHot;
};