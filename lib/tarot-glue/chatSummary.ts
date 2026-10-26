// 쏘웰라(app.ssolwellnesshouse.com) 채팅이 참고할 타로 결과 요약(owner 2026-10-26: "고민 원문 포함 타로 결과 원문 모두 쏘웰라에 넘기게").
// 쏠 아스트로 하우스의 astro_results.chat_summary와 같은 모양 — 한 줄에 한 섹션, "[제목] 본문". 쏘웰라는 이 문자열을 읽기만 한다.
// 화면으로 보내는 것과 같은 걸러진 쪽(sanitizeUnpaid/sanitizePaid 결과)만 받는다 — 결제 전이면 유료 본문은 애초에 없다.
// 길이 상한 6,000자(owner 승인: 쏘웰라 대화의 메시지마다 들어가므로 비용 상한).
export const CHAT_SUMMARY_MAX = 6000;

type Page = { page?: number; title?: unknown; says?: unknown; question?: unknown; body?: unknown; free?: unknown; fineprint?: unknown };

function flat(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/\[\[|\]\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^[◦•▸]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildChatSummary(pages: Page[], { worryText, nickname, createdAt, paid }: { worryText: string | null; nickname: string | null; createdAt: string; paid: boolean }): string {
  const head = [
    `[고민 원문] ${flat(worryText) || "(고민을 적지 않고 카드를 뽑음)"}`,
    `[결과 정보] 쏠 타로 하우스 · ${createdAt.slice(0, 10)}${nickname ? ` · 닉네임 ${flat(nickname)}` : ""} · ${paid ? "결제한 전체 리포트" : "무료 결과(결제 전 — 5쪽 결론부터는 아직 열지 않음)"}`,
  ];
  const lines = pages
    .map((p) => {
      const text = [p.says, p.question, p.body ?? p.free, p.fineprint].map(flat).filter(Boolean).join(" ");
      return text ? `[${p.page}. ${flat(p.title)}] ${text}` : null;
    })
    .filter((x): x is string => Boolean(x));
  let out = head.join("\n");
  for (const line of lines) {
    const room = CHAT_SUMMARY_MAX - out.length - 1;
    if (room <= 20) break;
    out += "\n" + (line.length <= room ? line : line.slice(0, room - 1) + "…");
  }
  return out;
}
