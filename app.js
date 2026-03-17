let historyData = [];

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

const birthdayNumbersEl = document.getElementById("birthdayNumbers");
const aiScoreBoardEl = document.getElementById("aiScoreBoard");
const hotNumbersEl = document.getElementById("hotNumbers");
const coldNumbersEl = document.getElementById("coldNumbers");
const dragAnalysisEl = document.getElementById("dragAnalysis");
const tailAnalysisEl = document.getElementById("tailAnalysis");
const serialAnalysisEl = document.getElementById("serialAnalysis");
const bingoAdviceEl = document.getElementById("bingoAdvice");
const backtestResultEl = document.getElementById("backtestResult");
const latestDrawsEl = document.getElementById("latestDraws");

document.getElementById("loadBtn").onclick = loadData;
document.getElementById("analyzeBtn").onclick = analyzeData;
document.getElementById("backtestBtn").onclick = runBacktest;
document.getElementById("battleBtn").onclick = goBattle;

if (gameEl) {
  gameEl.addEventListener("change", onGameChange);
}

onGameChange();

function onGameChange() {
  const bingoWrap = document.getElementById("bingoPickWrap");
  if (bingoWrap) {
    bingoWrap.style.display = gameEl.value === "bingo" ? "flex" : "none";
  }
}

async function loadData() {
  const game = gameEl.value;
  const count = Number(historyCountEl.value || 30);

  try {
    statusEl.innerText = "讀取中...";

    const res = await fetch(`/api/lottery?game=${game}&count=${count}`, {
      cache: "no-store"
    });

    const data = await res.json();
    console.log("API回傳:", data);

    historyData = Array.isArray(data.draws) ? data.draws : [];

    renderLatestDraws(historyData);

    if (game === "bingo") {
      renderBingoAdvice();
    } else if (bingoAdviceEl) {
      bingoAdviceEl.innerHTML = `<div class="text-list">此功能僅限賓果 Bingo</div>`;
    }

    statusEl.innerText = `已讀取 ${historyData.length} 期`;
  } catch (e) {
    console.error(e);
    historyData = [];
    statusEl.innerText = "讀取失敗";
  }
}

function analyzeData() {
  if (!historyData.length) {
    statusEl.innerText = "請先讀取歷史資料";
    return;
  }

  const config = getConfig();
  const birthdayNumbers = getBirthdayNumbers(config.max);

  const freqMap = buildFreqMap(historyData, config.max);
  const recentMap = buildRecentMap(historyData, config.max);
  const dragMap = buildDragMap(historyData, config.max);
  const coldMap = buildColdReboundMap(freqMap, config.max);
  const tailMap = buildTailMap(freqMap);

  const hotList = sortFreqDesc(freqMap);
  const coldList = sortFreqAsc(freqMap);

  const aiRank = buildAiRank(
    config.max,
    freqMap,
    dragMap,
    recentMap,
    coldMap,
    tailMap,
    birthdayNumbers
  );

  const confidence = buildConfidence(aiRank, config.pickCount);
  const bestCombo = buildBestCombo(aiRank, config.pickCount);
  const burst = buildBurst(aiRank, config.pickCount);
  const fusion = buildFusion(bestCombo, burst, hotList, config.pickCount);

  renderRecommendGroups(aiRank, config);
  renderConfidence(confidence);
  renderBurst(burst);
  renderTrend(historyData.slice(0, 5));
  renderHitPredict(confidence, config);
  renderBestCombo(bestCombo);
  renderFusion(fusion);

  renderBirthdayNumbers(birthdayNumbers);
  renderAiScoreBoard(aiRank, gameEl.value);
  renderHotCold(hotNumbersEl, hotList.slice(0, 10));
  renderHotCold(coldNumbersEl, coldList.slice(0, 10));
  renderTailAnalysis(freqMap);
  renderDragAnalysis(dragMap);
  renderSerialAnalysis(historyData);

  statusEl.innerText = "分析完成";
}

function getConfig() {
  const game = gameEl.value;

  if (game === "bingo") {
    return {
      game,
      max: 80,
      pickCount: Number(bingoPickCountEl?.value || 6)
    };
  }

  if (game === "lotto") {
    return {
      game,
      max: 49,
      pickCount: 6
    };
  }

  if (game === "power") {
    return {
      game,
      max: 38,
      pickCount: 6
    };
  }

  return {
    game,
    max: 39,
    pickCount: 5
  };
}

