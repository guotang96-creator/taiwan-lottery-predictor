/* V68 官方下載頁抓取版（第一步：抓官方下載連結清單） */
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

function extractUrlsFromHtml(html, baseUrl) {
  const urls = [];

  // href="..."
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const abs = absoluteUrl(baseUrl, m[1]);
    if (abs) urls.push(abs);
  }

  // src="..."（有些站會把下載圖示包在特殊連結）
  for (const m of html.matchAll(/src\s*=\s*["']([^"'#]+)["']/gi)) {
    const abs = absoluteUrl(baseUrl, m[1]);
    if (abs) urls.push(abs);
  }

  // onclick="window.open('...')" / location.href='...'
  for (const m of html.matchAll(/(?:window\.open|location\.href|document\.location)\s*\(\s*['"]([^'"]+)['"]/gi)) {
    const abs = absoluteUrl(baseUrl, m[1]);
    if (abs) urls.push(abs);
  }

  for (const m of html.matchAll(/(?:window\.open|location\.href|document\.location)\s*=\s*['"]([^'"]+)['"]/gi)) {
    const abs = absoluteUrl(baseUrl, m[1]);
    if (abs) urls.push(abs);
  }

  return uniq(urls);
}

function looksLikeDownload(url) {
  return (
    /\.(csv|xls|xlsx|zip|txt|pdf)(\?|$)/i.test(url) ||
    /download|result|history/i.test(url)
  );
}

function rocYearCandidates() {
  const now = new Date();
  const roc = now.getFullYear() - 1911;
  return [roc, roc - 1, roc - 2].map(String);
}

async function main() {
  ensureDir(OUT_DIR);

  console.log("Fetching official download page...");
  const res = await fetch(DOWNLOAD_PAGE, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch official download page: HTTP ${res.status}`);
  }

  const html = await res.text();
  const allUrls = extractUrlsFromHtml(html, DOWNLOAD_PAGE);
  const downloadUrls = allUrls.filter(looksLikeDownload);

  const years = rocYearCandidates();
  const likelyYearFiles = downloadUrls.filter(url => years.some(y => url.includes(y)));

  const manifest = {
    version: "V68-link-manifest",
    sourcePage: DOWNLOAD_PAGE,
    fetchedAt: new Date().toISOString(),
    rocYearsChecked: years,
    totalFoundUrls: allUrls.length,
    totalDownloadLikeUrls: downloadUrls.length,
    likelyYearFiles,
    allDownloadLikeUrls: downloadUrls
  };

  writeJson(path.join(OUT_DIR, "download_manifest.json"), manifest);

  console.log("Found URLs:", allUrls.length);
  console.log("Download-like URLs:", downloadUrls.length);
  console.log("Likely year files:", likelyYearFiles.length);
  console.log("Saved: data/official/download_manifest.json");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});