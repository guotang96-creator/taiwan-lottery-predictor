let currentData = [];
let deferredPrompt = null;

const gameEl = document.getElementById("game");
const historyCountEl = document.getElementById("historyCount");
const bingoPickCountEl = document.getElementById("bingoPickCount");
const groupCountEl = document.getElementById("groupCount");
const birthdayEl = document.getElementById("birthday");
const modeEl = document.getElementById("mode");
const bingoPickWrap = document.getElementById("bingoPickWrap");

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
const installBtn = document.getElementById("installBtn");

document.getElementById("loadBtn").addEventListener("click", loadData);
document.getElementById("analyzeBtn").addEventListener("click", analyzeData);
document.getElementById("backtestBtn").addEventListener("click", runBacktest);
document.getElementById("battleBtn").addEventListener("click", goBattle);

if (gameEl) gameEl.addEventListener("change", handleGameChange);
if (installBtn) installBtn.addEventListener("click", installApp);

handleGameChange();
registerSW();
setupPWA();

function handleGameChange() {
  if (bingoPickWrap) {
    bingoPickWrap.style.display = gameEl.value === "bingo" ? "flex" : "none";
  }
  clearPanels();
}

function clearPanels() {
  currentData = [];
  statusEl.textContent = "請先讀取資料";
  resultEl.innerHTML = "";
  confidenceBoxEl.innerHTML = "";
  burstBoxEl.innerHTML = "";
  trendBoxEl.innerHTML = "";
  if (hitPredictBoxEl) hitPredictBoxEl.innerHTML = "";
  if (bestComboBoxEl) bestComboBoxEl.innerHTML = "";
  if (fusionBoxEl) fusionBoxEl.innerHTML = "";
  birthdayNumbersEl.innerHTML = "";
  aiScoreBoardEl.innerHTML = "";
  hotNumbersEl.innerHTML = "";
  coldNumbersEl.innerHTML = "";
  dragAnalysisEl.innerHTML = "";
  tailAnalysisEl.innerHTML = "";
  serialAnalysisEl.innerHTML = "";
  bingoAdviceEl.innerHTML = "";
  backtestResultEl.innerHTML = "";
  latestDrawsEl.innerHTML = "";
}

async function loadData() {
  try {
    const game = gameEl.value;
    const count = historyCountEl.value;
    statusEl.textContent = "資料讀取中...";

    const res = await fetch(`/api/lottery?game=${game}&count=${count}`);
    const data = await res.json();

    currentData = (data.draws || []).filter(
      d => Array.isArray(d.numbers) && d.numbers.length > 0
    );

    renderLatestDraws(currentData);

    if (!currentData.length) {
      statusEl.textContent = "本次未成功取得資料，請稍後再試";
      return;
    }

    if (game === "bingo") {
      renderBingoAdvice();
    } else {
      bingoAdviceEl.innerHTML = `<div class="text-list">此功能僅限賓果 Bingo</div>`;
    }

    const sourceText = data.source === "repo-data" ? "自動資料" : "內建資料";
    statusEl.textContent = `讀取完成，共 ${currentData.length} 期（${sourceText}）`;
  } catch (error) {
    console.error(error);
    statusEl.textContent = "讀取失敗，請稍後再試";
  }
}

function analyzeData() {
  if (!currentData.length) {
    statusEl.textContent = "請先讀取資料";
    return;
  }

  const game = gameEl.value;
  const config = getGameConfig(game);
  const mode = modeEl.value;
  const birthdayNumbers = buildBirthdayNumbers(birthdayEl.value, config);

  const freq = buildFrequency(currentData, config);
  const hot = sortFreqDesc(freq.main).slice(0, 10);
  const cold = sortFreqAsc(freq.main).slice(0, 10);
  const tails = buildTailStats(freq.main);
  const drags = buildDragStats(currentData);
  const serials = buildSerialStats(currentData);
  const aiRank = buildAIScores(currentData, config, birthdayNumbers);
  const confidence = buildConfidence(aiRank, config);
  const burst = buildBurstCandidates(currentData, aiRank, config);
  const trend = buildTrend(currentData);
  const bestCombo = buildBestCombo(aiRank, freq, config, birthdayNumbers);
  const fusion = buildFusionNumbers(aiRank, hot, burst, config);
  const hitPredict = buildHitPredict(confidence, config);

  renderBirthdayNumbers(birthdayNumbers);
  renderHotCold(hotNumbersEl, hot);
  renderHotCold(coldNumbersEl, cold);
  renderTailStats(tails);
  renderDragStats(drags);
  renderSerialStats(serials);
  renderAIScoreBoard(aiRank, game);
  renderPredictions(aiRank, freq, config, birthdayNumbers, mode);
  renderConfidence(confidence);
  renderBurst(burst);
  renderTrend(trend);
  renderHitPredict(hitPredict);
  renderBestCombo(bestCombo, game, freq);
  renderFusion(fusion);

  statusEl.textContent = "分析完成";
}

