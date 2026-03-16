function randomNumbers(min,max,count){

let nums=[];

while(nums.length<count){

let n=Math.floor(Math.random()*(max-min+1))+min;

if(!nums.includes(n)){
nums.push(n);
}

}

return nums.sort((a,b)=>a-b);

}

function predict(){

let game=document.getElementById("game").value;

let numbers=[];

if(game==="bingo"){
numbers=randomNumbers(1,80,10);
}

if(game==="lotto"){
numbers=randomNumbers(1,49,6);
}

if(game==="power"){
numbers=randomNumbers(1,38,6);
}

if(game==="539"){
numbers=randomNumbers(1,39,5);
}

document.getElementById("result").innerHTML=numbers.join(" , ");

}