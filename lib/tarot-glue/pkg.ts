// 언어별 패키지 코드 고르기(영문판 2026-11-06). 한국어 = lib/tarot(원본 패키지), 영어 = lib/tarot-en(사람이 읽는 글·검사만 영어로 옮긴 것).
// locale을 안 주면 한국어 — 기존 한국어 결과는 그대로.
import * as decisionKo from "../tarot/decision.js";
import * as assembleKo from "../tarot/assembleReport.js";
import * as pagesKo from "../tarot/pagesV4.js";
import * as validateKo from "../tarot/validateV4.js";
import * as decisionEn from "../tarot-en/decision.js";
import * as assembleEn from "../tarot-en/assembleReport.js";
import * as pagesEn from "../tarot-en/pagesV4.js";
import * as validateEn from "../tarot-en/validateV4.js";
import type { Locale } from "../i18n/locale.ts";

const KO = { decision: decisionKo, assemble: assembleKo, pages: pagesKo, validate: validateKo };
const EN = { decision: decisionEn, assemble: assembleEn, pages: pagesEn, validate: validateEn } as unknown as typeof KO;
export const pkg = (locale?: Locale | null) => (locale === "en" ? EN : KO);