function getGameConfig(game) {
  if (game === "bingo") return { max: 80, pickCount: Number(bingoPickCountEl.value), secondMax: 0 };
  if (game === "lotto") return { max: 49, pickCount: 6, secondMax: 0 };
  if (game === "power") return { max: 38, pickCount: 6, secondMax: 8 };
  return { max: 39, pickCount: 5, secondMax: 0 };
}

function buildFrequency(draws, config) {
  const main = {};
  for (let i = 1; i <= config.max; i++) main[i] = 0;

  let second = null;
  if (config.secondMax) {
    second = {};
    for (let i = 1; i <= config.secondMax; i++) second[i] = 0;
  }

  draws.forEach(draw => {
    (draw.numbers || []).forEach(n => {
      if (main[n] !== undefined) main[n]++;
    });

    if (second && draw.second && second[draw.second] !== undefined) {
      second[draw.second]++;
    }
  });

  return { main, second };
}

function sortFreqDesc(obj) {
  return Object.entries(obj)
    .map(([n, c]) => ({ n: Number(n), c }))
    .sort((a, b) => b.c - a.c || a.n - b.n);
}

function sortFreqAsc(obj) {
  return Object.entries(obj)
    .map(([n, c]) => ({ n: Number(n), c }))
    .sort((a, b) => a.c - b.c || a.n - b.n);
}

function buildTailStats(mainFreq) {
  const tails = {};
  for (let i = 0; i <= 9; i++) tails[i] = 0;

  Object.entries(mainFreq).forEach(([num, count]) => {
    tails[Number(num) % 10] += count;
  });

  return Object.entries(tails)
    .map(([tail, count]) => ({ tail: Number(tail), count }))
    .sort((a, b) => b.count - a.count);
}

function buildDragStats(draws) {
  const map = {};
  for (let i = 0; i < draws.length - 1; i++) {
    const current = draws[i].numbers || [];
    const next = draws[i + 1].numbers || [];

    current.forEach(a => {
      next.forEach(b => {
        const key = `${a}→${b}`;
        map[key] = (map[key] || 0) + 1;
      });
    });
  }

  return Object.entries(map)
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function buildSerialStats(draws) {
  const result = [];

  draws.forEach(draw => {
    const nums = [...(draw.numbers || [])].sort((a, b) => a - b);
    const serialPairs = [];

    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i + 1] - nums[i] === 1) {
        serialPairs.push(`${nums[i]}-${nums[i + 1]}`);
      }
    }

    if (serialPairs.length) {
      result.push({
        issue: draw.issue || "",
        date: draw.date || "",
        serials: serialPairs
      });
    }
  });

  return result.slice(0, 8);
}

function buildBirthdayNumbers(dateStr, config) {
  if (!dateStr) return [];
  const parts = dateStr.split("-");
  if (parts.length !== 3) return [];

  const [year, month, day] = parts.map(Number);
  const raw = [
    year % 100,
    month,
    day,
    month + day,
    (year + month + day) % config.max,
    (month * day) % config.max,
    Math.floor(day / 2)
  ];

  return [...new Set(
    raw.map(n => normalizeNumber(n, config.max)).filter(n => n >= 1 && n <= config.max)
  )];
}

function normalizeNumber(n, max) {
  let value = Number(n || 0);
  while (value > max) value -= max;
  while (value <= 0) value += max;
  return value;
}

