const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readJson(filePath, fallback = {}) {
  try {
    if (!fileExists(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`⚠️ 讀取失敗: ${filePath}`, err.message);
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

function pickFirstExisting(paths) {
  for (const p of paths) {
    if (fileExists(p)) return p;
  }
  return null;
}

function mergeGame(baseGame, officialGame, gameKey) {
  const latestOfficial = officialGame
    ? {
        period: officialGame.period || '',
        drawDate: officialGame.drawDate || '',
        redeemableDate: officialGame.redeemableDate || '',
        numbers: normalizeArray(officialGame.numbers),
        orderNumbers: normalizeArray(officialGame.orderNumbers),
        specialNumber:
          officialGame.specialNumber !== undefined && officialGame.specialNumber !== null
            ? Number(officialGame.specialNumber)
            : null,
        source: officialGame.source || 'official-api'
      }
    : null;

  return {
    ...(baseGame || {}),
    game: gameKey,
    latestOfficial,
    latest: latestOfficial || baseGame?.latest || null
  };
}

function main() {
  try {
    const latestFile = pickFirstExisting([
      path.join(ROOT, 'latest.json'),
      path.join(ROOT, 'data', 'latest.json'),
      path.join(ROOT, 'docs', 'latest.json')
    ]);

    const officialFile = pickFirstExisting([
      path.join(ROOT, 'official_latest.json'),
      path.join(ROOT, 'data', 'official_latest.json'),
      path.join(ROOT, 'docs', 'official_latest.json')
    ]);

    const baseJson = latestFile ? readJson(latestFile, {}) : {};
    const officialJson = officialFile ? readJson(officialFile, {}) : {};

    const officialLatest = officialJson?.officialLatest || {};

    const merged = {
      ...baseJson,
      generatedAt: new Date().toISOString(),
      source: 'merged-official-data',
      officialLatest,
      bingo: mergeGame(baseJson?.bingo, officialLatest?.bingo, 'bingo'),
      daily539: mergeGame(baseJson?.daily539, officialLatest?.daily539, 'daily539'),
      lotto649: mergeGame(baseJson?.lotto649, officialLatest?.lotto649, 'lotto649'),
      superLotto638: mergeGame(baseJson?.superLotto638, officialLatest?.superLotto638, 'superLotto638')
    };

    writeJson(path.join(ROOT, 'latest.json'), merged);
    writeJson(path.join(ROOT, 'data', 'latest.json'), merged);
    writeJson(path.join(ROOT, 'docs', 'latest.json'), merged);

    console.log('🎉 latest.json 已同步輸出到 root / data / docs');
  } catch (err) {
    console.error('❌ update_official.js 失敗:', err);
    process.exit(1);
  }
}

main();