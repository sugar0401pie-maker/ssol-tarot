# 쏘웰라 문장 → 쏠 타로 필요 예시(need 라벨). 실행: python3 convert_ssol.py <ob csv 폴더> <출력 jsonl>
import csv, json, re, sys, collections as C
from root_need import MAP
D = sys.argv[1]
R = lambda f: list(csv.DictReader(open(f"{D}/{f}", encoding="utf-8-sig")))
DOM = {"LOV": r"연애|남친|여친|남자\s?친구|여자\s?친구|애인|연인|썸|헤어|이별|결혼|데이트|고백",
       "CAR": r"회사|상사|팀장|직장|업무|야근|출근|퇴근|동료|이직|퇴사|회의|프로젝트|월요일",
       "FAM": r"엄마|아빠|부모|가족|시댁|처가|남편|아내|아이|애들|육아|형제|동생|언니|누나|오빠",
       "SOC": r"친구|모임|단톡|동호회|무리|동기|이웃|사람들",
       "DIR": r"진로|취업|시험|공부|자격증|전공|자존감|나다움|꿈",
       "LIF": r"돈|월급|비용|저축|대출|이사|월세|생활비|잠이|수면|운동|헬스|지출"}
claim_root = C.defaultdict(list)
for r in R("ob_claim_roots.csv"):
    if r["link"] == "support":  # conditional(확인 뒤에만)·goal(자원 바람)은 쓰지 않음
        claim_root[r["claim_id"]].append(r["root_id"])
rows, seen = [], set()
def add(text, root, src, label_kind):
    t = (text or "").strip().strip('“”"')
    if len(t) < 6 or t in seen or root not in MAP:
        return
    need, alt, dh, lh, why = MAP[root]
    hits = [d for d, p in DOM.items() if re.search(p, t)]
    dom, dsrc = (hits[0], "단어") if len(hits) == 1 else ((dh, "뿌리") if dh and not hits else (None, "여러 단서" if hits else "없음"))
    seen.add(t)
    rows.append(dict(id=f"SW-{len(rows)+1:05d}", text=t, need=need, alt_need=alt, domain=dom, domain_source=dsrc,
                     locus_hint=lh, root=root, src=src, label_kind=label_kind,
                     tier="A" if src.startswith("eval") else "B" if src.startswith("claim") else "C"))
for r in R("ob_eval_set.csv"):
    if r["kind"] in ("positive", "confusable"):
        add(r["utterance"], r["expected"], "eval_" + r["kind"], "정답(평가 문장)")
for r in R("ob_claims.csv"):
    roots = claim_root.get(r["claim_id"], [])
    if r["claim_id"].startswith("R-"):
        roots = [r["claim_id"][2:]]
    needs = {MAP[x][0] for x in roots if x in MAP}
    if len(needs) != 1:
        continue
    root = next(x for x in roots if x in MAP)
    for k in ("examples_json", "lean_json"):
        for x in json.loads(r[k] or "[]"):
            add(x, root, "claim_" + k.split("_")[0], "뿌리 연결(claim)")
for f in ("ob_submotives.csv", "ob_leaves.csv"):
    for r in R(f):
        add(r["lean_utterance"], r["root_id"], f[3:-4] + "_lean", "뿌리 연결(트리)")
with open(sys.argv[2], "w", encoding="utf-8") as o:
    for x in rows:
        o.write(json.dumps(x, ensure_ascii=False) + "\n")
print(len(rows), C.Counter(x["need"] for x in rows), C.Counter(x["domain"] for x in rows), C.Counter(x["src"] for x in rows), sep="\n")
