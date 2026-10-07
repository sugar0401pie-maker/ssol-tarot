// 안전 확인 — 고민 원문을 서버에서 키워드로 1차 확인하고, AI 분류 결과(crisis_level, violence)와 합칩니다.
// 둘 중 하나라도 높게 나오면 높은 쪽을 따릅니다(낮추는 방향으로 합치지 않음).
// 키워드 목록은 보조 장치입니다. 운영하면서 오탐·미탐 사례를 모아 상담사와 함께 보완하세요. [확인필요]

const norm = (t) => String(t || "").replace(/\s+/g, "");

// 띄어쓰기를 지운 문장에서 찾는 목록
const URGENT = [
  /죽고싶/, /죽어버리/, /극단적선택/, /사라지고싶/, /살기싫/, /살고싶지않/,
  /유서/, /뛰어내리/, /목숨을끊/, /삶을끝내/, /인생을끝내/, /세상을떠나고싶/, /없어지고싶/,
];
// 두 글자 단어는 띄어쓰기를 지우면 오탐이 생겨 원문 그대로에서 찾습니다.
// 예: "혼자 살기" → "혼자살기"에 '자살', "여자 해외" → "여자해외"에 '자해'가 생김
const URGENT_RAW = [/자살/, /자해/];

const WATCH = [
  /너무힘들/, /버틸수가없/, /버티기힘들/, /아무의미없/, /아무것도못하겠/, /숨이막/, /무기력/,
  /잠을못자/, /매일울/, /혼자인것같/, /아무도없/, /지쳐서아무것도/,
];
const VIOLENCE = [
  /때리/, /때렸/, /맞았/, /폭력/, /폭행/, /협박/, /위협/, /감시/, /휴대폰을검사/, /핸드폰을검사/,
  /폰을뒤/, /위치를공유하라/, /위치공유를강요/, /못만나게/, /물건을던지/, /스토킹/, /따라다니/, /무서워서/,
];

export function screenText(text) {
  const t = norm(text);
  const hit = (list) => list.filter((re) => re.test(t)).map((re) => re.source);
  const raw = String(text || "");
  const u = [...hit(URGENT), ...URGENT_RAW.filter((re) => re.test(raw)).map((re) => re.source)];
  const w = hit(WATCH), v = hit(VIOLENCE);
  const level = u.length ? "urgent" : w.length ? "watch" : "none";
  return { level, violence: v.length > 0, matched: [...u, ...w, ...v] };
}

const RANK = { none: 0, watch: 1, urgent: 2 };
export function mergeSafety(local, ai) {
  const aiLevel = ai && RANK[ai.crisis_level] !== undefined ? ai.crisis_level : "none";
  const level = RANK[local.level] >= RANK[aiLevel] ? local.level : aiLevel;
  return { level, violence: Boolean(local.violence || (ai && ai.violence)), matched: local.matched };
}

// 화면 분기: urgent → 카드 진행 중단, 안전 안내 화면. watch → 진행하되 결과에 안내 박스, 계정에 위기 신호 이력 저장.
export function nextScreenFor(safety) {
  if (safety.level === "urgent") return "safety";
  return "confirm";
}

// 폭력·통제 신호가 있으면 상대에게 다가가는 실천(approach)은 빼고 넘깁니다(지식베이스 D19 규칙).
export function filterPractices(card, safety) {
  return card.practices.filter((p) => !(safety.violence && p.approach));
}