function buildAIScores(draws, config, birthdayNumbers) {
  const freq = buildFrequency(draws, config);
  const dragMap = buildNumberDragMap(draws, config.max);
  const tailRank = buildTailWeightMap(freq.main);
  const recentBoost = buildRecentBoost(draws, config.max);

  const hotRank = sortFreqDesc(freq.main).map(v => v.n);
  const coldRank = sortFreqAsc(freq.main).map(v => v.n);

  const hotIndex = {};
  hotRank.forEach((n, idx) => { hotIndex[n] = idx; });

  const coldIndex = {};
  coldRank.forEach((n, idx) => { coldIndex[n] = idx; });

  const rows = [];
  for (let n = 1; n <= config.max; n++) {
    let score = 0;
    score += Math.max(0, config.max - (hotIndex[n] ?? config.max)) * 1.2;
    score += (recentBoost[n] || 0) * 2.2;
    score += (tailRank[n % 10] || 0) * 1.1;
    score += (dragMap[n] || 0) * 1.8;

    if (birthdayNumbers.includes(n)) score += 8;
    if ((coldIndex[n] ?? config.max) < Math.floor(config.max / 6)) score -= 2.5;

    rows.push({
      n,
      score: Number(score.toFixed(2)),
      freq: freq.main[n] || 0
    });
  }

  return rows.sort((a, b) => b.score - a.score || b.freq - a.freq || a.n - b.n);
}

function buildNumberDragMap(draws, max) {
  const map = {};
  for (let i = 1; i <= max; i++) map[i] = 0;

  for (let i = 0; i < draws.length - 1; i++) {
    const current = draws[i].numbers || [];
    const next = draws[i + 1].numbers || [];
    current.forEach(a => {
      next.forEach(b => {
        map[b] = (map[b] || 0) + (Math.abs(a - b) <= 2 ? 2 : 1);
      });
    });
  }

  return map;
}

function buildTailWeightMap(mainFreq) {
  const tailStats = buildTailStats(mainFreq);
  const weight = {};
  tailStats.forEach((item, idx) => {
    weight[item.tail] = Math.max(1, 10 - idx);
  });
  return weight;
}

function buildRecentBoost(draws, max) {
  const boost = {};
  for (let i = 1; i <= max; i++) boost[i] = 0;

  const recent = draws.slice(0, Math.min(5, draws.length));
  recent.forEach((draw, idx) => {
    const val = Math.max(1, 5 - idx);
    (draw.numbers || []).forEach(n => {
      boost[n] += val;
    });
  });

  return boost;
}

function buildConfidence(aiRank, config) {
  const top = aiRank.slice(0, config.pickCount);
  const avg = top.length
    ? top.reduce((sum, item) => sum + item.score, 0) / top.length
    : 0;

  let level = "低";
  if (avg >= 60) level = "高";
  else if (avg >= 35) level = "中";

  return {
    avg: avg.toFixed(2),
    level
  };
}

function buildBurstCandidates(draws, aiRank, config) {
  const recent = draws.slice(0, Math.min(3, draws.length));
  const seen = new Set();
  recent.forEach(draw => (draw.numbers || []).forEach(n => seen.add(n)));

  return aiRank.filter(item => !seen.has(item.n)).slice(0, config.pickCount);
}

function buildTrend(draws) {
  const latest = draws.slice(0, 5);
  return latest.map((draw, idx) => ({
    date: draw.date || "",
    index: idx + 1,
    count: (draw.numbers || []).length
  }));
}

function buildBestCombo(aiRank, freq, config, birthdayNumbers) {
  const aiRanked = aiRank.map(v => v.n);
  const hotRanked = sortFreqDesc(freq.main).map(v => v.n);
  const combo = pickAIGroup(aiRanked, hotRanked, birthdayNumbers, config.pickCount, 0);
  return [...new Set(combo)].slice(0, config.pickCount).sort((a, b) => a - b);
}

function buildFusionNumbers(aiRank, hot, burst, config) {
  const combined = [];
  hot.forEach(v => combined.push(v.n));
  burst.forEach(v => combined.push(v.n));
  aiRank.slice(0, config.pickCount * 2).forEach(v => combined.push(v.n));
  return [...new Set(combined)].slice(0, config.pickCount);
}

function buildHitPredict(confidence, config) {
  const avg = Number(confidence.avg);
  let predict = "預估中 1 ~ 2 顆";
  if (config.pickCount >= 6 && avg >= 120) predict = "預估中 2 ~ 3 顆";
  else if (avg >= 60) predict = "預估中 2 顆左右";
  return predict;
}

