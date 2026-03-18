const fs = require("fs");
const path = require("path");

const OFFICIAL_DIR = path.join(process.cwd(), "data", "official");
const DOWNLOAD_DIR = path.join(process.cwd(), "data", "downloads");
const API_BASE = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/ResultDownload";
const CDN_BASE = "https://cdn.taiwanlottery.com.tw";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "application/json,text/plain,*/*"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} @ ${url}`);
  }

  return res.json();
}

async function downloadFile(url, filepath) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "*/*"
    }
  });

  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status} @ ${url}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(arrayBuffer));
}

function normalizeDownloadUrl(pathValue, fallbackYear) {
  if (typeof pathValue === "string" && pathValue.trim()) {
    if (pathValue.startsWith("http://") || pathValue.startsWith("https://")) {
      return pathValue;
    }
    if (pathValue.startsWith("/")) {
      return `${CDN_BASE}${pathValue}`;
    }
  }

  return `${CDN_BASE}/app/FilesForDownload/Download/LottoResult/${fallbackYear}.zip`;
}

async function main() {
  ensureDir(OFFICIAL_DIR);
  ensureDir(DOWNLOAD_DIR);

  const years = [];
  for (let y = 2026; y >= 2007; y -= 1) {
    years.push(y);
  }

  const results = [];

  console.log("Fetching official download info...");

  for (const year of years) {
    const apiUrl = `${API_BASE}?year=${year}`;

    try {
      const data = await fetchJson(apiUrl);

      const fileName =
        data?.fileName ||
        `${year}.zip`;

      const downloadUrl = normalizeDownloadUrl(data?.path, year);
      const outFile = path.join(DOWNLOAD_DIR, fileName);

      console.log(`year=${year} -> ${fileName}`);
      await downloadFile(downloadUrl, outFile);

      const stat = fs.statSync(outFile);

      results.push({
        year,
        ok: true,
        apiUrl,
        apiResponse: data,
        downloadUrl,
        fileName,
        savedAs: outFile.replace(process.cwd() + path.sep, "").replace(/\\/g, "/"),
        size: stat.size
      });
    } catch (err) {
      console.log(`year=${year} -> FAIL`);
      results.push({
        year,
        ok: false,
        apiUrl,
        error: err.message
      });
    }
  }

  const manifest = {
    version: "V68.6-download-zips",
    fetchedAt: new Date().toISOString(),
    yearsTried: years,
    successCount: results.filter(r => r.ok).length,
    failCount: results.filter(r => !r.ok).length,
    results
  };

  writeJson(path.join(OFFICIAL_DIR, "download_manifest.json"), manifest);
  console.log("Saved: data/official/download_manifest.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
