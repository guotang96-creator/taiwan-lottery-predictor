const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const DOWNLOAD_DIR = "data/downloads";
const OUTPUT_DIR = "data/official";

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");

    if (cols.length < 10) continue;

    const issue = cols[0];
    const date = cols[1];

    const numbers = cols.slice(2, 8)
      .map(x => parseInt(x))
      .filter(n => !isNaN(n));

    const special = parseInt(cols[8]);

    rows.push({
      issue,
      date,
      numbers,
      special: isNaN(special) ? null : special
    });
  }

  return rows;
}

function run() {
  const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith(".zip"));

  const result = {
    bingo: [],
    lotto649: [],
    superlotto638: [],
    dailycash: []
  };

  files.forEach(file => {
    const zip = new AdmZip(path.join(DOWNLOAD_DIR, file));

    zip.getEntries().forEach(entry => {
      if (!entry.entryName.endsWith(".csv")) return;

      const raw = entry.getData().toString("utf8");
      const rows = parseCSV(raw);

      if (entry.entryName.includes("649")) {
        result.lotto649.push(...rows);
      } else if (entry.entryName.includes("638")) {
        result.superlotto638.push(...rows);
      } else if (entry.entryName.includes("539")) {
        result.dailycash.push(...rows);
      } else if (entry.entryName.toLowerCase().includes("bingo")) {
        result.bingo.push(...rows);
      }
    });
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "meta.json"),
    JSON.stringify(result, null, 2)
  );

  console.log("✅ parse 完成");
}

run();