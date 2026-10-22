// v4.1 변경(CSO 2026-10-22 — 안전 단계 다시 정리):
//   - 단계는 urgent / watch / none 셋.
//     urgent(카드 멈춤, 안전 안내) = 죽음에 대한 직접 표현(죽고 싶다·그만 살려고·따라가고 싶다·곁으로 가고 싶다·먼저 죽으면·죽는 방법 검색),
//       자해 행동, 세상과의 작별 준비(가족에게 편지를 써 둠).
//     watch(다시 사용) = 결과·방향은 그대로 + 결과 마지막 쪽 맨 아래 작은 글씨 한 줄(copy.safety.watch_note).
//       소극적 표현(사라지고 싶다·안 깼으면·내가 없는 게 낫다·다 끝내고 싶다·살 이유를 모르겠다·살 자신이 없다),
//       한 달 이상 못 먹음/못 잠, 술 의존, 방에만 있음 등.
//     none = 이별·시험 뒤 한 달 안 되게 못 먹음, 관계·시험을 '끝낸다'는 뜻, 생활비·돈 관리 방식, 관용 표현.
//   - 데이터 safety_keywords.watch(옛 이름 deprecated_watch도 읽음).
//   - violence(방향 끔 + 안내 박스) / fear(안내 박스 + 방향 계산)는 v4.0과 같음(S4).
// v4.0: 폭력 확인(violence=true)은 구체 행동만: S4-1 신체 폭력(때림·밀침·목 조름) / S4-2 협박 / S4-3 통제(휴대폰·비밀번호 검사, 위치 강요, 만남 막기, 돈을 뺏음) / S4-4 스토킹.
//   '무서워서 말을 못 해요'·'눈치 봐요'처럼 그 사람이 무섭다는 말, 물건 던지기·벽/책상 치기는 fear=true('관계 속 두려움', S4-5) — 안내 박스만.
//   '떠날까 봐 무서워요'(잃을까 봐, S4-6), 차단했다·"연락하지 마"라는 언급만으로는 아무 판정 없음. S3 관용 표현 예외(exclude) 유지.
// 안전 확인 — 고민 원문을 서버에서 키워드로 1차 확인하고, AI 분류 결과(crisis_level, violence, fear)와 합칩니다.
// 둘 중 하나라도 높게 나오면 높은 쪽을 따릅니다(낮추는 방향으로 합치지 않음).
// 키워드 목록은 보조 장치입니다. 운영 키워드는 tarot_data.json의 safety_keywords(엑셀 '안전키워드' 시트)에서 관리하고,
// 아래 목록은 데이터가 없을 때 쓰는 기본값입니다.

const norm = (t) => String(t || "").replace(/\s+/g, "");

