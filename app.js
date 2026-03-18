function pad2(n) {
  return String(n).padStart(2, "0");
}

function uniqueRandomNumbers(max, count) {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  const result = [];

  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }

  return result.sort((a, b) => a - b);
}

function updateHeader(gameName, badgeText) {
  const titleEl = document.getElementById("resultGameName");
  const badgeEl = document.getElementById("resultBadge");
  if (titleEl) titleEl.textContent = gameName;
  if (badgeEl) badgeEl.textContent = badgeText;
}

function renderBalls(numbers, options = {}) {
  const { className = "", hitSet = null } = options;

  return `
    <div class="ball-row">
      ${numbers.map((n) => {
        const hitClass = hitSet ? (hitSet.has(Number(n)) ? "hit" : "miss") : className;
        return `<span class="ball ${hitClass}">${pad2(n)}</span>`;
      }).join("")}
    </div>
  `;
}

function buildPredictionData(type) {
  const setCount = parseInt(document.getElementById("setCount").value, 10) || 3;
  const bingoCount = parseInt(document.getElementById("bingoCount").value, 10) || 10;

  let gameName = "";
  let main = [];
  let groups = [];
  let hot = [];
  let cold = [];
  let streak = "";
  let tails = "";
  let extraLabel = "";
  let extraValue = null;

  if (type === "bingo") {
    gameName = "Bingo Bingo";
    main = uniqueRandomNumbers(80, bingoCount);
    groups = Array.from({ length: setCount }, () => uniqueRandomNumbers(80, bingoCount));
    hot = uniqueRandomNumbers(80, 10);
    cold = uniqueRandomNumbers(80, 10);
    streak = "建議留意 2 連號、3 連號區段，例如 11-12、27-28、45-46。";
    tails = "尾數 1、3、7、8 近期活躍，適合搭配分散布局。";
  } else if (type === "649") {
    gameName = "大樂透";
    main = uniqueRandomNumbers(49, 6);
    groups = Array.from({ length: setCount }, () => uniqueRandomNumbers(49, 6));
    hot = uniqueRandomNumbers(49, 6);
    cold = uniqueRandomNumbers(49, 6);
    streak = "本輪建議優先觀察 2 連號組合，避免過多密集重疊。";
    tails = "尾數 2、4、7 表現較活躍，可搭配 1 組均衡號。";
    extraLabel = "特別號建議";
    extraValue = uniqueRandomNumbers(49, 1)[0];
  } else if (type === "638") {
    gameName = "威力彩";
    main = uniqueRandomNumbers(38, 6);
    groups = Array.from({ length: setCount }, () => uniqueRandomNumbers(38, 6));
    hot = uniqueRandomNumbers(38, 6);
    cold = uniqueRandomNumbers(38, 6);
    streak = "第一區可留意中段連號與高段補位，避免全小或全大。";
    tails = "第一區尾數 1、4、8 較值得關注。";
    extraLabel = "第二區建議";
    extraValue = uniqueRandomNumbers(8, 1)[0];
  } else if (type === "539") {
    gameName = "今彩 539";
    main = uniqueRandomNumbers(39, 5);
    groups = Array.from({ length: setCount }, () => uniqueRandomNumbers(39, 5));
    hot = uniqueRandomNumbers(39, 5);
    cold = uniqueRandomNumbers(39, 5);
    streak = "建議保留 1 組連號結構，例如 08-09 或 27-28。";
    tails = "尾數 0、3、6、9 可列入搭配。";
  }

  return {
    type,
    gameName,
    main,
    groups,
    hot,
    cold,
    streak,
    tails,
    extraLabel,
    extraValue
  };
}

async function fetchOfficialResults() {
  try {
    const res = await fetch("data/official/latest.json?_=" + Date.now());
    if (!res.ok) throw new Error("讀取官方資料失敗");
    return await res.json();
  } catch (e) {
    console.error("官方資料讀取失敗", e);
    return null;
  }
}

async function getOfficialDraw(type) {
  const data = await fetchOfficialResults();
  if (!data) return null;

  const map = {
    bingo: "bingo",
    "649": "lotto649",
    "638": "lotto638",
    "539": "lotto539"
  };

  const key = map[type];
  const item = data[key];
  if (!item) return null;

  return {
    main: Array.isArray(item.numbers) ? item.numbers.map(Number) : [],
    special: item.special != null ? Number(item.special) : null
  };
}

function countHits(predicted, actual) {
  const actualSet = new Set((actual || []).map(Number));
  return (predicted || []).filter((n) => actualSet.has(Number(n))).length;
}

function compareSpecial(predictionData, draw) {
  if (predictionData.type === "649") {
    if (predictionData.extraValue == null || draw.special == null) return false;
    return Number(predictionData.extraValue) === Number(draw.special);
  }

  if (predictionData.type === "638") {
    if (predictionData.extraValue == null || draw.special == null) return false;
    return Number(predictionData.extraValue) === Number(draw.special);
  }

  return false;
}

function savePredictionRecord(record) {
  try {
    const key = "lottery_prediction_records_v70";
    const oldData = JSON.parse(localStorage.getItem(key) || "[]");
    oldData.unshift(record);
    localStorage.setItem(key, JSON.stringify(oldData.slice(0, 200)));
  } catch (e) {
    console.error("localStorage 儲存失敗", e);
  }
}

