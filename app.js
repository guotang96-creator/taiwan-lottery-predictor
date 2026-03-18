async function fetchMeta() {
  try {
    const res = await fetch("data/official/meta.json");
    return await res.json();
  } catch {
    return null;
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function ballsHTML(nums) {
  return nums.map(n => `<span class="ball">${pad(n)}</span>`).join("");
}

function latestFiveHTML(draws, label) {
  if (!draws.length) return "❌ 沒有資料";

  return draws.slice(0,5).map(d => `
    <div class="latest-item">
      第 ${d.issue || "-"} 期 (${d.date || ""})<br>
      ${ballsHTML(d.numbers)}
      ${d.special ? `<br>${label}: <span class="ball special">${pad(d.special)}</span>` : ""}
    </div>
  `).join("");
}

function normalize(draw) {
  return {
    issue: draw.issue || "",
    date: draw.date || "",
    numbers: draw.numbers || [],
    special: draw.special || null
  };
}

function pick(arr, n) {
  return arr.sort(()=>0.5-Math.random()).slice(0,n);
}

function analyze(draws, max, count) {
  const freq = Array(max+1).fill(0);

  draws.forEach(d=>{
    d.numbers.forEach(n=>freq[n]++);
  });

  const nums = [...Array(max)].map((_,i)=>i+1);

  nums.sort((a,b)=>freq[b]-freq[a]);

  return {
    hot: nums.slice(0,count),
    cold: nums.slice(-count)
  };
}

async function runPrediction(type) {
  const meta = await fetchMeta();

  const map = {
    bingo: ["bingo",80,10,"超級號"],
    "649": ["lotto649",49,6,"特別號"],
    "638": ["superlotto638",38,6,"第二區"],
    "539": ["dailycash",39,5,""]
  };

  const [key,max,count,label] = map[type];
  const data = meta?.[key]?.latest || [];

  const draws = data.map(normalize);

  if (!draws.length) {
    document.getElementById("predictionResult").innerHTML = "❌ 抓不到 meta.json";
    return;
  }

  const {hot,cold} = analyze(draws,max,count);

  const main = pick([...new Set([...hot,...Array(max).keys()].map(x=>x+1))],count);

  const html = `
    <h3>主推薦</h3>
    ${ballsHTML(main)}

    <h3>🔥熱號</h3>
    ${ballsHTML(hot)}

    <h3>❄冷號</h3>
    ${ballsHTML(cold)}

    <h3>最新五期</h3>
    ${latestFiveHTML(draws,label)}
  `;

  document.getElementById("resultGameName").innerText = key;
  document.getElementById("predictionResult").innerHTML = html;
}