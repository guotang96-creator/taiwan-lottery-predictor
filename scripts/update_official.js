const fs = require("fs");
const path = require("path");

const DIR = path.join(process.cwd(), "data", "official");

function read(file) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function write(file, data) {
  fs.writeFileSync(path.join(DIR, file), JSON.stringify(data, null, 2));
}

function clean(arr) {
  return arr.filter(x => x && x.issue); // 🔥 過濾壞資料
}

function latest(arr, n = 5) {
  return clean(arr)
    .sort((a, b) => String(b.issue).localeCompare(String(a.issue)))
    .slice(0, n);
}

function main() {
  const bingo = read("bingo.json");
  const lotto649 = read("lotto649.json");
  const superlotto638 = read("superlotto638.json");
  const dailycash = read("dailycash.json");

  const latestData = {
    version: "V72.7",
    updatedAt: new Date().toISOString(),
    games: {
      bingo: latest(bingo),
      lotto649: latest(lotto649),
      superlotto638: latest(superlotto638),
      dailycash: latest(dailycash)
    }
  };

  write("latest.json", latestData);

  console.log("✅ latest.json 已產生（已過濾壞資料）");
}

main();