/* V68.1 官方下載頁偵查版：抓頁面 + JS bundle 內的下載連結 */
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(process.cwd(), "data", "official");
const DOWNLOAD_PAGE = "https://www.taiwanlottery.com/lotto/history/result_download/";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function uniq(arr) {
  return [...new Set(arr)];
}

function absoluteUrl(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function extractUrls(text, baseUrl) {
  const urls = [];

  for (const m of text.matchAll(/https?:\/\/[^\s"'`()<>]+/gi)) {
    urls.push(m[0]);
  }

  for (const m of text.matchAll(/["'`](\/[^"'`]+)["'`]/gi)) {
    const abs = absoluteUrl(baseUrl, m[1]);
    if (abs) urls.push(abs);
  }

  for (const m of text.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const abs = absoluteUrl(baseUrl, m[1]);
    if (abs) urls.push(abs);
  }

  return uniq(urls);
}

function looksLikeBundle(url) {
  return /result_download.*\.js(\?|$)/i.test(url) || /_nuxt\/.*\.js(\?|$)/i.test(url);
}

function looksLikeDownload(url) {
  return (
    /\.(csv|xls|xlsx|zip|txt|pdf)(\?|$)/i.test(url) ||
    /download|history|result/i.test(url)
  );
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "*/*"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.text();
}

async function main() {
  ensureDir(OUT_DIR);

  console.log("Step 1: fetch official download page");
  const html = await fetchText(DOWNLOAD_PAGE);

  const pageUrls = extractUrls(html, DOWNLOAD_PAGE);
  const bundleUrls = pageUrls.filter(looksLikeBundle);
  const directDownloadUrls = pageUrls.filter(looksLikeDownload);

  console.log("Page URLs:", pageUrls.length);
  console.log("Bundle URLs:", bundleUrls.length);
  console.log("Direct download-like URLs:", directDownloadUrls.length);

  let bundleScanResults = [];

  for (const bundleUrl of bundleUrls.slice(0, 10)) {
    try {
      console.log("Scanning bundle:", bundleUrl);
      const jsText = await fetchText(bundleUrl);
      const jsUrls = extractUrls(jsText, bundleUrl);
      const downloadLike = jsUrls.filter(looksLikeDownload);

      bundleScanResults.push({
        bundleUrl,
        foundUrls: jsUrls.length,
        downloadLikeUrls: downloadLike
      });
    } catch (err) {
      bundleScanResults.push({
        bundleUrl,
        error: err.message,
        foundUrls: 0,
        downloadLikeUrls: []
      });
    }
  }

  const allBundleDownloadUrls = uniq(
    bundleScanResults.flatMap(x => x.downloadLikeUrls || [])
  );

  const manifest = {
    version: "V68.1-bundle-scan",
    sourcePage: DOWNLOAD_PAGE,
    fetchedAt: new Date().toISOString(),
    pageUrlsCount: pageUrls.length,
    bundleUrls,
    directDownloadUrls,
    bundleScanResults,
    allBundleDownloadUrls
  };

  writeJson(path.join(OUT_DIR, "download_manifest.json"), manifest);
  console.log("Saved: data/official/download_manifest.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
