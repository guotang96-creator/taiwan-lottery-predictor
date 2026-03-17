/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "data", "official");
const TMP_DIR = path.join(ROOT, ".tmp_lottery");

const GAME_SOURCES = {
  lotto649: {
    name: "大樂透",
    urls: [
      "https://www.taiwanlottery.com.tw/lotto/Lotto649/history.aspx",
      "https://www.taiwanlottery.com.tw/lotto/lotto649/history.aspx"
    ]
  },
  superlotto638: {
    name: "威力彩",
    urls: [
      "https://www.taiwanlottery.com.tw/lotto/SuperLotto638/history.aspx",
      "https://www.taiwanlottery.com.tw/lotto/superlotto638/history.aspx"
    ]
  },
  dailycash: {
    name: "今彩539",
    urls: [
      "https://www.taiwanlottery.com.tw/lotto/DailyCash/history.aspx",
      "https://www.taiwanlottery.com.tw/lotto/dailycash/history.aspx"
    ]
  },
  bingo: {
    name: "賓果賓果",
    urls: [
      "https://www.taiwanlottery.com.tw/lotto/BINGOBINGO/history.aspx",
      "https://www.taiwanlottery.com.tw/lotto/BingoBingo/history.aspx",
      "https://www.taiwanlottery.com.tw/lotto/bingobingo/history.aspx"
    ]
  }
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadByCurl(url, outFile) {
  const cmd = [
    "curl",
    "-L",
    "--compressed",
    "--connect-timeout", "20",
    "--max-time", "60",
    "--retry", "2",
    "--retry-delay", "2",
    "-A", "\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36\"",
    "-H", "\"Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\"",
    "-H", "\"Accept-Language: zh-TW,zh;q=0.9,en;q=0.8\"",
    "-H", "\"Cache-Control: no-cache\"",
    "-H", "\"Pragma: no-cache\"",
    "-o", `"${outFile}"`,
    `"${url}"`
  ].join(" ");

  execSync(cmd, { stdio: "pipe" });

  if (!fs.existsSync(outFile)) {
    throw new Error("curl 下載失敗，檔案不存在");
  }

  const text = fs.readFileSync(outFile, "utf8");
  if (!text || text.length < 3000) {
    throw new Error("下載內容過短");
  }
  return text;
}

async function fetchFirstAvailable(urls, gameKey) {
  let lastErr = null;

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const outFile = path.join(TMP_DIR, `${gameKey}_${i}.html`);

    try {
      const text = downloadByCurl(url, outFile);
      return { url, text };
    } catch (err) {
      lastErr = err;
    }

    await sleep(1000);
  }

  throw lastErr || new Error("No source available");
}

function decodeHtml(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]*>/g, " "));
}

function normalizeDate(s) {
  const raw = stripTags(s);
  const m1 = raw.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const mm = String(m1[2]).padStart(2, "0");
    const dd = String(m1[3]).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return raw || "";
}

function extractIssue(text) {
  const t = stripTags(text);
  const m = t.match(/(\d{6,9})/);
  return m ? m[1] : "";
}

function cleanNum(n) {
  const x = Number(String(n).replace(/[^\d]/g, ""));
  return Number.isFinite(x) ? x : null;
}

function uniqueDraws(draws) {
  const map = new Map();
  for (const draw of draws) {
    if (!draw || !draw.issue) continue;
    const key = `${draw.issue}_${draw.drawDate}_${JSON.stringify(draw.numbers || draw.numbers1 || [])}_${draw.special || ""}_${draw.numbers2 || ""}`;
    if (!map.has(key)) map.set(key, draw);
  }
  return [...map.values()];
}

function sortByIssueDesc(draws) {
  return [...draws].sort((a, b) => {
    const ia = Number(a.issue || 0);
    const ib = Number(b.issue || 0);
    if (ib !== ia) return ib - ia;
    return String(b.drawDate || "").localeCompare(String(a.drawDate || ""));
  });
}

function findTableBlocks(html) {
  const blocks = [];
  const re = /<table[\s\S]*?<\/table>/gi;
  let m;
  while ((m = re.exec(html))) {
    const block = m[0];
    if (block.includes("獎號") || block.includes("期別") || block.includes("開獎") || block.includes("BINGO")) {
      blocks.push(block);
    }
  }
  return blocks;
}

function parseRows(tableHtml) {
  const rows = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = trRe.exec(tableHtml))) {
    const rowHtml = m[0];
    const cells = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let td;
    while ((td = tdRe.exec(rowHtml))) {
      cells.push(stripTags(td[1]));
    }
    if (cells.length) rows.push(cells.map(c => c.trim()));
  }
  return rows;
}

function extractAllNumbers(text, min = 1, max = 99) {
  return (String(text).match(/\d{1,2}/g) || [])
    .map(cleanNum)
    .filter(n => Number.isInteger(n) && n >= min && n <= max);
}

function parseLotto649(html) {
  const draws = [];
  const tables = findTableBlocks(html);

  for (const table of tables) {
    const rows = parseRows(table);
    for (const row of rows) {
      const rowText = row.join(" | ");
      if (!/\d{6,9}/.test(rowText)) continue;

      const issue = extractIssue(rowText);
      const drawDate = normalizeDate(rowText);
      const nums = extractAllNumbers(rowText, 1, 49);

      if (!issue || nums.length < 6) continue;

      const uniqNums = [];
      for (const n of nums) {
        if (!uniqNums.includes(n)) uniqNums.push(n);
      }

      const main = uniqNums.slice(0, 6).sort((a, b) => a - b);
      const special = uniqNums[6] || null;

      if (main.length === 6) {
        draws.push({
          game: "lotto649",
          issue,
          drawDate,
          numbers: main,
          special
        });
      }
    }
  }

  return sortByIssueDesc(uniqueDraws(draws)).slice(0, 500);
}