function renderPredictions(aiRank, freq, config, birthdayNumbers, mode) {
  const groups = Number(groupCountEl.value);
  const game = gameEl.value;

  const aiRanked = aiRank.map(v => v.n);
  const rankedMain = sortFreqDesc(freq.main).map(v => v.n);
  const coldRanked = sortFreqAsc(freq.main).map(v => v.n);
  const rankedSecond = freq.second ? sortFreqDesc(freq.second).map(v => v.n) : [];

  let html = "";

  for (let g = 0; g < groups; g++) {
    let mainPick = [];

    if (mode === "hot") {
      mainPick = pickGroup(rankedMain, config.pickCount, g);
    } else if (mode === "cold") {
      mainPick = pickGroup(coldRanked, config.pickCount, g);
    } else if (mode === "balanced") {
      mainPick = pickBalancedGroup(rankedMain, coldRanked, config.pickCount, g);
    } else if (mode === "birthday") {
      mainPick = mixBirthdayPriority(aiRanked, birthdayNumbers, config.pickCount, true, g);
    } else {
      mainPick = pickAIGroup(aiRanked, rankedMain, birthdayNumbers, config.pickCount, g);
    }

    if (game === "bingo") {
      mainPick = mainPick.slice(0, Number(bingoPickCountEl.value));
    }

    mainPick = [...new Set(mainPick)]
      .slice(0, config.pickCount)
      .sort((a, b) => a - b);

    html += `<div class="group-box">`;
    html += `<div><strong>第 ${g + 1} 組</strong></div>`;
    html += `<div class="num-list" style="margin-top:8px;">${mainPick.map(n => ball(n)).join("")}</div>`;

    if (game === "power") {
      const secondPick = rankedSecond.length ? rankedSecond[g % rankedSecond.length] : 1;
      html += `<div style="margin-top:10px;"><strong>第二區：</strong></div>`;
      html += `<div class="num-list" style="margin-top:8px;">${ball(secondPick, "gold")}</div>`;
    }

    html += `</div>`;
  }

  resultEl.innerHTML = html;
}

function pickGroup(rankedList, count, offset) {
  const chosen = [];
  let i = offset;

  while (chosen.length < count && i < rankedList.length) {
    const n = rankedList[i];
    if (!chosen.includes(n)) chosen.push(n);
    i += 2;
  }

  let fillIndex = 0;
  while (chosen.length < count && fillIndex < rankedList.length) {
    const n = rankedList[fillIndex];
    if (!chosen.includes(n)) chosen.push(n);
    fillIndex++;
  }

  return chosen;
}

function pickBalancedGroup(hotList, coldList, count, offset) {
  const chosen = [];
  const hot = hotList.slice(offset).concat(hotList.slice(0, offset));
  const cold = coldList.slice(offset).concat(coldList.slice(0, offset));

  for (let i = 0; i < Math.max(hot.length, cold.length); i++) {
    if (hot[i] !== undefined && chosen.length < count && !chosen.includes(hot[i])) chosen.push(hot[i]);
    if (cold[i] !== undefined && chosen.length < count && !chosen.includes(cold[i])) chosen.push(cold[i]);
  }
  return chosen;
}

function mixBirthdayPriority(rankedList, birthdayNumbers, count, birthdayOnlyFirst, offset) {
  const chosen = [];
  const shiftedRanked = rankedList.slice(offset).concat(rankedList.slice(0, offset));

  if (birthdayOnlyFirst) {
    birthdayNumbers.forEach(n => {
      if (chosen.length < count && !chosen.includes(n)) chosen.push(n);
    });
  }

  const mix = [];
  for (let i = 0; i < Math.max(shiftedRanked.length, birthdayNumbers.length); i++) {
    if (birthdayNumbers[i] !== undefined) mix.push(birthdayNumbers[i]);
    if (shiftedRanked[i] !== undefined) mix.push(shiftedRanked[i]);
  }

  mix.forEach(n => {
    if (chosen.length < count && !chosen.includes(n)) chosen.push(n);
  });

  shiftedRanked.forEach(n => {
    if (chosen.length < count && !chosen.includes(n)) chosen.push(n);
  });

  return chosen;
}

