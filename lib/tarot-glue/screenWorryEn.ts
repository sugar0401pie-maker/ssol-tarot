// 영문판 고민 원문의 서버 키워드 확인. 영어 사전(data/en/tarot_data.json safety_keywords)은 한국어와 달리
// 정규식 문자열이고 제외(exceptions)·남이 한 협박(threat_reported) 목록이 따로 있다 — 사전 _note의 순서를 그대로 따른다.
//   정리(소문자·곧은 따옴표·공백 하나·wanna/gonna) → 1) 제외 표현 지우기 → 2) urgent는 남이 한 협박을 지우고 검사
//   → 3) urgent → watch → none, violence(+ threat_reported), fear는 violence가 없을 때만.
// 결과 모양은 한국어 screenText와 같다(mergeSafety에 그대로 넘김). 영어 사전은 전문가 검수 전 초안(데이터 _note).
import en from "../../data/en/tarot_data.json" with { type: "json" };

type Kw = { urgent?: string[]; watch?: string[]; violence?: string[]; fear?: string[]; exceptions?: string[]; threat_reported?: string[] };

export function normEn(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/\bwanna\b/g, "want to")
    .replace(/\bgonna\b/g, "going to")
    .replace(/\s+/g, " ")
    .trim();
}

const compile = (list: string[] | undefined) => (list || []).filter(Boolean).map((s) => new RegExp(s, "gi"));

export function screenTextEn(text: string, kw: Kw = en.safety_keywords as Kw) {
  const L = { u: compile(kw.urgent), w: compile(kw.watch), v: compile(kw.violence), f: compile(kw.fear), ex: compile(kw.exceptions), tr: compile(kw.threat_reported) };
  const strip = (s: string, list: RegExp[]) => list.reduce((acc, re) => acc.replace(re, " "), s);
  const hit = (list: RegExp[], s: string) => list.filter((re) => { re.lastIndex = 0; return re.test(s); }).map((re) => re.source);
  const t = strip(normEn(text), L.ex);
  const u = hit(L.u, strip(t, L.tr));
  const w = u.length ? [] : hit(L.w, t);
  const v = [...new Set([...hit(L.v, t), ...hit(L.tr, t)])];
  const f = v.length ? [] : hit(L.f, t);
  const level = u.length ? "urgent" : w.length ? "watch" : "none";
  return { level: level as "urgent" | "watch" | "none", violence: v.length > 0, fear: f.length > 0, matched: [...u, ...w, ...v, ...f] };
}
