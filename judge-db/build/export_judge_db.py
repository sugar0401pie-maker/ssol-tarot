# -*- coding: utf-8 -*-
"""판별 DB → 검수용 엑셀(쏠타로_판별DB_v0.1.xlsx)
실행: python3 build/export_judge_db.py <08_판별DB 폴더> <ob_roots.csv> <출력 xlsx> [키워드 점검 결과 txt]
"""
import csv, json, sys, collections as C
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.formatting.rule import CellIsRule
from openpyxl.worksheet.datavalidation import DataValidation

D, ROOTS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
KWTXT = open(sys.argv[4], encoding="utf-8").read().strip().splitlines() if len(sys.argv) > 4 else []
jl = lambda f: [json.loads(l) for l in open(f, encoding="utf-8") if l.strip()]
worry = jl(f"{D}/data/worry_examples_v2.jsonl")
ssol = jl(f"{D}/data/ssol_need_examples.jsonl")
rmap = json.load(open(f"{D}/data/root_need_map.json", encoding="utf-8"))
sig = json.load(open(f"{D}/data/safety_signals_tarot.json", encoding="utf-8"))
res = json.load(open(f"{D}/data/love_qsub_research.json", encoding="utf-8"))
QS = {q["code"]: q["name"] for q in res["qsub"]}
roots = {r["root_id"]: r for r in csv.DictReader(open(ROOTS, encoding="utf-8-sig"))}

FONT = "Malgun Gothic"
NAVY, CREAM, INPUT = "012F53", "FEF3DE", "FFF4B8"
f_body, f_id = Font(name=FONT, size=10), Font(name=FONT, size=8, color="8A94A0")
f_head = Font(name=FONT, size=10, bold=True, color="FFFFFF")
f_title, f_h2 = Font(name=FONT, size=16, bold=True, color=NAVY), Font(name=FONT, size=12, bold=True, color=NAVY)
fill_head, fill_input = PatternFill("solid", fgColor=NAVY), PatternFill("solid", fgColor=INPUT)
thin = Side(style="thin", color="D9D2C3"); box = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap, center = Alignment(wrap_text=True, vertical="top"), Alignment(horizontal="center", vertical="top", wrap_text=True)
STAT = ["초안", "검수중", "수정요청", "확정", "삭제"]
N = {"REST": "쉼", "START": "시작", "CHOOSE": "선택", "CONNECT": "연결", "BOUNDARY": "경계", "LETGO": "놓아주기", None: ""}
DN = {"CAR": "직업", "DIR": "진로·나", "LOV": "연애", "FAM": "가족", "SOC": "교우", "LIF": "재정·생활", None: ""}
EN = {"ANX": "불안", "TIR": "지침", "LON": "외로움", "HUR": "서운함·화", "CON": "막막함", "SHA": "자책", "GRI": "슬픔·상실", "HOP": "설렘·기대"}
QN = {"worry": "고민 서술", "other_mind": "상대 마음", "timing": "시기", "yesno": "할까요·될까요", "fortune": "운세"}

wb = Workbook(); g = wb.active; g.title = "읽어주세요"

def sheet(name, head, widths, rows, input_cols=(), status_col=None, freeze="C2"):
    ws = wb.create_sheet(name)
    for i, (h, w) in enumerate(zip(head, widths), 1):
        c = ws.cell(row=1, column=i, value=h); c.font, c.fill, c.alignment, c.border = f_head, fill_head, center, box
        ws.column_dimensions[c.column_letter].width = w
    for r, row in enumerate(rows, 2):
        for i, v in enumerate(row, 1):
            c = ws.cell(row=r, column=i, value=v); c.font = f_id if i == 1 else f_body; c.alignment = wrap; c.border = box
            if i in input_cols: c.fill = fill_input
    n = len(rows) + 1
    if status_col:
        col = ws.cell(row=1, column=status_col).column_letter
        dv = DataValidation(type="list", formula1='"' + ",".join(STAT) + '"', allow_blank=True); ws.add_data_validation(dv); dv.add(f"{col}2:{col}{n}")
        ws.conditional_formatting.add(f"{col}2:{col}{n}", CellIsRule(operator="equal", formula=['"확정"'], fill=PatternFill("solid", fgColor="CFE8C9")))
        ws.conditional_formatting.add(f"{col}2:{col}{n}", CellIsRule(operator="equal", formula=['"수정요청"'], fill=PatternFill("solid", fgColor="F8D2B0")))
    ws.freeze_panes = freeze; ws.auto_filter.ref = f"A1:{ws.cell(row=1, column=len(head)).column_letter}{n}"
    return ws

