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
    console.warn(`⚠️ 無法讀取 JSON: ${filePath}`, err.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ 已寫入 ${filePath}`);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function normalizeNumberArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(v => Number(v))
    .filter(v => Number.isFinite(v));
}

function pickLatestJsonFile() {
  const candidates = [
    path.join(ROOT, 'latest.json'),
    path.join(ROOT, 'data', 'latest.json'),
    path.join(ROOT, 'docs', 'latest.json'),
    path.join(ROOT, 'public', 'latest.json')
  ];

  for (const file of candidates) {
    if (fileExists(file)) return file;
  }

  return path.join(ROOT, 'latest.json');
}

function pickOfficialLatestFile() {
  const candidates = [
    path.join(ROOT, 'official_latest.json'),
    path.join(ROOT, 'data', 'official_latest.json'),
    path.join(ROOT, 'docs', 'official_latest.json')
  ];

  for (const file of candidates) {
    if (fileExists(file)) return file;
  }

  return null;
}

function safeGameBlock(base, key) {
  if (!base || typeof base !== 'object') return {};
  if (!base[key] || typeof base[key] !== 'object') return {};
  return base[key];
}

function toFrontEndGameData(gameKey, gameData, officialData) {
  const merged = {
    ...gameData
  };

  if (officialData && typeof officialData === 'object') {
    merged.latestOfficial = {
      period: officialData.period || '',
      drawDate: officialData.drawDate || '',
      redeemableDate: officialData.redeemableDate || '',
      numbers: normalizeNumberArray(officialData.numbers),
      orderNumbers: normalizeNumberArray(officialData.orderNumbers),
      specialNumber:
        officialData.specialNumber !== undefined && officialData.specialNumber !== null
          ? Number(officialData.specialNumber)
          : null,
      source: officialData.source || 'official-api'
    };

    merged.latest = {
      period: officialData.period || '',
      drawDate: officialData.drawDate || '',
      numbers: normalizeNumberArray(officialData.numbers),
      specialNumber:
        officialData.specialNumber !== undefined && officialData.specialNumber !== null
          ? Number(officialData.specialNumber)
          : null
    };
  } else {
    merged.latestOfficial = merged.latestOfficial || null;
    merged.latest = merged.latest || merged.latest || null;
  }

  merged.game = gameKey;
  return merged;
}

function buildFrontEndPayload(baseJson, officialLatestJson) {
  const officialLatest = officialLatestJson?.officialLatest || {};

  const bingoBase = safeGameBlock(baseJson, 'bingo');
  const daily539Base = safeGameBlock(baseJson, 'daily539');
  const lotto649Base = safeGameBlock(baseJson, 'lotto649');
  const superLotto638Base = safeGameBlock(baseJson, 'superLotto638');

  const output = {
    generatedAt:
      officialLatestJson?.generatedAt ||
      baseJson?.generatedAt ||
      new Date().toISOString(),

    source: 'merged-official-data',

    bingo: toFrontEndGameData('bingo', bingoBase, officialLatest.bingo),
    daily539: toFrontEndGameData('daily539', daily539Base, officialLatest.daily539),
    lotto649: toFrontEndGameData('lotto649', lotto649Base, officialLatest.lotto649),
    superLotto638: toFrontEndGameData(
      'superLotto638',
      superLotto638Base,
      officialLatest.superLotto638
    ),

    officialLatest: officialLatest
  };

  return output;
}

function writeAllTargets(data) {
  const targets = [
    path.join(ROOT, 'latest.json'),
    path.join(ROOT, 'data', 'latest.json')
  ];

  if (fileExists(path.join(ROOT, 'docs'))) {
    targets.push(path.join(ROOT, 'docs', 'latest.json'));
  }

  if (fileExists(path.join(ROOT, 'public'))) {
    targets.push(path.join(ROOT, 'public', 'latest.json'));
  }

  for (const target of targets) {
    writeJson(target, data);
  }
}

function main() {
  try {
    const latestJsonFile = pickLatestJsonFile();
    const officialLatestFile = pickOfficialLatestFile();

    console.log(`📄 latest.json 來源: ${latestJsonFile}`);
    console.log(`📄 official_latest.json 來源: ${officialLatestFile || '未找到'}`);

    const baseJson = readJson(latestJsonFile, {}) || {};
    const officialLatestJson = officialLatestFile
      ? readJson(officialLatestFile, {})
      : {};

    const merged = buildFrontEndPayload(baseJson, officialLatestJson);

    writeAllTargets(merged);

    console.log('🎉 update_official.js 完成');
  } catch (err) {
    console.error('❌ update_official.js 失敗:', err);
    process.exit(1);
  }
}

main();
