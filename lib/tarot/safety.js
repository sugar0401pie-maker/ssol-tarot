// v4.0 변경(규칙 S2 삭제·S4 쪼갬):
//   - 주의(watch) 단계를 없앰. level은 urgent / none 둘뿐. 데이터(safety_keywords.watch)에 watch 목록이 남아 있어도 판정에 쓰지 않음.
//     AI 분류가 crisis_level="watch"를 돌려줘도 none으로 봄.
//   - 폭력 확인(violence=true)은 구체 행동만: S4-1 신체 폭력(때림·밀침·목 조름·물건 던짐·벽을 침) / S4-2 협박 /
//     S4-3 통제(휴대폰·비밀번호 검사, 위치 강요, 만남 통제, 돈 통제) / S4-4 스토킹.
//   - '무서워서 말을 못 해요'·'눈치 봐요'처럼 그 사람이 무섭다는 말만 있으면 fear=true('관계 속 두려움', S4-5) — 안내 박스만.
//   - '떠날까 봐 무서워요'(잃을까 봐, S4-6), 차단했다·"연락하지 마"라는 언급만으로는 아무 판정 없음.
//   - S3 관용 표현 예외(exclude) 유지.
// 안전 확인 — 고민 원문을 서버에서 키워드로 1차 확인하고, AI 분류 결과(crisis_level, violence, fear)와 합칩니다.
// 둘 중 하나라도 높게 나오면 높은 쪽을 따릅니다(낮추는 방향으로 합치지 않음).
// 키워드 목록은 보조 장치입니다. v2.5부터 운영 키워드는 tarot_data.json의 safety_keywords(엑셀 '안전키워드' 시트)에서 관리하고,
// 아래 목록은 데이터가 없을 때 쓰는 기본값입니다.

const norm = (t) => String(t || "").replace(/\s+/g, "");

// 띄어쓰기를 지운 문장에서 찾는 목록
const URGENT = [
  /죽고싶/, /죽어버리/, /극단적선택/, /사라지고싶/, /살기싫/, /살고싶지않/,
  /유서/, /뛰어내리/, /목숨을끊/, /삶을끝내/, /인생을끝내/, /세상을떠나고싶/, /없어지고싶/,
];
// 두 글자 단어는 띄어쓰기를 지우면 오탐이 생겨 원문 그대로에서 찾습니다.
// 예: "혼자 살기" → "혼자살기"에 '자살', "여자 해외" → "여자해외"에 '자해'가 생김
const URGENT_RAW = [/자살/, /자해/];

// v4: S4-1~4 구체 행동만. ('무서워서'는 v4에서 FEAR로 옮김)
const VIOLENCE = [
  /때리/, /때렸/, /맞았/, /폭력/, /폭행/, /밀쳤/, /밀쳐/, /목을조/, /물건을던지/, /물건을던/, /벽을쳐/, /벽을치/, // S4-1
  /협박/, /위협/, /가만안두/, /죽어버리겠대/, /사진을뿌리/, // S4-2
  /감시/, /휴대폰을검사/, /핸드폰을검사/, /폰을뒤/, /비번을알아야/, /비번을다/,/위치를공유하라/, /위치공유를강요/, /못만나게/, /돈을뺏/, /통장을관리/, // S4-3
  /스토킹/, /따라다니/, /집앞에매일/, /번호바꿔도/, // S4-4
];
// v4 S4-5 관계 속 두려움: 그 사람이 무섭다(다른 신호 없음). '~할까 봐 무서워요'(잃을까 봐)는 넣지 않음
const PERSON = "(남친|여친|남자친구|여자친구|애인|남편|아내|와이프|그사람|그사람이|상대|상대방|그가|그애|오빠|남편이|팀장|상사|부모님|아빠|엄마)";
export const FEAR = [
  /무서워서(아무|그냥|아직)?(말|얘기|이야기|대답|거절|싫다고|반박)/, /무서워서아무것도/,
  /화낼까봐/, /화낼까무서/, /눈치(를)?봐/, /눈치(를)?보/, /큰일나서/, /겁나서(아무)?말을/,
  new RegExp(`${PERSON}(이|가)?무서`),
];
// 데이터 violence 목록에 들어 있지만 v4에서는 '관계 속 두려움'(S4-5)으로 보는 낱말 — 데이터는 그대로 두고 코드에서 옮김
export const FEAR_FROM_DATA = ["눈치봐요", "큰일나서", "무서워서"];

// v2.5: 키워드는 tarot_data.json의 safety_keywords(엑셀 '안전키워드' 시트)에서 받습니다. 없으면 위 기본 목록.
//   kw = { urgent:[], urgent_raw:[], watch:[](v4에서 안 씀), violence:[], fear:[](있으면), exclude:[] } — 모두 일반 문자열(띄어쓰기 없이)
export function screenText(text, kw = null) {
  const raw0 = String(text || "");
  let raw = raw0, t = norm(raw0);
  if (kw && kw.exclude) for (const ex of kw.exclude) { if (ex) { t = t.split(norm(ex)).join(" "); raw = raw.split(ex).join(" "); } }
  const toRe = (arr) => arr.filter(Boolean).map((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const L = kw ? { u: toRe(kw.urgent || []), ur: toRe(kw.urgent_raw || []),
                   v: toRe((kw.violence || []).filter((w) => !FEAR_FROM_DATA.includes(w))),
                   f: [...FEAR, ...toRe([...(kw.fear || []), ...(kw.violence || []).filter((w) => FEAR_FROM_DATA.includes(w))])] }
               : { u: URGENT, ur: URGENT_RAW, v: VIOLENCE, f: FEAR };
  const hit = (list) => list.filter((re) => re.test(t)).map((re) => re.source);
  const u = [...hit(L.u), ...L.ur.filter((re) => re.test(raw)).map((re) => re.source)];
  const v = hit(L.v);
  const f = v.length ? [] : hit(L.f); // 폭력이 확인되면 두려움은 따로 표시하지 않음(더 높은 단계)
  const level = u.length ? "urgent" : "none";
  return { level, violence: v.length > 0, fear: f.length > 0, matched: [...u, ...v, ...f] };
}

const RANK = { none: 0, urgent: 2 }; // v4: watch 없음
export function mergeSafety(local, ai) {
  const aiLevel = ai && ai.crisis_level === "urgent" ? "urgent" : "none"; // AI의 watch는 none으로
  const level = RANK[local.level] >= RANK[aiLevel] ? local.level : aiLevel;
  const violence = Boolean(local.violence || (ai && ai.violence));
  return { level, violence, fear: !violence && Boolean(local.fear || (ai && ai.fear)), matched: local.matched };
}

// 화면 분기: urgent → 카드 진행 중단, 안전 안내 화면. 그 밖은 모두 같은 흐름(v4: watch 분기 없음)
export function nextScreenFor(safety) {
  if (safety.level === "urgent") return "safety";
  return "confirm";
}

// 폭력·통제가 구체적 행동으로 확인되면(S4-1~4) 상대에게 다가가는 실천(approach)은 빼고 넘깁니다(V3). 두려움(fear)만으로는 빼지 않음.
export function filterPractices(card, safety) {
  return card.practices.filter((p) => !(safety.violence && p.approach));
}
