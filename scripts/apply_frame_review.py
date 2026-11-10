#!/usr/bin/env python3
"""기획 검토 묶음(JSON) 반영 — 세부 고민 정의 고침 + 판별 DB 정답 고침(2026-11-10, v2.3.13 직장·취업 검토).

  python3 scripts/apply_frame_review.py <검토.json> [--write]

- '고친 정의': [세부 id, 칸(이름·정의·구분 단서·이웃과 다른 점), 전 값, 새 값] → data/worry_subtopics.json
- '정답 바꾼 줄': {id, text, 전 세부, 전 두 번째, 새 세부, 새 두 번째, 전 점수표, 새 점수표} → 판별 DB 새 판
"전 값"이 지금 파일과 다르면(누가 먼저 고쳤음) 멈추고 아무것도 쓰지 않는다. --write 없이 돌리면 미리보기만.
"""
import json
import sys

SRC_GOLD = "judge-db/data/frame_gold_v2.7.jsonl"
OUT_GOLD = "judge-db/data/frame_gold_v2.8.jsonl"
SUBS = "data/worry_subtopics.json"
FIELD = {"이름": "name", "정의": "definition", "구분 단서": "clue", "이웃과 다른 점": "vs_neighbors"}


def main():
    review = json.load(open(sys.argv[1], encoding="utf-8"))
    write = "--write" in sys.argv
    problems = []

    sub_doc = json.load(open(SUBS, encoding="utf-8"))
    subs = sub_doc["subs"]
    for sid, label, old, new in review["고친 정의"]:
        key = FIELD.get(label)
        if not key or sid not in subs:
            problems.append(f"정의: 알 수 없는 칸/세부 {sid} {label}")
            continue
        if subs[sid].get(key) != old:
            problems.append(f"정의: {sid}.{key} 지금 값이 검토의 '전 값'과 다름")
            continue
        subs[sid][key] = new

    rows = [json.loads(l) for l in open(SRC_GOLD, encoding="utf-8") if l.strip()]
    by_id = {r["id"]: r for r in rows}
    for c in review["정답 바꾼 줄"]:
        r = by_id.get(c["id"])
        if not r:
            problems.append(f"정답: 없는 id {c['id']}")
            continue
        if r["text"] != c["text"] or r.get("sub_id") != c["전 세부"] or r.get("sub2") != c["전 두 번째"]:
            problems.append(f"정답: {c['id']} 지금 값이 '전' 값과 다름")
            continue
        if c["새 세부"] not in subs or (c["새 두 번째"] and c["새 두 번째"] not in subs):
            problems.append(f"정답: {c['id']} 새 세부가 세부 목록에 없음")
            continue
        tables = r.get("tables") or []
        if not tables or tables[0] != c["전 점수표"]:
            problems.append(f"정답: {c['id']} 점수표 '전' 값이 다름({tables} vs {c['전 점수표']})")
            continue
        r["sub_id"], r["sub2"] = c["새 세부"], c["새 두 번째"]
        r["tables"] = [c["새 점수표"]] + [t for t in tables[1:] if t != c["새 점수표"]]

    print(f"정의 {len(review['고친 정의'])}개 · 정답 {len(review['정답 바꾼 줄'])}줄 · 문제 {len(problems)}개")
    for p in problems:
        print(" -", p)
    if problems:
        sys.exit("문제가 있어 쓰지 않음")
    if not write:
        print("미리보기만 — --write로 씀")
        return
    with open(SUBS, "w", encoding="utf-8") as f:
        json.dump(sub_doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(OUT_GOLD, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print("씀:", SUBS, OUT_GOLD)


if __name__ == "__main__":
    main()
