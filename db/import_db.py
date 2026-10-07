# -*- coding: utf-8 -*-
"""검수 끝난 엑셀 → tarot_data.json 반영

실행:
  python3 import_db.py 쏠타로_문장DB.xlsx ../02_데이터/tarot_data.json            # 수정안 있으면 수정안, 없으면 현재 문장
  python3 import_db.py 쏠타로_문장DB.xlsx ../02_데이터/tarot_data.json --only-confirmed   # 상태 '확정'인 행만 반영
  --dry-run 을 붙이면 파일을 바꾸지 않고 보고서만 만듭니다.

결과: tarot_data.json 갱신 + import_report.md(바뀐 문장 · 경고 목록)
※ 엑셀이 문장의 원본이 됩니다. 반영 후에는 build/build_data.py를 다시 돌리지 마세요(초안으로 덮어씀).
"""
import json, sys
from datetime import date
from openpyxl import load_workbook
from db_schema import SHEETS, check_text, set_path

args = [a for a in sys.argv[1:] if not a.startswith("--")]
XLSX, JSON = args[0], args[1]
ONLY_CONFIRMED = "--only-confirmed" in sys.argv
DRY = "--dry-run" in sys.argv

d = json.load(open(JSON, encoding="utf-8"))
wb = load_workbook(XLSX)  # 문자열 칸만 읽으므로 수식 계산 결과는 필요 없음

# 현재 JSON 값 (엑셀 '현재 문장'과 비교해 그 사이 JSON이 바뀌었는지 확인)
current = {}
for name, *_ , fn, _stage in SHEETS:
    for rid, _l, _i, text in fn(d):
        current[rid] = text

changed, warnings, skipped, deleted, stale, blocked = [], [], 0, [], [], []
seen = set()
for name, *_rest in SHEETS:
    if name not in wb.sheetnames:
        warnings.append((name, "-", "시트가 없음 — 건너뜀")); continue
    ws = wb[name]
    for row in ws.iter_rows(min_row=2, values_only=True):
        rid, label, item, orig, status, fix = (row + (None,) * 6)[:6]
        if not rid:
            continue
        rid, status = str(rid).strip(), (status or "초안").strip()
        if rid in seen:
            warnings.append((name, rid, "ID 중복")); continue
        seen.add(rid)
        if rid not in current:
            warnings.append((name, rid, "데이터에 없는 ID — ID 칸을 고쳤는지 확인")); continue
        if status == "삭제":
            deleted.append((name, rid, label, item)); continue
        if ONLY_CONFIRMED and status != "확정":
            skipped += 1; continue
        orig = "" if orig is None else str(orig)
        if orig != current[rid]:
            stale.append((name, rid))
        final = str(fix).strip() if fix is not None and str(fix).strip() else orig
        ws_ = check_text(final, current[rid], rid, str(item or ""))
        block = [w for w in ws_ if w.startswith("금지 표현") or w.startswith("자리표시자")]
        for w in ws_:
            warnings.append((name, rid, w + (" → 반영 안 함" if w in block else "")))
        if block:
            blocked.append(rid); continue
        if final != current[rid]:
            changed.append((name, rid, label, item, current[rid], final))
            set_path(d, rid, final)

# 파생 필드 다시 맞추기: about = about_when + about_origin
for c in d["cards"]:
    c["about"] = f"{c['about_when']} {c['about_origin']}".strip()

missing = sorted(set(current) - seen)
d["db_import"] = dict(date=date.today().isoformat(), source=XLSX.split("/")[-1], only_confirmed=ONLY_CONFIRMED,
                      changed=len(changed))

L = [f"# 문장 DB 반영 보고서 ({date.today().isoformat()})", "",
     f"- 엑셀: `{XLSX.split('/')[-1]}` → `{JSON.split('/')[-1]}`{' (미리보기, 파일 변경 없음)' if DRY else ''}",
     f"- 방식: {'상태 확정만 반영' if ONLY_CONFIRMED else '수정안 있으면 수정안, 없으면 현재 문장'}",
     f"- 바뀐 문장 {len(changed)}개 · 확정 아니라 건너뜀 {skipped}개 · 삭제 요청 {len(deleted)}개 · 규칙 위반으로 반영 안 함 {len(blocked)}개 · 경고 {len(warnings)}개 · 엑셀에 없는 ID {len(missing)}개", ""]
if warnings:
    L += ["## 경고 ('반영 안 함' 표시가 없는 줄은 반영됨)", "", "| 시트 | ID | 내용 |", "|---|---|---|"] + [f"| {a} | `{b}` | {c} |" for a, b, c in warnings] + [""]
if stale:
    L += ["## 엑셀을 만든 뒤 JSON이 바뀐 문장 (엑셀 값으로 덮어씀)", ""] + [f"- {a} `{b}`" for a, b in stale] + [""]
if deleted:
    L += ["## 삭제 요청 (자동 반영 안 함 — 개발에서 구조 함께 수정)", ""] + [f"- {a} `{b}` {c} / {e}" for a, b, c, e in deleted] + [""]
if missing:
    L += ["## 엑셀에서 빠진 ID (JSON 값 유지)", ""] + [f"- `{m}`" for m in missing] + [""]
if changed:
    L += ["## 바뀐 문장", ""]
    for name, rid, label, item, old, new in changed:
        L += [f"### {name} · {label} · {item}", f"`{rid}`", "", f"- 전: {old}", f"- 후: {new}", ""]
open("import_report.md", "w", encoding="utf-8").write("\n".join(L))

if not DRY:
    json.dump(d, open(JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"바뀐 문장 {len(changed)} · 반영 안 함 {len(blocked)} · 건너뜀 {skipped} · 삭제 요청 {len(deleted)} · 경고 {len(warnings)} · 빠진 ID {len(missing)} → import_report.md")
