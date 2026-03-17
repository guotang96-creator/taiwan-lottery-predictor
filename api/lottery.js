export default async function handler(req, res) {
  const game = req.query.game || "539";
  const count = Number(req.query.count || 30);

  const fileMap = {
    "539": "/data/539.json",
    lotto: "/data/lotto.json",
    power: "/data/power.json",
    bingo: "/data/bingo.json"
  };

  try {
    const filePath = fileMap[game];

    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://${req.headers.host}`;

    const url = `${baseUrl}${filePath}?t=${Date.now()}`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) throw new Error("fetch fail");

    const data = await response.json();

    return res.status(200).json({
      game,
      draws: data.slice(0, count),
      source: "json"
    });

  } catch (err) {
    console.error("讀取失敗:", err);

    return res.status(200).json({
      game,
      draws: [],
      source: "error"
    });
  }
}