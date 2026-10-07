// 한국어 조사 자동 처리 — 디저트 테스트 v2 마스터 스펙 7.2장 코드를 그대로 옮기고 export만 붙였습니다.
// 카드명·감정명·필요명·영역명·숫자 뒤에 붙는 조사는 반드시 이 함수로만 정합니다(하드코딩·"은(는)" 병기 금지).

const DIGIT_BATCHIM = { "0": true, "1": true, "2": false, "3": true, "4": false, "5": false, "6": true, "7": true, "8": true, "9": false };

export function hasBatchim(word) {
  const ch = String(word).trim().replace(/['"’”)\]]+$/, "").slice(-1);
  if (ch in DIGIT_BATCHIM) return DIGIT_BATCHIM[ch];
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

// "으로/로"는 ㄹ받침 뒤에서 "로"가 맞으므로 별도 처리합니다(예: "물결로", "서재로"는 받침 있음이지만 ㄹ).
export function hasRieulBatchim(word) {
  const ch = String(word).trim().replace(/['"’”)\]]+$/, "").slice(-1);
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return ch === "1" || ch === "7" || ch === "8"; // 일·칠·팔
  return (code - 0xac00) % 28 === 8;
}

export function josa(word, [withBatchim, withoutBatchim]) {
  return hasBatchim(word) ? withBatchim : withoutBatchim;
}

export const EY = (w) => josa(w, ["이에요", "예요"]);
export const EUN_NEUN = (w) => josa(w, ["은", "는"]);
export const EUL_REUL = (w) => josa(w, ["을", "를"]);
export const I_GA = (w) => josa(w, ["이", "가"]);
export const GWA_WA = (w) => josa(w, ["과", "와"]);
export const EURO_RO = (w) => (hasBatchim(w) && !hasRieulBatchim(w) ? "으로" : "로");
export const IRASEO_RASEO = (w) => josa(w, ["이라서", "라서"]);

export function withParen(word, extra, josaFn) {
  return `${word}(${extra})${josaFn(word)}`;
}
