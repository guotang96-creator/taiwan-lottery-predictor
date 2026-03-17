export default async function handler(req, res) {
  const game = req.query.game || "539";
  const count = Number(req.query.count || 30);

  const map = {
    "539": "/data/539.json",
    lotto: "/data/lotto.json",
    power: "/data/power.json",
    bingo: "/data/bingo.json"
  };

  const fallbackData = {
    "539": [
      { issue: "539001", date: "2026-03-17", numbers: [8, 10, 18, 20, 34] },
      { issue: "539002", date: "2026-03-16", numbers: [7, 11, 17, 29, 33] }
    ],
    lotto: [
      { issue: "L001", date: "2026-03-17", numbers: [3, 8, 19, 25, 33, 41] },
      { issue: "L002", date: "2026-03-14", numbers: [5, 11, 17, 24, 38, 49] }
    ],
    power: [
      { issue: "P001", date: "2026-03-17", numbers: [4, 9, 15, 25, 27, 31], second: 8 },
      { issue: "P002", date: "2026-03-13", numbers: [3, 8, 14, 19, 26, 30], second: 2 }
    ],
    bingo: [
      { issue: "B001", date: "2026-03-17", numbers: [1,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46,49,52,55,58] },
      { issue: "B002", date: "2026-03-16", numbers: [2,5,8,11,14,17,20,23,26,29,32,35,38,41,44,47,50,53,56,59] }
    ]
  };

  try {
    const file = map[game];
    const base =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://${req.headers.host}`;

    const r = await fetch(base + file, { cache: "no-store" });

    if (r.ok) {
      const data = await r.json();
      const draws = Array.isArray(data) ? data.slice(0, count) : [];

      if (draws.length) {
        return res.status(200).json({
          game,
          draws,
          source: "real-history"
        });
      }
    }
  } catch (e) {
    // fallback
  }

  return res.status(200).json({
    game,
    draws: (fallbackData[game] || []).slice(0, count),
    source: "fallback"
  });
}