// 띄어쓰기를 지운 문장에서 찾는 목록 — urgent는 직접 표현·자해 행동·작별 준비만
// v4.1 CSO 2차: 남이 말한 협박("헤어지자고 하면 죽어버리겠대요")은 urgent가 아니라 violence(S4-2) — urgent를 볼 때는 이 구절을 지우고 봄
export const THREAT_REPORTED = [/죽어버리겠(대|다고|다며|다는|단다)/, /죽어버린(대|다고|다며)/, /(헤어지|헤어지자|떠나|안만나|그만만나|연락안하|연락을안하|차단하)[^.?!]{0,15}죽겠(대|다고|다며)/];
const URGENT = [
  /죽고싶/, /죽어버리/, /극단적선택/, /유서/, /뛰어내리/, /목숨을끊/, /삶을끝내/, /인생을끝내/, /세상을떠나고싶/,
  /그만살/, /인생그만하고싶/, /죽는게나을/, /따라가고싶/, /곁으로가고싶/, /먼저죽으면/, /죽는방법/, /죽을방법/, /약을모아/,
  /버틸이유가안보/, /버틸이유가없/,
  /저를해치/, /나를해치/, /저를다치게/, /나를다치게/, /나를아프게하는/, /저를아프게하는/,
  /편지를써뒀/, /편지를써놨/, /마지막인사/,
];
// 두 글자 단어는 띄어쓰기를 지우면 오탐이 생겨 원문 그대로에서 찾습니다.
// 예: "혼자 살기" → "혼자살기"에 '자살', "여자 해외" → "여자해외"에 '자해'가 생김
const URGENT_RAW = [/자살/, /자해/];
// v4.1 watch(다시 사용) — 소극적 표현·술 의존·방에만 있음
const WATCH = [
  /사라지고싶/, /사라져버리고싶/, /없어지고싶/, /지워지고싶/, /살기싫/, /살고싶지않/, /다끝내고싶(어|다)/, /다끝낼거/,
  /살이유가없/, /사는이유가없/, /살이유를모르/, /살아있을이유/, /있을이유가없/, /살자신이?없/, /안사는게낫/,
  /안깼으면/, /안깨어났으면/, /눈안떴으면/, /깨지않았으면/, /영원히잠들/, /영영쉬고싶/, /내일이(아예)?안왔으면/, /내일이안오길/, /사고라도났으면/, /왜또눈을떴/,
  /없어지는게맞/, /없는게나을/, /없는게낫/, /없으면다들편/, /없으면편할/, /없는게다들/, /없는게주변/, /없으면오히려/, /사라지면다들/, /없어지면되/, /사라져볼까/,
  /살아있는게민폐/, /숨쉬는것도미안/, /덜짐일/, /짐만되는/, /계속살아갈수있을지/,
  /술없이는/, /술없으면/, /안마시면못/, /술마셔야/,
  /방에만/, /방에서만/, /방에서안나가/, /밖에안나가/,
  /한끼도안먹/, /침대에서못일어나/, /아무것도안느껴/, /텅빈것같/,
  // 절망 확신·섭식(굶기·토하기)·일상 무너짐(위기 아닌 글 4,800여 개에서 오탐 0인 것만)
  /절대안바뀔/, /해도안바뀔/, /앞으로도계속이럴/, /나아질게하나도/, /평생그럴/, /절대안생기/, /절대사랑받지못/, /토해/, /게워/, /하루종일굶/, /하루종일거의안먹/, /하루에거의안먹/, /한발짝도안나/, /씻지도않/, /일어날힘이/, /출근을못/, /회사를못나/, /눈물만나/,
  /없으면훨씬편/, /사라지는상상/, /그냥짐이/, /절대안바뀌/, /나아질거라는기대도없/,
];
// 한 달 이상 못 먹음/못 잠 — 기간이 붙어야 watch(나흘·일주일·2주처럼 한 달이 안 되면 none). 데이터 목록과 상관없이 늘 씀
export const WATCH_RE = [
  /(한|두|세|석|넉|몇|여러|[0-9]+)(달|개월|년)(째|넘게|이상|동안|가까이|내내)[^.?!]{0,16}(못먹|안먹|굶|밥이안|밥을못|입맛이없|못자|못잤|잠을(못|거의)|잠이안)/,
  /(못먹|안먹|굶|밥을못|못자|못잤|잠을못)[^.?!]{0,8}(한|두|세|석|넉|몇|여러|[0-9]+)(달|개월|년)(째|넘게|이상|동안|가까이|내내)/,
];

// v4: S4-1~4 구체 행동만.
const VIOLENCE = [
  /때리/, /때렸/, /맞았/, /폭력/, /폭행/, /밀쳤/, /밀쳐/, /목을조/, // S4-1 (2026-10-22: 물건 던지기·벽 치기는 FEAR로)
  /협박/, /위협/, /가만안두/, /죽어버리겠대/, /사진을뿌리/, // S4-2 (남이 말한 협박은 THREAT_REPORTED로도 봄)
  /감시/, /휴대폰을검사/, /핸드폰을검사/, /폰을뒤/, /비번을알아야/, /비번을다/, /위치를공유하라/, /위치공유를강요/, /못만나게/, /돈을뺏/, // S4-3 (통장·생활비 관리 방식은 일반 고민 — 판정 안 함)
  /스토킹/, /따라다니/, /집앞에매일/, /번호바꿔도/, // S4-4
];
// v4 S4-5 관계 속 두려움: 그 사람이 무섭다(다른 신호 없음). '~할까 봐 무서워요'(잃을까 봐)는 넣지 않음
const PERSON = "(남친|여친|남자친구|여자친구|애인|남편|아내|와이프|그사람|그사람이|상대|상대방|그가|그애|오빠|남편이|팀장|상사|부모님|아빠|엄마)";
export const FEAR = [
  /무서워서(아무|그냥|아직)?(말|얘기|이야기|대답|거절|싫다고|반박)/, /무서워서아무것도/,
  /화낼까봐/, /화낼까무서/, /눈치(를)?봐/, /눈치(를)?보/, /큰일나서/, /겁나서(아무)?말을/,
  new RegExp(`${PERSON}(이|가)?무서`),
  // 2026-10-22 CSO: 물건 던지기·벽/책상 치기는 폭력 확인이 아니라 두려움(안내 박스 + 방향 계산). 생활비·돈 관리 방식은 합의일 수 있어 안전 판정 안 함
  /물건을던/, /벽을(쳐|치)/, /책상을(내리|쾅)/, /서류를던/,
];
// 데이터 violence 목록에 들어 있지만 v4에서는 '관계 속 두려움'(S4-5)으로 보는 낱말 — 데이터는 그대로 두고 코드에서 옮김
export const FEAR_FROM_DATA = ["눈치봐요", "큰일나서", "무서워서"];

