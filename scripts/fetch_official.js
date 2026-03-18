const fs = require("fs");

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    console.error("Fetch failed:", url);
    return null;
  }
}

function save(name, data) {
  fs.writeFileSync(`data/official/${name}.json`, JSON.stringify(data || [], null, 2));
}

// 台彩官方來源（公開接口）
const APIs = {
  bingo: "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Bingo/BingoResult",
  lotto649: "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Lotto649/Lotto649Result",
  superlotto638: "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/SuperLotto638/SuperLotto638Result",
  dailycash: "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/DailyCash/DailyCashResult"
};

(async () => {
  console.log("Fetching official lottery data...");

  for (const key of Object.keys(APIs)) {
    const data = await fetchJSON(APIs[key]);

    if (!data) {
      console.log(`${key}: ❌ fetch failed`);
      save(key, []);
      continue;
    }

    // 根據 API 結構抓資料（核心）
    let list = data?.content || data?.result || data?.data || [];

    console.log(`${key}:`, Array.isArray(list) ? list.length : 0);

    save(key, list);
  }

  console.log("Done fetch.");
})();