# 1 뿌리 → 필요
cnt = C.Counter(x["root"] for x in ssol)
rows = []
for rid, r in roots.items():
    m = rmap["map"].get(rid)
    rows.append([rid, r["name"], r["nature_primary"], N[m["need"]] if m else "(쓰지 않음)", N[m["alt_need"]] if m else "",
                 DN[m["domain_hint"]] if m else "", {"circumstance": "상황에 달림", "other": "남에게 달림"}.get(m["locus_hint"], "") if m else "",
                 m["why"] if m else rmap["skip"].get(rid, ""), cnt.get(rid, 0), "초안", None, None])
sheet("뿌리→필요", ["뿌리 ID", "쏘웰라 뿌리", "성격", "타로 필요", "두 번째 후보", "영역 단서", "locus 단서", "이유", "변환된 문장 수", "상태", "수정안(필요)", "메모"],
      [11, 40, 7, 10, 10, 9, 10, 46, 9, 9, 12, 26], rows, input_cols=(10, 11, 12), status_col=10)

# 2 새 고민 글
rows = []
for x in worry:
    rows.append([x["id"], x["text"], DN[x["domain"]], ", ".join(EN[e] for e in x["emotions"]), N[x["need"]], N[x.get("alt_need")],
                 QN[x["qtype"]], (x.get("qsub") or "") + (" " + QS[x["qsub"]] if x.get("qsub") else ""), x["style"], x["duration"], x["locus"], x["urgency"], x["crisis_level"], "예" if x["violence"] else "",
                 "예" if x["off_topic"] else "", x.get("safety_tag", ""), x["confidence"], "★" if x["fewshot"] else "", x.get("note", ""), "초안", None, None])
sheet("새 고민 글", ["ID", "고민 글", "영역", "감정", "필요", "두 번째 후보", "질문 형식", "연애 세부 유형", "말투", "기간", "누구에게 달림", "마감", "위기", "폭력", "장난·잡담", "안전 태그", "확신", "프롬프트 예시", "정답 이유", "상태", "고칠 정답", "메모"],
      [8, 54, 8, 14, 8, 8, 10, 22, 7, 8, 10, 8, 8, 6, 6, 14, 6, 6, 40, 9, 16, 24], rows, input_cols=(20, 21, 22), status_col=20)

# 2-1 연애 질문 세부 유형(v2.11)
cntq = C.Counter(x.get("qsub") for x in worry)
rows = [[q["code"], QN[q["qtype"]], q["name"], N[q["need"]], N[q["alt_need"]], q["need_rule"], q["locus"], ", ".join(EN[e] for e in q["emotions"]),
         ", ".join(q["cues"]), " / ".join(q["expressions"][:8]), q["reframe"], q["caution"], len(q["sources"]), cntq.get(q["code"], 0), "초안", None] for q in res["qsub"]]
sheet("연애 질문 유형", ["코드", "질문 형식", "세부 유형", "필요(기본)", "두 번째 후보", "필요 고르는 법", "누구에게 달림", "흔한 감정", "단서·은어", "조사에서 모은 일상 표현", "결과 AI 되묻기 방향({name}=닉네임)", "주의", "출처 기사 수", "예시 문장 수", "상태", "메모"],
      [11, 9, 22, 8, 8, 40, 9, 12, 30, 50, 50, 28, 7, 7, 9, 24], rows, input_cols=(15, 16), status_col=15)
rows = [[s_["term"], s_["meaning"], s_["links_to"]] for s_ in res["slang"]]
sheet("연애 은어", ["은어", "뜻", "이어지는 유형·상황"], [24, 60, 44], rows, freeze="B2")
rows = [[a["outlet"], "한국어" if a["lang"] == "ko" else "영어", a["title"], a.get("date", ""), ", ".join(QN.get(q, q) for q in a["qtypes"]), ", ".join(a["situations"]), a["core_question"], a["url"]] for a in res["articles"]]
sheet("조사 자료", ["매체", "언어", "기사 제목", "날짜", "질문 형식", "세부 상황", "대표 질문(짧게 바꿔 씀)", "URL"], [22, 7, 48, 11, 16, 30, 26, 50], rows, freeze="C2")

# 3 쏘웰라 필요 예시
rows = [[x["id"], x["text"], N[x["need"]], N[x["alt_need"]], DN[x["domain"]], x["domain_source"], x["root"], roots[x["root"]]["name"], x["tier"], x["src"]] for x in ssol]
sheet("쏘웰라 필요 예시", ["ID", "문장", "필요", "두 번째 후보", "영역", "영역 근거", "뿌리", "뿌리 이름", "등급", "출처"], [10, 56, 8, 9, 8, 9, 10, 36, 6, 16], rows)

