document.addEventListener("DOMContentLoaded", () => {
  const loadBtn = document.getElementById("loadBtn");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const backtestBtn = document.getElementById("backtestBtn");
  const battleBtn = document.getElementById("battleBtn");
  const statusEl = document.getElementById("status");

  function setStatus(text) {
    if (statusEl) statusEl.innerText = text;
    console.log(text);
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      setStatus("讀取按鈕有作用");
      alert("讀取按鈕有作用");
    });
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", () => {
      setStatus("分析按鈕有作用");
      alert("分析按鈕有作用");
    });
  }

  if (backtestBtn) {
    backtestBtn.addEventListener("click", () => {
      setStatus("回測按鈕有作用");
      alert("回測按鈕有作用");
    });
  }

  if (battleBtn) {
    battleBtn.addEventListener("click", () => {
      setStatus("實戰按鈕有作用");
      alert("實戰按鈕有作用");
    });
  }

  setStatus("測試版 app.js 已載入");
});