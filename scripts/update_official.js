const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");

function saveJson(name, rows) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, `${name}.json`),
    JSON.stringify(rows, null, 2),
    "utf8"
  );
  console.log(`saved ${name}.json: ${rows.length} rows`);
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function makeSequencePool(max) {
  const arr = [];
  for (let i = 1; i <= max; i++) arr.push(i);
  return arr;
}

function pickUniqueFromSeed(pool, start, count) {
  const picked = [];
  let idx = start;

  while (picked.length < count) {
    const n = pool[idx % pool.length];
    if (!picked.includes(n)) picked.push(n);
    idx += 3;
  }

  return picked.sort((a, b) => a - b);
}

/**
 * V66 手機穩定版：
 * 先把自動更新流程跑通。
 * 之後要換真實來源時，只要把 buildXXX() 改成 fetch 官方資料即可。
 */

function build539(total = 60) {
  const pool = makeSequencePool(39);
  const today = new Date();
  const rows = [];

  for (let i = 0; i < total; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    rows.push({
      issue: `539${String(1000 - i).padStart(4, "0")}`,
      date: formatDate(d),
      numbers: pickUniqueFromSeed(pool, i * 2 + 1, 5)
    });
  }

  return rows;
}

function buildLotto(total = 60) {
  const pool = makeSequencePool(49);
  const today = new Date();
  const rows = [];

  for (let i = 0; i < total; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 2);

    rows.push({
      issue: `649${String(1000 - i).padStart(4, "0")}`,
      date: formatDate(d),
      numbers: pickUniqueFromSeed(pool, i * 3 + 2, 6)
    });
  }

  return rows;
}

function buildPower(total = 60) {
  const pool = makeSequencePool(38);
  const secondPool = makeSequencePool(8);
  const today = new Date();
  const rows = [];

  for (let i = 0; i < total; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 2);

    rows.push({
      issue: `638${String(1000 - i).padStart(4, "0")}`,
      date: formatDate(d),
      numbers: pickUniqueFromSeed(pool, i * 4 + 1, 6),
      second: secondPool[(i * 2) % secondPool.length]
    });
  }

  return rows;
}

function buildBingo(total = 60) {
  const pool = makeSequencePool(80);
  const today = new Date();
  const rows = [];

  for (let i = 0; i < total; i++) {
    const d = new Date(today);
    d.setMinutes(d.getMinutes() - i * 5);

    rows.push({
      issue: `BINGO${String(100000 - i).padStart(6, "0")}`,
      date: formatDate(d),
      numbers: pickUniqueFromSeed(pool, i * 5 + 1, 20)
    });
  }

  return rows;
}

function main() {
  saveJson("539", build539());
  saveJson("lotto", buildLotto());
  saveJson("power", buildPower());
  saveJson("bingo", buildBingo());
  console.log("update done");
}

main();