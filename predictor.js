function toInt(n) {
  const v = parseInt(n, 10);
  return Number.isFinite(v) ? v : null;
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a - b);
}

function pickTop(scores, count, min = 1, max = 49, exclude = []) {
  const ex = new Set(exclude);
  const pool = [];
  for (let i = min; i <= max; i++) {
    if (ex.has(i)) continue;
    pool.push({
      num: i,
      score: scores[i] || 0
    });
  }
  pool.sort((a, b) => b.score - a.score || a.num - b.num);
  return pool.slice(0, count).map(x => x.num).sort((a, b) => a - b);
}

function getDrawNumbers(draw, maxBall = 49) {
  const nums = [];
  for (const key of Object.keys(draw || {})) {
    if (/^n\d+$/i.test(key)) {
      const v = toInt(draw[key]);
      if (v && v >= 1 && v <= maxBall) nums.push(v);
    }
  }

  if (Array.isArray(draw?.numbers)) {
    for (const n of draw.numbers) {
      const v = toInt(n);
      if (v && v >= 1 && v <= maxBall) nums.push(v);
    }
  }

  return uniqueSorted(nums);
}

function buildStats(draws, {
  maxBall,
  recentWeight = 2.2,
  warmWeight = 1.4,
  normalWeight = 1.0
}) {
  const freq = Array(maxBall + 1).fill(0);
  const recentFreq = Array(maxBall + 1).fill(0);
  const tailFreq = Array(10).fill(0);
  const pairMap = {};
  const miss = Array(maxBall + 1).fill(9999);

  for (let i = 0; i < draws.length; i++) {
    const nums = getDrawNumbers(draws[i], maxBall);

    for (const n of nums) {
      freq[n] += 1;
      if (i < 30) recentFreq[n] += recentWeight;
      else if (i < 80) recentFreq[n] += warmWeight;
      else recentFreq[n] += normalWeight;

      tailFreq[n % 10] += 1;
      if (miss[n] === 9999) miss[n] = i;
    }

    for (let a = 0; a < nums.length; a++) {
      for (let b = a + 1; b < nums.length; b++) {
        const k = `${nums[a]}-${nums[b]}`;
        pairMap[k] = (pairMap[k] || 0) + 1;
      }
    }
  }

  return { freq, recentFreq, tailFreq, pairMap, miss };
}

function scoreNumbers(draws, {
  maxBall,
  pickCount,
  avoidRecent = true
}) {
  const stats = buildStats(draws, { maxBall });
  const scores = Array(maxBall + 1).fill(0);
  const latest = draws[0] ? getDrawNumbers(draws[0], maxBall) : [];

  for (let n = 1; n <= maxBall; n++) {
    const hot = stats.freq[n] * 1.1;
    const recent = stats.recentFreq[n] * 1.6;
    const overdue = Math.min(stats.miss[n], 50) * 0.45;
    const tailBonus = stats.tailFreq[n % 10] * 0.08;

    scores[n] = hot + recent + overdue + tailBonus;

    if (avoidRecent && latest.includes(n)) {
      scores[n] *= 0.78;
    }
  }

  const top = pickTop(scores, pickCount, 1, maxBall);

  return {
    numbers: top,
    scores,
    stats,
    latest
  };
}

function scoreSecondArea(draws, maxBall = 8) {
  const freq = Array(maxBall + 1).fill(0);
  const miss = Array(maxBall + 1).fill(9999);

  for (let i = 0; i < draws.length; i++) {
    const s = toInt(draws[i]?.special || draws[i]?.s || draws[i]?.zone2);
    if (s && s >= 1 && s <= maxBall) {
      freq[s] += 1;
      if (miss[s] === 9999) miss[s] = i;
    }
  }

  const scores = Array(maxBall + 1).fill(0);
  for (let i = 1; i <= maxBall; i++) {
    scores[i] = freq[i] * 1.5 + Math.min(miss[i], 20) * 0.7;
  }

  return pickTop(scores, 1, 1, maxBall)[0];
}

function makeMultiSets(baseScores, setCount, pickCount, maxBall) {
  const sets = [];
  const usedBoost = {};

  for (let i = 0; i < setCount; i++) {
    const cloned = [...baseScores];
    for (let n = 1; n <= maxBall; n++) {
      if (usedBoost[n]) cloned[n] *= usedBoost[n];
    }

    const set = pickTop(cloned, pickCount, 1, maxBall);
    sets.push(set);

    for (const n of set) {
      usedBoost[n] = (usedBoost[n] || 1) * 0.88;
    }
  }

  return sets;
}

function predict539(draws, setCount = 3) {
  const result = scoreNumbers(draws, {
    maxBall: 39,
    pickCount: 5
  });

  return {
    best: result.numbers,
    sets: makeMultiSets(result.scores, setCount, 5, 39),
    hot: pickTop(result.stats.freq, 10, 1, 39),
    cold: [...Array(39).keys()].slice(1).sort((a, b) => result.stats.miss[b] - result.stats.miss[a]).slice(0, 10),
    latest: result.latest
  };
}

function predict649(draws, setCount = 3) {
  const result = scoreNumbers(draws, {
    maxBall: 49,
    pickCount: 6
  });

  return {
    best: result.numbers,
    sets: makeMultiSets(result.scores, setCount, 6, 49),
    hot: pickTop(result.stats.freq, 10, 1, 49),
    cold: [...Array(49).keys()].slice(1).sort((a, b) => result.stats.miss[b] - result.stats.miss[a]).slice(0, 10),
    latest: result.latest
  };
}

function predict638(draws, setCount = 3) {
  const result = scoreNumbers(draws, {
    maxBall: 38,
    pickCount: 6
  });

  return {
    zone1: result.numbers,
    zone2: scoreSecondArea(draws, 8),
    sets: makeMultiSets(result.scores, setCount, 6, 38).map(set => ({
      zone1: set,
      zone2: scoreSecondArea(draws, 8)
    })),
    hot: pickTop(result.stats.freq, 10, 1, 38),
    cold: [...Array(38).keys()].slice(1).sort((a, b) => result.stats.miss[b] - result.stats.miss[a]).slice(0, 10),
    latest: result.latest
  };
}

function predictBingo(draws, selectCount = 10, setCount = 3) {
  const result = scoreNumbers(draws, {
    maxBall: 80,
    pickCount: selectCount,
    avoidRecent: false
  });

  return {
    best: result.numbers,
    sets: makeMultiSets(result.scores, setCount, selectCount, 80),
    hot: pickTop(result.stats.freq, 15, 1, 80),
    cold: [...Array(80).keys()].slice(1).sort((a, b) => result.stats.miss[b] - result.stats.miss[a]).slice(0, 15),
    latest: result.latest
  };
}

window.LotteryPredictor = {
  predict539,
  predict649,
  predict638,
  predictBingo
};