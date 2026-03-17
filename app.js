let historyData = [];

async function loadData() {
  const game = document.getElementById("game").value;
  const count = document.getElementById("historyCount").value;
  const statusEl = document.getElementById("status");
  const latestDrawsEl = document.getElementById("latestDraws");

  try {
    statusEl.innerText = "讀取中...";

    const res = await fetch(`/api/lottery?game=${game}&count=${count}`, {
      cache: "no-store"
    });
    const data = await res.json();

    historyData = Array.isArray(data.draws) ? data.draws : [];
    statusEl.innerText = `已讀取 ${historyData.length} 期`;

    if (latestDrawsEl) {
      latestDrawsEl.innerHTML = historyData.slice(0, 5).map(draw => `
        <div class="draw-item">
          <div><strong>${draw.date || ""}</strong>${draw.issue ? `｜${draw.issue}` : ""}</div>
          <div class="num-list" style="margin-top:8px;">
            ${(draw.numbers || []).map(n => `<span class="ball">${String(n).padStart(2, "0")}</span>`).join("")}
          </div>
        </div>
      `).join("");
    }
  } catch (e) {
    console.error(e);
    statusEl.innerText = "讀取失敗";
  }
}

function analyzeData() {
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");

  if (!historyData.length) {
    statusEl.innerText = "請先讀取歷史資料";
    return;
  }

  const groupCount = Number(document.getElementById("groupCount").value || 5);
  const game = document.getElementById("game").value;
  const pickCount = game === "bingo"
    ? Number(document.getElementById("bingoPickCount").value || 6)
    : game === "539"
    ? 5
    : 6;

  const freq = {};
  historyData.forEach(draw => {
    (draw.numbers || []).forEach(n => {
      freq[n] = (freq[n] || 0) + 1;
    });
  });

  const sorted = Object.keys(freq)
    .map(Number)
    .sort((a, b) => (freq[b] - freq[a]) || (a - b));

  let html = "";
  for (let g = 0; g < groupCount; g++) {
    const pick = sorted.slice(g, g + pickCount).sort((a, b) => a - b);
    html += `
      <div class="group-box">
        <div><strong>第 ${g + 1} 組</strong></div>
        <div class="num-list" style="margin-top:8px;">
          ${pick.map(n => `<span class="ball">${String(n).padStart(2, "0")}</span>`).join("")}
        </div>
      </div>
    `;
  }

  resultEl.innerHTML = html;
  statusEl.innerText = "分析完成";
}

function runBacktest() {
  const statusEl = document.getElementById("status");
  const backtestResultEl = document.getElementById("backtestResult");

  if (!historyData.length || historyData.length < 6) {
    statusEl.innerText = "資料不足，無法回測";
    if (backtestResultEl) {
      backtestResultEl.innerHTML = `<div class="text-list">資料不足，至少需要 6 期以上才能回測</div>`;
    }
    return;
  }

  let totalHits = 0;
  let tests = 0;

  for (let i = 1; i < historyData.length; i++) {
    const prev = historyData[i].numbers || [];
    const next = historyData[i - 1].numbers || [];
    totalHits += prev.filter(n => next.includes(n)).length;
    tests++;
  }

  const avg = tests ? (totalHits / tests).toFixed(2) : "0.00";

  if (backtestResultEl) {
    backtestResultEl.innerHTML = `<div class="text-list">回測 ${tests} 期，平均命中 ${avg} 顆</div>`;
  }
  statusEl.innerText = "回測完成";
}

function goBattle() {
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("result");

  if (!resultEl || !resultEl.innerHTML.trim()) {
    statusEl.innerText = "請先分析後再進入實戰";
    return;
  }

  statusEl.innerText = "實戰模式已啟動，請依推薦號碼作為參考使用";
  window.scrollTo({ top: 0, behavior: "smooth" });
}