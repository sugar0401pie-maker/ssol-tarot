"""Tiny checker for the EN safety keyword draft. Usage: python3 run_test.py
Same order as safety.js: exceptions removed -> threat_reported removed for urgent -> urgent > watch > none;
violence (+ threat_reported); fear only when no violence."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
KW = json.load(open(os.path.join(HERE, "safety_keywords_en.json")))["safety_keywords_en"]
CASES = json.load(open(os.path.join(HERE, "test_cases_en.json")))["cases"]
C = lambda xs: [re.compile(p, re.I) for p in xs]
EXC, THR, URG, WAT, VIO, FEA = (C(KW[k]) for k in ("exceptions", "threat_reported", "urgent", "watch", "violence", "fear"))

def norm(t):
    t = t.lower().replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    t = re.sub(r"\bwanna\b", "want to", t); t = re.sub(r"\bgonna\b", "going to", t)
    return re.sub(r"\s+", " ", t).strip()

def screen(text):
    t = norm(text)
    for r in EXC: t = r.sub(" ", t)
    tu = t
    for r in THR: tu = r.sub(" ", tu)
    u = [r.pattern for r in URG if r.search(tu)]
    w = [] if u else [r.pattern for r in WAT if r.search(t)]
    v = [r.pattern for r in VIO + THR if r.search(t)]
    f = [] if v else [r.pattern for r in FEA if r.search(t)]
    level = "urgent" if u else "watch" if w else "none"
    return level, bool(v), bool(f), u + w + v + f

def label(level, v, f):  # one label per case for scoring
    if level != "none": return level
    return "violence" if v else "fear" if f else "none"

ok, miss = 0, []
stats = {}
for c in CASES:
    lv, v, f, m = screen(c["text"])
    got = label(lv, v, f)
    s = stats.setdefault(c["expected"], [0, 0]); s[1] += 1
    if got == c["expected"]: ok += 1; s[0] += 1
    else: miss.append((c["id"], c["expected"], got, c["text"], m[:3]))
for x in miss: print("MISS", *x)
urgent_recall = stats["urgent"][0] / stats["urgent"][1]
none_as_urgent = sum(1 for c in CASES if c["expected"] == "none" and screen(c["text"])[0] == "urgent")
print("per level:", {k: f"{a}/{b}" for k, (a, b) in stats.items()})
print(f"RESULT accuracy {ok}/{len(CASES)} = {ok/len(CASES):.1%} | urgent recall {urgent_recall:.0%} | none->urgent {none_as_urgent}")