function getBirthdayNumbers(max) {
  const raw = (birthdayEl?.value || "").trim();
  if (!raw) return [];

  const parts = raw.split("-");
  if (parts.length !== 3) return [];

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const nums = [
    year % 100,
    month,
    day,
    month + day,
    (year + month + day) % max,
    (month * day) % max,
    Math.floor(day / 2)
  ];

  return [...new Set(
    nums
      .map(n => normalizeNumber(n, max))
      .filter(n => n >= 1 && n <= max)
  )].sort((a, b) => a - b);
}

function normalizeNumber(n, max) {
  let value = Number(n || 0);
  while (value > max) value -= max;
  while (value <= 0) value += max;
  return value;
}

function buildFreqMap(draws, max) {
  const map = {};
  for (let i = 1; i <= max; i++) map[i] = 0;

  draws.forEach(draw => {
    (draw.numbers || []).forEach(n => {
      if (map[n] !== undefined) map[n] += 1;
    });
  });

  return map;
}

function buildRecentMap(draws, max) {
  const map = {};
  for (let i = 1; i <= max; i++) map[i] = 0;

  draws.slice(0, 5).forEach((draw, idx) => {
    const weight = 5 - idx;
    (draw.numbers || []).forEach(n => {
      if (map[n] !== undefined) map[n] += weight;
    });
  });

  return map;
}

function buildDragMap(draws, max) {
  const map = {};
  for (let i = 1; i <= max; i++) map[i] = 0;

  for (let i = 0; i < draws.length - 1; i++) {
    const a = draws[i].numbers || [];
    const b = draws[i + 1].numbers || [];

    a.forEach(x => {
      b.forEach(y => {
        map[y] += Math.abs(x - y) <= 2 ? 2 : 1;
      });
    });
  }

  return map;
}

function buildColdReboundMap(freqMap, max) {
  const sorted = sortFreqAsc(freqMap);
  const map = {};
  for (let i = 1; i <= max; i++) map[i] = 0;

  sorted.forEach((item, idx) => {
    if (idx < Math.floor(max / 5)) {
      map[item.n] = 10 - idx;
    }
  });

  return map;
}

function buildTailMap(freqMap) {
  const tails = {};
  for (let i = 0; i <= 9; i++) tails[i] = 0;

  Object.entries(freqMap).forEach(([num, count]) => {
    tails[Number(num) % 10] += count;
  });

  return tails;
}

function buildAiRank(max, freqMap, dragMap, recentMap, coldMap, tailMap, birthdayNumbers) {
  const rows = [];

  for (let i = 1; i <= max; i++) {
    const freqScore = (freqMap[i] || 0) * 1.4;
    const recentScore = (recentMap[i] || 0) * 2.3;
    const dragScore = (dragMap[i] || 0) * 1.7;
    const coldScore = (coldMap[i] || 0) * 1.2;
    const tailScore = (tailMap[i % 10] || 0) * 0.35;
    const birthdayScore = birthdayNumbers.includes(i) ? 8 : 0;

    let score = freqScore + recentScore + dragScore + coldScore + tailScore + birthdayScore;

    if (modeEl?.value === "hot") score += freqScore * 0.6;
    if (modeEl?.value === "cold") score += coldScore * 0.8;
    if (modeEl?.value === "balanced") score += (freqScore + dragScore) * 0.2;
    if (modeEl?.value === "birthday") score += birthdayScore * 1.2;

    rows.push({
      n: i,
      score: Number(score.toFixed(2))
    });
  }

  return rows.sort((a, b) => b.score - a.score || a.n - b.n);
}

function buildConfidence(aiRank, pickCount) {
  const top = aiRank.slice(0, pickCount);
  const avg = top.length
    ? top.reduce((sum, item) => sum + item.score, 0) / top.length
    : 0;

  return {
    avg: avg.toFixed(2),
    level: avg > 120 ? "高" : avg > 60 ? "中" : "低"
  };
}

function buildBestCombo(aiRank, pickCount) {
  return aiRank
    .slice(0, pickCount)
    .map(v => v.n)
    .sort((a, b) => a - b);
}

