/* eslint-disable @typescript-eslint/no-explicit-any */
// 세 번째 카드(앞으로의 열쇠)는 결제 뒤에 공개(owner 2026-11-02 "3번째 카드부터 시크릿").
// 패키지가 만든 10쪽(1 세 장 · 2~4 카드 · 5~10)을 화면 순서로 바꾼다:
//   1 첫 번째 카드(+ 안내 문단) · 2 두 번째 카드 · 3 오늘 당신에게 온 세 장(고민 풀어보기) · 4 세 번째 카드 · 5~10 그대로
// 결제 전에는 4쪽이 뒷면 카드 + 결제 상자, 5쪽도 잠금(5쪽 무료 글은 세 번째 카드를 알고 쓴 글이라 결제 전에는 보내지 않는다).
// 순수 함수(네트워크 없음) — 결제 전 응답에 세 번째 카드가 새지 않는지 테스트로 확인한다(secretThird.test.ts).
import { josa } from "../tarot/josa.js";
import { cleanOption } from "../tarot/decision.js";
import { twoCardGist, twoCardChange } from "./cardGist.ts";
import { midResult, type MidDb } from "./midResult.ts";

export type SecretCopy = {
  intro: string; worry_title: string; two_title: string; same: string; split: string; general: string;
  next_button: string; p4_title: string; p4_options: string; p4_general: string; change_leads?: string[];
  // v2.3.4(v4.3): 원문 질문만 있을 때 4쪽 예고, 4쪽 결제 버튼, 결제하면 뒤집힌다는 안내
  p4_question?: string; p4_cta?: string; p4_after_pay_note?: string;
};
type Card = { reversed?: boolean; positionName: string; card: { name: string; no?: number } };
type LeanLike = { option?: string; cards?: { option?: string; reason?: string | null }[] } | null | undefined;
type FrameLike = { options?: string[] | null; options_ranked?: string[] | null; core_question?: string | null; forecast?: boolean; area?: string | null } | null | undefined;

// 이름 자리는 {name}(패키지 v2.3.2부터)과 예전 {nickname} 둘 다 받는다.
const fill = (t: string, v: Record<string, string>) => {
  const vv = "name" in v && !("nickname" in v) ? { ...v, nickname: v.name } : v;
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in vv ? vv[k] : m));
};

/** ‘A’와 ‘B’ / ‘A’, ‘B’와 ‘C’ — 선택지가 2개 이상일 때만, 아니면 null */
export function optionsAnd(options: string[]): string | null {
  const o = options.map(cleanOption).filter(Boolean);
  if (o.length < 2) return null;
  const q = (x: string) => `‘${x}’`;
  const head = o.slice(0, -1).map(q);
  const lastPrev = o[o.length - 2];
  return `${head.join(", ")}${josa(lastPrev, ["과", "와"])} ${q(o[o.length - 1])}`;
}
/** ‘A / B’ */
export function optionsSlash(options: string[]): string | null {
  const o = options.map(cleanOption).filter(Boolean);
  return o.length >= 2 ? `‘${o.join(" / ")}’` : null;
}

