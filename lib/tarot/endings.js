// v4.0 (새로) 말투 변환 — 해요체(~요)·합니다체(~니다)를 쪽마다 50:50으로 맞춤 (규칙 G15)
//   원본: 07_DB 시절 build/endings.py(to_formal, _jong) + v4 시안 후처리 post.py(REV·EXTRA_F·to_informal·to_formal2·kind·SPL·balance·bold_first)
//   안전한 어미만 기계적으로 바꿈. 불규칙 활용(ㄹ 받침 등)은 못 바꾸면 그대로 두고 fails에 기록.

// 받침 번호(0=없음, 8=ㄹ, 20=ㅆ). 한글 음절이 아니면 -1
export const jong = (ch) => { const c = String(ch).charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? c % 28 : -1; };

// (요 어미, 니다 어미) — 긴 것부터 (endings.py FIXED)
export const FIXED = [
  ["아니에요.", "아닙니다."], ["거예요.", "것입니다."], ["이에요.", "입니다."], ["예요.", "입니다."],
  ["있어요.", "있습니다."], ["없어요.", "없습니다."], ["해요.", "합니다."], ["돼요.", "됩니다."],
  ["줘요.", "줍니다."], ["져요.", "집니다."], ["겨요.", "깁니다."], ["가요.", "갑니다."], ["봐요.", "봅니다."],
  ["보여요.", "보입니다."], ["쉬워요.", "쉽습니다."], ["나와요.", "나옵니다."], ["아와요.", "아옵니다."], ["어와요.", "어옵니다."],
  ["몰라요.", "모릅니다."], ["풀려요.", "풀립니다."], ["비춰요.", "비춥니다."], ["올라요.", "오릅니다."], ["달라요.", "다릅니다."],
  ["가까워요.", "가깝습니다."], ["어려워요.", "어렵습니다."], ["모여요.", "모입니다."], ["바뀌어요.", "바뀝니다."], ["들려요.", "들립니다."],
  [" 커요.", " 큽니다."], [" 써요.", " 씁니다."], ["움직여요.", "움직입니다."],
  ["켜요.", "킵니다."], ["서요.", "섭니다."], ["내요.", "냅니다."], ["세워요.", "세웁니다."], ["채워요.", "채웁니다."],
];
// post.py EXTRA_F — to_formal보다 먼저 봄
export const EXTRA_F = [["거예요.", "겁니다."], ["줄어요.", "줄어듭니다."], ["늘어요.", "늘어납니다."], ["볼게요.", "보겠습니다."], ["그래요.", "그렇습니다."],
  ["가리켜요.", "가리킵니다."], ["몰라요.", "모릅니다."], ["걸려요.", "걸립니다."], ["떠올라요.", "떠오릅니다."], ["흘러요.", "흐릅니다."]];
// post.py REV — 니다 → 요
export const REV = [["아닙니다.", "아니에요."], ["것입니다.", "거예요."], ["겁니다.", "거예요."], ["있습니다.", "있어요."], ["없습니다.", "없어요."], ["합니다.", "해요."], ["됩니다.", "돼요."],
  ["줍니다.", "줘요."], ["집니다.", "져요."], ["갑니다.", "가요."], ["봅니다.", "봐요."], ["보입니다.", "보여요."], ["쉽습니다.", "쉬워요."],
  ["나옵니다.", "나와요."], ["모릅니다.", "몰라요."], ["풀립니다.", "풀려요."], ["다릅니다.", "달라요."], ["가깝습니다.", "가까워요."], ["어렵습니다.", "어려워요."],
  ["바뀝니다.", "바뀌어요."], ["채웁니다.", "채워요."], ["냅니다.", "내요."], ["섭니다.", "서요."], ["않습니다.", "않아요."], ["같습니다.", "같아요."], ["좋습니다.", "좋아요."], ["많습니다.", "많아요."], ["괜찮습니다.", "괜찮아요."],
  ...EXTRA_F.map(([a, b]) => [b, a]), ["겠습니다.", "겠어요."]];

const endsWith = (s, a) => s.endsWith(a);
const swap = (s, a, b) => s.slice(0, s.length - a.length) + b;

