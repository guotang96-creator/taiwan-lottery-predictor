const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(process.cwd(), "data", "official");

async function fetch539() {
  const url = "https://www.taiwanlottery.com.tw/lotto/DailyCash/history.aspx";

  const res = await fetch(url);
  const html = await res.text();

  const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/gs)];

  const results = [];

  for (const row of rows) {
    const text = row[1].replace(/<[^>]+>/g, " ").trim();

    const match = text.match(/(\d{3}\/\d{2}\/\d{2}).*?(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})/);

    if (match) {
      results.push({
        game: "dailycash",
        issue: "",
        drawDate: match[1].replace(/\//g, "-"),
        numbers: [
          Number(match[2]),
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6])
        ]
      });
    }
  }

  return results.slice(0, 100);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log("抓 539 資料...");
  const data539 = await fetch539();

  fs.writeFileSync(
    path.join(OUT_DIR, "dailycash.json"),
    JSON.stringify(data539, null, 2)
  );

  console.log("完成 ✔");
}

main();