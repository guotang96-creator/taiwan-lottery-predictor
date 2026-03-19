const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ 已寫入 ${filePath}`);
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
    throw new Error(`API rtCode != 0 - ${url}`);
  }

  return json;
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

function latestByPeriod(list) {
  return [...(list || [])]
    .sort((a, b) => Number(b?.period || 0) - Number(a?.period || 0))[0] || null;
}

function normalizeBingo(content) {
  const raw = content && content.lotteryBingoLatestPost
    ? content.lotteryBingoLatestPost
    : content;

  if (!raw) {
    return {
      game: 'bingo',
      period: '',
      drawDate: '',
      numbers: [],
      orderNumbers: [],
      specialNumber: null,
      source: 'official-api'
    };
  }

  const numbers = toNumberArray(raw.bigShowOrder || []);
  const orderNumbers = toNumberArray(raw.openShowOrder || []);

  return {
    game: 'bingo',
    period: String(raw.drawTerm || ''),
    drawDate: raw.dDate || '',
    redeemableDate: raw.eDate || '',
    numbers,
    orderNumbers,
    specialNumber: Number(raw.prizeNum?.bullEye || null) || null,
    source: 'official-api'
  };
}

  const orderNumbers = toNumberArray(
    raw.openShowOrder ||
    raw.drawOrderNums ||
    raw.drawOrderNumbers ||
    []
  );

  return {
    game: 'bingo',
    period: String(raw.drawTerm || raw.period || ''),
    drawDate: raw.dDate || raw.lotteryDate || raw.drawDate || '',
    numbers,
    orderNumbers,
    specialNumber: Number(
      raw?.prizeNum?.bullEye ||
      raw.superNum ||
      raw.specialNumber ||
      null
    ) || null,
    source: 'official-api'
  };
}

function normalize539(item) {
  const numbers = toNumberArray(item?.drawNumberSize || item?.numbers || []);

  return {
    game: 'daily539',
    period: String(item?.period || ''),
    drawDate: item?.lotteryDate || item?.drawDate || '',
    redeemableDate: item?.redeemableDate || '',
    numbers: numbers.slice(0, 5),
    source: 'official-api'
  };
}

function normalize649(item) {
  const allNums = toNumberArray(item?.drawNumberSize || item?.numbers || []);
  const mainNumbers = allNums.slice(0, 6);
  const specialNumber = Number(
    item?.specialNumber ||
    item?.specialNum ||
    allNums[6] ||
    null
  ) || null;

  return {
    game: 'lotto649',
    period: String(item?.period || ''),
    drawDate: item?.lotteryDate || item?.drawDate || '',
    redeemableDate: item?.redeemableDate || '',
    numbers: mainNumbers,
    specialNumber,
    source: 'official-api'
  };
}

function normalize638(item) {
  const allNums = toNumberArray(item?.drawNumberSize || item?.numbers || []);
  const mainNumbers = allNums.slice(0, 6);
  const specialNumber = Number(
    item?.specialNumber ||
    item?.specialNum ||
    item?.secondAreaNumber ||
    allNums[6] ||
    null
  ) || null;

  return {
    game: 'superLotto638',
    period: String(item?.period || ''),
    drawDate: item?.lotteryDate || item?.drawDate || '',
    redeemableDate: item?.redeemableDate || '',
    numbers: mainNumbers,
    specialNumber,
    source: 'official-api'
  };
}

async function main() {
  try {
    const { month, endMonth } = getMonthRange(3);

    console.log('📡 抓取官方最新 API...');
    console.log({ month, endMonth });

    const bingoRes = await fetchJson(
      'https://api.taiwanlottery.com/TLCAPIWeB/Lottery/LatestBingoResult'
    );

    const res539 = await fetchJson(
      `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Daily539Result?period&month=${month}&endMonth=${endMonth}&pageNum=1&pageSize=200`
    );

    const res649 = await fetchJson(
      `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Lotto649Result?period&month=${month}&endMonth=${endMonth}&pageNum=1&pageSize=200`
    );

    const res638 = await fetchJson(
      `https://api.taiwanlottery.com/TLCAPIWeB/Lottery/SuperLotto638Result?period&month=${month}&endMonth=${endMonth}&pageNum=1&pageSize=200`
    );

    const data = {
      generatedAt: new Date().toISOString(),
      source: 'official-api',
      officialLatest: {
        bingo: normalizeBingo(bingoRes?.content),
        daily539: normalize539(latestByPeriod(res539?.content?.daily539Res)),
        lotto649: normalize649(latestByPeriod(res649?.content?.lotto649Res)),
        superLotto638: normalize638(latestByPeriod(res638?.content?.superLotto638Res))
      },
      debugRaw: {
        bingo: bingoRes?.content || null
      }
    };

    writeJson(path.join(ROOT, 'official_latest.json'), data);
    writeJson(path.join(ROOT, 'data', 'official_latest.json'), data);
    writeJson(path.join(ROOT, 'docs', 'official_latest.json'), data);

    console.log('🎉 official_latest.json 已同步到 root / data / docs');
  } catch (err) {
    console.error('❌ fetch_latest_official.js 失敗:', err);
    process.exit(1);
  }
}

main();
