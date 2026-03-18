const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeReadJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`⚠️ JSON 讀取失敗: ${filePath}`, err.message);
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ 已寫入 ${filePath}`);
}

function formatMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getMonthRange(monthCount = 3) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    month: formatMonth(start),
    endMonth: formatMonth(end)
  };
}

function toNumberArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => Number(v))
    .filter(v => Number.isFinite(v));
}

function pickFirstArray(obj, keys) {
  for (const key of keys) {
    if (Array.isArray(obj?.[key])) return obj[key];
  }
  return [];
}

function pickFirstValue(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return null;
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  try {
    return new Date(value).toISOString();
  } catch {
    return String(value);
  }
}

function sortByPeriodDesc(list) {
  return [...list].sort((a, b) => {
    const pa = Number(a.period || a.drawTerm || a.term || 0);
    const pb = Number(b.period || b.drawTerm || b.term || 0);
    return pb - pa;
  });
}

function extractLatestFromList(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return sortByPeriodDesc(list)[0];
}

function normalize539(item) {
  if (!item) return null;
  return {
    game: 'daily539',
    period: String(pickFirstValue(item, ['period', 'drawTerm', 'term']) || ''),
    drawDate: normalizeDate(pickFirstValue(item, ['lotteryDate', 'drawDate', 'date'])),
    redeemableDate: normalizeDate(pickFirstValue(item, ['redeemableDate'])),
    numbers: toNumberArray(pickFirstValue(item, ['drawNumberSize', 'numbers', 'drawNumbers'])),
    source: 'official-api'
  };
}

function normalizeLotto649(item) {
  if (!item) return null;
  return {
    game: 'lotto649',
    period: String(pickFirstValue(item, ['period', 'drawTerm', 'term']) || ''),
    drawDate: normalizeDate(pickFirstValue(item, ['lotteryDate', 'drawDate', 'date'])),
    redeemableDate: normalizeDate(pickFirstValue(item, ['redeemableDate'])),
    numbers: toNumberArray(pickFirstValue(item, ['drawNumberSize', 'numbers', 'drawNumbers'])),
    specialNumber: Number(pickFirstValue(item, ['specialNumber', 'specialNum', 'bonusNumber'])) || null,
    source: 'official-api'
  };
}

function normalizeSuperLotto638(item) {
  if (!item) return null;
  return {
    game: 'superLotto638',
    period: String(pickFirstValue(item, ['period', 'drawTerm', 'term']) || ''),
    drawDate: normalizeDate(pickFirstValue(item, ['lotteryDate', 'drawDate', 'date'])),
    redeemableDate: normalizeDate(pickFirstValue(item, ['redeemableDate'])),
    numbers: toNumberArray(
      pickFirstValue(item, [
        'drawNumberSize',
        'drawNumber1',
        'numbers',
        'drawNumbers'
      ])
    ),
    specialNumber: Number(
      pickFirstValue(item, ['specialNumber', 'secondAreaNumber', 'specialNum', 'bonusNumber'])
    ) || null,
    source: 'official-api'
  };
}

function normalizeBingo(content) {
  if (!content) return null;

  const orderNums = toNumberArray(
    pickFirstValue(content, [
      'drawOrderNums',
      'drawOrderNumbers',
      'drawNumberAppear',
      'drawNumbers'
    ])
  );

  const sizeNums = toNumberArray(
    pickFirstValue(content, [
      'drawSizeNums',
      'drawNumberSize',
      'numbers'
    ])
  );

  const numbers = sizeNums.length ? sizeNums : orderNums;

  return {
    game: 'bingo',
    period: String(pickFirstValue(content, ['drawTerm', 'period', 'term']) || ''),
    drawDate: normalizeDate(pickFirstValue(content, ['lotteryDate', 'drawDate', 'date'])),
    numbers,
    orderNumbers: orderNums,
    specialNumber: Number(pickFirstValue(content, ['superNum', 'specialNumber', 'bonusNumber'])) || null,
    source: 'official-api'
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'accept': 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${url}`);
  }

  const json = await res.json();

  if (json?.rtCode !== 0) {
    throw new Error(`API rtCode != 0: ${url}`);
  }

  return json;
}

async function getLatestOfficialData() {
  const { month, endMonth } = getMonthRange(3);

  const urls = {
    bingo: 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LatestBingoResult',
    daily539: `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Daily539Result?period&month=${month}&endMonth=${endMonth}&pageNum=1&pageSize=200`,
    lotto649: `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Lotto649Result?period&month=${month}&endMonth=${endMonth}&pageNum=1&pageSize=200`,
    superLotto638: `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/SuperLotto638Result?period&month=${month}&endMonth=${endMonth}&pageNum=1&pageSize=200`
  };

  console.log('📡 抓取官方最新 API 中...');
  console.log(urls);

  const [bingoRes, daily539Res, lotto649Res, superLotto638Res] = await Promise.all([
    fetchJson(urls.bingo),
    fetchJson(urls.daily539),
    fetchJson(urls.lotto649),
    fetchJson(urls.superLotto638)
  ]);

  const latest539 = extractLatestFromList(
    pickFirstArray(daily539Res?.content, ['daily539Res', 'list', 'results'])
  );

  const latest649 = extractLatestFromList(
    pickFirstArray(lotto649Res?.content, ['lotto649Res', 'list', 'results'])
  );

  const latest638 = extractLatestFromList(
    pickFirstArray(superLotto638Res?.content, ['superLotto638Res', 'list', 'results'])
  );

  return {
    generatedAt: new Date().toISOString(),
    source: 'official-api',
    officialLatest: {
      bingo: normalizeBingo(bingoRes?.content),
      daily539: normalize539(latest539),
      lotto649: normalizeLotto649(latest649),
      superLotto638: normalizeSuperLotto638(latest638)
    }
  };
}

function mergeIntoLatestJson(latestOfficial) {
  const candidateFiles = [
    path.join(ROOT, 'latest.json'),
    path.join(ROOT, 'docs', 'latest.json'),
    path.join(ROOT, 'public', 'latest.json'),
    path.join(ROOT, 'data', 'latest.json')
  ];

  let updatedAny = false;

  for (const file of candidateFiles) {
    if (!fs.existsSync(file)) continue;

    const current = safeReadJson(file, {});
    const next = {
      ...current,
      generatedAt: latestOfficial.generatedAt,
      officialLatest: latestOfficial.officialLatest
    };

    safeWriteJson(file, next);
    updatedAny = true;
  }

  if (!updatedAny) {
    safeWriteJson(path.join(ROOT, 'latest.json'), latestOfficial);
  }
}

async function main() {
  try {
    const latestOfficial = await getLatestOfficialData();

    // 獨立輸出一份
    safeWriteJson(path.join(ROOT, 'official_latest.json'), latestOfficial);
    safeWriteJson(path.join(ROOT, 'data', 'official_latest.json'), latestOfficial);

    // 若 docs 資料夾存在，也同步一份給 GitHub Pages 讀
    if (fs.existsSync(path.join(ROOT, 'docs'))) {
      safeWriteJson(path.join(ROOT, 'docs', 'official_latest.json'), latestOfficial);
    }

    // 合併進既有 latest.json
    mergeIntoLatestJson(latestOfficial);

    console.log('🎉 fetch_latest_official.js 完成');
  } catch (err) {
    console.error('❌ fetch_latest_official.js 失敗:', err);
    process.exit(1);
  }
}

main();
