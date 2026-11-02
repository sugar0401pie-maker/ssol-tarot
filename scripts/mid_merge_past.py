# 3쪽 '두 장 중간 결과' 합 문장(나를 가로막아 온 것)을 과거형으로 바꾼다(owner 2026-11-02: "이거는 과거니까 기다렸어요, 불안해졌어요").
# 기획이 새 DB(JSON)를 주면 다시 돌린다 — 이미 과거형인 문장은 그대로라 여러 번 돌려도 같다.
#   python3 scripts/mid_merge_past.py data/mid_result_db.json          # 미리보기(바뀌는 문장·못 바꾼 문장)
#   python3 scripts/mid_merge_past.py data/mid_result_db.json --write  # 파일에 씀
# '지금·이제'가 든 문장은 지금 상태를 말하는 문장이라 바꾸지 않는다(과거형으로 바꾸면 어색해짐) — 목록으로 보여 줌.
import json, re, sys

END = {  # 문장 끝 낱말 → 과거형
    "있어요.": "있었어요.", "없어요.": "없었어요.", "상태예요.": "상태였어요.", "자리예요.": "자리였어요.", "제자리예요.": "제자리였어요.",
    "불안뿐이에요.": "불안뿐이었어요.", "돼요.": "됐어요.", "가요.": "갔어요.", "나요.": "났어요.", "해요.": "했어요.", "와요.": "왔어요.",
    "내요.": "냈어요.", "못해요.": "못했어요.", "않아요.": "않았어요.", "미뤄요.": "미뤘어요.", "커져요.": "커졌어요.", "늘어나요.": "늘어났어요.",
    "몰라요.": "몰랐어요.", "키워요.": "키웠어요.", "들어와요.": "들어왔어요.", "어려워져요.": "어려워졌어요.", "두려워져요.": "두려워졌어요.",
    "버거워요.": "버거웠어요.", "줄어들어요.": "줄어들었어요.", "기다려요.": "기다렸어요.", "불안해져요.": "불안해졌어요.",
    "맴돌아요.": "맴돌았어요.", "무서워져요.": "무서워졌어요.", "느껴요.": "느꼈어요.", "외로워요.": "외로웠어요.", "미뤄져요.": "미뤄졌어요.",
    "골라요.": "골랐어요.", "붙들어요.": "붙들었어요.", "밀려요.": "밀렸어요.", "부딪쳐요.": "부딪쳤어요.", "가득해요.": "가득했어요.",
    "흔들려요.": "흔들렸어요.", "조급해져요.": "조급해졌어요.", "짓눌러요.": "짓눌렀어요.", "흘러가요.": "흘러갔어요.", "만들어요.": "만들었어요.",
}
NOW = re.compile(r"지금|이제")
# '지금·이제'가 든 문장은 시점 말을 과거 이야기에 맞게 먼저 바꾼 뒤 과거형으로(앞에서부터 차례로, 처음 맞는 것만).
NOW_FIX = [("지금도 ", "그 뒤로도 "), ("지금은 ", ""), ("지금 가진 ", "가진 "), ("지금의 관계", "관계"), ("지금 자리", "그 자리"),
           ("지금 또 ", "또 "), ("지금 다시 ", "다시 "), ("지금의 걱정", "걱정"), ("이제는 ", "어느새 "), ("이제 ", "어느새 ")]
PAST = re.compile(r"(었|았|였|했|됐|졌|렸|났|왔|갔|웠|켰|쳤|랐|냈|꼈|뤘|렀|섰|겼|쳤)어요\.$")

def to_past(text):
    out, kept = [], []
    for s in re.split(r"(?<=[.?!])\s+", text.strip()):
        if NOW.search(s) and s.split()[-1] in END:
            for a, b in NOW_FIX:
                if a in s:
                    s = s.replace(a, b, 1)
                    break
        last = s.split()[-1] if s.split() else ""
        if NOW.search(s) or last not in END:
            if last not in END and not PAST.search(last):
                kept.append(s)
            elif NOW.search(s) and last in END:
                kept.append(s)
            out.append(s)
        else:
            out.append(s[: -len(last)] + END[last])
    return " ".join(out), kept

def main():
    path = sys.argv[1]
    d = json.load(open(path, encoding="utf8"))
    changed, kept = 0, []
    for k, v in d["merge"].items():
        nv, kk = to_past(v)
        if nv != v:
            changed += 1
            if "--write" not in sys.argv and changed <= 5:
                print(f"{k}\n  전: {v}\n  후: {nv}")
        d["merge"][k] = nv
        kept += [(k, x) for x in kk]
    print(f"합 문장 {len(d['merge'])}개 중 바뀜 {changed}개 · 그대로 둔 현재형 문장 {len(kept)}개")
    for k, x in kept:
        print(f"  [{k}] {x}")
    if "--write" in sys.argv:
        json.dump(d, open(path, "w", encoding="utf8"), ensure_ascii=False, indent=1)
        print("썼어요")

main()
