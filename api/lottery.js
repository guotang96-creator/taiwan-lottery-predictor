export default async function handler(req, res) {

const game = req.query.game;
const count = Number(req.query.count || 30);

let url = "";

if (game === "539") {
url = "https://www.taiwanlottery.com.tw/lotto/DailyCash/history.aspx";
}

if (game === "lotto") {
url = "https://www.taiwanlottery.com.tw/lotto/Lotto649/history.aspx";
}

if (game === "power") {
url = "https://www.taiwanlottery.com.tw/lotto/SuperLotto638/history.aspx";
}

if (game === "bingo") {
url = "https://www.taiwanlottery.com.tw/lotto/bingo/bingo.asp";
}

try {

const r = await fetch(url,{
headers:{
"user-agent":"Mozilla/5.0"
}
});

const text = await r.text();

const numbers = [...text.matchAll(/\d{2}/g)]
.map(v=>Number(v[0]))
.filter(n=>n>0 && n<90);

const draws = [];

for(let i=0;i<count;i++){

const start=i*6;

const nums=numbers.slice(start,start+6);

if(nums.length>=5){

draws.push({
issue:String(539000+i),
date:"",
numbers:nums.slice(0,5)
});

}

}

res.status(200).json({draws});

}catch(e){

res.status(200).json({draws:[]});

}

}