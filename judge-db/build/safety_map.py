# 쏘웰라 안전 신호(S1~S7) → 쏠 타로 crisis_level + 타로 전용 폭력·통제 신호(V1~V6). 실행: python3 safety_map.py <ob csv 폴더> <출력 폴더>
import csv, json, sys, re
D, O = sys.argv[1], sys.argv[2]
# 타로는 카드 진행을 멈추느냐(urgent) / 결과에 안내 박스(watch) 두 단계뿐
LEVEL = {"S1-a": "urgent", "S1-b": "urgent", "S1-c": "urgent", "S1-d": "urgent", "S1-e": "urgent",
         "S2-a": "watch", "S2-b": "urgent", "S2-c": "watch",
         "S3-a": "watch", "S3-b": "watch", "S3-c": "watch", "S3-d": "watch", "S3-e": "watch",
         "S4-a": "watch", "S4-b": "watch", "S4-c": "watch", "S4-d": "watch", "S5-a": "watch", "S5-b": "watch",
         "S6-a": "urgent", "S6-b": "urgent", "S6-c": "urgent", "S6-d": "watch",
         "S7-a": "urgent", "S7-b": "watch", "S7-c": "watch", "S7-d": "urgent"}
WHY = {"S2-b": "짐이라는 느낌은 간접 자살 신호로 자주 쓰여 타로에서는 카드를 멈춤(쏘웰라 🟠)",
       "S6-a": "현실 검증이 어려운 상태 — 타로 해석이 확신을 키울 수 있어 카드를 멈추고 전문기관 안내",
       "S6-b": "위와 같음", "S6-c": "위와 같음", "S7-a": "과다 복용 의심 — 즉시 119·응급 안내", "S7-d": "음주 운전·자해 생각 — 즉시 안내",
       "S4-a": "타로 사용층에서 드묾 — 카드는 진행하고 안내 박스", "S4-b": "위와 같음", "S4-d": "위와 같음"}
rows = []
for r in csv.DictReader(open(f"{D}/ob_safety_signals.csv", encoding="utf-8-sig")):
    rows.append(dict(code=r["signal_id"], group=r["grp"], signal=r["signal"], example=r["example"], ssol_level=r["level"],
                     tarot_level=LEVEL[r["signal_id"]], violence=False, why=WHY.get(r["signal_id"], "")))
V = [("V1", "신체 폭력", "때림·밀침·팔을 세게 잡음·멍·물건을 던짐·벽을 침", "남친이 화나면 벽을 쳐서 무서워요"),
     ("V2", "협박·위협", "헤어지면 해치겠다·알리겠다·죽어 버리겠다는 말로 붙잡음, 가만 안 두겠다", "헤어지자고 하면 죽어버리겠대요"),
     ("V3", "통제·감시", "휴대폰·카톡·비번 요구, 위치 공유 강요, 옷차림·만남 통제, 하루 종일 확인 전화", "카톡을 다 보여 달래요. 안 보여주면 숨기는 거래요"),
     ("V4", "스토킹", "이별·거절 뒤 집·회사 앞에서 기다림, 번호·계정을 바꿔도 연락, 몰래 집에 들어옴", "헤어지자고 하니까 집 앞에 매일 와요"),
     ("V5", "경제 통제", "월급·카드를 가져감, 생활비를 안 주고 영수증 검사, 명의 대출 강요", "월급을 남편이 다 관리하고 만 원 쓸 때도 허락받아요"),
     ("V6", "두려움 표현", "상대 기분을 살피며 무섭다, 화낼까 봐 늘 눈치 봄", "남친 기분 나쁘게 하면 큰일 나서 항상 눈치 봐요")]
for c, g, s, e in V:
    rows.append(dict(code=c, group="폭력·통제(타로 신설)", signal=s, example=e, ssol_level="(쏘웰라 없음)", tarot_level="none",
                     violence=True, why="violence=true → 다가가기 실천 빼고 1366·112 안내. 위험 신호가 함께 있으면 urgent"))
with open(f"{O}/safety_signals_tarot.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=1)
# 쏘웰라 위기 평가 문장 44개 → 타로 형식(키워드에 맞춰 고치지 않은 '처음 보는 세트')
out = []
for r in csv.DictReader(open(f"{D}/ob_eval_set.csv", encoding="utf-8-sig")):
    if r["kind"] != "safety":
        continue
    code = r["expected"].split(":")[1]
    out.append(dict(id=r["eval_id"], text=r["utterance"], crisis_level=LEVEL[code], violence=False, safety_tag=code, src="쏘웰라 E1 위기"))
with open(f"{O}/ssol_safety_heldout.jsonl", "w", encoding="utf-8") as f:
    for x in out:
        f.write(json.dumps(x, ensure_ascii=False) + "\n")
print(len(rows), len(out))
