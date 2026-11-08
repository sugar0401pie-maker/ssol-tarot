// 언어별 데이터 묶음(문장 DB·점수표·중간 결과 DB). 서버·순수 함수가 세션의 locale로 고른다.
// 한국어는 기존 data/*.json, 영어는 data/en/*.json(기획 전달본 — 손으로 고치지 않는다, 기획 파일로만 교체).
// 브라우저로는 이 파일을 보내지 않는다(유료 DB 문장 포함) — 화면 문구는 lib/server/clientData.ts가 골라서 넘긴다.
import ko from "../../data/tarot_data.json" with { type: "json" };
import koTables from "../../data/decision_tables.json" with { type: "json" };
import koMid from "../../data/mid_result_db.json" with { type: "json" };
import en from "../../data/en/tarot_data.json" with { type: "json" };
import enTables from "../../data/en/decision_tables.json" with { type: "json" };
import enMid from "../../data/en/mid_result_db.json" with { type: "json" };
import type { Locale } from "./locale.ts";
import { EN_INTERIM_COPY, fillMissing } from "./enInterim.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Bundle = { locale: Locale; data: typeof ko; tables: typeof koTables; midDb: typeof koMid };

const KO: Bundle = { locale: "ko", data: ko, tables: koTables, midDb: koMid };
// 영어 데이터는 같은 키 구조(값만 영어) — 타입은 한국어 것을 쓴다(영어에만 있는 키는 any로 읽음).
// 영어 데이터에 아직 없는 화면 문구는 임시 문구(enInterim.ts)로 채운다 — 데이터 값이 있으면 데이터가 이긴다.
// 영문 카드 그림(owner 2026-11-08): public/images/tarot/en/ 아래 같은 파일 이름 — 데이터는 고치지 않고 여기서 경로만 바꾼다.
// 결과 화면·뽑기·내 결과·인트로·주문 메일이 모두 card.image.file로 그림을 고르므로 이 한 곳이면 된다.
export const EN_ART_DIR = "en/";
const enCards = (en as any).cards.map((c: any) => ({ ...c, image: { ...c.image, file: EN_ART_DIR + c.image.file } }));
const EN: Bundle = { locale: "en", data: { ...(en as any), cards: enCards, copy: fillMissing((en as any).copy, EN_INTERIM_COPY) }, tables: enTables as any, midDb: enMid as any };

export function bundleFor(locale: Locale): Bundle {
  return locale === "en" ? EN : KO;
}
export { KO as KO_BUNDLE, EN as EN_BUNDLE };

/** 고민 글자 수 제한(한국어 10~300, 영어 20~600 — owner 2026-11-05 "외국인은 최대 600자"). 데이터 copy.worry 값. */
export function worryLimits(locale: Locale): { min: number; max: number } {
  const w = bundleFor(locale).data.copy.worry as any;
  return { min: Number(w.min_len) || 10, max: Number(w.max_len) || 300 };
}