/** 3쪽(고민 풀어보기) 본문 줄글 — pageBlocks 규칙: "### " 큰 소제목 · "!! " 첫 문장 굵게(남색) 문단 · "◦ " 목록 */
export function worryPageBody({ name, oldPage1, reading: reading0, frame, lean, picks, copy, frameTitle, mid = null, domain = null, teaser = null, areaPhrase = null, pageTitle = null }: {
  name: string; oldPage1: string; reading: string; frame: FrameLike; lean: LeanLike; picks: Card[]; copy: SecretCopy; frameTitle: string;
  mid?: MidDb | null; domain?: string | null; teaser?: string | null; areaPhrase?: string | null; pageTitle?: string | null;
}): string {
  const chunks = String(oldPage1 || "").split(/\n\s*\n/);
  const strip = chunks.find((c) => c.trim().startsWith("[카드 이미지")) ?? null;
  // 고민 틀 상자("이번 고민에서 끝까지 함께 볼 것" + ◦ 선택지·결국 묻는 것·기한) — 패키지가 1쪽에 넣은 것을 그대로 옮긴다
  let box = chunks.find((c) => c.trim().startsWith(frameTitle)) ?? null;
  // v4.3 예측 질문이면 '될 흐름 / 어려운 흐름' 선택지 줄은 보이지 않는다(패키지 buildPagesV43과 같음)
  if (box && frame?.forecast) box = box.split("\n").filter((x) => !x.trim().startsWith("◦ 선택지")).join("\n");
  // v4.3: 취업·시험 등 세부 영역이면 고민 읽기 문장의 영역 이름을 바꾼다(data copy.result.v43.area_phrases — 패키지와 같은 바꾸기)
  const reading = areaPhrase
    ? reading0.replace(/진로와 자기계발에 대한 고민|직업과 커리어에 대한 고민|나 자신과 삶의 방향에 대한 고민/, areaPhrase).replace(/고민(으로|로) 읽혔/, "고민으로 읽혔")
    : reading0;
  const m = reading.match(/^(.+?[.?!])\s+([\s\S]+)$/);
  const lead = m ? `!! **${m[1]}** ${m[2]}` : `!! **${reading}**`;
  const out: string[] = [];
  // 카드 줄 표시(화면은 응답의 cards로 그림) — 패키지 줄에는 카드 그림 파일 이름이 들어 있어 세 번째 카드가 새므로 표시만 남긴다
  if (strip) out.push("[카드 이미지 3장]");
  // v2.3.2부터 쪽 제목(h1)이 곧 '{name}님의 고민 풀어보기'라 같은 말이면 본문 소제목은 겹쳐 쓰지 않는다.
  const heading = fill(copy.worry_title, { name });
  if (heading !== pageTitle) out.push(`### ${heading}`);
  out.push(lead);
  if (box) out.push(box.trim());
  const two = (lean?.cards ?? []).slice(0, 2);
  // v4.3 예측 질문(선택지가 '될 흐름 / 어려운 흐름')이면 선택지를 화면에 보이지 않는다(패키지 buildPagesV43과 같음).
  const options = frame?.forecast ? null : optionsAnd(frame?.options ?? []);
  // 선택지 문단(same·split)이 아닌 '답은 아직…' 문단 뒤에는 듣고 싶은 답에 맞춘 예고 한 문장(v43.teaserLine)
  const generalLine = teaser ? `${copy.general} ${teaser}` : copy.general;
  // 두 장 중간 결과(owner 2026-11-02 문장 DB) — 카드별 이유 목록(◦ … ‘선택지’ 쪽을 가리켜요) 대신. 고민 미작성(NONE)에도 나온다.
  const midParas = mid ? midResult(mid, domain, picks) : null;
  if (lean && two.length === 2 && two.every((c) => c?.reason)) {
    // 제목 → 중간 결과(그동안·지금은 / 가로막아 온 것) → 전환 문장("그러는 한편, 카드는 앞으로 …" + 두 장의 뜻) → "하지만 답은 아직…"(owner 2026-11-02)
    // 중간 결과를 못 찾으면 예전 순서(종합 문장 → 카드별 목록)
    const gist = twoCardGist(lean);
    out.push(`**${copy.two_title}**`);
    if (midParas) {
      out.push(...midParas);
      const change = twoCardChange(lean, copy.change_leads ?? []);
      // 전환 문장만 굵게 + 남색, 두 장의 뜻(뒤 문장)은 보통 글씨(owner 2026-11-02)
      const lead = change ? (copy.change_leads ?? []).find((l) => change.startsWith(`${l} `)) : undefined;
      if (change && lead) out.push(`!! **${lead}** ${change.slice(lead.length + 1)}`);
      else if (gist) out.push(`!! **${gist}**`);
    } else {
      if (gist) out.push(`!! **${gist}**`);
      out.push(two.map((c, i) => `◦ ${picks[i].positionName} ‘${picks[i].card.name}’${picks[i].reversed ? "(역방향)" : ""} — ${c.reason}`).join("\n"));
    }
    const same = two[0].option === two[1].option;
    out.push(keyLine(same && options ? fill(copy.same, { options }) : same ? generalLine : copy.split));
  } else {
    if (midParas) out.push(`**${copy.two_title}**`, ...midParas);
    out.push(keyLine(generalLine));
  }
  return out.join("\n\n");
}

