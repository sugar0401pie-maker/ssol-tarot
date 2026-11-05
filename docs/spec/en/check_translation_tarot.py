#!/usr/bin/env python3
"""SSOL Tarot House — English translation checker (v1.0, 2026-11-05).

Usage:
  python3 check_translation_tarot.py rows.json [out.json]
    rows.json : list of {key, kind, ko, en}
    out.json  : optional {key: {"en": ...}} — checks these English texts instead of rows' en
Prints a summary and writes check_report.json (key -> list of issues).
"""
import json, re, sys, collections

HANGUL = re.compile(r'[가-힣]')
TOKEN = re.compile(r'\{[^{}]+\}')
KO_PARTICLE_TOKEN = re.compile(r'\{(eul|[a-z0-9_]+:[^{}]+)\}')
BANNED = [r'\bsomehow\b', r'\ba certain energy\b', r'\bthe universe\b', r'\bvibes?\b', r'\bhold space\b',
          r'\blean into\b', r'\bsit with\b', r'\bjourney\b', r'\billuminat', r'\bembrace the light\b',
          r'\bmanifest', r'\bsoul\b', r'\bsacred\b', r'\bdivine\b', r'\bdestiny\b', r'\bfate\b',
          r'\bdefinitely\b', r'\bcertainly\b', r'\bguarantee', r'\bsurely\b', r'\balways will\b',
          r'\bnever will\b', r'\bis bound to\b', r'\banxious attachment\b', r'\bavoidant\b',
          r'\bdepress', r'\btoxic\b', r'\btrauma', r'\bnarcissis', r'\bcodependen', r'\bbad card\b',
          r'\bominous\b', r'\bprofessional counsel', r'\bSsol\b', r'\bgonna\b', r'\blow-?key\b']
CALQUE = [r"\bit'?s the picture of\b", r'\bit points to a time when\b', r'\bthis is a card that\b',
          r'\bthe energy of\b', r"\byou'?re someone who\b", r'\bthe worry on your mind\b',
          r"\bchase each other'?s tails\b", r'\bfolding your\b', r'\bchased by the urgency\b',
          r'\bstands for the energy\b']
HEDGE = re.compile(r'\b(may|might|perhaps|maybe|possibly|likely|could be)\b', re.I)
DUMMY = re.compile(r'(^|[.!?]\s+)(It is|It\'s a time|There is|There are|There\'s|This is a (card|time))\b')
SENT = re.compile(r'[.!?]+(?=\s|$)')
LOWER_FRAG_KEYS = re.compile(r'/frag/|/scores/|/reasons/')


def toks(s):
    return sorted(TOKEN.findall(s or ''))


def ko_tokens(s):
    out = []
    s = s or ''
    for mt in TOKEN.finditer(s):
        t = mt.group(0)
        if t == '{eul}':
            continue
        m = re.match(r'\{([a-z0-9_]+):[^{}]+\}', t)
        if m:
            base = '{%s}' % m.group(1)
            before = s[:mt.start()].rstrip('’\'" ')
            if before.endswith(base):  # e.g. ‘{c}’{c:이} — particle helper for the token just before
                continue
            out.append(base)
        else:
            out.append(t)
    return sorted(['{conclusion}' if t == '{결론}' else t for t in out])


def sentences(s):
    s = re.sub(r'\b(e\.g|i\.e|etc|vs|Mr|Ms|Dr|no)\.', 'X', s or '')
    s = re.sub(r'…', '.', s)
    return max(1, len(SENT.findall(s.strip())) or 1)


def ko_sentences(s):
    s = (s or '').replace('…', '.')
    return max(1, len(re.findall(r'[.!?](?=\s|$)', s.strip())) or 1)


def check(row, en):
    ko, kind, key = str(row.get('ko') or ''), row.get('kind', ''), row['key']
    en = en or ''
    issues = []
    if not en.strip() and ko.strip():
        return ['empty']
    if HANGUL.search(en) and kind != 'internal':
        issues.append('hangul')
    if ko_tokens(ko) != toks(en):
        issues.append('tokens %s vs %s' % (ko_tokens(ko), toks(en)))
    if ko.count('‘') != en.count('‘') and '‘' in ko:
        issues.append('quote‘ count')
    if en != en.strip() and ko == ko.strip():
        issues.append('spaces')
    if '**' in en and '**' not in ko:
        issues.append('bold added')
    if kind == 'internal':
        return issues
    low = en.lower()
    for b in BANNED:
        if re.search(b, en if b == r'\bSsol\b' else low):
            issues.append('banned:' + b.strip('\\b'))
    for c in CALQUE:
        if re.search(c, low):
            issues.append('calque:' + c.strip('\\b'))
    if kind not in ('user_voice',):
        if len(HEDGE.findall(en)) > 1:
            issues.append('hedge x%d' % len(HEDGE.findall(en)))
        if len(re.findall(r'\bhearts?\b', low)) > 1:
            issues.append('heart x%d' % len(re.findall(r'\bhearts?\b', low)))
        if len(re.findall(r'\bworr(y|ies|ied)\b', low)) > 1:
            issues.append('worry x%d' % len(re.findall(r'\bworr(y|ies|ied)\b', low)))
        if DUMMY.search(en):
            issues.append('dummy opener')
    if kind in ('reading', 'user_voice') and len(ko) > 25:
        ks, es = ko_sentences(ko), sentences(en)
        if abs(ks - es) > 1:
            issues.append('sentences %d→%d' % (ks, es))
        r = len(en) / max(1, len(ko))
        if r < 1.2 or r > 2.8:
            issues.append('length x%.1f' % r)
    if LOWER_FRAG_KEYS.search(key) and kind in ('template', 'reason'):
        if en[:1].isupper() and not en.startswith('‘'):
            issues.append('fragment capitalized')
        if en.rstrip().endswith('.'):
            issues.append('fragment ends with period')
    if re.match(r'^\{(now|hold|step|frag)\}', en):
        issues.append('starts with lowercase token')
    return issues


def main():
    rows = json.load(open(sys.argv[1]))
    out = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
    report, cnt = {}, collections.Counter()
    for r in rows:
        en = (out[r['key']]['en'] if out and r['key'] in out else r.get('en')) if out else r.get('en')
        if out and r['key'] not in out:
            continue
        iss = check(r, en)
        if iss:
            report[r['key']] = iss
            for i in iss:
                cnt[i.split(' ')[0].split(':')[0] if not i.startswith(('banned', 'calque')) else i] += 1
    json.dump(report, open('check_report.json', 'w'), ensure_ascii=False, indent=1)
    print('rows checked:', len(out) if out else len(rows), '| rows with issues:', len(report))
    for k, v in cnt.most_common(60):
        print('%5d  %s' % (v, k))


if __name__ == '__main__':
    main()
