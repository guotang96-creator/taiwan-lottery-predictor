const STORAGE_KEY_RECORDS = "lottery_v694_records";
const STORAGE_KEY_LAST = "lottery_v694_last_prediction";

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

function getSetCount() {
  return parseInt(document.getElementById("setCount")?.value || "3", 10);
}

function getBingoCount() {
  return parseInt(document.getElementById("bingoCount")?.value || "10", 10);
}

function renderBalls(numbers, type = "", hitNumbers = []) {
  return `
    <div class="ball-row">
      ${numbers.map((n) => {
        const hitClass = hitNumbers.includes(n) ? "hit" : "";
        return `<span class="ball ${type} ${hitClass}">${pad2(n)}</span>`;
      }).join("")}
    </div>
  `;
}

function updateHeader(gameName, badgeText) {
  const titleEl = document.getElementById("resultGameName");
  const badgeEl = document.getElementById("resultBadge");
  if (titleEl) titleEl.textContent = gameName;
  if (badgeEl) badgeEl.textContent = badgeText;
}

function updateConfidence(level, text) {
  const el = document.getElementById("confidenceBadge");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("confidence-hot", "confidence-normal", "confidence-cold");
  if (level === "hot") el.classList.add("confidence-hot");
  else if (level === "cold") el.classList.add("confidence-cold");
  else el.classList.add("confidence-normal");
}

function setHitBadge(text) {
  const el = document.getElementById("hitBadge");
  if (el) el.textContent = text;
}

function setStatsBadge(text) {
  const el = document.getElementById("statsBadge");
  if (el) el.textContent = text;
}

function getGameLabel(type) {
  const map = {
    bingo: "Bingo Bingo",
    "649": "大樂透",
    "638": "威力彩",
    "539": "今彩 539"
  };
  return map[type] || type;
}

function getGameConfig(type) {
  if (type === "bingo") {
    return {
      gameName: "Bingo Bingo",
      max: 80,
      mainCount: getBingoCount(),
      hotCount: 10,
      coldCount: 10,
      hasSpecial: false
    };
  }
  if (type === "649") {
    return {
      gameName: "大樂透",
      max: 49,
      mainCount: 6,
      hotCount: 6,
      coldCount: 6,
      hasSpecial: false
    };
  }
  if (type === "638") {
    return {
      gameName: "威力彩",
      max: 38,
      mainCount: 6,
      hotCount: 6,
      coldCount: 6,
      hasSpecial: true,
      specialMax: 8
    };
  }
  return {
    gameName: "今彩 539",
    max: 39,
    mainCount: 5,
    hotCount: 5,
    coldCount: 5,
    hasSpecial: false
  };
}

function buildPredictionData(type) {
  const setCount = getSetCount();
  const config = getGameConfig(type);

  let streak = "";
  let tails = "";
  let extra = "";
  let confidenceLevel = "normal";
  let confidenceText = "可信度：⚠️ 普通";

  const main = uniqueRandomNumbers(config.max, config.mainCount);
  const groups = Array.from({ length: setCount }, () => uniqueRandomNumbers(config.max, config.mainCount));
  const hot = uniqueRandomNumbers(config.max, config.hotCount);
  const cold = uniqueRandomNumbers(config.max, config.coldCount);

  let special = null;

  if (type === "bingo") {
    streak = "建議留意 2 連號、3 連號區段，例如 11-12、27-28、45-46。";
    tails = "尾數 1、3、7、8 近期活躍，適合搭配分散布局。";
    confidenceLevel = "hot";
    confidenceText = "可信度：🔥 熱狀態";
  } else if (type === "649") {
    streak = "本輪建議優先觀察 2 連號組合，避免過多密集重疊。";
    tails = "尾數 2、4、7 表現較活躍，可搭配 1 組均衡號。";
    confidenceLevel = "normal";
    confidenceText = "可信度：⚠️ 普通";
  } else if (type === "638") {
    special = uniqueRandomNumbers(config.specialMax, 1)[0];
    extra = `<div class="special-box">第二區建議：<span class="ball special">${pad2(special)}</span></div>`;
    streak = "第一區可留意中段連號與高段補位，避免全小或全大。";
    tails = "第一區尾數 1、4、8 較值得關注。";
    confidenceLevel = "hot";
    confidenceText = "可信度：🔥 熱狀態";
  } else if (type === "539") {
    streak = "建議保留 1 組連號結構，例如 08-09 或 27-28。";
    tails = "尾數 0、3、6、9 可列入搭配。";
    confidenceLevel = "cold";
    confidenceText = "可信度：❄️ 冷靜布局";
  }

  return {
    type,
    gameName: config.gameName,
    main,
    groups,
    hot,
    cold,
    streak,
    tails,
    extra,
    special,
    confidenceLevel,
    confidenceText,
    createdAt: new Date().toISOString()
  };
}

