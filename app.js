let currentData = [];

const gameEl = document.getElementById("game");
const historyCountEl = document.getElementById("historyCount");
const bingoPickCountEl = document.getElementById("bingoPickCount");
const groupCountEl = document.getElementById("groupCount");
const birthdayEl = document.getElementById("birthday");
const modeEl = document.getElementById("mode");

const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const confidenceBoxEl = document.getElementById("confidenceBox");
const burstBoxEl = document.getElementById("burstBox");
const trendBoxEl = document.getElementById("trendBox");

const hitPredictBoxEl = document.getElementById("hitPredictBox");
const bestComboBoxEl = document.getElementById("bestComboBox");
const fusionBoxEl = document.getElementById("fusionBox");

document.getElementById("loadBtn").onclick = loadData;
document.getElementById("analyzeBtn").onclick = analyzeData;

async function loadData() {
  statusEl.textContent = "讀取中...";

  const res = await fetch(`/api/lottery?game=${gameEl.value}&count=${historyCountEl.value}`);
  const data = await res.json();

  currentData = data.draws || [];

  statusEl.textContent = `已讀取 ${currentData.length} 期`;
}

function analyzeData() {
  if (!currentData.length) {
    statusEl.textContent = "請先讀資料";
    return;
  }

  const config = getConfig();
  const freq = buildFreq();
  const aiRank = buildAI(freq);

  const confidence = calcConfidence(aiRank, config);
  const burst = buildBurst(aiRank);
  const trend = currentData.slice(0, 5);

  const bestCombo = aiRank.slice(0, config.pick).map(v => v.n);
  const fusion = [...new Set([...bestCombo, ...burst.map(v => v.n)])].slice(0, config.pick);
  const hitPredict = calcHit(confidence);

  renderMain(aiRank, config);
  renderConfidence(confidence);
  renderBurst(burst);
  renderTrend(trend);

  renderHit(hitPredict);
  renderBest(bestCombo);
  renderFusion(fusion);

  statusEl.textContent = "分析完成";
}

/* ===================== 核心 ===================== */

function getConfig() {
  const game = gameEl.value;
  if (game === "bingo") return { max: 80, pick: Number(bingoPickCountEl.value) };
  if (game === "lotto") return { max: 49, pick: 6 };
  if (game === "power") return { max: 38, pick: 6 };
  return { max: 39, pick: 5 };
}

function buildFreq() {
  const map = {};
  currentData.forEach(d => {
    d.numbers.forEach(n => {
      map[n] = (map[n] || 0) + 1;
    });
  });
  return map;
}

function buildAI(freq) {
  return Object.entries(freq)
    .map(([n, c]) => ({
      n: Number(n),
      score: c + Math.random() * 5
    }))
    .sort((a, b) => b.score - a.score);
}

function calcConfidence(aiRank, config) {
  const avg = aiRank.slice(0, config.pick).reduce((s, v) => s + v.score, 0) / config.pick;
  return {
    avg: avg.toFixed(2),
    level: avg > 20 ? "高" : avg > 10 ? "中" : "低"
  };
}

function buildBurst(aiRank) {
  return aiRank.slice(5, 11);
}

function calcHit(conf) {
  const v = Number(conf.avg);
  if (v > 20) return "預估中 2~3 顆";
  if (v > 10) return "預估中 1~2 顆";
  return "預估中 1 顆";
}

/* ===================== UI ===================== */

function renderMain(aiRank, config) {
  const groups = Number(groupCountEl.value);
  let html = "";

  for (let g = 0; g < groups; g++) {
    const pick = aiRank.slice(g, g + config.pick).map(v => v.n).sort((a, b) => a - b);

    html += `
    <div class="group-box">
      <div>第 ${g + 1} 組</div>
      <div class="num-list">
        ${pick.map(n => ball(n)).join("")}
      </div>
    </div>`;
  }

  resultEl.innerHTML = html;
}

function renderConfidence(c) {
  confidenceBoxEl.innerHTML = `
  平均 AI 分數：${c.avg}<br>
  信心等級：${c.level}`;
}

function renderBurst(list) {
  burstBoxEl.innerHTML = list.map(v => ball(v.n, "gold")).join("");
}

function renderTrend(list) {
  trendBoxEl.innerHTML = list.map((d, i) =>
    `${d.date} 第${i + 1}筆`
  ).join("<br>");
}

/* 🔥 這三個就是你剛剛壞掉的 */

function renderHit(text) {
  if (!hitPredictBoxEl) return;
  hitPredictBoxEl.innerHTML = text;
}

function renderBest(combo) {
  if (!bestComboBoxEl) return;
  bestComboBoxEl.innerHTML = combo.map(n => ball(n)).join("");
}

function renderFusion(list) {
  if (!fusionBoxEl) return;
  fusionBoxEl.innerHTML = list.map(n => ball(n, "gold")).join("");
}

/* ===================== UI helper ===================== */

function ball(n, cls = "") {
  return `<span class="ball ${cls}">${String(n).padStart(2, "0")}</span>`;
}