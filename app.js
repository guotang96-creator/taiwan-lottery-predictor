let currentGame = "bingo";
let currentData = [];

const tabs = document.querySelectorAll(".tab");
const statusEl = document.getElementById("status");
const loadBtn = document.getElementById("loadBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const battleBtn = document.getElementById("battleBtn");
const historyCountEl = document.getElementById("historyCount");
const bingoPickCountEl = document.getElementById("bingoPickCount");
const bingoPickWrap = document.getElementById("bingoPickWrap");

const predictionsEl = document.getElementById("predictions");
const frequencyEl = document.getElementById("frequency");
const dragAnalysisEl = document.getElementById("dragAnalysis");
const tailAnalysisEl = document.getElementById("tailAnalysis");
const latestDrawsEl = document.getElementById("latestDraws");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentGame = tab.dataset.game;
    bingoPickWrap.style.display = currentGame === "bingo" ? "flex" : "none";
    clearPanels();
  });
});

loadBtn.addEventListener("click", loadData);
analyzeBtn.addEventListener("click", analyzeData);
battleBtn.addEventListener("click", goBattle);

function clearPanels() {
  currentData = [];
  statusEl.textContent = "請先讀取資料";
  predictionsEl.innerHTML = "";
  frequencyEl.innerHTML = "";
  dragAnalysisEl.innerHTML = "";
  tailAnalysisEl.innerHTML = "";
  latestDrawsEl.innerHTML = "";
}

async function loadData() {
  try {
    statusEl.textContent = "資料讀取中...";
    const historyCount = Number(historyCountEl.value);
    const res = await fetch(`/api/fetch-lottery?game=${currentGame}&count=${historyCount}`);
    const data = await res.json();
    currentData = data.draws || [];
    renderLatestDraws(currentData);
    statusEl.textContent = `讀取完成，共 ${currentData.length} 期`;
  } catch (err) {
    statusEl.textContent = "讀取失敗，請稍後再試";
    console.error(err);
  }
}

function analyzeData() {
  if (!currentData.length) {
    statusEl.textContent = "請先讀取資料";
    return;
  }

  const config = getGameConfig(currentGame);
  const freq = buildFrequency(currentData, config.maxNumber, config.mainPickCount);
  const tails = buildTailStats(freq);
  const drags = buildDragStats(currentData);

  renderFrequency(freq, config);
  renderTailStats(tails);
  renderDragStats(drags);

  if (currentGame === "power") {
    const mainPred = pickTop(freq.main, 6);
    const secPred = pickTop(freq.second, 1);
    predictionsEl.innerHTML = `
      <div class="small-text"><strong>第一區推薦：</strong></div>
      <div class="num-list">${mainPred.map(n => ball(n)).join("")}</div>
      <div class="small-text" style="margin-top:10px;"><strong>第二區推薦：</strong></div>
      <div class="num-list">${secPred.map(n => ball(n, "gold")).join("")}</div>
    `;
  } else {
    const count = currentGame === "bingo" ? Number(bingoPickCountEl.value) : config.mainPickCount;
    const pred = pickTop(freq.main, count);
    predictionsEl.innerHTML = `<div class="num-list">${pred.map(n => ball(n)).join("")}</div>`;
  }

  statusEl.textContent = "分析完成";
}

function getGameConfig(game) {
  if (game === "bingo") return { maxNumber: 80, mainPickCount: 20 };
  if (game === "lotto") return { maxNumber: 49, mainPickCount: 6 };
  if (game === "power") return { maxNumber: 38, mainPickCount: 6, secondMax: 8 };
  return { maxNumber: 39, mainPickCount: 5 };
}

function buildFrequency(draws, max, pickCount) {
  const main = {};
  for (let i = 1; i <= max; i++) main[i] = 0;

  let second = null;
  if (currentGame === "power") {
    second = {};
    for (let i = 1; i <= 8; i++) second[i] = 0;
  }

  draws.forEach(draw => {
    (draw.numbers || []).forEach(n => {
      if (main[n] !== undefined) main[n]++;
    });
    if (currentGame === "power" && draw.second) {
      second[draw.second] = (second[draw.second] || 0) + 1;
    }
  });

  return { main, second };
}

function buildTailStats(freq) {
  const result = {};
  for (let i = 0; i <= 9; i++) result[i] = 0;
  Object.entries(freq.main).forEach(([num, count]) => {
    const tail = Number(num) % 10;
    result[tail] += count;
  });
  return result;
}

function buildDragStats(draws) {
  const map = {};
  for (let i = 0; i < draws.length - 1; i++) {
    const curr = draws[i].numbers || [];
    const next = draws[i + 1].numbers || [];
    curr.forEach(a => {
      next.forEach(b => {
        const key = `${a}->${b}`;
        map[key] = (map[key] || 0) + 1;
      });
    });
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
}

function pickTop(freqObj, count) {
  return Object.entries(freqObj)
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .slice(0, count)
    .map(([n]) => Number(n))
    .sort((a, b) => a - b);
}

function renderFrequency(freq, config) {
  const top = pickTop(freq.main, Math.min(12, Object.keys(freq.main).length));
  frequencyEl.innerHTML = `<div class="num-list">${top.map(n => ball(n)).join("")}</div>`;
}

function renderTailStats(tails) {
  const html = Object.entries(tails)
    .sort((a, b) => b[1] - a[1])
    .map(([tail, count]) => `<div>尾數 ${tail}：${count} 次</div>`)
    .join("");
  tailAnalysisEl.innerHTML = `<div class="small-text">${html}</div>`;
}

function renderDragStats(drags) {
  dragAnalysisEl.innerHTML = `
    <div class="small-text">
      ${drags.map(([k, v]) => `<div>${k}：${v} 次</div>`).join("")}
    </div>
  `;
}

function renderLatestDraws(draws) {
  const latest = draws.slice(0, 5);
  latestDrawsEl.innerHTML = latest.map(d => `
    <div style="margin-bottom:10px;">
      <div><strong>${d.date || ""}</strong> ${d.issue || ""}</div>
      <div class="num-list" style="margin-top:6px;">
        ${(d.numbers || []).map(n => ball(n)).join("")}
        ${d.second ? ball(d.second, "gold") : ""}
      </div>
    </div>
  `).join("");
}

function goBattle() {
  const html = predictionsEl.innerHTML;
  if (!html) {
    statusEl.textContent = "請先分析後再進入實戰";
    return;
  }
  statusEl.textContent = "實戰模式：請依推薦號碼快速下注參考";
}

function ball(n, cls = "") {
  return `<span class="ball ${cls}">${String(n).padStart(2, "0")}</span>`;
}