function parseSuperLotto638(html) {
  const draws = [];
  const tables = findTableBlocks(html);

  for (const table of tables) {
    const rows = parseRows(table);
    for (const row of rows) {
      const rowText = row.join(" | ");
      if (!/\d{6,9}/.test(rowText)) continue;

      const issue = extractIssue(rowText);
      const drawDate = normalizeDate(rowText);
      const nums = extractAllNumbers(rowText, 1, 38);
      const zone2 = extractAllNumbers(rowText, 1, 8);

      if (!issue || nums.length < 6) continue;

      const uniqMain = [];
      for (const n of nums) {
        if (!uniqMain.includes(n)) uniqMain.push(n);
      }

      const main = uniqMain.slice(0, 6).sort((a, b) => a - b);
      const second = zone2.find(n => n >= 1 && n <= 8) || null;

      if (main.length === 6) {
        draws.push({
          game: "superlotto638",
          issue,
          drawDate,
          numbers1: main,
          numbers2: second
        });
      }
    }
  }

  return sortByIssueDesc(uniqueDraws(draws)).slice(0, 500);
}

function parseDailyCash(html) {
  const draws = [];
  const tables = findTableBlocks(html);

  for (const table of tables) {
    const rows = parseRows(table);
    for (const row of rows) {
      const rowText = row.join(" | ");
      if (!/\d{6,9}/.test(rowText)) continue;

      const issue = extractIssue(rowText);
      const drawDate = normalizeDate(rowText);
      const nums = extractAllNumbers(rowText, 1, 39);

      if (!issue || nums.length < 5) continue;

      const uniqNums = [];
      for (const n of nums) {
        if (!uniqNums.includes(n)) uniqNums.push(n);
      }

      const main = uniqNums.slice(0, 5).sort((a, b) => a - b);

      if (main.length === 5) {
        draws.push({
          game: "dailycash",
          issue,
          drawDate,
          numbers: main
        });
      }
    }
  }

  return sortByIssueDesc(uniqueDraws(draws)).slice(0, 700);
}

function parseBingo(html) {
  const draws = [];
  const tables = findTableBlocks(html);

  for (const table of tables) {
    const rows = parseRows(table);
    for (const row of rows) {
      const rowText = row.join(" | ");
      if (!/\d{8,9}/.test(rowText)) continue;

      const issue = extractIssue(rowText);
      const drawDate = normalizeDate(rowText);

      let nums = extractAllNumbers(rowText, 1, 80);
      const uniqNums = [];
      for (const n of nums) {
        if (!uniqNums.includes(n)) uniqNums.push(n);
      }

      nums = uniqNums.slice(0, 20).sort((a, b) => a - b);

      if (issue && nums.length >= 10) {
        draws.push({
          game: "bingo",
          issue,
          drawDate,
          numbers: nums
        });
      }
    }
  }

  return sortByIssueDesc(uniqueDraws(draws)).slice(0, 1500);
}

function parseGame(gameKey, html) {
  switch (gameKey) {
    case "lotto649":
      return parseLotto649(html);
    case "superlotto638":
      return parseSuperLotto638(html);
    case "dailycash":
      return parseDailyCash(html);
    case "bingo":
      return parseBingo(html);
    default:
      return [];
  }
}

async function updateOne(gameKey) {
  const source = GAME_SOURCES[gameKey];
  const { url, text } = await fetchFirstAvailable(source.urls, gameKey);
  const draws = parseGame(gameKey, text);

  if (!draws.length) {
    throw new Error(`${source.name} 解析失敗，抓到 0 筆`);
  }

  console.log(`[OK] ${source.name}: ${draws.length} 筆 from ${url}`);
  return {
    gameKey,
    sourceUrl: url,
    draws
  };
}

async function main() {
  ensureDir(OUTPUT_DIR);
  ensureDir(TMP_DIR);

  const results = {};
  const errors = [];

  for (const gameKey of Object.keys(GAME_SOURCES)) {
    try {
      const result = await updateOne(gameKey);
      results[gameKey] = result;
      await sleep(1000);
    } catch (err) {
      console.error(`[FAIL] ${gameKey}: ${err.message}`);
      errors.push({ gameKey, error: err.message });

      const backupFile = path.join(OUTPUT_DIR, `${gameKey}.json`);
      if (!fs.existsSync(backupFile)) {
        writeJson(backupFile, []);
      }
    }
  }

  for (const gameKey of Object.keys(GAME_SOURCES)) {
    if (results[gameKey]?.draws) {
      writeJson(path.join(OUTPUT_DIR, `${gameKey}.json`), results[gameKey].draws);
    }
  }

  const meta = {
    version: "V66.1",
    sourceName: "台灣彩券官方網站",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    games: Object.fromEntries(
      Object.keys(GAME_SOURCES).map(gameKey => {
        const existing = readJsonIfExists(path.join(OUTPUT_DIR, `${gameKey}.json`)) || [];
        return [
          gameKey,
          {
            count: results[gameKey]?.draws?.length ?? existing.length ?? 0,
            sourceUrl: results[gameKey]?.sourceUrl || null
          }
        ];
      })
    ),
    errors
  };

  writeJson(path.join(OUTPUT_DIR, "meta.json"), meta);

  if (Object.keys(results).length === 0) {
    console.log("[WARN] 全部來源都失敗，已保留舊資料");
    process.exit(0);
  }

  console.log("[DONE] official data updated");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
