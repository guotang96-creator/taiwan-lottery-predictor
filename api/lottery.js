export default async function handler(req, res) {

const game = req.query.game;
const count = Number(req.query.count || 30);

try {

const r = await fetch("https://raw.githubusercontent.com/GuoTang96/lottery-data/main/539.json");

const data = await r.json();

res.status(200).json({
draws: data.slice(0,count)
});

}catch(e){

res.status(200).json({draws:[]});

}

}