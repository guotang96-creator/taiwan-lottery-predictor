const fs = require("fs");
const path = require("path");

const EXTRACT_DIR = path.join(process.cwd(), "data", "extracted");
const OUTPUT_DIR = path.join(process.cwd(), "data", "official");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// 🔥 解決 Big5 問題（核心）
function readFileAuto(filePath) {
  const buffer = fs.readFileSync(filePath);

  // 嘗試 UTF-8
  let text = buffer.toString("utf8");

  // 如果出現亂碼（常見特徵）
  if (text.includes("�") || text.includes("???")) {
    try {
      const iconv = require("iconv-lite");
      text = iconv.decode(buffer, "big5");
    } catch (e) {
      // fallback
    }
  }

  return text;
}

function parseCSV(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.split(","))
    .filter(row => row.length > 5);
}

function collectFiles(dir) {
  let results = [];

  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);

  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results = results.concat(collectFiles(full));
    } else if (file.toLowerCase().endsWith(".csv")) {
      results.push(full);
    }
  }

  return results;
}

function detectType(text) {
  if (text.includes("今彩539")) return "539";
  if (text.includes("大樂透")) return "649";
  if (text.includes("威力彩")) return "638";
  return null;
}

function safeNum(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function main() {
  ensureDir(OUTPUT_DIR);

  const files = collectFiles(EXTRACT_DIR);

  const data539 = [];
  const data649 = [];
  const data638 = [];

  console.log("📦 CSV files:", files.length);

  for (const file of files) {
    try {
      const text = readFileAuto(file);
      const type = detectType(text);

      if (!type) continue;

      const rows = parseCSV(text);

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];

        if (!r || r.length < 10) continue;

        const date = r[2];

        if (type === "539") {
          const nums = [r[6], r[7], r[8], r[9], r[10]]
            .map(safeNum)
            .filter(n => n !== null);

          if (nums.length === 5) {
            data539.push({ date, numbers: nums });
          }
        }

        if (type === "649") {
          const nums = [r[6], r[7], r[8], r[9], r[10], r[11]]
            .map(safeNum)
            .filter(n => n !== null);

          const special = safeNum(r[12]);

          if (nums.length === 6) {
            data649.push({ date, numbers: nums, special });
          }
        }

        if (type === "638") {
          const nums = [r[6], r[7], r[8], r[9], r[10], r[11]]
            .map(safeNum)
            .filter(n => n !== null);

          const special = safeNum(r[12]);

          if (nums.length === 6) {
            data638.push({ date, numbers: nums, special });
          }
        }
      }
    } catch (err) {
      console.error("❌ error file:", file, err.message);
    }
  }

  // 🔥 排序（最新在前）
  const sortByDateDesc = (a, b) => (a.date < b.date ? 1 : -1);

  data539.sort(sortByDateDesc);
  data649.sort(sortByDateDesc);
  data638.sort(sortByDateDesc);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "dailycash.json"),
    JSON.stringify(data539, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "lotto649.json"),
    JSON.stringify(data649, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "superlotto638.json"),
    JSON.stringify(data638, null, 2)
  );

  console.log("✅ DONE");
  console.log("539:", data539.length);
  console.log("649:", data649.length);
  console.log("638:", data638.length);
}

main();