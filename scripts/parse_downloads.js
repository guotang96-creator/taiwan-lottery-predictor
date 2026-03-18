const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const DOWNLOAD_DIR = path.join(process.cwd(), "data", "downloads");
const OFFICIAL_DIR = path.join(process.cwd(), "data", "official");
const EXTRACT_DIR = path.join(process.cwd(), "data", "extracted");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function listZipFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.toLowerCase().endsWith(".zip"))
    .map(name => path.join(dir, name))
    .sort();
}

function safeText(buffer) {
  try {
    return buffer.toString("utf8");
  } catch {
    return "";
  }
}

function detectFileType(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".xls")) return "xls";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".json")) return "json";
  return "other";
}

function main() {
  ensureDir(OFFICIAL_DIR);
  ensureDir(EXTRACT_DIR);

  const zipFiles = listZipFiles(DOWNLOAD_DIR);
  const inventory = [];

  for (const zipPath of zipFiles) {
    const zipName = path.basename(zipPath);
    const year = zipName.replace(/\.zip$/i, "");
    const yearExtractDir = path.join(EXTRACT_DIR, year);

    ensureDir(yearExtractDir);

    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      zip.extractAllTo(yearExtractDir, true);

      const files = entries.map(entry => {
        const entryName = entry.entryName;
        const entryType = detectFileType(entryName);

        let preview = "";
        let size = entry.header.size || 0;

        if (!entry.isDirectory && (entryType === "csv" || entryType === "txt" || entryType === "json")) {
          const buf = entry.getData();
          preview = safeText(buf).slice(0, 500);
          size = buf.length;
        }

        return {
          entryName,
          isDirectory: entry.isDirectory,
          type: entryType,
          size,
          preview
        };
      });

      inventory.push({
        zipName,
        year,
        ok: true,
        extractedTo: yearExtractDir.replace(process.cwd() + path.sep, "").replace(/\\/g, "/"),
        entryCount: files.length,
        files
      });
    } catch (err) {
      inventory.push({
        zipName,
        year,
        ok: false,
        error: err.message
      });
    }
  }

  const manifest = {
    version: "V68.7-zip-inventory",
    generatedAt: new Date().toISOString(),
    zipCount: zipFiles.length,
    inventory
  };

  writeJson(path.join(OFFICIAL_DIR, "zip_inventory.json"), manifest);
  console.log("Saved: data/official/zip_inventory.json");
}

main();