// 한 문장(마침표로 끝남)을 합니다체로(endings.py to_formal). 못 바꾸면 null
export function toFormalBasic(s) {
  for (const [a, b] of FIXED) if (endsWith(s, a)) return swap(s, a, b);
  const m = s.match(/([가-힣])([아어])요\.$/);
  if (m) {
    const j = jong(m[1]);
    if (j > 0 && j !== 8) return s.slice(0, m.index + 1) + "습니다."; // 좋아요→좋습니다 (ㄹ 받침 제외)
  }
  return null;
}
// post.py to_formal2 = EXTRA_F 먼저, 그다음 to_formal
export function toFormal(s) {
  for (const [a, b] of EXTRA_F) if (endsWith(s, a)) return swap(s, a, b);
  return toFormalBasic(s);
}
// 니다 → 요 (post.py to_informal). 못 바꾸면 null
export function toInformal(s) {
  let m = s.match(/([가-힣])습니다\.$/);
  if (m && jong(m[1]) === 20) return s.slice(0, m.index + 1) + "어요."; // 했습니다→했어요
  for (const [a, b] of REV) if (endsWith(s, a)) return swap(s, a, b);
  m = s.match(/([가-힣])입니다\.$/);
  if (m) return s.slice(0, m.index + 1) + (jong(m[1]) > 0 ? "이에요." : "예요.");
  return null;
}
// 문장 종류: "f"(니다) / "i"(요) / null(권유·의문·기타 — 바꾸지 않음)
export function kind(s) {
  const t = String(s).trimEnd().replaceAll("**", "");
  if (/(세요|십시오|볼까요|을까요|ㄹ까요)\.$/.test(t)) return null;
  return /니다\.$/.test(t) ? "f" : /요\.$/.test(t) ? "i" : null;
}
// 한 줄을 문장으로 나눔(post.py SPL). 나눈 조각을 이어 붙여 원문이 안 되면 [줄 전체]
export function splitSentences(t) {
  const parts = String(t).match(/.*?[.?!]+(?:\*\*)?(?:\s+|$)/g) || [];
  const clean = parts.filter((p) => p !== "");
  return clean.join("") === t ? clean : [t];
}

const SKIP_HEAD = ["##", "[", "▸", "#", "※"]; // ※ = 코드가 붙이는 고정 안내(R10 작은 글씨) — 말투를 바꾸지 않음(post.py에서 추가)
// 쪽 안의 서술문을 ~니다/~요 번갈아(50:50). seed 홀짝으로 첫 문장 어미를 정함(쪽 번호를 넣음). fails에 못 바꾼 끝을 모음
export function balance(lines, seed, fails = []) {
  const out = lines.slice();
  const idx = [];
  out.forEach((ln, li) => {
    const s = ln.trim();
    if (!s || SKIP_HEAD.some((h) => s.startsWith(h)) || !/[.?!](\*\*)?$/.test(s)) return;
    splitSentences(ln).forEach((sent, si) => { if (kind(sent.replaceAll("**", ""))) idx.push([li, si]); });
  });
  const want = seed % 2;
  const sents = {};
  for (const [li] of idx) if (!sents[li]) sents[li] = splitSentences(out[li]);
  idx.forEach(([li, si], k) => {
    const sent = sents[li][si];
    const body = sent.trimEnd(), tail = sent.slice(body.length);
    const star = body.endsWith("**");
    let core = star ? body.slice(0, -2) : body;
    const target = (k + want) % 2 === 0 ? "f" : "i";
    if (kind(core) !== target) {
      const conv = target === "f" ? toFormal(core) : toInformal(core);
      if (conv) core = conv; else fails.push(core.slice(-12));
    }
    sents[li][si] = core + (star ? "**" : "") + tail;
  });
  for (const li of Object.keys(sents)) out[li] = sents[li].join("");
  return out;
}

// 문단 첫 문장 굵게(post.py bold_first) — 이미 ** 있는 줄, 제목·목록·안내 줄, 한 문장뿐인 줄은 그대로
const BOLD_SKIP = ["##", "[", "▸", "#", "◦ ", "• ", "※"]; // ※ 작은 글씨는 굵게 하지 않음(post.py에서 추가)
export function boldFirstLines(lines) {
  return lines.map((ln) => {
    const s = ln.trim();
    if (!s || s.includes("**") || BOLD_SKIP.some((h) => s.startsWith(h)) || !/[.?!]$/.test(s)) return ln;
    const m = s.match(/^(.+?[.?!])(\s+.+)$/);
    return m ? `**${m[1]}**${m[2]}` : ln;
  });
}

// 쪽 전체 말투 비율 확인용: {f, i}
export function countKinds(text) {
  const t = { f: 0, i: 0 };
  for (const s of String(text || "").replaceAll("**", "").match(/[^.?!\n]*[.?!]/g) || []) { const k = kind(s); if (k) t[k]++; }
  return t;
}
