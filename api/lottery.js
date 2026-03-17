export default async function handler(req, res) {
  const { game, count } = req.query;

  let url = "";

  if (game === "bingo") {
    url = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/BingoResult";
  }

  if (game === "lotto") {
    url = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Lotto649Result";
  }

  if (game === "power") {
    url = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/SuperLotto638Result";
  }

  if (game === "539") {
    url = "https://api.taiwanlottery.com/TLCAPIWeB/Lottery/Daily539Result";
  }

  try {
    const r = await fetch(url);
    const data = await r.json();

    let draws = [];

    if (game === "bingo") {
      draws = data?.content?.map(d => ({
        issue: d.drawTerm,
        date: d.drawDate,
        numbers: d.drawNumberAppear.split(",").map(Number)
      }));
    }

    if (game === "lotto") {
      draws = data?.content?.map(d => ({
        issue: d.drawTerm,
        date: d.drawDate,
        numbers: d.drawNumberAppear.slice(0,6).map(Number)
      }));
    }

    if (game === "power") {
      draws = data?.content?.map(d => ({
        issue: d.drawTerm,
        date: d.drawDate,
        numbers: d.drawNumberAppear.slice(0,6).map(Number),
        second: Number(d.drawNumberAppear[6])
      }));
    }

    if (game === "539") {
      draws = data?.content?.map(d => ({
        issue: d.drawTerm,
        date: d.drawDate,
        numbers: d.drawNumberAppear.slice(0,5).map(Number)
      }));
    }

    res.status(200).json({
      draws: draws.slice(0, Number(count || 30))
    });

  } catch (err) {
    res.status(200).json({ draws: [] });
  }
}