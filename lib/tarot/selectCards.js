// 카드 선별 로직 — 고민 분류(영역·감정·필요) → 후보 7장 → 사용자가 고른 3장에 위치 배정.
// 원칙: 결과에 영향을 주는 부분에는 무작위를 쓰지 않는다(쏠 웰니스 하우스 공통 원칙).
//       화면에 7장을 늘어놓는 "배치 순서"만 세션 ID로 섞는다(어떤 카드가 후보인지는 바뀌지 않음).

export function validateClassification(cls, data) {
  const errors = [];
  const codes = (arr) => new Set(arr.map((x) => x.code));
  const D = codes(data.domains), E = codes(data.emotions), N = codes(data.needs);
  if (!cls || typeof cls !== "object") return ["분류 결과가 없습니다"];
  if (!D.has(cls.domain)) errors.push(`알 수 없는 영역: ${cls.domain}`);
  const emos = Array.isArray(cls.emotions) ? cls.emotions : [];
  if (emos.length < 1 || emos.length > 2) errors.push("감정은 1~2개여야 합니다");
  if (new Set(emos).size !== emos.length) errors.push("감정이 중복되었습니다");
  emos.forEach((e) => { if (!E.has(e)) errors.push(`알 수 없는 감정: ${e}`); });
  if (!N.has(cls.need)) errors.push(`알 수 없는 필요: ${cls.need}`);
  return errors;
}

export function scoreCard(card, cls, w) {
  let s = 0;
  if (card.match.needs.includes(cls.need)) s += w.need;
  if (card.match.emotions.includes(cls.emotions[0])) s += w.emotion_primary;
  if (cls.emotions[1] && card.match.emotions.includes(cls.emotions[1])) s += w.emotion_secondary;
  if (card.match.domains.includes(cls.domain)) s += w.domain;
  return s;
}

// 후보 7장: 점수 내림차순 → 동점이면 카드 번호 오름차순(결정론적).
export function shortlist(cls, data) {
  const errs = validateClassification(cls, data);
  if (errs.length) throw new Error(errs.join("; "));
  const w = data.scoring.weights;
  return data.cards
    .map((c) => ({ id: c.id, no: c.no, score: scoreCard(c, cls, w) }))
    .sort((a, b) => b.score - a.score || a.no - b.no)
    .slice(0, data.scoring.shortlist_size);
}

// 화면 배치 순서(시각 연출 전용). 같은 세션 ID면 항상 같은 순서 → 새로고침해도 카드가 뒤바뀌지 않음.
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function displayOrder(list, sessionId) {
  const rand = mulberry32(xmur3(String(sessionId))());
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// 사용자가 고른 순서 = 위치(지금의 마음 → 나를 붙잡는 것 → 다음 한 걸음).
export function assignPositions(pickedIds, shortlistIds, data) {
  const n = data.scoring.pick_count;
  if (!Array.isArray(pickedIds) || pickedIds.length !== n) throw new Error(`카드는 정확히 ${n}장을 골라야 합니다`);
  if (new Set(pickedIds).size !== n) throw new Error("같은 카드를 두 번 고를 수 없습니다");
  const allowed = new Set(shortlistIds);
  pickedIds.forEach((id) => { if (!allowed.has(id)) throw new Error(`후보에 없는 카드: ${id}`); });
  const byId = Object.fromEntries(data.cards.map((c) => [c.id, c]));
  const positions = data.positions.slice().sort((a, b) => a.order - b.order);
  return pickedIds.map((id, i) => ({ position: positions[i].code, positionName: positions[i].name, card: byId[id] }));
}
