export default async function handler(req, res) {
  const game = req.query.game || "539";
  const count = Number(req.query.count || 30);

  const fallbackData = {
    "539": [
      { issue: "539001", date: "2026-03-17", numbers: [8, 10, 18, 20, 34] },
      { issue: "539002", date: "2026-03-16", numbers: [7, 11, 17, 29, 33] },
      { issue: "539003", date: "2026-03-15", numbers: [6, 12, 18, 21, 35] },
      { issue: "539004", date: "2026-03-14", numbers: [5, 10, 19, 24, 34] },
      { issue: "539005", date: "2026-03-13", numbers: [8, 14, 20, 23, 31] },
      { issue: "539006", date: "2026-03-12", numbers: [9, 11, 17, 22, 36] },
      { issue: "539007", date: "2026-03-11", numbers: [7, 12, 18, 25, 33] },
      { issue: "539008", date: "2026-03-10", numbers: [6, 10, 21, 24, 34] }
    ],
    lotto: [
      { issue: "L001", date: "2026-03-17", numbers: [3, 8, 19, 25, 33, 41] },
      { issue: "L002", date: "2026-03-14", numbers: [5, 11, 17, 24, 38, 49] },
      { issue: "L003", date: "2026-03-10", numbers: [2, 7, 15, 21, 34, 42] },
      { issue: "L004", date: "2026-03-07", numbers: [6, 12, 18, 27, 31, 44] },
      { issue: "L005", date: "2026-03-03", numbers: [1, 9, 16, 22, 35, 40] },
      { issue: "L006", date: "2026-02-28", numbers: [4, 10, 14, 23, 36, 45] },
      { issue: "L007", date: "2026-02-24", numbers: [5, 8, 20, 26, 32, 47] },
      { issue: "L008", date: "2026-02-21", numbers: [7, 13, 19, 24, 37, 48] }
    ],
    power: [
      { issue: "P001", date: "2026-03-17", numbers: [4, 9, 15, 25, 27, 31], second: 8 },
      { issue: "P002", date: "2026-03-13", numbers: [3, 8, 14, 19, 26, 30], second: 2 },
      { issue: "P003", date: "2026-03-10", numbers: [5, 10, 16, 22, 28, 34], second: 5 },
      { issue: "P004", date: "2026-03-06", numbers: [1, 7, 13, 20, 29, 35], second: 1 },
      { issue: "P005", date: "2026-03-03", numbers: [2, 11, 17, 24, 31, 37], second: 6 },
      { issue: "P006", date: "2026-02-27", numbers: [6, 9, 18, 21, 27, 33], second: 3 },
      { issue: "P007", date: "2026-02-24", numbers: [4, 12, 15, 23, 30, 38], second: 7 },
      { issue: "P008", date: "2026-02-20", numbers: [5, 8, 19, 25, 28, 32], second: 4 }
    ],
    bingo: [
      { issue: "B001", date: "2026-03-17", numbers: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 58] },
      { issue: "B002", date: "2026-03-16", numbers: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41, 44, 47, 50, 53, 56, 59] },
      { issue: "B003", date: "2026-03-15", numbers: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60] },
      { issue: "B004", date: "2026-03-14", numbers: [5, 6, 15, 18, 22, 24, 27, 31, 33, 36, 40, 41, 44, 45, 50, 61, 62, 70, 71, 80] },
      { issue: "B005", date: "2026-03-13", numbers: [1, 3, 8, 9, 17, 21, 26, 28, 30, 34, 35, 39, 43, 47, 52, 64, 65, 72, 73, 79] },
      { issue: "B006", date: "2026-03-12", numbers: [2, 4, 7, 10, 16, 20, 23, 25, 29, 32, 38, 42, 46, 49, 53, 58, 66, 67, 74, 75] },
      { issue: "B007", date: "2026-03-11", numbers: [6, 11, 12, 13, 19, 24, 28, 31, 37, 40, 41, 48, 50, 54, 55, 60, 68, 69, 76, 77] },
      { issue: "B008", date: "2026-03-10", numbers: [5, 7, 14, 15, 18, 22, 27, 30, 33, 36, 39, 44, 47, 52, 57, 61, 63, 70, 78, 79] }
    ]
  };

  const map = {
    "539": "/data/539.json",
    lotto: "/data/lotto.json",
    power: "/data/power.json",
    bingo: "/data/bingo.json"
  };

  try {
    const file = map[game];
    const base =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://${req.headers.host}`;

    if (file) {
      const r = await fetch(base + file);
      if (r.ok) {
        const data = await r.json();
        const draws = Array.isArray(data) ? data.slice(0, count) : [];

        if (draws.length) {
          return res.status(200).json({
            game,
            draws,
            source: "repo-data"
          });
        }
      }
    }
  } catch (e) {
    // 失敗就走 fallback
  }

  return res.status(200).json({
    game,
    draws: (fallbackData[game] || []).slice(0, count),
    source: "fallback"
  });
}