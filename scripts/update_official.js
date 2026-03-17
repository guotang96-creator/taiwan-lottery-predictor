/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "data", "official");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 🔥 使用穩定 API（可被 GitHub 存取）
const API = {
  lotto649: "https://api.taiwanlottery.io/lotto649",
  superlotto638: "https://api.taiwanlottery.io/superlotto638",
  dailycash: "https://api.taiwanlottery.io/dailycash",
  bingo: "https://api.taiwanlottery.io/bingo"
};

async function main() {
  ensureDir(OUTPUT_DIR);

  const results = {};
  const errors = [];

  for (const key of Object.keys(API)) {
    try {
      console.log(`[FETCH] ${key}`);
      const data = await fetchJSON(API[key]);

      // 統一格式
      let parsed = [];

      if (key === "lotto649") {
        parsed = data.map(d => ({
          issue: d.issue,
          drawDate: d.date,
          numbers: d.numbers,
          special: d.special
        }));
      }

      if (key === "superlotto638") {
        parsed = data.map(d => ({
          issue: d.issue,
          drawDate: d.date,
          numbers1: d.numbers,
          numbers2: d.special
        }));
      }

      if (key === "dailycash") {
        parsed = data.map(d => ({
          issue: d.issue,
          drawDate: d.date,
          numbers: d.numbers
        }));
      }

      if (key === "bingo") {
        parsed = data.map(d => ({
          issue: d.issue,
          drawDate: d.date,
          numbers: d.numbers
        }));
      }

      writeJson(path.join(OUTPUT_DIR, `${key}.json`), parsed);

      console.log(`[OK] ${key}: ${parsed.length}`);
      results[key] = parsed.length;

    } catch (err) {
      console.log(`[FAIL] ${key}: ${err.message}`);
      errors.push({ key, error: err.message });

      // 保留舊資料
      const file = path.join(OUTPUT_DIR, `${key}.json`);
      if (!fs.existsSync(file)) writeJson(file, []);
    }
  }

  const meta = {
    version: "V66.2",
    updatedAt: new Date().toISOString(),
    source: "API fallback (stable)",
    results,
    errors
  };

  writeJson(path.join(OUTPUT_DIR, "meta.json"), meta);

  console.log("[DONE] update complete");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
