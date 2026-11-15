// v2.3.18 변경(CSO 2026-11-14 — 실제 고민 2,553건에 돌려 본 뒤 키워드 정리):
//   - urgent에서 뺌: 저를/나를 해치·약을 모아·따라가고 싶·곁으로 가고 싶·편지를 써 뒀(낱말만으로는 위기가 아님),
//     그만 살(그만 살려·살래·살까로 좁힘)·버틸 이유가 없/안 보·먼저 죽으면·마지막 인사·나를/저를 아프게 하는(뜻이 갈림). 이런 글은 AI 분류가 맡음.
//   - urgent에 더함: 죽을지·죽을래·죽어야·죽을 생각·언제 죽, 규칙 URGENT_RE(죽을까 — 뒤에 '봐'가 오면 제외).
//     '죽을·죽어·죽는·죽겠'은 낱말 그대로 넣지 않음(죽을 것 같아요·죽어라 공부·설레 죽는·배고파 죽겠어 같은 관용 표현에 걸림).
//   - watch에 더함: 죽으면·죽을까 봐(남의 죽음을 걱정하는 글에도 걸려 위기가 아니라 주의).
//   - watch·violence·fear에서 뜻이 갈리는 낱말을 뺌. 잘못 걸린 것이 확인된 낱말은 예외(exclude)로 문맥을 거름
//     (투자해→자해, 혼자살→자살, 멍때리→때리, 협박범, 떨어져/같이 살기 싫, 멀리/같이 살 자신). 눈치 봐요는 fear에서 뺌.
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
  /인생그만하고싶/, /죽는게나을/, /죽는방법/, /죽을방법/,
  /저를다치게/, /나를다치게/,
  /죽을지/, /죽을래/, /죽어야/, /죽을생각/, /언제죽/, // v2.3.18
  /그만살려/, /그만살래/, /그만살까/, // v2.3.18: 그만살 → 좁힘("이 집에서 그만 살고 싶어요"는 걸리지 않게)
];
// v2.3.18: 데이터 목록과 상관없이 늘 쓰는 위기 규칙 — '죽을까'(죽을까 봐는 watch)
export const URGENT_RE = [/죽을까(?!봐)/];
// 2026-11-15 owner(쏠 타로 저장소 추가 — 패키지 v2.3.18 위에 얹음): '죽을까·죽을지·언제 죽'은 urgent이지만,
//   남(반려동물·가족 등)이 아파서 살지 죽을지 걱정하는 글, 과로로 죽을까 걱정, "언제 죽을지 모르니까"(인생관)는 watch로 낮춘다.
//   이 구절만 urgent 판단에서 지우고 watch 근거로 남긴다 — 같은 글에 다른 위기 표현이 있으면 여전히 urgent.
const SUBJ = "(강아지|고양이|댕댕이|반려견|반려묘|반려동물|햄스터|엄마|아빠|어머니|아버지|어머님|아버님|할머니|할아버지|부모님|남편|아내|와이프|아이|아들|딸|애기|아기|동생|언니|오빠|누나|친구|남친|여친|남자친구|여자친구)";
export const DEATH_SOFT_RE = [
  /살지죽을지/,
  new RegExp(`${SUBJ}(가|이|는|도|께서)[^.?!]{0,12}(아프|아파|아픈|병|수술|암|입원|노견|노묘|숨을|기운|밥을안)[^.?!]{0,10}죽을(까|지)`),
  /(과로|일하다|이러다)[^.?!]{0,6}죽을까(걱정|겁|무서)/,
  /언제죽을지모르(니까|잖|는게|는인생)/,
];
// 2026-11-15 owner: 패키지 v2.3.18 '제안(미반영)' 문맥 규칙 중 U1·U3·W1·W2·W3을 모두 watch로(U2 '나를 아프게 하는 짓'은 자해라고 말하는 경우가 많아,
//   U4 '가족에게 편지를 써 뒀'은 뜻이 갈려 넣지 않음). 문맥이 붙을 때만 잡는다 — "저를 해치려는 사람", "남자친구 따라가고 싶어요", "그런 친구는 없는 게 낫죠"는 안 걸림.
export const WATCH_CTX_RE = [
  /(저를|나를|제자신을|내자신을)해치는(습관|짓|행동)/, /(저를|나를)해치고싶/, // U1
  /(돌아가시|돌아가신|세상을떠나|세상을떠난|하늘나라)[^.?!]{0,40}(따라가고싶|곁으로가고싶)/, // U3
  /더버틸이유가(없|안보)/, // W1
  /(제가|내가|저는|나는)없는게(낫|나을)/, // W2
  /(제가|내가)없어지면/, // W3
];
// 두 글자 단어는 띄어쓰기를 지우면 오탐이 생겨 원문 그대로에서 찾습니다.
// 예: "혼자 살기" → "혼자살기"에 '자살', "여자 해외" → "여자해외"에 '자해'가 생김
const URGENT_RAW = [/자살/, /자해/];
// v4.1 watch(다시 사용) — 소극적 표현·술 의존·방에만 있음
const WATCH = [
  /사라지고싶/, /사라져버리고싶/, /없어지고싶/, /지워지고싶/, /살기싫/, /살고싶지않/, /다끝내고싶(어|다)/, /다끝낼거/, /죽으면/, /죽을까봐/,
  /살이유가없/, /사는이유가없/, /살이유를모르/, /살아있을이유/, /있을이유가없/, /살자신이?없/, /안사는게낫/,
  /안깼으면/, /안깨어났으면/, /눈안떴으면/, /깨지않았으면/, /영원히잠들/, /영영쉬고싶/, /내일이(아예)?안왔으면/, /내일이안오길/, /사고라도났으면/, /왜또눈을떴/,
  /없어지는게맞/, /없으면다들편/, /없는게다들/, /없는게주변/, /없으면오히려/, /사라지면다들/, /사라져볼까/,
  /살아있는게민폐/, /숨쉬는것도미안/, /덜짐일/, /짐만되는/,
  /술없으면/, /안마시면못/, /술마셔야/,
  /방에서만/, /방에서안나가/, /밖에안나가/,
  /한끼도안먹/, /침대에서못일어나/, /아무것도안느껴/,
  // 절망 확신·섭식(굶기·토하기)·일상 무너짐(위기 아닌 글 4,800여 개에서 오탐 0인 것만)
  /해도안바뀔/, /앞으로도계속이럴/, /나아질게하나도/, /평생그럴/, /절대사랑받지못/, /게워/, /하루종일굶/, /하루종일거의안먹/, /하루에거의안먹/, /한발짝도안나/, /씻지도않/, /일어날힘이/, /출근을못/, /회사를못나/,
  /없으면훨씬편/, /사라지는상상/, /그냥짐이/, /나아질거라는기대도없/,
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
  /감시/, /휴대폰을검사/, /핸드폰을검사/, /폰을뒤/, /비번을알아야/, /비번을다/, /위치를공유하라/, /위치공유를강요/, /돈을뺏/, /가둬/, /가뒀/, /감금/, // S4-3 (통장·생활비 관리 방식은 일반 고민 — 판정 안 함)
  /스토킹/, /(저를|나를|계속)따라다(니|녀)/, /집앞에매일/, /번호바꿔도/, // S4-4
];
// v4 S4-5 관계 속 두려움: 그 사람이 무섭다(다른 신호 없음). '~할까 봐 무서워요'(잃을까 봐)는 넣지 않음
const PERSON = "(남친|여친|남자친구|여자친구|애인|남편|아내|와이프|그사람|그사람이|상대|상대방|그가|그애|오빠|남편이|팀장|상사|부모님|아빠|엄마)";
export const FEAR = [
  /무서워서(아무|그냥|아직)?(말|얘기|이야기|대답|거절|싫다고|반박)/, /무서워서아무것도/,
  /화낼까봐/, /화낼까무서/, /큰일나서/, /겁나서(아무)?말을/, // v2.3.18: 눈치 봐·보는 뺌(직장 고민에 너무 많이 걸림)
  new RegExp(`${PERSON}(이|가)?무서`),
  // 2026-10-22 CSO: 물건 던지기·벽/책상 치기는 폭력 확인이 아니라 두려움(안내 박스 + 방향 계산). 생활비·돈 관리 방식은 합의일 수 있어 안전 판정 안 함
  /물건을던/, /벽을(쳐|치)/, /책상을(내리|쾅)/, /서류를던/,
];
// 데이터 violence 목록에 들어 있지만 v4에서는 '관계 속 두려움'(S4-5)으로 보는 낱말 — 데이터는 그대로 두고 코드에서 옮김
export const FEAR_FROM_DATA = ["큰일나서", "무서워서"];

