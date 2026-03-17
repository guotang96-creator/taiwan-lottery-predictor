export default async function handler(req, res) {
  try {
    const game = req.query.game || "bingo";
    const count = Number(req.query.count || 30);

    let draws = [];

    if (game === "bingo") {
      draws = await fetchBingo(count);
    } else if (game === "lotto") {
      draws = await fetchLotto("lotto649", count);
    } else if (game === "power") {
      draws = await fetchPower(count);
    } else if (game === "539") {
      draws = await fetch539(count);
    }

    res.status(200).json({
      game,
      draws: draws.slice(0, count)
    });
  } catch (error) {
    console.error("lottery api error:", error);
    res.status(200).json({
      game: req.query.game || "bingo",
      draws: []
    });
  }
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.8"
    }
  });
  return await r.text();
}

function cleanText(html) {
  return html
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function uniqueByIssue(list) {
  const map = new Map();
  list.forEach(item => {
    if (item && item.issue && !map.has(item.issue)) {
      map.set(item.issue, item);
    }
  });
  return Array.from(map.values());
}

function parseNumbers(text, need) {
  const nums = (text.match(/\d{1,2}/g) || [])
    .map(n => Number(n))
    .filter(n => n > 0);

  const result = [];
  for (const n of nums) {
    if (result.length >= need) break;
    result.push(n);
  }
  return result;
}

async function fetchBingo(count) {
  const url = "https://www.taiwanlottery.com/lotto/result/bingo_bingo/";
  const html = cleanText(await fetchText(url));

  const issueMatches = [...html.matchAll(/(\d{9})/g)].map(m => m[1]);
  const dateMatches = [...html.matchAll(/(\d{4}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2})/g)].map(m => m[1]);

  const blocks = html.split(/BINGO BINGO|賓果賓果/);
  const draws = [];

  for (const block of blocks) {
    const issue = (block.match(/(\d{9})/) || [])[1];
    if (!issue) continue;

    const numbers = parseNumbers(
      block
        .replace(issue, "")
        .replace(/超級獎號.*$/, ""),
      20
    );

    if (numbers.length >= 20) {
      const date = (block.match(/(\d{4}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      draws.push({
        issue,
        date: date.replace(/\//g, "-"),
        numbers: numbers.slice(0, 20)
      });
    }
  }

  if (draws.length) return uniqueByIssue(draws).slice(0, count);

  const fallback = [];
  for (let i = 0; i < Math.min(issueMatches.length, dateMatches.length); i++) {
    fallback.push({
      issue: issueMatches[i],
      date: dateMatches[i].replace(/\//g, "-"),
      numbers: []
    });
  }
  return uniqueByIssue(fallback).slice(0, count);
}

async function fetchLotto(type, count) {
  const url = "https://www.taiwanlottery.com/lotto/history/history_result/";
  const form = new URLSearchParams();
  form.set("type", type);

  const html = cleanText(
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "user-agent": "Mozilla/5.0",
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.8"
      },
      body: form.toString()
    }).then(r => r.text())
  );

  const issueRegex = /(\d{9})/g;
  const dateRegex = /(\d{4}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2})/g;

  const issues = [...html.matchAll(issueRegex)].map(m => m[1]);
  const dates = [...html.matchAll(dateRegex)].map(m => m[1].replace(/\//g, "-"));

  const draws = [];
  const chunks = html.split(/獎號|中獎號碼/);

  for (const chunk of chunks) {
    const issue = (chunk.match(/(\d{9})/) || [])[1];
    if (!issue) continue;

    const numbers = parseNumbers(chunk.replace(issue, ""), 7);
    if (numbers.length >= 6) {
      const date = (chunk.match(/(\d{4}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      draws.push({
        issue,
        date: date.replace(/\//g, "-"),
        numbers: numbers.slice(0, 6),
        second: numbers[6] || null
      });
    }
  }

  if (draws.length) return uniqueByIssue(draws).slice(0, count);

  const fallback = [];
  for (let i = 0; i < Math.min(issues.length, dates.length); i++) {
    fallback.push({
      issue: issues[i],
      date: dates[i],
      numbers: []
    });
  }
  return uniqueByIssue(fallback).slice(0, count);
}

async function fetchPower(count) {
  const url = "https://www.taiwanlottery.com/lotto/result/super_lotto638/";
  const html = cleanText(await fetchText(url));

  const draws = [];
  const blocks = html.split(/威力彩/);

  for (const block of blocks) {
    const issue = (block.match(/(\d{9})/) || [])[1];
    if (!issue) continue;

    const nums = parseNumbers(block.replace(issue, ""), 7);
    if (nums.length >= 7) {
      const date = (block.match(/(\d{4}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      draws.push({
        issue,
        date: date.replace(/\//g, "-"),
        numbers: nums.slice(0, 6),
        second: nums[6]
      });
    }
  }

  return uniqueByIssue(draws).slice(0, count);
}

async function fetch539(count) {
  const url = "https://www.taiwanlottery.com/lotto/result/dailycash/";
  const html = cleanText(await fetchText(url));

  const draws = [];
  const blocks = html.split(/今彩539/);

  for (const block of blocks) {
    const issue = (block.match(/(\d{9})/) || [])[1];
    if (!issue) continue;

    const nums = parseNumbers(block.replace(issue, ""), 5);
    if (nums.length >= 5) {
      const date = (block.match(/(\d{4}\/\d{2}\/\d{2}|\d{4}-\d{2}-\d{2})/) || [])[1] || "";
      draws.push({
        issue,
        date: date.replace(/\//g, "-"),
        numbers: nums.slice(0, 5)
      });
    }
  }

  return uniqueByIssue(draws).slice(0, count);
}