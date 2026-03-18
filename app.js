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
    console.warn(`⚠️ 無法讀取 ${filePath}:`, err.message);
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
  return arr.map(Number).filter(Number.isFinite);
}

function mergeData(baseJson, officialJson) {
  const officialLatest = officialJson?.officialLatest || {};

  const output = {
    ...baseJson,
    generatedAt: officialJson?.generatedAt || baseJson?.generatedAt || new Date().toISOString(),
    officialLatest
  };

  const gameKeys = ['bingo', 'daily539', 'lotto649', 'superLotto638'];

  for (const key of gameKeys) {
    output[key] = output[key] || {};
    const official = officialLatest[key];

    if (official) {
      output[key].latestOfficial = {
        period: official.period || '',
        drawDate: official.drawDate || '',
        redeemableDate: official.redeemableDate || '',
        numbers: normalizeArray(official.numbers),
        orderNumbers: normalizeArray(official.orderNumbers),
        specialNumber:
          official.specialNumber !== undefined && official.specialNumber !== null
            ? Number(official.specialNumber)
            : null,
        source: official.source || 'official-api'
      };

      output[key].latest = {
        period: official.period || '',
        drawDate: official.drawDate || '',
        numbers: normalizeArray(official.numbers),
        specialNumber:
          official.specialNumber !== undefined && official.specialNumber !== null
            ? Number(official.specialNumber)
            : null
      };
    }
  }

  return output;
}

function main() {
  try {
    const baseJson =
      readJson(path.join(ROOT, 'latest.json')) ||
      readJson(path.join(ROOT, 'data', 'latest.json')) ||
      readJson(path.join(ROOT, 'docs', 'latest.json')) ||
      {};

    const officialJson =
      readJson(path.join(ROOT, 'official_latest.json')) ||
      readJson(path.join(ROOT, 'data', 'official_latest.json')) ||
      readJson(path.join(ROOT, 'docs', 'official_latest.json')) ||
      {};

    const merged = mergeData(baseJson, officialJson);

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
