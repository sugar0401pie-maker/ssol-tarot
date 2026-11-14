#!/usr/bin/env python3
"""문장 DB 검수표(JSON) → data/report_lines.json 반영 (2026-11-14, v2.3.17 직장·진로 추가분).

  python3 -I scripts/report_lines_from_review.py <검수표.json> [--write]

패키지 v2.3.16의 report_lines.json에 검수표 v2.3.17에서 늘어난 것을 넣는다:
- 1·2쪽 영역 문장: 검수표의 모든 줄 → scene[카드_up|rev][영역 변형][now|hold]  (v2.3.17: PATHFIND 88줄 추가)
- 영역 변형 PATHFIND(진로를 정하는 중 — PT-WHAT·PT-MAJOR·PT-TWO·PT-MEANING)
- 장면 머리말: 틀 기본 → cue.frame, 세부 → cue.sub, 장면(쏘웰라 장면 맥락) → cue.scene {id: {cue, subs}}
검수 칸: '뺌'이면 그 줄을 쓰지 않고(공통 문장으로), '고침'이면 '고친 문장'·'고친 머리말'을 쓴다. 비어 있으면 그대로.
다른 표(5쪽 머리·별칭·카드별 한 줄 등)는 패키지 report_lines.json 값을 그대로 둔다(검수표와 같음을 확인함).
--write 없이 돌리면 바뀌는 수만 보여 준다.
"""
import json
import sys

OUT = "data/report_lines.json"
POS = {"지나온 길(1쪽)": "now", "지금의 흐름(2쪽)": "hold"}


def reviewed(row, text_key, fixed_key):
    mark = str(row.get("검수") or "").strip()
    if mark == "뺌":
        return None
    if mark == "고침" and str(row.get(fixed_key) or "").strip():
        return str(row[fixed_key]).strip()
    return row[text_key]


def main():
    rv = json.load(open(sys.argv[1], encoding="utf-8"))
    write = "--write" in sys.argv
    rl = json.load(open(OUT, encoding="utf-8"))
    changed = {"scene": 0, "scene_removed": 0, "cue": 0}

    # 영역 변형 PATHFIND
    for r in rv["영역 변형"]:
        if r.get("변형") == "PATHFIND":
            subs = [x.strip() for x in str(r["들어가는 세부"]).split(",") if x.strip()]
            rl["area_variants"]["variants"]["PATHFIND"] = {"name": r["이름"], "subs": subs}
            n = " v2.3.17: 진로를 정하는 중인 세부 4개는 PATHFIND(새 문장 88개)로."
            if n not in rl["area_variants"]["note"]:
                rl["area_variants"]["note"] += n

    # 1·2쪽 영역 문장
    for r in rv["1·2쪽 영역 문장"]:
        if "카드" not in r:
            continue
        key = f'{r["카드"]}_{"up" if r["방향"] == "정" else "rev"}'
        v, pos = r["영역 변형"], POS[r["자리"]]
        line = reviewed(r, "새 셋째 문장", "고친 문장")
        cur = rl["scene"].setdefault(key, {}).setdefault(v, {})
        if line is None:
            if pos in cur:
                del cur[pos]
                changed["scene_removed"] += 1
        elif cur.get(pos) != line:
            cur[pos] = line
            changed["scene"] += 1

    # 장면 머리말
    cue = rl["cue"]
    cue.setdefault("scene", {})
    for r in rv["장면 머리말"]:
        kind = str(r.get("종류") or "")
        text = reviewed(r, "다음에 ___ (머리말)", "고친 머리말")
        if not kind or text is None:
            continue
        if kind == "틀 기본":
            tgt, k = cue["frame"], r["id"]
        elif kind.startswith("세부"):
            tgt, k = cue["sub"], r["id"]
        elif kind.startswith("장면"):
            subs = [x.strip() for x in str(r["이름"]).split(",") if x.strip()]
            val = {"cue": text, "subs": subs}
            if cue["scene"].get(r["id"]) != val:
                cue["scene"][r["id"]] = val
                changed["cue"] += 1
            continue
        else:
            continue
        if tgt.get(k) != text:
            tgt[k] = text
            changed["cue"] += 1
    n = " v2.3.17: scene(쏘웰라 장면 맥락 39개, 세부 묶음) → sub → frame 순."
    if n not in (cue.get("note") or ""):
        cue["note"] = (cue.get("note") or "") + n
    rl["version"] = "2.3.17"

    print(changed, "| 장면 머리말 장면", len(cue["scene"]), "· 세부", len(cue["sub"]), "· 틀", len(cue["frame"]))
    if not write:
        print("미리보기만 — --write로 씀")
        return
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rl, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("씀:", OUT)


if __name__ == "__main__":
    main()
