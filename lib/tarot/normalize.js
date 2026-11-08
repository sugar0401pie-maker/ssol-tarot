// v2.3.9 반말·줄임말·오타 정리(검색 전용 — 화면·AI 입력 원문은 바꾸지 않음)
//   사전: 02_데이터/norm_dict.json {slang, typo, endings, remove, tests}
//   순서: remove → endings → slang → typo. 단계마다 긴 키부터 한 번만 바꿈(바꾼 값을 같은 단계에서 다시 바꾸지 않음).
//   앞뒤에 공백을 붙여 '넘 ', '되 '처럼 공백이 붙은 키도 문장 처음·끝에서 맞게 함.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function buildNormalizer(dict) {
  const stages = ["endings", "slang", "typo"].map((cat) => {
    const mp = new Map();
    for (const [k, v] of dict[cat] || []) mp.set(k, v);
    const keys = [...mp.keys()].sort((a, b) => b.length - a.length);
    return { mp, re: keys.length ? new RegExp(keys.map(esc).join("|"), "g") : null };
  });
  const rem = [...(dict.remove || [])].sort((a, b) => b.length - a.length);
  const ws = (s) => " " + s.replace(/\s+/g, " ").trim() + " ";
  return function normalizeWorry(text) {
    let t = String(text || "");
    for (const r of rem) t = t.split(r).join(" ");
    t = ws(t);
    for (const { mp, re } of stages) if (re) t = ws(t.replace(re, (m) => mp.get(m)));
    return t.trim();
  };
}
