import csv
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "raw_data"
DATA_DIR = BASE_DIR / "data"

RAW_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)


def clean_date(text: str) -> str:
    return str(text).strip().replace("/", "-").replace(".", "-")


def to_int(value):
    try:
        return int(str(value).strip())
    except Exception:
        return None


def save_json(name: str, rows: list):
    out = DATA_DIR / f"{name}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"saved: {out}")


def read_csv_rows(filename: str):
    path = RAW_DIR / filename
    if not path.exists():
        print(f"missing: {path}")
        return []

    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def convert_539():
    rows = read_csv_rows("539.csv")
    result = []

    for r in rows:
        issue = str(r.get("issue", "")).strip()
        date = clean_date(r.get("date", ""))

        numbers = [
            to_int(r.get("n1")),
            to_int(r.get("n2")),
            to_int(r.get("n3")),
            to_int(r.get("n4")),
            to_int(r.get("n5")),
        ]
        numbers = [n for n in numbers if n is not None]

        if issue and len(numbers) == 5:
            result.append({
                "issue": issue,
                "date": date,
                "numbers": numbers
            })

    save_json("539", result)


def convert_lotto():
    rows = read_csv_rows("lotto.csv")
    result = []

    for r in rows:
        issue = str(r.get("issue", "")).strip()
        date = clean_date(r.get("date", ""))

        numbers = [
            to_int(r.get("n1")),
            to_int(r.get("n2")),
            to_int(r.get("n3")),
            to_int(r.get("n4")),
            to_int(r.get("n5")),
            to_int(r.get("n6")),
        ]
        numbers = [n for n in numbers if n is not None]

        if issue and len(numbers) == 6:
            result.append({
                "issue": issue,
                "date": date,
                "numbers": numbers
            })

    save_json("lotto", result)


def convert_power():
    rows = read_csv_rows("power.csv")
    result = []

    for r in rows:
        issue = str(r.get("issue", "")).strip()
        date = clean_date(r.get("date", ""))

        numbers = [
            to_int(r.get("n1")),
            to_int(r.get("n2")),
            to_int(r.get("n3")),
            to_int(r.get("n4")),
            to_int(r.get("n5")),
            to_int(r.get("n6")),
        ]
        numbers = [n for n in numbers if n is not None]
        second = to_int(r.get("second"))

        if issue and len(numbers) == 6 and second is not None:
            result.append({
                "issue": issue,
                "date": date,
                "numbers": numbers,
                "second": second
            })

    save_json("power", result)


def convert_bingo():
    rows = read_csv_rows("bingo.csv")
    result = []

    for r in rows:
        issue = str(r.get("issue", "")).strip()
        date = clean_date(r.get("date", ""))

        numbers = []
        for i in range(1, 21):
            n = to_int(r.get(f"n{i}"))
            if n is not None:
                numbers.append(n)

        if issue and len(numbers) == 20:
            result.append({
                "issue": issue,
                "date": date,
                "numbers": numbers
            })

    save_json("bingo", result)


def main():
    convert_539()
    convert_lotto()
    convert_power()
    convert_bingo()
    print("done")


if __name__ == "__main__":
    main()