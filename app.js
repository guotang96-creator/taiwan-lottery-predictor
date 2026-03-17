let currentData = [];

const gameEl = document.getElementById("game");
const historyCountEl = document.getElementById("historyCount");
const bingoPickCountEl = document.getElementById("bingoPickCount");
const groupCountEl = document.getElementById("groupCount");
const bingoPickWrap = document.getElementById("bingoPickWrap");

const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const hotNumbersEl = document.getElementById("hotNumbers");
const coldNumbersEl = document.getElementById("coldNumbers");
const dragAnalysisEl = document.getElementById("dragAnalysis");
const tailAnalysisEl = document.getElementById("tailAnalysis");
const serialAnalysisEl = document.getElementById("serialAnalysis");
const latestDrawsEl = document.getElementById("latestDraws");

document.getElementById("loadBtn").addEventListener("click", loadData);
document.getElementById("analyzeBtn").addEventListener("click", analyzeData);
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
  hotNumbersEl.innerHTML = "";
  coldNumbersEl.innerHTML = "";
  dragAnalysisEl.innerHTML = "";
  tailAnalysisEl.innerHTML = "";
  serialAnalysisEl.innerHTML = "";
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
      statusEl.textContent = "官方資料已連線，但本次未成功解析，請稍後再試";
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

  const freq = buildFrequency(currentData, config);
  const hot = sortFreqDesc(freq.main).slice(0, 10);
  const cold = sortFreqAsc(freq.main).slice(0, 10);
  const tails = buildTailStats(freq.main);
  const drags = buildDragStats(currentData);
  const serials = buildSerialStats(currentData);

  renderHotCold(hotNumbersEl, hot);
  renderHotCold(coldNumbersEl, cold);
  renderTailStats(tails);
  renderDragStats(drags);
  renderSerialStats(serials);
  renderPredictions(freq, config);

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

    if (second && draw.second) {
      if (second[draw.second] !== undefined) {
        second[draw.second]++;
      }
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

function renderPredictions(freq, config) {
  const groups = Number(groupCountEl.value);
  const game = gameEl.value;

  const rankedMain = sortFreqDesc(freq.main).map(v => v.n);
  const rankedSecond = freq.second ? sortFreqDesc(freq.second).map(v => v.n) : [];

  let html = "";

  for (let g = 0; g < groups; g++) {
    const mainPick = pickGroup(rankedMain, config.pickCount, g).sort((a, b) => a - b);

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