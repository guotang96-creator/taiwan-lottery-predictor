/* V68.3 掃描 result_download bundle 內關鍵片段 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(process.cwd(), "data", "official");
const BUNDLE_URL = "https://www.taiwanlottery.com/_nuxt/result_download.1_0_7_4.js";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function uniq(arr) {
  return [...new Set(arr)];
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "*/*"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} @ ${url}`);
  }

  return res.text();
}

function getSnippet(text, index, radius = 220) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end);
}

function collectKeywordSnippets(text, keywords) {
  const results = [];

  for (const keyword of keywords) {
    let idx = 0;
    while (true) {
      idx = text.indexOf(keyword, idx);
      if (idx === -1) break;

      results.push({
        keyword,
        index: idx,
        snippet: getSnippet(text, idx)
      });

      idx += keyword.length;
    }
  }

  return results;
}

function extractUrls(text) {
  const urls = [];

  for (const m of text.matchAll(/https?:\/\/[^\s"'`()<>]+/gi)) {
    urls.push(m[0]);
  }

  for (const m of text.matchAll(/\/[A-Za-z0-9_\-/.?=&%]+/g)) {
    const s = m[0];
    if (
      s.includes("Lottery") ||
      s.includes("download") ||
      s.includes("result") ||
      s.includes("history") ||
      s.includes("api")
    ) {
      urls.push(`https://www.taiwanlottery.com${s}`);
    }
  }

  return uniq(urls);
}

async function main() {
  ensureDir(OUT_DIR);

  console.log("Fetching bundle:", BUNDLE_URL);
  const jsText = await fetchText(BUNDLE_URL);

  const keywords = [
    "ResultDownload",
    "Lottery",
    "download",
    "history",
    "fetch(",
    "axios",
    "114",
    "113",
    "csv",
    "xlsx",
    "xls",
    "zip"
  ];

  const snippets = collectKeywordSnippets(jsText, keywords).slice(0, 120);
  const urls = extractUrls(jsText);

  const manifest = {
    version: "V68.3-bundle-debug",
    fetchedAt: new Date().toISOString(),
    bundleUrl: BUNDLE_URL,
    jsLength: jsText.length,
    matchedKeywordCount: snippets.length,
    urlsFound: urls,
    snippets
  };

  writeJson(path.join(OUT_DIR, "download_manifest.json"), manifest);
  console.log("Saved: data/official/download_manifest.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});