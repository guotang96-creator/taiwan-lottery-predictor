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
  return value.map(v => Number(v)).filter(v => Number.isFinite(v));
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

function parseStableTime(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function normalizePeriodValue(item) {
  return String(pickFirstValue(item, ['period', 'drawTerm', 'term', 'issue']) || '');
}

function sortByPeriodDesc(list) {
  return [...list].sort((a, b) => {
    const pa = Number(a.period || a.drawTerm || a.term || 0);
    const pb = Number(b.period || b.drawTerm || b.term || 0);
    if (pb !== pa) return pb - pa;

    const ta = parseStableTime(a.drawDate || a.lotteryDate || a.date || 0);
    const tb = parseStableTime(b.drawDate || b.lotteryDate || b.date || 0);
    return tb - ta;
  });
}

function extractLatestFromList(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return sortByPeriodDesc(list)[0];
}

function extractSequentialNumbers(item, keys, start, end) {
  const nums = [];
  for (const key of keys) {
    for (let i = start; i <= end; i++) {
      const value = item?.[`${key}${i}`];
      const num = Number(value);
      if (Number.isFinite(num)) nums.push(num);
    }
  }
  return nums;
}

function extractMainNumbers(item, options = {}) {
  const {
    directArrayKeys = [],
    sequentialPrefixes = [],
    seqStart = 1,
    seqEnd = 6
  } = options;

  for (const key of directArrayKeys) {
    const arr = toNumberArray(item?.[key]);
    if (arr.length) return arr;
  }

  const seqNums = extractSequentialNumbers(item, sequentialPrefixes, seqStart, seqEnd);
  if (seqNums.length) return seqNums;

  return [];
}

function extractSpecialNumber(item, keys) {
  const raw = pickFirstValue(item, keys);
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function normalize539(item) {
  if (!item) return null;
  return {
    game: 'daily539',
    period: normalizePeriodValue(item),
    drawDate: normalizeDate(pickFirstValue(item, ['lotteryDate', 'drawDate', 'date'])),
    redeemableDate: normalizeDate(pickFirstValue(item, ['redeemableDate'])),
    numbers: extractMainNumbers(item, {
      directArrayKeys: ['drawNumberSize', 'numbers', 'drawNumbers'],
      sequentialPrefixes: ['drawNumber', 'num', 'ball'],
      seqStart: 1,
      seqEnd: 5
    }),
    source: 'official-api'
  };
}

function normalizeLotto649(item) {
  if (!item) return null;
  return {
    game: 'lotto649',
    period: normalizePeriodValue(item),
    drawDate: normalizeDate(pickFirstValue(item, ['lotteryDate', 'drawDate', 'date'])),
    redeemableDate: normalizeDate(pickFirstValue(item, ['redeemableDate'])),
    numbers: extractMainNumbers(item, {
      directArrayKeys: ['drawNumberSize', 'numbers', 'drawNumbers'],
      sequentialPrefixes: ['drawNumber', 'num', 'ball'],
      seqStart: 1,
      seqEnd: 6
    }),
    specialNumber: extractSpecialNumber(item, [
      'specialNumber',
      'specialNum',
      'bonusNumber',
      'bonusNum',
      'superNumber'
    ]),
    source: 'official-api'
  };
}

function normalizeSuperLotto638(item) {
  if (!item) return null;
  return {
    game: 'superLotto638',
    period: normalizePeriodValue(item),
    drawDate: normalizeDate(pickFirstValue(item, ['lotteryDate', 'drawDate', 'date'])),
    redeemableDate: normalizeDate(pickFirstValue(item, ['redeemableDate'])),
    numbers: extractMainNumbers(item, {
      directArrayKeys: ['drawNumberSize', 'drawNumber1', 'numbers', 'drawNumbers', 'zone1'],
      sequentialPrefixes: ['drawNumber', 'num', 'ball'],
      seqStart: 1,
      seqEnd: 6
    }),
    specialNumber: extractSpecialNumber(item, [
      'specialNumber',
      'secondAreaNumber',
      'secondNumber',
      'specialNum',
      'bonusNumber',
      'superNumber',
      'zone2'
    ]),
    source: 'official-api'
  };
}

function normalizeBingo(content) {
  if (!content) return null;

  const orderNums = extractMainNumbers(content, {
    directArrayKeys: [
      'drawOrderNums',
      'drawOrderNumbers',
      'drawNumberAppear',
      'drawNumbers',
      'orderNumbers'
    ],
    sequentialPrefixes: ['drawOrderNum', 'drawNumber'],
    seqStart: 1,
    seqEnd: 20
  });

  const sizeNums = extractMainNumbers(content, {
    directArrayKeys: [
      'drawSizeNums',
      'drawNumberSize',
      'numbers'
    ],
    sequentialPrefixes: ['drawSizeNum'],
    seqStart: 1,
    seqEnd: 20
  });

  const numbers = sizeNums.length ? sizeNums : orderNums;

  return {
    game: 'bingo',
    period: normalizePeriodValue(content),
    drawDate: normalizeDate(pickFirstValue(content, ['lotteryDate', 'drawDate', 'date'])),
    numbers,
    orderNumbers: orderNums,
    specialNumber: extractSpecialNumber(content, [
      'superNum',
      'specialNumber',
      'bonusNumber'
    ]),
    source: 'official-api'
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
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

async function fetchJsonWithRetry(url, retries = 3, waitMs = 4000) {
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️ 抓取失敗 (${i + 1}/${retries}): ${url} - ${err.message}`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
  throw lastErr;
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
    fetchJsonWithRetry(urls.bingo, 4, 5000),
    fetchJsonWithRetry(urls.daily539, 3, 4000),
    fetchJsonWithRetry(urls.lotto649, 3, 4000),
    fetchJsonWithRetry(urls.superLotto638, 3, 4000)
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

  const officialLatest = {
    bingo: normalizeBingo(bingoRes?.content),
    daily539: normalize539(latest539),
    lotto649: normalizeLotto649(latest649),
    superLotto638: normalizeSuperLotto638(latest638)
  };

  console.log('===== normalized official latest =====');
  console.log(JSON.stringify(officialLatest, null, 2));

  return {
    generatedAt: new Date().toISOString(),
    source: 'official-api',
    officialLatest
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

    safeWriteJson(path.join(ROOT, 'official_latest.json'), latestOfficial);
    safeWriteJson(path.join(ROOT, 'data', 'official_latest.json'), latestOfficial);

    if (fs.existsSync(path.join(ROOT, 'docs'))) {
      safeWriteJson(path.join(ROOT, 'docs', 'official_latest.json'), latestOfficial);
    }

    mergeIntoLatestJson(latestOfficial);

    console.log('🎉 fetch_latest_official.js 完成');
  } catch (err) {
    console.error('❌ fetch_latest_official.js 失敗:', err);
    process.exit(1);
  }
}

main();