// S3 관용 표현 예외 — 데이터가 없을 때 쓰는 기본값(데이터 safety_keywords.exclude와 같음)
const DEFAULT_EXCLUDE = ["사라지고싶을만큼", "사라지고싶었어요ㅋ", "투자해", "혼자살", "멍때리", "뼈때리", "협박범", "떨어져살기싫", "같이살기싫", "에서살기싫", "랑살기싫", "멀리살자신", "같이살자신", "떨어져살자신", "에서살자신"];
// 데이터의 watch 목록(옛 이름 deprecated_watch도 읽음)
export const watchListOf = (kw) => (kw ? kw.watch || kw.deprecated_watch || [] : []);

// kw = { urgent:[], urgent_raw:[], watch:[](옛 이름 deprecated_watch), violence:[], fear:[](있으면), exclude:[] } — 모두 일반 문자열(띄어쓰기 없이)
export function screenText(text, kw = null) {
  const raw0 = String(text || "");
  let raw = raw0, t = norm(raw0);
  for (const ex of (kw ? kw.exclude || [] : DEFAULT_EXCLUDE)) { if (ex) { t = t.split(norm(ex)).join(" "); raw = raw.split(ex).join(" "); } }
  const toRe = (arr) => arr.filter(Boolean).map((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const L = kw ? { u: [...toRe(kw.urgent || []), ...URGENT_RE], ur: toRe(kw.urgent_raw || []), w: [...toRe(watchListOf(kw)), ...WATCH_RE],
                   v: toRe((kw.violence || []).filter((w) => !FEAR_FROM_DATA.includes(w))),
                   f: [...FEAR, ...toRe([...(kw.fear || []), ...(kw.violence || []).filter((w) => FEAR_FROM_DATA.includes(w))])] }
               : { u: [...URGENT, ...URGENT_RE], ur: URGENT_RAW, w: [...WATCH, ...WATCH_RE], v: VIOLENCE, f: FEAR };
  const hit = (list, s = t) => list.filter((re) => re.test(s)).map((re) => re.source);
  const tu0 = THREAT_REPORTED.reduce((s, re) => s.replace(new RegExp(re.source, "g"), " "), t); // 남이 말한 협박은 urgent에서 뺌
  const soft = hit(DEATH_SOFT_RE, tu0); // 남의 죽음·건강 걱정은 urgent에서 빼고 watch로
  const tu = DEATH_SOFT_RE.reduce((s, re) => s.replace(new RegExp(re.source, "g"), " "), tu0);
  const u = [...hit(L.u, tu), ...L.ur.filter((re) => re.test(raw)).map((re) => re.source)];
  const w = u.length ? [] : [...hit([...L.w, ...WATCH_CTX_RE]), ...soft];
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
