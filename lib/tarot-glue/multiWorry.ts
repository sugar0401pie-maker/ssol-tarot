// v2.3.21 여러 고민을 한꺼번에 썼을 때 뽑기 전에 하나를 고르게 함 — 서버·화면이 같이 쓰는 순수 부분(AI 호출 없음).
//   데이터: data/multi_worry.json(패키지 그대로, 문구는 CSO·Claude 초안 — CSO 검수 전). 한국어판만.
//   고른 답은 따로 저장하지 않는다: 저장된 고민 글로 detectMulti를 다시 돌리면 같은 선택지가 나오므로(결정적) 선택 id만 검사한다.
import { detectMulti, type MultiDetect } from "../tarot/multiWorry.js";
import mw from "../../data/multi_worry.json" with { type: "json" };

export const MULTI_DB = mw;

/** 이 고민에 '어느 고민으로 뽑을까요?'를 물을지. 위기 글·영문판·빈 글은 묻지 않는다. */
export function multiFor(worry: string | null | undefined, { urgent, locale }: { urgent: boolean; locale: string }): MultiDetect | null {
  if (locale !== "ko" || !worry) return null;
  const d = detectMulti(worry, MULTI_DB, { urgent });
  return d.ask ? d : null;
}

/** 화면이 보낸 선택 id가 이 고민의 선택지(또는 '모두 이어진 한 가지')인지. 아니면 null(= 고르지 않은 것으로). */
export function checkChoice(detect: MultiDetect | null, raw: unknown): string | null {
  if (!detect || typeof raw !== "string") return null;
  if (raw === MULTI_DB.linked.id) return raw;
  return detect.options.some((o) => o.key === raw) ? raw : null;
}
