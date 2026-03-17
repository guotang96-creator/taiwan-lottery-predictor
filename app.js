let currentData = [];

const gameEl = document.getElementById("game");
const historyCountEl = document.getElementById("historyCount");
const bingoPickCountEl = document.getElementById("bingoPickCount");
const groupCountEl = document.getElementById("groupCount");
const birthdayEl = document.getElementById("birthday");
const modeEl = document.getElementById("mode");
const bingoPickWrap = document.getElementById("bingoPickWrap");

const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const birthdayNumbersEl = document.getElementById("birthdayNumbers");
const hotNumbersEl = document.getElementById("hotNumbers");
const coldNumbersEl = document.getElementById("coldNumbers");
const dragAnalysisEl = document.getElementById("dragAnalysis");
const tailAnalysisEl = document.getElementById("tailAnalysis");
const serialAnalysisEl = document.getElementById("serialAnalysis");
const backtestResultEl = document.getElementById("backtestResult");
const latestDrawsEl = document.getElementById("latestDraws");

document.getElementById("loadBtn").addEventListener("click", loadData);
document.getElementById("analyzeBtn").addEventListener("click", analyzeData);
document.getElementById("backtestBtn").addEventListener("click", runBacktest);
document.getElementById("battleBtn").addEventListener("click", goBattle);
gameEl.addEventListener("change", handleGameChange);

handleGameChange();

function handleGameChange() {
  bingoPickWrap.style.display = gameEl.value === "bingo" ? "flex" : "none";
  clearPanels();
}

function clearPanels() {
  currentData = [];
  statusEl.textContent = "請先讀取資料";
  resultEl.innerHTML = "";
  birthdayNumbersEl.innerHTML = "";
  hotNumbersEl.innerHTML = "";
  coldNumbersEl.innerHTML = "";
  dragAnalysisEl.innerHTML = "";
  tailAnalysisEl.innerHTML = "";
  serialAnalysisEl.innerHTML = "";
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

    statusEl.textContent = `讀取完成，共 ${currentData.length} 期`;
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

  const freq = buildFrequency(currentData, config);
  const hot = sortFreqDesc(freq.main).slice(0, 10);
  const cold = sortFreqAsc(freq.main).slice(0, 10);
  const tails = buildTailStats(freq.main);
  const drags = buildDragStats(currentData);
  const serials = buildSerialStats(currentData);
  const birthdayNumbers = buildBirthdayNumbers(birthdayEl.value, config);

  renderHotCold(hotNumbersEl, hot);
  renderHotCold(coldNumbersEl, cold);
  renderBirthdayNumbers(birthdayNumbers);
  renderTailStats(tails);
  renderDragStats(drags);
  renderSerialStats(serials);
  renderPredictions(freq, config, birthdayNumbers, mode);

  statusEl.textContent = "分析完成";
}

function getGameConfig(game) {
  if (game === "bingo") {
    return { max: 80, pickCount: Number(bingoPickCountEl.value), secondMax: 0 };
  }
  if (game === "lotto") {
    return { max: 49, pickCount: 6, secondMax: 0 };
  }
  if (game === "power") {
    return { max: 38, pickCount: 6, secondMax: 8 };
  }
  return { max: 39, pickCount: 5, secondMax: 0 };
}

function buildFrequency(draws, config) {
  const main = {};
  for (let i = 1; i <= config.max; i++) {
    main[i] = 0;
  }

  let second = null;
  if (config.secondMax) {
    second = {};
    for (let i = 1; i <= config.secondMax; i++) {
      second[i] = 0;
    }
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
    const tail = Number(num) % 10;
    tails[tail] += count;
  });

  return Object.entries(tails)
    .map(([tail, count]) => ({ tail, count }))
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

  const [year, month, day] = dateStr.split("-").map(Number);
  const raw = [
    year % 100,
    month,
    day,
    Math.floor(day / 2),
    month + day,
    (year + month + day) % config.max,
    (month * day) % config.max
  ];

  const normalized = raw
    .map(n => normalizeNumber(n, config.max))
    .filter(n => n >= 1 && n <= config.max);

  return [...new Set(normalized)];
}

