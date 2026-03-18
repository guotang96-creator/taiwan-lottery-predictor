// app.js
(() => {
  const APP_VERSION = "official-live-v1";

  const DATA_PATHS = {
    officialLatest: [
      "./official_latest.json",
      "./data/official_latest.json",
      "./docs/official_latest.json",
      "/taiwan-lottery-predictor/official_latest.json",
      "/taiwan-lottery-predictor/data/official_latest.json",
      "/taiwan-lottery-predictor/docs/official_latest.json"
    ],
    latest: [
      "./latest.json",
      "./data/latest.json",
      "./docs/latest.json",
      "/taiwan-lottery-predictor/latest.json",
      "/taiwan-lottery-predictor/data/latest.json",
      "/taiwan-lottery-predictor/docs/latest.json"
    ]
  };

  const GAME_META = {
    bingo: {
      title: "賓果 Bingo Bingo",
      count: 20
    },
    daily539: {
      title: "今彩 539",
      count: 5
    },
    lotto649: {
      title: "大樂透",
      count: 6
    },
    superLotto638: {
      title: "威力彩",
      count: 6
    }
  };

  function log(...args) {
    console.log("[LotteryApp]", ...args);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDate(input) {
    if (!input) return "—";
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return String(input);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function normalizeNumbers(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(v => Number(v))
      .filter(v => Number.isFinite(v))
      .map(v => pad2(v));
  }

  function safeText(v, fallback = "—") {
    if (v === null || v === undefined || v === "") return fallback;
    return String(v);
  }

  async function fetchJsonFromCandidates(paths) {
    const errors = [];

    for (const path of paths) {
      try {
        const res = await fetch(`${path}?v=${Date.now()}`, {
          cache: "no-store"
        });

        if (!res.ok) {
          errors.push(`${path} => HTTP ${res.status}`);
          continue;
        }

        const json = await res.json();
        log("Loaded JSON:", path, json);
        return { path, json };
      } catch (err) {
        errors.push(`${path} => ${err.message}`);
      }
    }

    throw new Error(errors.join(" | "));
  }

  function getOfficialGameData(officialJson, gameKey) {
    if (!officialJson || typeof officialJson !== "object") return null;

    if (officialJson.officialLatest && officialJson.officialLatest[gameKey]) {
      return officialJson.officialLatest[gameKey];
    }

    if (officialJson[gameKey] && officialJson[gameKey].latestOfficial) {
      return officialJson[gameKey].latestOfficial;
    }

    if (officialJson[gameKey] && officialJson[gameKey].latest) {
      return officialJson[gameKey].latest;
    }

    return null;
  }

  function getMergedGameData(latestJson, gameKey) {
    if (!latestJson || typeof latestJson !== "object") return null;

    if (latestJson[gameKey]?.latestOfficial) {
      return latestJson[gameKey].latestOfficial;
    }

    if (latestJson[gameKey]?.latest) {
      return latestJson[gameKey].latest;
    }

    if (latestJson.officialLatest?.[gameKey]) {
      return latestJson.officialLatest[gameKey];
    }

    return latestJson[gameKey] || null;
  }

  function unifyGameData(gameKey, raw) {
    if (!raw) return null;

    const numbers = normalizeNumbers(raw.numbers || raw.drawNumberSize || []);
    const orderNumbers = normalizeNumbers(raw.orderNumbers || raw.drawOrderNums || []);
    const specialNumber = raw.specialNumber ?? raw.superNum ?? null;

    return {
      gameKey,
      title: GAME_META[gameKey]?.title || gameKey,
      period: safeText(raw.period),
      drawDate: raw.drawDate || raw.lotteryDate || raw.date || "",
      redeemableDate: raw.redeemableDate || "",
      numbers,
      orderNumbers,
      specialNumber: specialNumber !== null && specialNumber !== undefined && specialNumber !== ""
        ? pad2(Number(specialNumber))
        : null,
      source: raw.source || "unknown"
    };
  }

  function pickBestData(officialJson, latestJson) {
    const result = {};

    for (const gameKey of Object.keys(GAME_META)) {
      const officialData = unifyGameData(gameKey, getOfficialGameData(officialJson, gameKey));
      const latestData = unifyGameData(gameKey, getMergedGameData(latestJson, gameKey));
      result[gameKey] = officialData || latestData || null;
    }

    return result;
  }

  function ensureLatestContainer() {
    let container = document.getElementById("latest-results");

    if (!container) {
      container = document.createElement("section");
      container.id = "latest-results";
      container.style.maxWidth = "1200px";
      container.style.margin = "20px auto";
      container.style.padding = "16px";

      const target =
        document.querySelector("main") ||
        document.querySelector(".container") ||
        document.body;

      target.prepend(container);
    }

    return container;
  }

  function createNumberBalls(numbers) {
    if (!numbers || !numbers.length) {
      return `<div style="color:#666;">尚無號碼資料</div>`;
    }

    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${numbers.map(num => `
          <span style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            min-width:40px;
            height:40px;
            padding:0 10px;
            border-radius:999px;
            background:#d81b60;
            color:#fff;
            font-weight:700;
            box-shadow:0 2px 6px rgba(0,0,0,0.15);
          ">${num}</span>
        `).join("")}
      </div>
    `;
  }

  function createSpecialBall(num, label = "特別號") {
    if (!num || num === "NaN") return "";
    return `
      <div style="margin-top:10px;">
        <span style="font-size:14px;color:#666;margin-right:8px;">${label}</span>
        <span style="
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:40px;
          height:40px;
          padding:0 10px;
          border-radius:999px;
          background:#ff9800;
          color:#fff;
          font-weight:700;
          box-shadow:0 2px 6px rgba(0,0,0,0.15);
        ">${num}</span>
      </div>
    `;
  }

  function createGameCard(data) {
    if (!data) {
      return `
        <div style="
          background:#fff;
          border-radius:16px;
          padding:18px;
          box-shadow:0 4px 16px rgba(0,0,0,0.08);
          border:1px solid #eee;
        ">
          <div style="font-size:18px;font-weight:700;margin-bottom:8px;">無資料</div>
          <div style="color:#888;">目前尚未取得資料</div>
        </div>
      `;
    }

    const specialLabel = data.gameKey === "superLotto638"
      ? "第二區"
      : data.gameKey === "lotto649"
        ? "特別號"
        : data.gameKey === "bingo"
          ? "超級獎號"
          : "特別號";

    const numbersForDisplay =
      data.gameKey === "bingo" && data.numbers.length === 0
        ? data.orderNumbers
        : data.numbers;

    return `
      <div style="
        background:#fff;
        border-radius:18px;
        padding:20px;
        box-shadow:0 4px 16px rgba(0,0,0,0.08);
        border:1px solid #ececec;
      ">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-size:22px;font-weight:800;color:#222;">${data.title}</div>
            <div style="font-size:14px;color:#666;margin-top:6px;">期數：${safeText(data.period)}</div>
            <div style="font-size:14px;color:#666;margin-top:4px;">開獎時間：${formatDate(data.drawDate)}</div>
          </div>
          <div style="
            background:#f5f5f5;
            color:#444;
            border-radius:999px;
            padding:6px 12px;
            font-size:12px;
            font-weight:700;
          ">
            ${safeText(data.source, "official")}
          </div>
        </div>

        <div style="margin-top:16px;">
          ${createNumberBalls(numbersForDisplay)}
          ${createSpecialBall(data.specialNumber, specialLabel)}
        </div>
      </div>
    `;
  }

  function renderLatestResults(bestData, sourceInfo = {}) {
    const container = ensureLatestContainer();

    container.innerHTML = `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:16px;
      ">
        <div>
          <h2 style="margin:0;font-size:28px;color:#222;">最新官方開獎資料</h2>
          <div style="margin-top:6px;color:#666;font-size:14px;">
            版本：${APP_VERSION}
          </div>
        </div>
        <div style="color:#666;font-size:13px;">
          official：${sourceInfo.officialPath || "—"}<br>
          latest：${sourceInfo.latestPath || "—"}
        </div>
      </div>

      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));
        gap:16px;
      ">
        ${createGameCard(bestData.bingo)}
        ${createGameCard(bestData.daily539)}
        ${createGameCard(bestData.lotto649)}
        ${createGameCard(bestData.superLotto638)}
      </div>
    `;
  }

  function updateLegacyDom(bestData) {
    const mapping = [
      ["bingo", "bingo"],
      ["daily539", "539"],
      ["lotto649", "lotto649"],
      ["superLotto638", "superlotto638"]
    ];

    mapping.forEach(([gameKey, shortKey]) => {
      const data = bestData[gameKey];
      if (!data) return;

      const periodEl =
        document.getElementById(`${shortKey}-period`) ||
        document.getElementById(`${gameKey}-period`);

      const dateEl =
        document.getElementById(`${shortKey}-date`) ||
        document.getElementById(`${gameKey}-date`);

      const numbersEl =
        document.getElementById(`${shortKey}-numbers`) ||
        document.getElementById(`${gameKey}-numbers`);

      const specialEl =
        document.getElementById(`${shortKey}-special`) ||
        document.getElementById(`${gameKey}-special`);

      const numbersForDisplay =
        data.gameKey === "bingo" && data.numbers.length === 0
          ? data.orderNumbers
          : data.numbers;

      if (periodEl) periodEl.textContent = safeText(data.period);
      if (dateEl) dateEl.textContent = formatDate(data.drawDate);
      if (numbersEl) numbersEl.textContent = numbersForDisplay.join(" ");
      if (specialEl) specialEl.textContent = data.specialNumber || "—";
    });
  }

  function showError(message) {
    const container = ensureLatestContainer();
    container.innerHTML = `
      <div style="
        max-width:900px;
        margin:20px auto;
        padding:18px;
        border-radius:16px;
        background:#fff3f3;
        border:1px solid #f3b7b7;
        color:#a40000;
      ">
        <div style="font-size:22px;font-weight:800;margin-bottom:8px;">資料載入失敗</div>
        <div style="line-height:1.7;">${message}</div>
      </div>
    `;
  }

  async function loadAllData() {
    let officialResult = null;
    let latestResult = null;

    try {
      officialResult = await fetchJsonFromCandidates(DATA_PATHS.officialLatest);
    } catch (err) {
      log("official_latest.json 載入失敗", err.message);
    }

    try {
      latestResult = await fetchJsonFromCandidates(DATA_PATHS.latest);
    } catch (err) {
      log("latest.json 載入失敗", err.message);
    }

    if (!officialResult && !latestResult) {
      throw new Error("official_latest.json 與 latest.json 都載入失敗");
    }

    const bestData = pickBestData(
      officialResult?.json || null,
      latestResult?.json || null
    );

    window.LotteryData = {
      officialLatest: officialResult?.json || null,
      latest: latestResult?.json || null,
      bestData
    };

    renderLatestResults(bestData, {
      officialPath: officialResult?.path || "",
      latestPath: latestResult?.path || ""
    });

    updateLegacyDom(bestData);

    log("Data ready:", window.LotteryData);
  }

  async function init() {
    try {
      await loadAllData();
    } catch (err) {
      console.error(err);
      showError(err.message || "未知錯誤");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