function buildBurst(aiRank, pickCount) {
  return aiRank.slice(pickCount, pickCount * 2);
}

function buildFusion(bestCombo, burst, hotList, pickCount) {
  return [...new Set([
    ...bestCombo,
    ...burst.slice(0, pickCount).map(v => v.n),
    ...hotList.slice(0, pickCount).map(v => v.n)
  ])]
    .slice(0, pickCount)
    .sort((a, b) => a - b);
}

function sortFreqDesc(map) {
  return Object.entries(map)
    .map(([n, c]) => ({ n: Number(n), c }))
    .sort((a, b) => b.c - a.c || a.n - b.n);
}

function sortFreqAsc(map) {
  return Object.entries(map)
    .map(([n, c]) => ({ n: Number(n), c }))
    .sort((a, b) => a.c - b.c || a.n - b.n);
}

function renderRecommendGroups(aiRank, config) {
  const groups = Number(groupCountEl?.value || 5);
  let html = "";

  for (let g = 0; g < groups; g++) {
    const pick = aiRank
      .slice(g, g + config.pickCount)
      .map(v => v.n)
      .sort((a, b) => a - b);

    html += `
      <div class="group-box">
        <div><strong>第 ${g + 1} 組</strong></div>
        <div class="num-list" style="margin-top:8px;">
          ${pick.map(n => ball(n)).join("")}
        </div>
      </div>
    `;
  }

  resultEl.innerHTML = html;
}

function renderConfidence(conf) {
  if (!confidenceBoxEl) return;
  confidenceBoxEl.innerHTML = `
    <div class="text-list">
      <div>平均 AI 分數：${conf.avg}</div>
      <div>信心等級：${conf.level}</div>
    </div>
  `;
}

function renderBurst(list) {
  if (!burstBoxEl) return;
  burstBoxEl.innerHTML = list.length
    ? `<div class="num-list">${list.map(v => ball(v.n, "gold")).join("")}</div>`
    : `<div class="text-list">沒有資料</div>`;
}

function renderTrend(list) {
  if (!trendBoxEl) return;
  trendBoxEl.innerHTML = list.length
    ? `<div class="text-list">${list.map((d, i) => `<div>${d.date || ""}｜第 ${i + 1} 筆｜共 ${(d.numbers || []).length} 號</div>`).join("")}</div>`
    : `<div class="text-list">沒有資料</div>`;
}

function renderHitPredict(confidence, config) {
  if (!hitPredictBoxEl) return;

  const avg = Number(confidence.avg);
  let text = "預估中 1 顆";

  if (avg > 120 && config.pickCount >= 6) {
    text = "預估中 2~3 顆";
  } else if (avg > 60) {
    text = "預估中 1~2 顆";
  }

  hitPredictBoxEl.innerHTML = `<div class="text-list">${text}</div>`;
}

function renderBestCombo(combo) {
  if (!bestComboBoxEl) return;
  bestComboBoxEl.innerHTML = `<div class="num-list">${combo.map(n => ball(n)).join("")}</div>`;
}

function renderFusion(combo) {
  if (!fusionBoxEl) return;
  fusionBoxEl.innerHTML = `<div class="num-list">${combo.map(n => ball(n, "gold")).join("")}</div>`;
}

function renderBirthdayNumbers(nums) {
  if (!birthdayNumbersEl) return;
  birthdayNumbersEl.innerHTML = nums.length
    ? `<div class="num-list">${nums.map(n => ball(n, "red")).join("")}</div>`
    : `<div class="text-list">沒有資料</div>`;
}

function renderAiScoreBoard(aiRank, game) {
  if (!aiScoreBoardEl) return;
  const top = aiRank.slice(0, game === "bingo" ? 15 : 10);

  aiScoreBoardEl.innerHTML = top.map(v => `
    <div class="score-row">
      <span>${ball(v.n)}</span>
      <span>AI分數：${v.score}</span>
    </div>
  `).join("");
}

function renderHotCold(target, list) {
  if (!target) return;
  target.innerHTML = `<div class="num-list">${list.map(v => ball(v.n)).join("")}</div>`;
}

