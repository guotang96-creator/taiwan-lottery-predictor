export default async function handler(req, res) {

const game=req.query.game
const count=parseInt(req.query.count)||30

try{

let url=""

if(game==="539"){
url="https://raw.githubusercontent.com/ChanceYu/TaiwanLottery/master/data/539.json"
}

if(game==="lotto"){
url="https://raw.githubusercontent.com/ChanceYu/TaiwanLottery/master/data/649.json"
}

if(game==="power"){
url="https://raw.githubusercontent.com/ChanceYu/TaiwanLottery/master/data/638.json"
}

if(game==="bingo"){
url="https://raw.githubusercontent.com/ChanceYu/TaiwanLottery/master/data/bingo.json"
}

const r=await fetch(url)
const data=await r.json()

let draws=[]

data.slice(0,count).forEach(d=>{

let numbers=[]

if(game==="power"){

numbers=[
d.n1,
d.n2,
d.n3,
d.n4,
d.n5,
d.n6
]

draws.push({
issue:d.issue,
date:d.date,
numbers:numbers,
second:d.n7
})

}else{

numbers=[
d.n1,
d.n2,
d.n3,
d.n4,
d.n5
]

if(game==="lotto"){
numbers.push(d.n6)
}

draws.push({
issue:d.issue,
date:d.date,
numbers:numbers
})

}

})

res.status(200).json({draws})

}catch(e){

res.status(200).json({draws:[]})

}

}