function pickAIGroup(aiRanked, rankedMain, birthdayNumbers, count, offset) {
  const chosen = [];
  const aiShift = aiRanked.slice(offset).concat(aiRanked.slice(0, offset));
  const hotShift = rankedMain.slice(offset).concat(rankedMain.slice(0, offset));

  const pool = [];
  for (let i = 0; i < Math.max(aiShift.length, hotShift.length, birthdayNumbers.length); i++) {
    if (aiShift[i] !== undefined) pool.push(aiShift[i]);
    if (hotShift[i] !== undefined) pool.push(hotShift[i]);
    if (birthdayNumbers[i] !== undefined) pool.push(birthdayNumbers[i]);
  }

  pool.forEach(n => {
    if (chosen.length < count && !chosen.includes(n)) chosen.push(n);
  });

  return chosen;
}

function renderConfidence(confidence) {
  confidenceBoxEl.innerHTML = `
    <div class="text-list">
      <div>平均 AI 分數：${confidence.avg}</div>
      <div>信心等級：${confidence.level}</div>
    </div>
  `;
}

function renderBurst(items) {
  if (!items.length) {
    burstBoxEl.innerHTML = `<div class="text-list">目前沒有明顯爆號候選</div>`;
    return;
  }

  burstBoxEl.innerHTML = `<div class="num-list">${items.map(v => ball(v.n, "gold")).join("")}</div>`;
}

function renderTrend(items) {
  if (!items.length) {
    trendBoxEl.innerHTML = `<div class="text-list">目前沒有走勢資料</div>`;
    return;
  }

  trendBoxEl.innerHTML = `
    <div class="text-list">
      ${items.map(v => `<div>${v.date}｜第 ${v.index} 筆｜共 ${v.count} 號</div>`).join("")}
    </div>
  `;
}

function renderHitPredict(text) {
  if (hitPredictBoxEl) {
    hitPredictBoxEl.innerHTML = `<div class="text-list">${text}</div>`;
  }
}

function renderBestCombo(combo, game, freq) {
  if (!bestComboBoxEl) return;

  let html = `<div class="num-list">${combo.map(n => ball(n)).join("")}</div>`;

  if (game === "power" && freq.second) {
    const secondRanked = sortFreqDesc(freq.second).map(v => v.n);
    const secondPick = secondRanked[0] || 1;
    html += `<div style="margin-top:10px;"><strong>第二區：</strong></div>`;
    html += `<div class="num-list" style="margin-top:8px;">${ball(secondPick, "gold")}</div>`;
  }

  bestComboBoxEl.innerHTML = html;
}

function renderFusion(items) {
  if (!fusionBoxEl) return;
  fusionBoxEl.innerHTML = `<div class="num-list">${items.map(n => ball(n, "gold")).join("")}</div>`;
}

function renderBirthdayNumbers(items) {
  if (!items.length) {
    birthdayNumbersEl.innerHTML = `<div class="text-list">請先選擇出生年月日</div>`;
    return;
  }

  birthdayNumbersEl.innerHTML = `<div class="num-list">${items.map(n => ball(n, "red")).join("")}</div>`;
}

function renderAIScoreBoard(aiRank, game) {
  const top = aiRank.slice(0, game === "bingo" ? 15 : 10);

  aiScoreBoardEl.innerHTML = top.map(v => `
    <div class="score-row">
      <span>${ball(v.n)}</span>
      <span>AI分數：${v.score}</span>
    </div>
  `).join("");
}

function renderHotCold(target, items) {
  target.innerHTML = `<div class="num-list">${items.map(v => ball(v.n)).join("")}</div>`;
}

function renderTailStats(tails) {
  tailAnalysisEl.innerHTML = `
    <div class="text-list">
      ${tails.map(v => `<div>尾數 ${v.tail}：${v.count} 次</div>`).join("")}
    </div>
  `;
}

function renderDragStats(drags) {
  if (!drags.length) {
    dragAnalysisEl.innerHTML = `<div class="text-list">暫無拖號資料</div>`;
    return;
  }

  dragAnalysisEl.innerHTML = `
    <div class="text-list">
      ${drags.map(v => `<div>${v.pair}：${v.count} 次</div>`).join("")}
    </div>
  `;
}

function renderSerialStats(serials) {
  if (!serials.length) {
    serialAnalysisEl.innerHTML = `<div class="text-list">近期無明顯連號</div>`;
    return;
  }

  serialAnalysisEl.innerHTML = `
    <div class="text-list">
      ${serials.map(v => `<div>${v.date} ${v.issue}：${v.serials.join("、")}</div>`).join("")}
    </div>
  `;
}