# 4 안전 신호
rows = [[s["code"], s["group"], s["signal"], s["example"], s["ssol_level"], s["tarot_level"] if not s["violence"] else "violence=true", s["why"], "초안", None] for s in sig]
sheet("안전 신호", ["코드", "묶음", "신호", "예시", "쏘웰라 단계", "타로 처리", "이유", "상태", "메모"], [7, 16, 40, 40, 14, 14, 44, 9, 26], rows, input_cols=(8, 9), status_col=8, freeze="B2")

# 읽어주세요
g.column_dimensions["A"].width = 18; g.column_dimensions["B"].width = 100
g["A1"] = "쏠 타로 하우스 — 고민 판별 DB v0.2 (2026-10-18 · 검수 전)"; g["A1"].font = f_title
info = [
    ("목적", "고민 분류 AI(프롬프트 A)가 영역·감정·필요·질문 형식·안전을 고를 때 참고·평가하는 자연어 문장 모음"),
    ("새 고민 글", f"{len(worry)}개(연애 세부 유형 표시 {sum(1 for x in worry if x.get('qsub'))}개) — 연애 {sum(x['domain']=='LOV' for x in worry)}개 중심. 타로식 질문(상대 마음·시기·할까요·운세) {sum(x['qtype']!='worry' for x in worry)}개, 위기·폭력·오탐 함정 포함. ★는 프롬프트 예시(평가에서 뺌)"),
    ("쏘웰라 필요 예시", f"{len(ssol)}개 — 쏘웰라 해석 DB v1.5 문장을 '뿌리→필요' 연결표로 바꿈. 등급 A=평가 정답 문장, B=의미 사전 예시, C=해석 트리의 기우는 말(대화체라 짧고 맥락 의존적)"),
    ("연애 질문 유형", f"(v2.11) 국내외 매거진·연애 코치·타로 질문 자료 {len(res['articles'])}건({len({a['outlet'] for a in res['articles']})}곳)을 분석해 연애 질문을 세부 유형 {len(res['qsub'])}개로 나눔. 유형마다 단서·은어·일상 표현·필요 고르는 법·결과 AI 되묻기 방향. 은어 {len(res['slang'])}개, 조사 자료 목록 포함"),
    ("뿌리→필요", f"쏘웰라 뿌리 {len(roots)}개 → 타로 필요 6가지. {len(rmap['map'])}개 연결, {len(rmap['skip'])}개는 자원·취향이라 뺌. 연결을 고치면 build/root_need.py → convert_ssol.py로 다시 만듦"),
    ("안전 신호", "쏘웰라 S1~S7을 타로 두 단계(urgent=카드 멈춤 / watch=안내 박스)로 맞추고, 타로 전용 폭력·통제 V1~V6을 새로 둠"),
    ("검수하는 법", "노란 칸만 고치면 됩니다. 정답이 틀렸으면 '고칠 정답'에 예: 필요=경계, 위기=watch 처럼 적고 상태를 '수정요청'으로. 다 맞으면 '확정'"),
    ("주의", "새 고민 글은 Claude가 쓴 합성 문장입니다. 실제 사용자 글로 따로 재야 합니다(익명 처리 후). 정답 라벨도 상담사 확인 전 초안입니다"),
]
for i, (a, b) in enumerate(info, 3):
    g.cell(row=i, column=1, value=a).font = f_h2; c = g.cell(row=i, column=2, value=b); c.font = f_body; c.alignment = wrap
r = len(info) + 4
g.cell(row=r, column=1, value="키워드 안전 확인").font = f_h2
for j, line in enumerate(KWTXT, 1):
    c = g.cell(row=r + j, column=2, value=line); c.font = f_body
r += len(KWTXT) + 2
g.cell(row=r, column=1, value="분포").font = f_h2
for j, (k, v) in enumerate([("영역", C.Counter(DN[x["domain"]] for x in worry)), ("필요", C.Counter(N[x["need"]] for x in worry)),
                            ("질문 형식", C.Counter(QN[x["qtype"]] for x in worry)), ("감정", C.Counter(EN[e] for x in worry for e in x["emotions"])),
                            ("말투", C.Counter(x["style"] for x in worry)), ("위기·폭력", C.Counter(("위험" if x["crisis_level"] == "urgent" else "주의" if x["crisis_level"] == "watch" else "폭력" if x["violence"] else "없음") for x in worry))], 1):
    g.cell(row=r + j, column=1, value=k).font = f_body
    g.cell(row=r + j, column=2, value=" · ".join(f"{a} {b}" for a, b in v.most_common())).font = f_body
wb.save(OUT)
print("저장:", OUT, {ws.title: ws.max_row - 1 for ws in wb.worksheets[1:]})
