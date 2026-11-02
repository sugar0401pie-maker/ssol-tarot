/* eslint-disable @typescript-eslint/no-explicit-any */
// 세 번째 카드(앞으로의 열쇠)는 결제 뒤에 공개(owner 2026-11-02 "3번째 카드부터 시크릿").
// 패키지가 만든 10쪽(1 세 장 · 2~4 카드 · 5~10)을 화면 순서로 바꾼다:
//   1 첫 번째 카드(+ 안내 문단) · 2 두 번째 카드 · 3 오늘 당신에게 온 세 장(고민 풀어보기) · 4 세 번째 카드 · 5~10 그대로
// 결제 전에는 4쪽이 뒷면 카드 + 결제 상자, 5쪽도 잠금(5쪽 무료 글은 세 번째 카드를 알고 쓴 글이라 결제 전에는 보내지 않는다).
// 순수 함수(네트워크 없음) — 결제 전 응답에 세 번째 카드가 새지 않는지 테스트로 확인한다(secretThird.test.ts).
import { josa } from "../tarot/josa.js";
import { cleanOption } from "../tarot/decision.js";

export type SecretCopy = {
  intro: string; worry_title: string; two_title: string; same: string; split: string; general: string;
  next_button: string; p4_title: string; p4_options: string; p4_general: string;
};
type Card = { reversed?: boolean; positionName: string; card: { name: string } };
type LeanLike = { option?: string; cards?: { option?: string; reason?: string | null }[] } | null | undefined;
type FrameLike = { options?: string[] | null } | null | undefined;

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

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
export function worryPageBody({ name, oldPage1, reading, frame, lean, picks, copy, frameTitle }: {
  name: string; oldPage1: string; reading: string; frame: FrameLike; lean: LeanLike; picks: Card[]; copy: SecretCopy; frameTitle: string;
}): string {
  const chunks = String(oldPage1 || "").split(/\n\s*\n/);
  const strip = chunks.find((c) => c.trim().startsWith("[카드 이미지")) ?? null;
  // 고민 틀 상자("이번 고민에서 끝까지 함께 볼 것" + ◦ 선택지·결국 묻는 것·기한) — 패키지가 1쪽에 넣은 것을 그대로 옮긴다
  const box = chunks.find((c) => c.trim().startsWith(frameTitle)) ?? null;
  const m = reading.match(/^(.+?[.?!])\s+([\s\S]+)$/);
  const lead = m ? `!! **${m[1]}** ${m[2]}` : `!! **${reading}**`;
  const out: string[] = [];
  // 카드 줄 표시(화면은 응답의 cards로 그림) — 패키지 줄에는 카드 그림 파일 이름이 들어 있어 세 번째 카드가 새므로 표시만 남긴다
  if (strip) out.push("[카드 이미지 3장]");
  out.push(`### ${fill(copy.worry_title, { nickname: name })}`, lead);
  if (box) out.push(box.trim());
  const two = (lean?.cards ?? []).slice(0, 2);
  const options = optionsAnd(frame?.options ?? []);
  if (lean && two.length === 2 && two.every((c) => c?.reason)) {
    const lines = two.map((c, i) => {
      const p = picks[i];
      return `◦ ${p.positionName} ‘${p.card.name}’${p.reversed ? "(역방향)" : ""} — ${c.reason}`;
    });
    out.push([`**${copy.two_title}**`, ...lines].join("\n"));
    const same = two[0].option === two[1].option;
    out.push(same && options ? fill(copy.same, { options }) : same ? copy.general : copy.split);
  } else {
    out.push(copy.general);
  }
  return out.join("\n\n");
}

export function secretThird(pages: any[], { paid, name, reading, frame, lean, picks, copy, frameTitle, teaser5 = null }: {
  paid: boolean; name: string; reading: string; frame: FrameLike; lean: LeanLike; picks: Card[]; copy: SecretCopy; frameTitle: string; teaser5?: string | null;
}): any[] {
  const by = (n: number) => pages.find((p) => p.page === n);
  const [p1, p2, p3, p4] = [by(1), by(2), by(3), by(4)];
  if (!p1 || !p2 || !p3 || !p4 || !p2.card) return pages; // 예상과 다른 모양이면 손대지 않는다
  const rest = pages.filter((p) => p.page >= 5);
  const back = p2.back ?? p3.back;
  const next = p2.next;
  const first = { ...p2, page: 1, back: null, intro: fill(copy.intro, { nickname: name }) };
  const second = { ...p3, page: 2, back };
  const worry = {
    page: 3, title: p1.title, access: "무료", back, next: copy.next_button,
    body: worryPageBody({ name, oldPage1: p1.body, reading, frame, lean, picks, copy, frameTitle }),
  };
  const slash = optionsSlash(frame?.options ?? []);
  const fourth = paid
    ? { ...p4, page: 4, back }
    : {
        page: 4, title: p4.title, access: "유료", back, next: p4.next ?? next, secret: true,
        teaser: slash ? fill(copy.p4_options, { nickname: name, options: slash }) : fill(copy.p4_general, { nickname: name }),
      };
  const five = rest.map((p) =>
    // 5쪽 무료 글(메인 문구·첫 줄·종합 문장)은 세 장을 다 보고 쓴 글이라 결제 전에는 다른 잠긴 쪽처럼 예고만 보낸다
    !paid && p.page === 5 ? { page: 5, title: p.title, access: "유료", back: p.back, next: p.next, teaser: p.teaser ?? teaser5, blur: p.blur ?? null } : p,
  );
  return [first, second, worry, fourth, ...five];
}
