# 판별 DB 엑셀의 '고민 틀 정답(T6)' 시트 → judge-db/data/frame_gold_v1.jsonl (서버가 고민 틀 예시 5개를 고를 때 쓰는 파일).
# owner 결정(2026-10-22): 판별 DB는 엑셀로 검사·수정한다 → 엑셀을 고친 뒤 이 도구로 반영한다.
#
#   python3 scripts/judge_db_frame_gold.py judge-db/쏠타로_판별DB_v0.4.xlsx            # 미리보기: 바뀌는 줄·경고만 보여 줌
#   python3 scripts/judge_db_frame_gold.py judge-db/쏠타로_판별DB_v0.4.xlsx --write    # 파일에 씀
#
# 칸 대응(패키지 jsonl 모양 그대로): ID→id · 세트→set · 고민 글→text · 영역→domain · 연애 세부 유형→qsub ·
#   정답 표 + 2순위로 인정하는 표→tables(표 이름은 한글 → 코드, '방향 계산 안 함'→null) · 줄 세우기('+/−'→axis, '추천 순위'→rank, 방향 없음→null) ·
#   선택지('A → B → …')→ranked · 정답 메모→note · CSO 검수(●)→cso_reviewed
# 표 이름·줄 세우기에 모르는 값이 있으면 쓰지 않고 멈춘다(오타가 그대로 서비스에 들어가지 않게).
import json, sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "judge-db/data/frame_gold_v1.jsonl"
SHEET = "고민 틀 정답(T6)"
TABLE = {"다가가기": "approach", "재회": "reunion", "진전": "progress", "지속": "continue", "새 인연": "newlove",
         "이직·퇴사": "job", "시작·실행": "start", "이사·독립": "move", "표현": "express", "경계": "boundary", "방향 계산 안 함": None}
MODE = {"+/−": "axis", "+/-": "axis", "추천 순위": "rank"}
COLS = ["ID", "세트", "고민 글", "영역", "연애 세부 유형", "정답 표", "2순위로 인정하는 표", "줄 세우기", "선택지(+ 쪽 → − 쪽 / 추천 순위)", "정답 메모", "CSO 검수"]


def text(v) -> str:
    return "" if v is None else str(v).strip()


def convert(xlsx: Path) -> tuple[list[dict], list[str]]:
    ws = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    head = [text(h) for h in rows[0]]
    missing = [c for c in COLS if c not in head]
    if missing:
        sys.exit(f"'{SHEET}' 시트에 칸이 없어요: {missing}")
    at = {c: head.index(c) for c in COLS}
    out, errs, seen = [], [], set()
    for n, r in enumerate(rows[1:], start=2):
        g = lambda c: r[at[c]] if at[c] < len(r) else None
        rid = text(g("ID"))
        if not rid:
            continue
        if rid in seen:
            errs.append(f"{n}줄 {rid}: ID가 겹쳐요")
        seen.add(rid)
        tables = []
        for name in [text(g("정답 표"))] + [x.strip() for x in text(g("2순위로 인정하는 표")).split(",") if x.strip()]:
            if name not in TABLE:
                errs.append(f"{n}줄 {rid}: 모르는 표 이름 '{name}'")
                continue
            tables.append(TABLE[name])
        first = tables[0] if tables else None
        m = text(g("줄 세우기"))
        if first is None:
            mode = None
        elif m in MODE:
            mode = MODE[m]
        else:
            errs.append(f"{n}줄 {rid}: 줄 세우기 '{m}'를 모르겠어요('+/−' 또는 '추천 순위')")
            mode = None
        ranked = [x.strip() for x in text(g("선택지(+ 쪽 → − 쪽 / 추천 순위)")).split("→") if x.strip()]
        if first is not None and len(ranked) < 2:
            errs.append(f"{n}줄 {rid}: 표가 있는데 선택지가 2개 미만이에요")
        if first is None and ranked:
            errs.append(f"{n}줄 {rid}: '방향 계산 안 함'인데 선택지가 있어요")
        out.append({
            "id": rid, "set": text(g("세트")), "text": text(g("고민 글")),
            "domain": text(g("영역")) or None, "qsub": text(g("연애 세부 유형")) or None,
            "tables": tables, "mode": mode, "ranked": ranked, "note": text(g("정답 메모")),
            "cso_reviewed": text(g("CSO 검수")) == "●",
        })
        if not out[-1]["text"]:
            errs.append(f"{n}줄 {rid}: 고민 글이 비어 있어요")
    return out, errs


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit("사용법: python3 scripts/judge_db_frame_gold.py <판별DB 엑셀> [--write]")
    rows, errs = convert(Path(args[0]))
    old = {}
    if OUT.exists():
        old = {o["id"]: o for o in (json.loads(l) for l in OUT.read_text(encoding="utf-8").splitlines() if l.strip())}
    new = {o["id"]: o for o in rows}
    changed = [k for k in new if k in old and new[k] != old[k]]
    added = [k for k in new if k not in old]
    removed = [k for k in old if k not in new]
    print(f"엑셀 {len(rows)}줄 · 바뀜 {len(changed)} · 새로 {len(added)} · 빠짐 {len(removed)} · 경고 {len(errs)}")
    for k in changed[:30]:
        diff = {f: (old[k].get(f), new[k][f]) for f in new[k] if old[k].get(f) != new[k][f]}
        print(f"  바뀜 {k}: {json.dumps(diff, ensure_ascii=False)}")
    for k in added[:30]:
        print(f"  새로 {k}")
    for k in removed[:30]:
        print(f"  빠짐 {k}")
    for e in errs:
        print(f"  경고 {e}")
    if "--write" in sys.argv:
        if errs:
            sys.exit("경고가 있어서 쓰지 않았어요. 엑셀을 고친 뒤 다시 실행해 주세요.")
        OUT.write_text("".join(json.dumps(o, ensure_ascii=False) + "\n" for o in rows), encoding="utf-8")
        print(f"{OUT.relative_to(ROOT)}에 썼어요")


main()