/** "세 번째 카드는 앞으로의 열쇠예요." 문장만 굵게 + 남색(owner 2026-11-02) — "!! " 문단은 굵은 글씨를 남색으로 그린다 */
export const KEY_SENTENCE = "세 번째 카드는 앞으로의 열쇠예요.";
export function keyLine(text: string): string {
  return text.includes(KEY_SENTENCE) ? `!! ${text.replace(KEY_SENTENCE, `**${KEY_SENTENCE}**`)}` : text;
}

export function secretThird(pages: any[], { paid, name, reading, frame, lean, picks, copy, frameTitle, teaser5 = null, mid = null, domain = null, teaser = null, areaPhrase = null }: {
  paid: boolean; name: string; reading: string; frame: FrameLike; lean: LeanLike; picks: Card[]; copy: SecretCopy; frameTitle: string; teaser5?: string | null;
  mid?: MidDb | null; domain?: string | null; teaser?: string | null; areaPhrase?: string | null;
}): any[] {
  const by = (n: number) => pages.find((p) => p.page === n);
  const [p1, p2, p3, p4] = [by(1), by(2), by(3), by(4)];
  if (!p1 || !p2 || !p3 || !p4 || !p2.card) return pages; // 예상과 다른 모양이면 손대지 않는다
  const rest = pages.filter((p) => p.page >= 5);
  const back = p2.back ?? p3.back;
  const next = p2.next;
  const first = { ...p2, page: 1, back: null, intro: fill(copy.intro, { name }) };
  const second = { ...p3, page: 2, back };
  const worry = {
    page: 3, title: p1.title, access: "무료", back, next: copy.next_button,
    body: worryPageBody({ name, oldPage1: p1.body, reading, frame, lean, picks, copy, frameTitle, mid, domain, teaser, areaPhrase, pageTitle: p1.title }),
  };
  const slash = frame?.forecast ? null : optionsSlash(frame?.options ?? []);
  const opts = (frame?.options ?? []).map(cleanOption).filter(Boolean);
  const q = String(frame?.core_question ?? "").trim();
  // 4쪽 예고(v2.3.2): 선택지 → p4_options, 원문 질문만 → p4_question, 둘 다 없음 → p4_general
  const teaser4 = slash
    ? fill(copy.p4_options, { name, options: slash, a: opts[0] ?? "", b: opts[1] ?? "" })
    : q && copy.p4_question ? fill(copy.p4_question, { name, q }) : fill(copy.p4_general, { name });
  const fourth = paid
    ? { ...p4, page: 4, back }
    : {
        page: 4, title: p4.title, access: "유료", back, next: p4.next ?? next, secret: true,
        teaser: teaser4, note: copy.p4_after_pay_note ?? null,
      };
  const five = rest.map((p) =>
    // 5쪽 무료 글(메인 문구·첫 줄·종합 문장)은 세 장을 다 보고 쓴 글이라 결제 전에는 다른 잠긴 쪽처럼 예고만 보낸다
    !paid && p.page === 5 ? { page: 5, title: p.title, access: "유료", back: p.back, next: p.next, teaser: p.teaser ?? teaser5, blur: p.blur ?? null } : p,
  );
  return [first, second, worry, fourth, ...five];
}