function renderBingoAdvice() {
  const pickCount = Number(bingoPickCountEl.value);
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
  const latest = draws.slice(0, 5);

  if (!latest.length) {
    latestDrawsEl.innerHTML = `<div class="text-list">目前沒有可顯示的開獎資料</div>`;
    return;
  }

  latestDrawsEl.innerHTML = latest.map(draw => `
    <div class="draw-item">
      <div><strong>${draw.date || ""}</strong>${draw.issue ? `｜${draw.issue}` : ""}</div>
      <div class="num-list" style="margin-top:8px;">
        ${(draw.numbers || []).map(n => ball(n)).join("")}
        ${draw.second ? ball(draw.second, "gold") : ""}
      </div>
    </div>
  `).join("");
}

function runBacktest() {
  if (!currentData.length || currentData.length < 6) {
    backtestResultEl.innerHTML = `<div class="text-list">資料不足，至少需要 6 期以上才能回測</div>`;
    return;
  }

  const game = gameEl.value;
  const config = getGameConfig(game);
  const birthdayNumbers = buildBirthdayNumbers(birthdayEl.value, config);
  const mode = modeEl.value;

  let totalHits = 0;
  let tests = 0;
  let hit2 = 0;
  let hit3 = 0;
  let hit4 = 0;
  let hit5Plus = 0;
  const details = [];

  for (let i = 5; i < currentData.length; i++) {
    const training = currentData.slice(i - 5, i);
    const aiRank = buildAIScores(training, config, birthdayNumbers);
    const freq = buildFrequency(training, config);
    const rankedMain = sortFreqDesc(freq.main).map(v => v.n);
    const coldRanked = sortFreqAsc(freq.main).map(v => v.n);
    const aiRanked = aiRank.map(v => v.n);

    let pick = [];
    if (mode === "hot") pick = pickGroup(rankedMain, config.pickCount, 0);
    else if (mode === "cold") pick = pickGroup(coldRanked, config.pickCount, 0);
    else if (mode === "balanced") pick = pickBalancedGroup(rankedMain, coldRanked, config.pickCount, 0);
    else if (mode === "birthday") pick = mixBirthdayPriority(aiRanked, birthdayNumbers, config.pickCount, true, 0);
    else pick = pickAIGroup(aiRanked, rankedMain, birthdayNumbers, config.pickCount, 0);

    pick = pick.slice(0, config.pickCount);
    const hitCount = pick.filter(n => currentData[i].numbers.includes(n)).length;

    totalHits += hitCount;
    tests++;

    if (hitCount >= 2) hit2++;
    if (hitCount >= 3) hit3++;
    if (hitCount >= 4) hit4++;
    if (hitCount >= 5) hit5Plus++;

    details.push({
      issue: currentData[i].issue || "",
      date: currentData[i].date || "",
      hits: hitCount,
      target: currentData[i].numbers
    });
  }

  const avgHits = tests ? (totalHits / tests).toFixed(2) : "0.00";
  const pct = v => tests ? ((v / tests) * 100).toFixed(1) : "0.0";

  backtestResultEl.innerHTML = `
    <div class="text-list">
      <div>回測期數：${tests} 期</div>
      <div>總命中數：${totalHits}</div>
      <div>平均每期命中：${avgHits}</div>
      <div>中 2 以上：${pct(hit2)}%</div>
      <div>中 3 以上：${pct(hit3)}%</div>
      <div>中 4 以上：${pct(hit4)}%</div>
      <div>中 5 以上：${pct(hit5Plus)}%</div>
      <div style="margin-top:10px;"><strong>最近回測明細：</strong></div>
      ${details.slice(-5).reverse().map(d => `
        <div>${d.date} ${d.issue}：命中 ${d.hits} 個｜開獎 ${d.target.join("、")}</div>
      `).join("")}
    </div>
  `;
}

function goBattle() {
  if (!resultEl.innerHTML.trim()) {
    statusEl.textContent = "請先分析後再進入實戰";
    return;
  }

  statusEl.textContent = "實戰模式已啟動，請依推薦號碼作為參考使用";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ball(n, cls = "") {
  return `<span class="ball ${cls}">${String(n).padStart(2, "0")}</span>`;
}

function setupPWA() {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.classList.remove("hidden");
  });
}

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (installBtn) installBtn.classList.add("hidden");
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    });
  }
}