// 고객이 직접 쓴 선택지의 짧은 별칭(owner 2026-11-15, 패키지 v2.3.15 요청 — A2가 option_aliases를 함께 냄).
// 7·10쪽은 첫 번째만 정식 이름, 나머지와 4·5·6·8·9쪽은 별칭(DB 선택지와 같은 규칙 — reportLines.ts applyAliases).
// AI가 만든 별칭은 여기서 검사해 통과한 것만 쓴다. 하나라도 이상하면 그 선택지는 정식 이름 그대로(예전과 같음).
const FORBIDDEN = /예언|운명|반드시|틀림없|맞힌|확실|정답|무조건|최고|최악/;
const MIN = 2;
const MAX = 8; // 띄어쓰기 뺀 글자 수
const bigrams = (s: string) => {
  const t = s.replace(/[^가-힣a-zA-Z0-9]/g, "");
  const out = new Set<string>();
  for (let i = 0; i + 1 < t.length; i++) out.add(t.slice(i, i + 2));
  if (t.length === 1) out.add(t);
  return out;
};
const stripMark = (s: string) => s.replace(/\s*\(암시\)\s*$/, "").trim();

/** 한 선택지의 별칭이 쓸 만한지: 2~8자, 금지어 없음, 정식 이름과 다름, 정식 이름의 말에서 나옴(글자 두 개 이상 겹침). */
export function aliasOk(full: string, alias: unknown): alias is string {
  if (typeof alias !== "string") return false;
  const a = alias.trim();
  const n = [...a.replace(/\s/g, "")].length;
  if (n < MIN || n > MAX || FORBIDDEN.test(a) || /[{}[\]()‘’'"]/.test(a)) return false;
  const f = stripMark(full);
  if (!f || a === f || [...f.replace(/\s/g, "")].length <= MAX) return false; // 정식 이름이 이미 짧으면 별칭이 필요 없다
  const fb = bigrams(f);
  return [...bigrams(a)].some((b) => fb.has(b));
}

/** 고민 틀에서 쓸 수 있는 별칭 목록 [{ full, alias }]. 고객이 직접 쓴 선택지(decision_source explicit)만, 서로 다른 별칭만. */
export function userAliases(frame: { decision_source?: string | null; forecast?: unknown; options?: unknown; options_ranked?: unknown; option_aliases?: unknown } | null): { full: string; alias: string }[] {
  if (!frame || frame.decision_source !== "explicit" || frame.forecast) return [];
  const opts = (Array.isArray(frame.options_ranked) ? frame.options_ranked : Array.isArray(frame.options) ? frame.options : []) as unknown[];
  const al = Array.isArray(frame.option_aliases) ? frame.option_aliases : [];
  if (opts.length < 2 || al.length !== opts.length) return [];
  const out: { full: string; alias: string }[] = [];
  const seen = new Set<string>();
  opts.forEach((o, i) => {
    const full = typeof o === "string" ? stripMark(o) : "";
    const a = al[i];
    if (!full || !aliasOk(full, a)) return;
    const alias = (a as string).trim();
    if (seen.has(alias)) return;
    seen.add(alias);
    out.push({ full, alias });
  });
  return out;
}