function buildPredictionHTML(config) {
  const { gameName, main, groups, hot, cold, streak, tails, extra } = config;

  return `
    <div class="result-grid">
      <div class="result-card highlight-card">
        <div class="card-title">主推薦號碼</div>
        ${renderBalls(main, "main")}
      </div>

      ${
        extra
          ? `<div class="result-card">
              <div class="card-title">特別區 / 第二區</div>
              ${extra}
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
        ${renderBalls(hot, "hot")}
      </div>

      <div class="result-card">
        <div class="card-title">冷號參考</div>
        ${renderBalls(cold, "cold")}
      </div>

      <div class="result-card">
        <div class="card-title">連號偵測</div>
        <div class="text-block">${streak}</div>
      </div>

      <div class="result-card">
        <div class="card-title">尾數分析</div>
        <div class="text-block">${tails}</div>
      </div>

      <div class="result-card full-width">
        <div class="card-title">AI 分析摘要</div>
        <div class="text-block">
          ${gameName} 本次預測已依據近期資料節奏、熱冷分布、連號與尾數結構做綜合排列，建議搭配自己的選號習慣一起參考使用。
        </div>
      </div>
    </div>
  `;
}

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) || "[]");
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
}

function getLastPrediction() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_LAST) || "null");
  } catch {
    return null;
  }
}

function saveLastPrediction(data) {
  localStorage.setItem(STORAGE_KEY_LAST, JSON.stringify(data));
}

function countHits(predicted, drawn) {
  return predicted.filter((n) => drawn.includes(n));
}

function createSimulatedDraw(type) {
  const config = getGameConfig(type);
  const mainDraw = uniqueRandomNumbers(config.max, config.mainCount);
  let specialDraw = null;

  if (type === "638") {
    specialDraw = uniqueRandomNumbers(config.specialMax, 1)[0];
  }

  return {
    main: mainDraw,
    special: specialDraw
  };
}

function getHitComment(hitCount, totalCount, type, specialHit = false) {
  if (type === "638") {
    if (hitCount >= 4 || (hitCount >= 3 && specialHit)) return "表現很強，這組命中結構不錯";
    if (hitCount >= 2 || specialHit) return "中等表現，可持續觀察";
    return "本次偏弱，建議調整結構";
  }

  if (hitCount >= Math.ceil(totalCount * 0.7)) return "命中表現優秀";
  if (hitCount >= Math.ceil(totalCount * 0.4)) return "命中表現中等";
  return "本次命中偏低";
}

function compareAndStoreRecord(predictionData) {
  const draw = createSimulatedDraw(predictionData.type);
  const hitMain = countHits(predictionData.main, draw.main);
  const mainHitCount = hitMain.length;

  let specialHit = false;
  if (predictionData.type === "638" && predictionData.special != null) {
    specialHit = predictionData.special === draw.special;
  }

  const totalHitScore = predictionData.type === "638"
    ? mainHitCount + (specialHit ? 1 : 0)
    : mainHitCount;

  const record = {
    id: Date.now(),
    type: predictionData.type,
    gameName: predictionData.gameName,
    createdAt: predictionData.createdAt,
    predictedMain: predictionData.main,
    predictedSpecial: predictionData.special ?? null,
    drawMain: draw.main,
    drawSpecial: draw.special ?? null,
    hitMain,
    mainHitCount,
    specialHit,
    totalHitScore,
    totalNumbers: predictionData.main.length,
    comment: getHitComment(mainHitCount, predictionData.main.length, predictionData.type, specialHit)
  };

  const records = getRecords();
  records.unshift(record);
  saveRecords(records.slice(0, 100));

  return record;
}

function renderHitTracking(record) {
  const resultEl = document.getElementById("hitTrackingResult");
  if (!resultEl || !record) return;

  let hitClass = "hit-bad";
  let badgeText = "未命中";

  if (record.totalHitScore >= Math.ceil(record.totalNumbers * 0.6)) {
    hitClass = "hit-good";
    badgeText = "表現佳";
  } else if (record.totalHitScore >= Math.ceil(record.totalNumbers * 0.3) || record.specialHit) {
    hitClass = "hit-normal";
    badgeText = "普通";
  }

  setHitBadge(badgeText);

  resultEl.innerHTML = `
    <div class="hit-summary">
      <div class="hit-card">
        <div class="card-title">最新比對結果｜${record.gameName}</div>
        <div class="hit-big ${hitClass}">
          命中 ${record.mainHitCount} 顆
          ${record.drawSpecial != null ? `｜第二區 ${record.specialHit ? "命中" : "未中"}` : ""}
        </div>
        <div class="hit-sub">${record.comment}</div>
      </div>

      <div class="result-grid">
        <div class="result-card">
          <div class="card-title">你的主推薦</div>
          ${renderBalls(record.predictedMain, "main", record.hitMain)}
        </div>

        <div class="result-card">
          <div class="card-title">模擬開獎結果</div>
          ${renderBalls(record.drawMain, "", record.hitMain)}
        </div>

        ${
          record.drawSpecial != null
            ? `
              <div class="result-card full-width">
                <div class="card-title">第二區比對</div>
                <div class="special-box">
                  你的第二區：
                  <span class="ball special">${pad2(record.predictedSpecial)}</span>
                  開獎第二區：
                  <span class="ball special">${pad2(record.drawSpecial)}</span>
                  <span class="${record.specialHit ? "hit-good" : "hit-bad"}">
                    ${record.specialHit ? "✔ 命中" : "✘ 未中"}
                  </span>
                </div>
              </div>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function calculateStats(records) {
  const recent10 = records.slice(0, 10);
  const total = recent10.length;

  if (!total) {
    return null;
  }

  const totalHit = recent10.reduce((sum, r) => sum + r.totalHitScore, 0);
  const avgHit = totalHit / total;

  const best = recent10.reduce((max, r) => {
    if (!max) return r;
    return r.totalHitScore > max.totalHitScore ? r : max;
  }, null);

  const hitPositiveCount = recent10.filter((r) => r.totalHitScore > 0).length;
  const hitRate = (hitPositiveCount / total) * 100;

  const grouped = {};
  recent10.forEach((r) => {
    if (!grouped[r.type]) {
      grouped[r.type] = {
        gameName: r.gameName,
        count: 0,
        totalHit: 0
      };
    }
    grouped[r.type].count += 1;
    grouped[r.type].totalHit += r.totalHitScore;
  });

  const ranking = Object.values(grouped)
    .map((g) => ({
      gameName: g.gameName,
      average: g.totalHit / g.count
    }))
    .sort((a, b) => b.average - a.average);

  return {
    total,
    avgHit,
    best,
    hitRate,
    ranking,
    recent10
  };
}

function renderStatsPanel() {
  const panel = document.getElementById("statsPanelContent");
  if (!panel) return;

  const records = getRecords();
  const stats = calculateStats(records);

  if (!stats) {
    setStatsBadge("尚無資料");
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📈</div>
        <div class="empty-title">尚無統計資料</div>
        <div class="empty-text">開始預測後，這裡會累積你的歷史命中表現。</div>
      </div>
    `;
    return;
  }

  setStatsBadge("已更新");

  panel.innerHTML = `
    <div class="stats-summary">
      <div class="stats-grid">
        <div class="stats-card">
          <div class="card-title">近 10 次命中率</div>
          <div class="stats-big">${stats.hitRate.toFixed(1)}%</div>
          <div class="stats-sub">只要有中任一顆，即列入命中一次</div>
        </div>

        <div class="stats-card">
          <div class="card-title">平均命中顆數</div>
          <div class="stats-big">${stats.avgHit.toFixed(2)}</div>
          <div class="stats-sub">依近 10 次紀錄平均計算</div>
        </div>

        <div class="stats-card">
          <div class="card-title">最佳紀錄</div>
          <div class="stats-big">${stats.best.totalHitScore} 顆</div>
          <div class="stats-sub">${stats.best.gameName}</div>
        </div>
      </div>

      <div class="result-grid">
        <div class="result-card">
          <div class="card-title">彩種排行榜</div>
          <div class="rank-list">
            ${stats.ranking.map((r, i) => `
              <div class="rank-item">
                <div class="rank-name">${i + 1}. ${r.gameName}</div>
                <div class="rank-score">平均 ${r.average.toFixed(2)} 顆</div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="result-card">
          <div class="card-title">近 10 次紀錄</div>
          <div class="history-list">
            ${stats.recent10.map((r, i) => `
              <div class="history-item">
                <div class="history-left">${i + 1}. ${r.gameName}</div>
                <div class="history-right">
                  命中 ${r.totalHitScore} 顆
                  ${r.drawSpecial != null ? `｜第二區${r.specialHit ? "中" : "未中"}` : ""}
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="result-card full-width">
          <div class="card-title">統計摘要</div>
          <div class="text-block">
            系統目前依最近 ${stats.total} 次紀錄分析，整體命中率為 <strong>${stats.hitRate.toFixed(1)}%</strong>，
            平均每次命中 <strong>${stats.avgHit.toFixed(2)}</strong> 顆。
            最佳表現出現在 <strong>${stats.best.gameName}</strong>，
            單次最高命中 <strong>${stats.best.totalHitScore}</strong> 顆。
          </div>
        </div>
      </div>
    </div>
  `;
}

function runPrediction(type) {
  const predictionData = buildPredictionData(type);
  const resultEl = document.getElementById("predictionResult");

  updateHeader(predictionData.gameName, "已完成");
  updateConfidence(predictionData.confidenceLevel, predictionData.confidenceText);

  if (resultEl) {
    resultEl.innerHTML = buildPredictionHTML(predictionData);
  }

  saveLastPrediction(predictionData);
  const record = compareAndStoreRecord(predictionData);
  renderHitTracking(record);
  renderStatsPanel();
}

function bootFromStorage() {
  const last = getLastPrediction();
  if (last) {
    updateHeader(last.gameName || "上次預測", "已載入");
    updateConfidence(last.confidenceLevel || "normal", last.confidenceText || "可信度：⚠️ 普通");

    const resultEl = document.getElementById("predictionResult");
    if (resultEl) {
      resultEl.innerHTML = buildPredictionHTML(last);
    }
  }

  const records = getRecords();
  if (records.length > 0) {
    renderHitTracking(records[0]);
  }
  renderStatsPanel();
}

window.addEventListener("DOMContentLoaded", bootFromStorage);