function normalizeNumber(n, max) {
  let value = Number(n || 0);
  while (value > max) value -= max;
  while (value <= 0) value += max;
  return value;
}

function renderPredictions(freq, config, birthdayNumbers, mode) {
  const groups = Number(groupCountEl.value);
  const game = gameEl.value;

  const rankedMain = sortFreqDesc(freq.main).map(v => v.n);
  const rankedSecond = freq.second ? sortFreqDesc(freq.second).map(v => v.n) : [];

  let html = "";

  for (let g = 0; g < groups; g++) {
    let mainPick = [];

    if (mode === "normal") {
      mainPick = pickGroup(rankedMain, config.pickCount, g);
    } else if (mode === "birthday") {
      mainPick = mixBirthdayPriority(rankedMain, birthdayNumbers, config.pickCount, true, g);
    } else {
      mainPick = mixBirthdayPriority(rankedMain, birthdayNumbers, config.pickCount, false, g);
    }

    mainPick = [...new Set(mainPick)].slice(0, config.pickCount).sort((a, b) => a - b);

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

function mixBirthdayPriority(rankedList, birthdayNumbers, count, birthdayOnlyFirst, offset) {
  const chosen = [];
  const shiftedRanked = rankedList.slice(offset).concat(rankedList.slice(0, offset));

  if (birthdayOnlyFirst) {
    birthdayNumbers.forEach(n => {
      if (chosen.length < count && !chosen.includes(n)) {
        chosen.push(n);
      }
    });
  } else {
    const mix = [];
    for (let i = 0; i < Math.max(shiftedRanked.length, birthdayNumbers.length); i++) {
      if (birthdayNumbers[i] !== undefined) mix.push(birthdayNumbers[i]);
      if (shiftedRanked[i] !== undefined) mix.push(shiftedRanked[i]);
    }

    mix.forEach(n => {
      if (chosen.length < count && !chosen.includes(n)) {
        chosen.push(n);
      }
    });
  }

  shiftedRanked.forEach(n => {
    if (chosen.length < count && !chosen.includes(n)) {
      chosen.push(n);
    }
  });

  return chosen;
}

function renderHotCold(target, items) {
  target.innerHTML = `<div class="num-list">${items.map(v => ball(v.n)).join("")}</div>`;
}

function renderBirthdayNumbers(items) {
  if (!items.length) {
    birthdayNumbersEl.innerHTML = `<div class="text-list">請先選擇出生年月日</div>`;
    return;
  }

  birthdayNumbersEl.innerHTML = `<div class="num-list">${items.map(n => ball(n, "red")).join("")}</div>`;
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
  const details = [];

  for (let i = 5; i < currentData.length; i++) {
    const training = currentData.slice(i - 5, i);
    const target = currentData[i];
    const freq = buildFrequency(training, config);
    const rankedMain = sortFreqDesc(freq.main).map(v => v.n);

    let pick = [];
    if (mode === "normal") {
      pick = pickGroup(rankedMain, config.pickCount, 0);
    } else if (mode === "birthday") {
      pick = mixBirthdayPriority(rankedMain, birthdayNumbers, config.pickCount, true, 0);
    } else {
      pick = mixBirthdayPriority(rankedMain, birthdayNumbers, config.pickCount, false, 0);
    }

    pick = pick.slice(0, config.pickCount);
    const hitCount = pick.filter(n => target.numbers.includes(n)).length;

    totalHits += hitCount;
    tests++;

    details.push({
      issue: target.issue || "",
      date: target.date || "",
      hits: hitCount,
      target: target.numbers
    });
  }

  const avgHits = tests ? (totalHits / tests).toFixed(2) : "0.00";

  backtestResultEl.innerHTML = `
    <div class="text-list">
      <div>回測期數：${tests} 期</div>
      <div>總命中數：${totalHits}</div>
      <div>平均每期命中：${avgHits}</div>
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