// S3 관용 표현 예외 — 데이터가 없을 때 쓰는 기본값(데이터 safety_keywords.exclude와 같음)
const DEFAULT_EXCLUDE = ["사라지고싶을만큼", "사라지고싶었어요ㅋ"];
// 데이터의 watch 목록(옛 이름 deprecated_watch도 읽음)
export const watchListOf = (kw) => (kw ? kw.watch || kw.deprecated_watch || [] : []);

// kw = { urgent:[], urgent_raw:[], watch:[](옛 이름 deprecated_watch), violence:[], fear:[](있으면), exclude:[] } — 모두 일반 문자열(띄어쓰기 없이)
export function screenText(text, kw = null) {
  const raw0 = String(text || "");
  let raw = raw0, t = norm(raw0);
  for (const ex of (kw ? kw.exclude || [] : DEFAULT_EXCLUDE)) { if (ex) { t = t.split(norm(ex)).join(" "); raw = raw.split(ex).join(" "); } }
  const toRe = (arr) => arr.filter(Boolean).map((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const L = kw ? { u: toRe(kw.urgent || []), ur: toRe(kw.urgent_raw || []), w: [...toRe(watchListOf(kw)), ...WATCH_RE],
                   v: toRe((kw.violence || []).filter((w) => !FEAR_FROM_DATA.includes(w))),
                   f: [...FEAR, ...toRe([...(kw.fear || []), ...(kw.violence || []).filter((w) => FEAR_FROM_DATA.includes(w))])] }
               : { u: URGENT, ur: URGENT_RAW, w: [...WATCH, ...WATCH_RE], v: VIOLENCE, f: FEAR };
  const hit = (list, s = t) => list.filter((re) => re.test(s)).map((re) => re.source);
  const tu = THREAT_REPORTED.reduce((s, re) => s.replace(new RegExp(re.source, "g"), " "), t); // 남이 말한 협박은 urgent에서 뺌
  const u = [...hit(L.u, tu), ...L.ur.filter((re) => re.test(raw)).map((re) => re.source)];
  const w = u.length ? [] : hit(L.w);
  const v = [...new Set([...hit(L.v), ...hit(THREAT_REPORTED)])];
  const f = v.length ? [] : hit(L.f); // 폭력이 확인되면 두려움은 따로 표시하지 않음(더 높은 단계)
  const level = u.length ? "urgent" : w.length ? "watch" : "none";
  return { level, violence: v.length > 0, fear: f.length > 0, matched: [...u, ...w, ...v, ...f] };
}

export const RANK = { none: 0, watch: 1, urgent: 2 };
const levelOf = (x) => (x === "urgent" || x === "watch" ? x : "none");
export function mergeSafety(local, ai) {
  const aiLevel = levelOf(ai && ai.crisis_level);
  const lv = levelOf(local.level);
  const level = RANK[lv] >= RANK[aiLevel] ? lv : aiLevel;
  const violence = Boolean(local.violence || (ai && ai.violence));
  return { level, violence, fear: !violence && Boolean(local.fear || (ai && ai.fear)), matched: local.matched };
}

// 화면 분기: urgent → 카드 진행 중단, 안전 안내 화면. watch·none은 같은 흐름(watch는 결과 마지막 쪽 맨 아래 작은 글씨만)
export function nextScreenFor(safety) {
  if (safety.level === "urgent") return "safety";
  return "confirm";
}
// watch면 결과 마지막 쪽 맨 아래에 붙일 작은 글씨 한 줄(없으면 null)
export function watchNoteFor({ data, safety }) {
  if (!safety || safety.level !== "watch") return null;
  return (data && data.copy && data.copy.safety && data.copy.safety.watch_note) || null;
}

// 폭력·통제가 구체적 행동으로 확인되면(S4-1~4) 상대에게 다가가는 실천(approach)은 빼고 넘깁니다(V3). 두려움(fear)만으로는 빼지 않음.
export function filterPractices(card, safety) {
  return card.practices.filter((p) => !(safety.violence && p.approach));
}
