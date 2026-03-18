const fs = require("fs");
const path = require("path");

const EXTRACT_DIR = path.join(process.cwd(), "data", "extracted");
const OUTPUT_DIR = path.join(process.cwd(), "data", "official");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readCSV(filePath) {
  const raw = fs.readFileSync(filePath);
  return raw.toString("utf8");
}

function parseCSV(text) {
  return text.split("\n").map(line => line.split(","));
}

function collectFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results = results.concat(collectFiles(full));
    } else if (file.endsWith(".csv")) {
      results.push(full);
    }
  }

  return results;
}

function detectType(content) {
  if (content.includes("今彩539")) return "539";
  if (content.includes("大樂透")) return "649";
  if (content.includes("威力彩")) return "638";
  return null;
}

function main() {
  ensureDir(OUTPUT_DIR);

  const files = collectFiles(EXTRACT_DIR);

  const data539 = [];
  const data649 = [];
  const data638 = [];

  for (const file of files) {
    const text = readCSV(file);
    const type = detectType(text);

    if (!type) continue;

    const rows = parseCSV(text);

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 10) continue;

      const date = r[2];

      if (type === "539") {
        data539.push({
          date,
          numbers: [r[6], r[7], r[8], r[9], r[10]].filter(Boolean)
        });
      }

      if (type === "649") {
        data649.push({
          date,
          numbers: [r[6], r[7], r[8], r[9], r[10], r[11]].filter(Boolean),
          special: r[12]
        });
      }

      if (type === "638") {
        data638.push({
          date,
          numbers: [r[6], r[7], r[8], r[9], r[10], r[11]].filter(Boolean),
          special: r[12]
        });
      }
    }
  }

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

  console.log("✅ JSON generated!");
}

main();