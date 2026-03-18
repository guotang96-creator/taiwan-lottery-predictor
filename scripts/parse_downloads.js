const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const DOWNLOAD_DIR = path.join(process.cwd(), "data", "downloads");
const EXTRACT_DIR = path.join(process.cwd(), "data", "extracted");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  ensureDir(EXTRACT_DIR);

  if (!fs.existsSync(DOWNLOAD_DIR)) {
    console.log("❌ downloads 資料夾不存在");
    process.exit(1);
  }

  const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith(".zip"));

  if (files.length === 0) {
    console.log("❌ 沒有 zip 檔");
    process.exit(1);
  }

  let total = 0;

  for (const file of files) {
    const fullPath = path.join(DOWNLOAD_DIR, file);

    try {
      console.log("📦 解壓:", file);

      const zip = new AdmZip(fullPath);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.entryName.endsWith(".csv")) {
          const outPath = path.join(EXTRACT_DIR, entry.entryName);

          ensureDir(path.dirname(outPath));

          fs.writeFileSync(outPath, entry.getData());
          total++;
        }
      }

    } catch (err) {
      console.log("❌ 解壓失敗:", file, err.message);
    }
  }

  console.log("✅ CSV 總數:", total);

  if (total === 0) {
    console.log("❌ 沒有解出任何 CSV");
    process.exit(1);
  }

  console.log("🎉 DONE");
}

main();