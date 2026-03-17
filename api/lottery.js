export default async function handler(req, res) {
  const game = req.query.game || "539";
  const count = Number(req.query.count || 30);

  const map = {
    bingo: "/data/bingo.json",
    lotto: "/data/lotto.json",
    power: "/data/power.json",
    "539": "/data/539.json"
  };

  const file = map[game];

  try {
    const base =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://${req.headers.host}`;

    const r = await fetch(base + file);
    const data = await r.json();

    res.status(200).json({
      game,
      draws: (data || []).slice(0, count)
    });
  } catch (e) {
    res.status(200).json({
      game,
      draws: []
    });
  }
}