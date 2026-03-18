const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = path.join(process.cwd(), "data", "official");
const PAGE_URL = "https://www.taiwanlottery.com/lotto/history/result_download/";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

async function safeText(locator) {
  try {
    const text = await locator.textContent();
    return (text || "").trim();
  } catch {
    return "";
  }
}

async function main() {
  ensureDir(OUT_DIR);

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  const networkHits = [];
  const downloadEvents = [];
  const consoleLogs = [];

  page.on("request", (req) => {
    const url = req.url();
    if (
      url.includes("ResultDownload") ||
      url.includes("download") ||
      url.includes("history") ||
      url.includes(".csv") ||
      url.includes(".xls") ||
      url.includes(".xlsx") ||
      url.includes(".zip")
    ) {
      networkHits.push({
        type: "request",
        method: req.method(),
        url
      });
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (
      url.includes("ResultDownload") ||
      url.includes("download") ||
      url.includes("history") ||
      url.includes(".csv") ||
      url.includes(".xls") ||
      url.includes(".xlsx") ||
      url.includes(".zip")
    ) {
      networkHits.push({
        type: "response",
        status: res.status(),
        contentType: res.headers()["content-type"] || "",
        url
      });
    }
  });

  page.on("console", (msg) => {
    consoleLogs.push(msg.text());
  });

  page.on("download", async (download) => {
    downloadEvents.push({
      suggestedFilename: download.suggestedFilename(),
      url: download.url()
    });
  });

  console.log("Opening official page...");
  await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 120000 });

  await page.waitForTimeout(3000);

  const title = await page.title();
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const buttons = await page.locator("text=/年/").count().catch(() => 0);

  const clicked = [];

  // 嘗試點頁面上出現的年度按鈕
  const yearCandidates = ["114", "113", "112", "111", "110", "2025", "2024", "2023"];

  for (const year of yearCandidates) {
    const locator = page.locator(`text=${year}`).first();
    try {
      if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
        const label = await safeText(locator);
        await locator.click({ timeout: 5000 });
        await page.waitForTimeout(2500);
        clicked.push({ year, label, success: true });
      }
    } catch (err) {
      clicked.push({ year, success: false, error: err.message });
    }
  }

  // 再嘗試抓 class 名稱像 download-butoon 的元素
  const downloadButtonLocator = page.locator('[class*="download"]');
  const count = await downloadButtonLocator.count().catch(() => 0);

  for (let i = 0; i < Math.min(count, 20); i += 1) {
    const item = downloadButtonLocator.nth(i);
    try {
      const text = await safeText(item);
      if (!text.includes("年")) continue;

      await item.click({ timeout: 5000 });
      await page.waitForTimeout(2500);

      clicked.push({
        index: i,
        text,
        success: true
      });
    } catch (err) {
      clicked.push({
        index: i,
        success: false,
        error: err.message
      });
    }
  }

  const manifest = {
    version: "V68.5-playwright-probe",
    fetchedAt: new Date().toISOString(),
    pageUrl: PAGE_URL,
    title,
    bodyPreview: bodyText.slice(0, 1200),
    yearTextCount: buttons,
    clicked: uniqBy(clicked, x => JSON.stringify(x)),
    downloadEvents: uniqBy(downloadEvents, x => `${x.url}|${x.suggestedFilename}`),
    networkHits: uniqBy(networkHits, x => `${x.type}|${x.url}|${x.method || ""}|${x.status || ""}`),
    consoleLogs: uniqBy(consoleLogs, x => x)
  };

  writeJson(path.join(OUT_DIR, "download_manifest.json"), manifest);

  await browser.close();
  console.log("Saved: data/official/download_manifest.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});