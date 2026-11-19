// 카드를 멈추고 안전 안내 화면을 띄우는 기준(owner 2026-11-19): 자기 죽음의 **시기**(언제·내일·날짜)나 **장소**(어디서·옥상·한강…)를
// 구체적으로 말할 때만. "죽고 싶다"처럼 일상에서도 쓰는 말만으로는 멈추지 않고 watch(결과 그대로 + 마지막 쪽 109 안내 한 줄).
// 패키지 판정(lib/tarot/safety.js)·데이터는 그대로 두고 그 위에서 단계만 고친다(screenWorry.ts).
// 남의 죽음 걱정("엄마가 언제 죽을지")·남이 한 협박·관용 표현("내일 시험이라 죽겠다")은 걸리지 않게.
const norm = (t: string) => String(t || "").replace(/\s+/g, "");

// 자기 죽음을 뜻하는 말(관용 '죽겠다·죽을 것 같다'는 넣지 않음)
const DIE = "(죽(으려|을거|을려|을래|기로|을날|을생각|어버리려|어버릴|을까|을지|어야지|자)|자살(하려|할거|할래|하기로|할까|할지)|뛰어내리(려|ㄹ|기로|자)|뛰어내릴|목숨을끊(으려|을|기로)|생을마감(하려|할|하기로))";
const TIME = "(오늘|내일|모레|이번주|주말|다음주|이따|오늘밤|내일밤|새벽|다음달|[0-9]+일(에|날)|생일(에|날)|월요일|화요일|수요일|목요일|금요일|토요일|일요일|[0-9]+시)";
const PLACE = "(옥상|한강|대교|다리위|다리에서|난간|철로|선로|기찻길|철길|절벽|바다에|바닷가|산에서|아파트|베란다|창문|모텔|지하철역|선로에|마포대교)";

const TIMING_RE: RegExp[] = [
  new RegExp(`${TIME}[^.?!]{0,12}${DIE}`),
  /언제죽(을지|을까|어야|는게|을거)/,
  /(죽을|자살할|뛰어내릴)(날|날짜|시기|때)(를|을)?(정했|잡았|고민|생각|골라|정하)/,
  /(날짜|날)(를|을)?(정했|잡았)[^.?!]{0,10}(죽|자살|뛰어내리)/,
];
const PLACE_RE: RegExp[] = [
  /(어디서|어디에서|어디가|어디로)[^.?!]{0,8}(죽|자살|뛰어내리)/,
  /(죽을|자살할|뛰어내릴)(곳|장소|데)/,
  new RegExp(`${PLACE}[^.?!]{0,12}${DIE}`),
  new RegExp(`${DIE}[^.?!]{0,8}${PLACE}`),
];

// 남(가족·반려동물 등)의 죽음이나 남이 한 말
const OTHER = /(강아지|고양이|반려|햄스터|엄마|아빠|어머니|아버지|어머님|아버님|할머니|할아버지|부모님|남편|아내|와이프|아이|아들|딸|애기|아기|동생|언니|오빠|누나|친구|남친|여친|남자친구|여자친구|그사람|걔)(가|이|는|도|께서)[^.?!]{0,10}(언제|내일|오늘|어디)/;
const REPORTED = /(죽겠(대|다고)|죽어버리겠(대|다고|다며)|죽는대|죽는다고)/;
const IDIOM = /(언제죽을지모르(니까|잖|는게|는인생)|죽을것같|죽겠(다|어|네|음|당))/;

export function hasConcretePlan(text: string): boolean {
  let t = norm(text);
  for (const re of [OTHER, REPORTED, IDIOM]) t = t.replace(new RegExp(re.source, "g"), " ");
  return [...TIMING_RE, ...PLACE_RE].some((re) => re.test(t));
}

/** 패키지 판정 위에 기준을 얹는다: 구체적 시기·장소면 urgent, 아니면 urgent → watch. */
export function applyPlanRule<T extends { level: string; matched?: string[] }>(r: T, text: string): T {
  if (hasConcretePlan(text)) return { ...r, level: "urgent", matched: [...(r.matched ?? []), "plan:timing_or_place"] };
  if (r.level === "urgent") return { ...r, level: "watch" };
  return r;
}
