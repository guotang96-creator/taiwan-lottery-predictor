export default async function handler(req, res) {
  const game = req.query.game || "539";
  const count = Number(req.query.count || 30);

  const fileMap = {
    "539": "data/539.json",
    lotto: "data/lotto.json",
    power: "data/power.json",
    bingo: "data/bingo.json"
  };

  try {
    const file = fileMap[game];

    // ⭐️ 直接用你自己的網站（最穩）
    const base = "https://taiwan-lottery-predictor.vercel.app";

    const url = `${base}/${file}?t=${Date.now()}`;

    const r = await fetch(url, { cache: "no-store" });

    if (!r.ok) throw new Error("讀不到 JSON");

    const data = await r.json();

    return res.status(200).json({
      game,
      draws: data.slice(0, count),
      source: "ok"
    });

  } catch (e) {
    console.error("API錯誤:", e);

    return res.status(200).json({
      game,
      draws: [],
      source: "error"
    });
  }
}