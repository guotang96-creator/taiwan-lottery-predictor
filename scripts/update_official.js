const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`⚠️ 無法讀取 ${filePath}: ${err.message}`);
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ 已寫入 ${filePath}`);
}

function normalizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(v => Number(v)).filter(v => Number.isFinite(v));
}

function mergeGameBlock(baseBlock, officialBlock) {
  const out = (baseBlock && typeof baseBlock === 'object') ? { ...baseBlock } : {};

  if (!officialBlock || typeof officialBlock !== 'object') {
    return out;
  }

  out.latestOfficial = {
    period: officialBlock.period || '',
    drawDate: officialBlock.drawDate || '',
    redeemableDate: officialBlock.redeemableDate || '',
    numbers: normalizeArray(officialBlock.numbers),
    orderNumbers: normalizeArray(officialBlock.orderNumbers),
    specialNumber:
      officialBlock.specialNumber !== undefined && officialBlock.specialNumber !== null
        ? Number(officialBlock.specialNumber)
        : null,
    source: officialBlock.source || 'official-api'
  };

  out.latest = {
    period: officialBlock.period || '',
    drawDate: officialBlock.drawDate || '',
    redeemableDate: officialBlock.redeemableDate || '',
    numbers: normalizeArray(officialBlock.numbers),
    orderNumbers: normalizeArray(officialBlock.orderNumbers),
    specialNumber:
      officialBlock.specialNumber !== undefined && officialBlock.specialNumber !== null
        ? Number(officialBlock.specialNumber)
        : null,
    source: officialBlock.source || 'official-api'
  };

  return out;
}

function main() {
  try {
    const baseLatest =
      readJson(path.join(ROOT, 'latest.json')) ||
      readJson(path.join(ROOT, 'data', 'latest.json')) ||
      readJson(path.join(ROOT, 'docs', 'latest.json')) ||
      {};

    const officialLatestData =
      readJson(path.join(ROOT, 'official_latest.json')) ||
      readJson(path.join(ROOT, 'data', 'official_latest.json')) ||
      readJson(path.join(ROOT, 'docs', 'official_latest.json')) ||
      {};

    const officialLatest = officialLatestData.officialLatest || {};

    const merged = {
      ...baseLatest,
      generatedAt: officialLatestData.generatedAt || baseLatest.generatedAt || new Date().toISOString(),
      source: 'merged-official-data',
      officialLatest: officialLatest
    };

    merged.bingo = mergeGameBlock(baseLatest.bingo, officialLatest.bingo);
    merged.daily539 = mergeGameBlock(baseLatest.daily539, officialLatest.daily539);
    merged.lotto649 = mergeGameBlock(baseLatest.lotto649, officialLatest.lotto649);
    merged.superLotto638 = mergeGameBlock(baseLatest.superLotto638, officialLatest.superLotto638);

    writeJson(path.join(ROOT, 'latest.json'), merged);
    writeJson(path.join(ROOT, 'data', 'latest.json'), merged);
    writeJson(path.join(ROOT, 'docs', 'latest.json'), merged);

    console.log('🎉 latest.json 已同步到 root / data / docs');
  } catch (err) {
    console.error('❌ update_official.js 失敗:', err);
    process.exit(1);
  }
}

main();