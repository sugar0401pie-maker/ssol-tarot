# 조사 결과(ko1·ko2·en1·en2) → 세부 유형(qsub)에 일상 표현·출처 붙이기. 실행: python3 merge_research.py <mag 폴더> <출력 json>
import json, sys, collections as C
from love_qsub import Q
M = sys.argv[1]
A, S, SL = [], [], []
for f in ["ko1", "ko2", "en1", "en2"]:
    d = json.load(open(f"{M}/{f}.json", encoding="utf-8"))
    A += d["articles"]; S += [dict(s, _f=f) for s in d["situations"]]; SL += d.get("slang", [])
out = {q["code"]: dict(q, expressions=[], sources=[]) for q in Q}
unmapped = []
for s in S:
    hit = [q for q in Q if q["qtype"] == s["qtype"] and any(r in s["situation"] for r in q["research"])]
    if not hit:
        unmapped.append((s["qtype"], s["situation"])); continue
    for q in hit[:2]:
        o = out[q["code"]]
        for e in s["expressions_ko"]:
            if e not in o["expressions"]:
                o["expressions"].append(e)
        for t in s.get("source_titles", []):
            if t not in o["sources"]:
                o["sources"].append(t)
art = {a["title"]: a for a in A}
for o in out.values():
    o["sources"] = [dict(title=t, outlet=art[t]["outlet"], url=art[t]["url"], lang=art[t]["lang"]) for t in o["sources"] if t in art]
slang, seen = [], set()
for s in SL:
    k = s["term"].split("(")[0].strip()
    if k not in seen:
        seen.add(k); slang.append(dict(term=s["term"], meaning=s.get("meaning", ""), links_to=s.get("links_to", "")))
json.dump(dict(qsub=list(out.values()), slang=slang, articles=A), open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("unmapped", unmapped)
print({k: (len(v["expressions"]), len(v["sources"])) for k, v in out.items()})
print("articles", len(A), "outlets", len({a["outlet"] for a in A}), C.Counter(a["lang"] for a in A), "slang", len(slang))
