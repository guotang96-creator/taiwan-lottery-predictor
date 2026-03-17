export default async function handler(req, res) {

const game=req.query.game
const count=parseInt(req.query.count)||30

let url=""

if(game==="539"){
url="https://api.apicep.com/api/twlotto539"
}

if(game==="lotto"){
url="https://api.apicep.com/api/twlotto649"
}

if(game==="power"){
url="https://api.apicep.com/api/twlotto638"
}

if(game==="bingo"){
url="https://api.apicep.com/api/twbingo"
}

try{

const r=await fetch(url)
const data=await r.json()

let draws=[]

data.slice(0,count).forEach(d=>{

let numbers=[]

if(game==="power"){

numbers=[
d.Lotto1,
d.Lotto2,
d.Lotto3,
d.Lotto4,
d.Lotto5,
d.Lotto6
]

draws.push({
issue:d.Period,
date:d.Date,
numbers:numbers,
second:d.Lotto7
})

}else{

numbers=[
d.Lotto1,
d.Lotto2,
d.Lotto3,
d.Lotto4,
d.Lotto5
]

if(game==="lotto"){
numbers.push(d.Lotto6)
}

draws.push({
issue:d.Period,
date:d.Date,
numbers:numbers
})

}

})

res.status(200).json({draws})

}catch(e){

res.status(200).json({draws:[]})

}

}