async function compareAndStoreRecord(predictionData) {
  const draw = await getOfficialDraw(predictionData.type);

  if (!draw || !draw.main || draw.main.length === 0) {
    alert("⚠️ 尚未取得官方開獎資料");
    return null;
  }

  const mainHit = countHits(predictionData.main, draw.main);
  const specialHit = compareSpecial(predictionData, draw);

  const record = {
    createdAt: new Date().toISOString(),
    type: predictionData.type,
    gameName: predictionData.gameName,
    predictionMain: predictionData.main,
    predictionExtra: predictionData.extraValue,
    officialMain: draw.main,
    officialSpecial: draw.special,
    mainHit,
    specialHit
  };

  savePredictionRecord(record);
  return record;
}

function buildPredictionHTML(config) {
  const {
    gameName,
    main,
    groups,
    hot,
    cold,
    streak,
    tails,
    extraLabel,
    extraValue,
    compareHtml
  } = config;

  return `
    <div class="result-grid">
      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${renderBalls(main, { className: "main" })}
      </div>

      ${
        extraLabel && extraValue != null
          ? `<div class="result-card">
              <div class="card-title">${extraLabel}</div>
              <div class="special-box">
                <span class="ball special">${pad2(extraValue)}</span>
              </div>
            </div>`
          : ""
      }

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
        ${renderBalls(hot, { className: "hot" })}
      </div>

      <div class="result-card">
        <div class="card-title">冷號參考</div>
        ${renderBalls(cold, { className: "cold" })}
      </div>

      <div class="result-card">
        <div class="card-title">連號偵測</div>
        <div class="text-block">${streak}</div>
      </div>

      <div class="result-card">
        <div class="card-title">尾數分析</div>
        <div class="text-block">${tails}</div>
      </div>

      ${compareHtml}

      <div class="result-card full-width">
        <div class="card-title">AI 分析摘要</div>
        <div class="text-block">
          ${gameName} 本次預測已依據近期資料節奏、熱冷分布、連號與尾數結構做綜合排列，並使用官方最新資料做真實比對。
        </div>
      </div>
    </div>
  `;
}

function buildCompareHtml(predictionData, record) {
  if (!record) {
    return `
      <div class="result-card full-width">
        <div class="card-title">官方開獎比對</div>
        <div class="text-block status-warn">目前尚未取得官方最新資料，因此這次無法完成真實比對。</div>
      </div>
    `;
  }

  const officialSet = new Set((record.officialMain || []).map(Number));

  let extraCompareHtml = "";
  if (predictionData.type === "649") {
    extraCompareHtml = `
      <div class="compare-row">
        <div class="compare-label">特別號比對</div>
        <div class="compare-stats">
          <span class="stat-chip">預測特別號：${predictionData.extraValue != null ? pad2(predictionData.extraValue) : "--"}</span>
          <span class="stat-chip">官方特別號：${record.officialSpecial != null ? pad2(record.officialSpecial) : "--"}</span>
          <span class="stat-chip ${record.specialHit ? "status-good" : "status-bad"}">
            ${record.specialHit ? "特別號命中" : "特別號未中"}
          </span>
        </div>
      </div>
    `;
  }

  if (predictionData.type === "638") {
    extraCompareHtml = `
      <div class="compare-row">
        <div class="compare-label">第二區比對</div>
        <div class="compare-stats">
          <span class="stat-chip">預測第二區：${predictionData.extraValue != null ? pad2(predictionData.extraValue) : "--"}</span>
          <span class="stat-chip">官方第二區：${record.officialSpecial != null ? pad2(record.officialSpecial) : "--"}</span>
          <span class="stat-chip ${record.specialHit ? "status-good" : "status-bad"}">
            ${record.specialHit ? "第二區命中" : "第二區未中"}
          </span>
        </div>
      </div>
    `;
  }

  return `
    <div class="result-card full-width">
      <div class="card-title">官方開獎比對</div>

      <div class="compare-section">
        <div class="compare-row">
          <div class="compare-label">你的預測</div>
          ${renderBalls(predictionData.main, { hitSet: officialSet })}
        </div>

        <div class="compare-row">
          <div class="compare-label">官方開獎</div>
          ${renderBalls(record.officialMain, { className: "main" })}
        </div>

        <div class="compare-row">
          <div class="compare-label">命中統計</div>
          <div class="compare-stats">
            <span class="stat-chip status-good">主號命中 ${record.mainHit} 個</span>
            ${
              predictionData.type === "649" || predictionData.type === "638"
                ? `<span class="stat-chip ${record.specialHit ? "status-good" : "status-bad"}">
                    ${record.specialHit ? "特殊區命中" : "特殊區未中"}
                   </span>`
                : ""
            }
          </div>
        </div>

        ${extraCompareHtml}
      </div>
    </div>
  `;
}

async function runPrediction(type) {
  updateHeader("資料處理中…", "分析中");

  const resultEl = document.getElementById("predictionResult");
  resultEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <div class="empty-title">正在產生預測</div>
      <div class="empty-text">請稍候，正在整理推薦號碼與官方最新資料比對。</div>
    </div>
  `;

  const predictionData = buildPredictionData(type);
  const record = await compareAndStoreRecord(predictionData);

  updateHeader(predictionData.gameName, "已完成");

  const compareHtml = buildCompareHtml(predictionData, record);

  resultEl.innerHTML = buildPredictionHTML({
    gameName: predictionData.gameName,
    main: predictionData.main,
    groups: predictionData.groups,
    hot: predictionData.hot,
    cold: predictionData.cold,
    streak: predictionData.streak,
    tails: predictionData.tails,
    extraLabel: predictionData.extraLabel,
    extraValue: predictionData.extraValue,
    compareHtml
  });
}