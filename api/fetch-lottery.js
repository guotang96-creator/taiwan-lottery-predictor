export default async function handler(req, res) {
  const { game = "bingo", count = "50" } = req.query;

  const mock = {
    bingo: [
      { issue: "1150001", date: "2026-03-16", numbers: [1,6,7,10,11,13,17,21,22,25,36,40,47,50,53,60,61,64,70,79] },
      { issue: "1150002", date: "2026-03-16", numbers: [2,3,4,15,19,22,26,32,33,39,47,56,59,60,62,65,68,73,75,77] }
    ],
    lotto: [
      { issue: "115000001", date: "2026-03-15", numbers: [3,8,19,25,33,41] },
      { issue: "115000002", date: "2026-03-12", numbers: [7,11,16,24,38,49] }
    ],
    power: [
      { issue: "115000001", date: "2026-03-16", numbers: [14,26,28,31,32,34], second: 1 },
      { issue: "115000002", date: "2026-03-12", numbers: [4,9,15,25,27,31], second: 8 }
    ],
    "539": [
      { issue: "115000001", date: "2026-03-16", numbers: [17,19,21,29,34] },
      { issue: "115000002", date: "2026-03-14", numbers: [8,10,18,20,34] }
    ]
  };

  res.status(200).json({
    game,
    draws: (mock[game] || []).slice(0, Number(count))
  });
}