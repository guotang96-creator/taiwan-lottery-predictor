import json
import os
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 先用穩定的本地預設資料
DEFAULT_DATA = {
    "539": [
        {"issue": "539001", "date": "2026-03-17", "numbers": [8, 10, 18, 20, 34]},
        {"issue": "539002", "date": "2026-03-16", "numbers": [7, 11, 17, 29, 33]},
        {"issue": "539003", "date": "2026-03-15", "numbers": [6, 12, 18, 21, 35]},
        {"issue": "539004", "date": "2026-03-14", "numbers": [5, 10, 19, 24, 34]},
        {"issue": "539005", "date": "2026-03-13", "numbers": [8, 14, 20, 23, 31]}
    ],
    "lotto": [
        {"issue": "L001", "date": "2026-03-17", "numbers": [3, 8, 19, 25, 33, 41]},
        {"issue": "L002", "date": "2026-03-14", "numbers": [5, 11, 17, 24, 38, 49]},
        {"issue": "L003", "date": "2026-03-10", "numbers": [2, 7, 15, 21, 34, 42]},
        {"issue": "L004", "date": "2026-03-07", "numbers": [6, 12, 18, 27, 31, 44]},
        {"issue": "L005", "date": "2026-03-03", "numbers": [1, 9, 16, 22, 35, 40]}
    ],
    "power": [
        {"issue": "P001", "date": "2026-03-17", "numbers": [4, 9, 15, 25, 27, 31], "second": 8},
        {"issue": "P002", "date": "2026-03-13", "numbers": [3, 8, 14, 19, 26, 30], "second": 2},
        {"issue": "P003", "date": "2026-03-10", "numbers": [5, 10, 16, 22, 28, 34], "second": 5},
        {"issue": "P004", "date": "2026-03-06", "numbers": [1, 7, 13, 20, 29, 35], "second": 1},
        {"issue": "P005", "date": "2026-03-03", "numbers": [2, 11, 17, 24, 31, 37], "second": 6}
    ],
    "bingo": [
        {"issue": "B001", "date": "2026-03-17", "numbers": [1,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46,49,52,55,58]},
        {"issue": "B002", "date": "2026-03-16", "numbers": [2,5,8,11,14,17,20,23,26,29,32,35,38,41,44,47,50,53,56,59]},
        {"issue": "B003", "date": "2026-03-15", "numbers": [3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54,57,60]},
        {"issue": "B004", "date": "2026-03-14", "numbers": [5,6,15,18,22,24,27,31,33,36,40,41,44,45,50,61,62,70,71,80]},
        {"issue": "B005", "date": "2026-03-13", "numbers": [1,3,8,9,17,21,26,28,30,34,35,39,43,47,52,64,65,72,73,79]}
    ]
}

def write_json(name, rows):
    path = DATA_DIR / f"{name}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"updated {path}")

def main():
    for name, rows in DEFAULT_DATA.items():
        write_json(name, rows)

if __name__ == "__main__":
    main()