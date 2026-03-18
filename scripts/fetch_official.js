/* V68.2 官方下載端點探測版 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(process.cwd(), "data", "official");
const PAGE_URL = "https://www.taiwanlottery.com/lotto/history/result_download/";
const API_URL = "https://www.taiwanlottery.com/Lottery/ResultDownload";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "*/*",
      ...options.headers
    },
    method: options.method || "GET",
    body: options.body
  });

  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    url,
    headers: Object.fromEntries(res.headers.entries()),
    text
  };
}

async function tryRequest(name, options) {
  try {
    const result = await fetchText(API_URL, options);
    return {
      name,
      ok: result.ok,
      status: result.status,
      contentType: result.headers["content-type"] || "",
      location: result.headers["location"] || "",
      preview: result.text.slice(0, 1000)
    };
  } catch (err) {
    return {
      name,
      ok: false,
      error: err.message
    };
  }
}

async function main() {
  ensureDir(OUT_DIR);

  const page = await fetchText(PAGE_URL);

  const probes = [];

  probes.push(await tryRequest("GET plain", {
    method: "GET"
  }));

  probes.push(await tryRequest("GET json accept", {
    method: "GET",
    headers: {
      accept: "application/json,text/plain,*/*"
    }
  }));

  probes.push(await tryRequest("POST empty json", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json,text/plain,*/*"
    },
    body: JSON.stringify({})
  }));

  probes.push(await tryRequest("POST empty form", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body: ""
  }));

  const manifest = {
    version: "V68.2-endpoint-probe",
    fetchedAt: new Date().toISOString(),
    sourcePage: PAGE_URL,
    endpoint: API_URL,
    pageStatus: page.status,
    pageContentType: page.headers["content-type"] || "",
    pagePreview: page.text.slice(0, 500),
    probes
  };

  writeJson(path.join(OUT_DIR, "download_manifest.json"), manifest);
  console.log("Saved: data/official/download_manifest.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});