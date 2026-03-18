/* V68.4 官方下載端點實測版 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(process.cwd(), "data", "official");
const BASE = "https://www.taiwanlottery.com";
const API = `${BASE}/Lottery/ResultDownload`;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

async function fetchProbe(year) {
  const url = `${API}?year=${year}`;

  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept": "application/json,text/plain,*/*"
      }
    });

    const text = await res.text();

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return {
      year,
      url,
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") || "",
      textPreview: text.slice(0, 1000),
      json
    };
  } catch (err) {
    return {
      year,
      url,
      ok: false,
      error: err.message
    };
  }
}

async function main() {
  ensureDir(OUT_DIR);

  const years = [2026, 2025, 2024, 2023];
  const probes = [];

  console.log("Probing official ResultDownload endpoint...");

  for (const year of years) {
    const result = await fetchProbe(year);
    probes.push(result);
    console.log(`year=${year} status=${result.status || "ERR"}`);
  }

  const manifest = {
    version: "V68.4-resultdownload-probe",
    fetchedAt: new Date().toISOString(),
    endpoint: API,
    probes
  };

  writeJson(path.join(OUT_DIR, "download_manifest.json"), manifest);
  console.log("Saved: data/official/download_manifest.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});