function renderTailAnalysis(freqMap) {
  if (!tailAnalysisEl) return;

  const tails = {};
  for (let i = 0; i <= 9; i++) tails[i] = 0;

  Object.entries(freqMap).forEach(([num, count]) => {
    tails[Number(num) % 10] += count;
  });

  const rows = Object.entries(tails)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([tail, count]) => `<div>尾數 ${tail}：${count} 次</div>`)
    .join("");

  tailAnalysisEl.innerHTML = `<div class="text-list">${rows}</div>`;
}

function renderDragAnalysis(dragMap) {
  if (!dragAnalysisEl) return;

  const rows = Object.entries(dragMap)
    .map(([n, score]) => ({ n: Number(n), score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(v => `<div>${v.n}：${v.score}</div>`)
    .join("");

  dragAnalysisEl.innerHTML = `<div class="text-list">${rows}</div>`;
}

function renderSerialAnalysis(draws) {
  if (!serialAnalysisEl) return;

  const serials = [];

  draws.slice(0, 8).forEach(draw => {
    const nums = [...(draw.numbers || [])].sort((a, b) => a - b);
    const hits = [];

    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i + 1] - nums[i] === 1) {
        hits.push(`${nums[i]}-${nums[i + 1]}`);
      }
    }

    if (hits.length) {
      serials.push(`<div>${draw.date || ""}：${hits.join("、")}</div>`);
    }
  });

  serialAnalysisEl.innerHTML = `<div class="text-list">${serials.length ? serials.join("") : "近期無明顯連號"}</div>`;
}

function renderBingoAdvice() {
  if (!bingoAdviceEl) return;
  const pickCount = Number(bingoPickCountEl?.value || 6);

  let text = "目前設定顆數屬中性策略。";
  if (pickCount <= 3) text = "目前偏保守，適合縮小集中度。";
  if (pickCount >= 4 && pickCount <= 6) text = "目前屬平衡策略，適合一般實戰。";
  if (pickCount >= 7) text = "目前偏擴散策略，適合提高覆蓋面。";

  bingoAdviceEl.innerHTML = `
    <div class="text-list">
      <div>目前選擇：${pickCount} 顆</div>
      <div>${text}</div>
      <div>建議常用區間：4～6 顆</div>
    </div>
  `;
}

function renderLatestDraws(draws) {
  if (!latestDrawsEl) return;

  const latest = draws.slice(0, 5);

  latestDrawsEl.innerHTML = latest.length
    ? latest.map(draw => `
      <div class="draw-item">
        <div><strong>${draw.date || ""}</strong>${draw.issue ? `｜${draw.issue}` : ""}</div>
        <div class="num-list" style="margin-top:8px;">
          ${(draw.numbers || []).map(n => ball(n)).join("")}
        </div>
      </div>
    `).join("")
    : `<div class="text-list">沒有資料</div>`;
}

function runBacktest() {
  if (!backtestResultEl) return;

  if (!historyData.length || historyData.length < 6) {
    backtestResultEl.innerHTML = `<div class="text-list">資料不足，至少需要 6 期以上才能回測</div>`;
    return;
  }

  const config = getConfig();
  let totalHits = 0;
  let tests = 0;

  for (let i = 5; i < historyData.length; i++) {
    const training = historyData.slice(i - 5, i);
    const freqMap = buildFreqMap(training, config.max);
    const recentMap = buildRecentMap(training, config.max);
    const dragMap = buildDragMap(training, config.max);
    const coldMap = buildColdReboundMap(freqMap, config.max);
    const tailMap = buildTailMap(freqMap);
    const aiRank = buildAiRank(config.max, freqMap, dragMap, recentMap, coldMap, tailMap, []);
    const pick = aiRank.slice(0, config.pickCount).map(v => v.n);

    const hits = pick.filter(n => historyData[i].numbers.includes(n)).length;
    totalHits += hits;
    tests++;
  }

  const avg = tests ? (totalHits / tests).toFixed(2) : "0.00";
  backtestResultEl.innerHTML = `<div class="text-list">回測 ${tests} 期，平均命中 ${avg} 顆</div>`;
}

function goBattle() {
  if (!resultEl || !resultEl.innerHTML.trim()) {
    statusEl.innerText = "請先分析後再進入實戰";
    return;
  }

  statusEl.innerText = "實戰模式已啟動，請依推薦號碼作為參考使用";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ball(n, cls = "") {
  return `<span class="ball ${cls}">${String(n).padStart(2, "0")}</span>`;
}