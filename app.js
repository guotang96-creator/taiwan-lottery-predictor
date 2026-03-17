let history=[]

async function loadData(){

let game=document.getElementById("game").value

let res=await fetch("/api/lottery?game="+game)

let data=await res.json()

history=data

alert("歷史資料載入完成")

}

function predict(){

let numbers={}

history.forEach(draw=>{

draw.forEach(n=>{
numbers[n]=(numbers[n]||0)+1
})

})

let sorted=Object.entries(numbers)
.sort((a,b)=>b[1]-a[1])
.slice(0,6)
.map(v=>v[0])

document.getElementById("result").innerHTML=sorted.join(" , ")

}