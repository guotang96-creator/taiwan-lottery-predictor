const fs = require("fs");

function safeUpdate(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ 不存在: ${filePath}`);
      return;
    }

    const oldData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // 🚫 不允許空資料覆蓋
    if (!Array.isArray(oldData) || oldData.length === 0) {
      console.log(`⚠️ 跳過（避免覆蓋空資料）: ${filePath}`);
      return;
    }

    // ✅ 僅排序（確保最新在前）
    oldData.sort((a, b) => {
      return new Date(b.drawDate) - new Date(a.drawDate);
    });

    fs.writeFileSync(filePath, JSON.stringify(oldData, null, 2));

    console.log(`✅ 保留並整理: ${filePath}`);
  } catch (err) {
    console.error(`❌ 錯誤: ${filePath}`, err);
  }
}

const files = [
  "data/official/bingo.json",
  "data/official/lotto649.json",
  "data/official/superlotto638.json",
  "data/official/dailycash.json",
];

files.forEach(safeUpdate);

console.log("🎯 V66.5 完成（真資料保護模式）");
