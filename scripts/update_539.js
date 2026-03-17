const fs = require("fs");
const path = require("path");

const outputPath = path.join(__dirname, "..", "data", "539.json");

function buildMockLatest539() {
  const today = new Date();
  const rows = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const issue = `113${String(200 - i).padStart(6, "0")}`;
    const date = d.toISOString().slice(0, 10);

    const base = [3, 8, 14, 25, 36, 1, 7, 18, 22, 34, 5, 11, 19, 27, 33];
    const nums = [
      base[(i + 0) % base.length],
      base[(i + 3) % base.length],
      base[(i + 6) % base.length],
      base[(i + 9) % base.length],
      base[(i + 12) % base.length]
    ]
      .sort((a, b) => a - b);

    rows.push({
      issue,
      date,
      numbers: nums
    });
  }

  return rows;
}

function main() {
  const data = buildMockLatest539();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");

  console.log(`updated ${outputPath}`);
}

main();