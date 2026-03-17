import json
import re
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8"
}


def fetch_text(url, method="GET", data=None):
    if method == "POST":
        r = requests.post(url, headers=HEADERS, data=data, timeout=20)
    else:
        r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return r.text


def clean_text(text):
    return (
        text.replace("\r", " ")
        .replace("\n", " ")
        .replace("\t", " ")
        .replace("&nbsp;", " ")
    )


def normalize_date(text):
    if not text:
        return ""
    return text.replace("/", "-")


def load_existing(name):
    path = DATA_DIR / f"{name}.json"
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_json(name, rows):
    path = DATA_DIR / f"{name}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"updated: {path}")


def safe_update(name, rows):
    if rows and len(rows) > 0:
        save_json(name, rows)
        return True
    print(f"skip update {name}, keep existing data")
    return False


def unique_by_issue(rows):
    result = []
    seen = set()
    for row in rows:
        issue = row.get("issue")
        if issue and issue not in seen:
            seen.add(issue)
            result.append(row)
    return result


def parse_blocks_by_issue(html, issue_pattern=r"\d{9}"):
    matches = list(re.finditer(issue_pattern, html))
    if not matches:
        return []

    blocks = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(html)
        blocks.append(html[start:end])
    return blocks


def extract_date(block):
    m = re.search(r"(\d{4}[/-]\d{2}[/-]\d{2})", block)
    return normalize_date(m.group(1)) if m else ""


def extract_issue(block):
    m = re.search(r"(\d{9})", block)
    return m.group(1) if m else ""


def extract_numbers(block, min_num=1, max_num=99):
    nums = [int(x) for x in re.findall(r"\b\d{1,2}\b", block)]
    return [n for n in nums if min_num <= n <= max_num]


def fetch_539():
    url = "https://www.taiwanlottery.com/lotto/result/dailycash/"
    html = clean_text(fetch_text(url))
    blocks = parse_blocks_by_issue(html)

    rows = []
    for block in blocks:
      issue = extract_issue(block)
      if not issue:
          continue

      date = extract_date(block)
      nums = extract_numbers(block, 1, 39)

      if len(nums) >= 5:
          rows.append({
              "issue": issue,
              "date": date,
              "numbers": nums[:5]
          })

    return unique_by_issue(rows)[:50]


def fetch_lotto():
    url = "https://www.taiwanlottery.com/lotto/result/lotto649/"
    html = clean_text(fetch_text(url))
    blocks = parse_blocks_by_issue(html)

    rows = []
    for block in blocks:
      issue = extract_issue(block)
      if not issue:
          continue

      date = extract_date(block)
      nums = extract_numbers(block, 1, 49)

      if len(nums) >= 6:
          rows.append({
              "issue": issue,
              "date": date,
              "numbers": nums[:6]
          })

    return unique_by_issue(rows)[:50]


def fetch_power():
    url = "https://www.taiwanlottery.com/lotto/result/super_lotto638/"
    html = clean_text(fetch_text(url))
    blocks = parse_blocks_by_issue(html)

    rows = []
    for block in blocks:
      issue = extract_issue(block)
      if not issue:
          continue

      date = extract_date(block)
      nums = extract_numbers(block, 1, 38)
      second_candidates = extract_numbers(block, 1, 8)

      if len(nums) >= 6:
          second = second_candidates[-1] if second_candidates else 1
          rows.append({
              "issue": issue,
              "date": date,
              "numbers": nums[:6],
              "second": second
          })

    return unique_by_issue(rows)[:50]


def fetch_bingo():
    url = "https://www.taiwanlottery.com/lotto/result/bingo_bingo/"
    html = clean_text(fetch_text(url))

    blocks = parse_blocks_by_issue(html)
    rows = []

    for block in blocks:
      issue = extract_issue(block)
      if not issue:
          continue

      date = extract_date(block)
      nums = extract_numbers(block, 1, 80)

      if len(nums) >= 20:
          rows.append({
              "issue": issue,
              "date": date,
              "numbers": nums[:20]
          })

    return unique_by_issue(rows)[:50]


def main():
    jobs = [
        ("539", fetch_539),
        ("lotto", fetch_lotto),
        ("power", fetch_power),
        ("bingo", fetch_bingo),
    ]

    for name, fn in jobs:
        try:
            rows = fn()
            if not rows:
                print(f"{name}: no parsed rows, keep old data")
                continue
            safe_update(name, rows)
        except Exception as e:
            print(f"{name}: update failed -> {e}")
            print(f"{name}: keep existing data")


if __name__ == "__main__":
    main()