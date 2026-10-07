// 고민 분류 AI 응답을 검사하는 순수 함수(네트워크 없음 → 단위 테스트 가능).
// 코드값 검사는 패키지 원본 validateClassification(lib/tarot/selectCards.js)을 그대로 쓴다.
import { validateClassification } from "../tarot/selectCards.js";

export type CrisisLevel = "none" | "watch" | "urgent";

export type Classification = {
  domain: string;
  emotions: string[];
  need: string;
  self_focus: boolean;
  crisis_level: CrisisLevel;
  violence: boolean;
  off_topic: boolean;
  confidence: number | null;
};

const LEVELS: CrisisLevel[] = ["none", "watch", "urgent"];

// 응답 문자열 → 분류값. 형식·코드값이 하나라도 틀리면 null(호출한 쪽이 1회 재시도 후 미작성 모드로 처리).
// crisis_level이 없거나 이상한 값이면 분류 전체를 실패로 본다 — 안전 판단이 빠진 결과를 "none"으로
// 받아들이지 않기 위해서다(이 경우에도 서버 키워드 결과는 그대로 살아 있다).
export function parseClassification(raw: string, data: unknown): Classification | null {
  let obj: Record<string, unknown>;
  try {
    const cleaned = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  if (validateClassification(obj, data).length) return null;
  if (!LEVELS.includes(obj.crisis_level as CrisisLevel)) return null;
  if (typeof obj.violence !== "boolean") return null;
  return {
    domain: obj.domain as string,
    emotions: obj.emotions as string[],
    need: obj.need as string,
    self_focus: obj.self_focus === true,
    crisis_level: obj.crisis_level as CrisisLevel,
    violence: obj.violence,
    off_topic: obj.off_topic === true,
    confidence: typeof obj.confidence === "number" ? obj.confidence : null,
  };
}

// 결과 조립에 넘길 분류값. off_topic(장난·의미 없는 글)이면 "~에 대한 고민으로 읽혔어요"라고 단정하지 않도록
// 미작성 모드처럼 조립한다(null).
export function classificationForReport(cls: Classification | null): Classification | null {
  if (!cls || cls.off_topic) return null;
  return cls;
}
