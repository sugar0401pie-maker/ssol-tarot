// 영문판 주문 확인 이메일(기획 docs/policies/en/08_on-screen-texts.md 4장 — EU·UK 소비자법상 청약철회 포기 확인을
// 남는 매체로 보내야 한다, 결제 직후 자동). 쏠 아스트로 하우스 lib/billing/orderEmailEn.ts를 그대로 옮기고
// 상품 이름·가격·주소만 타로 것으로(08 문서: "Your SSOL Tarot House full report — order confirmation", "Full tarot report · US$1.99").
// 08 문서대로 고민 글·카드 해석은 넣지 않는다 — 카드 그림·카드 이름(공유 카드와 같은 범위)과 주문 내역만.
export const ORDER_SUPPORT = "contact@ssolwellness.com";
const SITE = "https://en.tarot.ssolwellnesshouse.com"; // 영문 사이트(2026-11-08 분리)

export interface OrderMailInput {
  orderId: string;
  paidAt: Date;
  /** 토스가 돌려준 결제수단("카드", "해외간편결제" 등) */
  method: string | null;
  resultId: string | null;
  /** 세 번째 카드(앞으로의 열쇠) 그림 jpg 절대 주소 — 카카오 공유 카드와 같은 그림. 없으면 그림 없이 */
  imageUrl?: string | null;
  /** 세 번째 카드 영문 이름(그림 아래 한 줄) */
  cardName?: string | null;
  nickname?: string | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function formatPaidAt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
export function methodLabel(m: string | null): string {
  if (!m) return "card or PayPal";
  if (m.includes("카드") || /card/i.test(m)) return "card";
  if (m.includes("해외간편") || /paypal|foreign/i.test(m)) return "PayPal";
  return "card or PayPal";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function buildOrderEmailEn(m: OrderMailInput): { subject: string; text: string; html: string } {
  const subject = "Your SSOL Tarot House full report — order confirmation";
  const body = `Thanks for your order. Order no. ${m.orderId} · Full tarot report · US$1.99, one-time payment, no renewal · Paid on ${formatPaidAt(m.paidAt)} with ${methodLabel(m.method)}.`;
  const waiver = "Before paying, you asked us to deliver your report right away and acknowledged that you lose your right to cancel once it is shown to you.";
  const seller = `Seller: SSOL Wellness House · 572-07-03549 · Room 408, 4F, 100 Dongmak-ro, Mapo-gu, Seoul · ${ORDER_SUPPORT} · Contact number +82-10-2835-2263`;
  const terms = `${SITE}/en/legal#terms`;
  const refund = `${SITE}/en/legal#refund`;
  // 결제 직후 세 번째 카드가 열리는 4쪽으로
  const report = m.resultId ? `${SITE}/en/result/${m.resultId}/4?utm_source=email&utm_medium=order_mail` : null;
  const text = [body, "", waiver, "", ...(report ? [`Open your report: ${report}`, ""] : []), seller, `Terms of Use: ${terms}`, `Refund Policy: ${refund}`].join("\n");

  // 아스트로와 같은 모양: 남색 머리띠 → 카드 그림 → 주문 내역 표 → 철회권 확인 상자 → 버튼 → 판매자 줄.
  // 메일 앱 호환을 위해 표(table)와 인라인 스타일만 쓴다. 문장 자체는 08 §4 그대로(위 body·waiver를 칸으로 나눠 보여 줄 뿐).
  const row = (k: string, v: string) =>
    `<tr><td style="padding:9px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #eee4cf;width:38%">${esc(k)}</td><td style="padding:9px 0;color:#013566;font-size:14px;font-weight:600;border-bottom:1px solid #eee4cf;text-align:right">${esc(v)}</td></tr>`;
  const hello = m.nickname ? `${m.nickname}, thanks for your order.` : "Thanks for your order.";
  const html = `<div style="background:#f4efe3;padding:24px 12px;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FDF6E9;border:1px solid #e6dcc6;border-radius:18px;overflow:hidden">
<tr><td style="background:#013566;padding:18px 22px;text-align:center">
<p style="margin:0;font-size:11px;letter-spacing:3px;color:#CBB27A">SSOL TAROT HOUSE</p>
<p style="margin:6px 0 0;font-size:20px;color:#FDF6E9">Order confirmation</p>
</td></tr>
${m.imageUrl ? `<tr><td style="padding:0"><img src="${esc(m.imageUrl)}" alt="${esc(m.cardName ?? "Tarot card")} artwork" width="520" style="display:block;width:100%;height:auto;border:0"></td></tr>` : ""}
<tr><td style="padding:20px 22px 6px;font-family:Arial,Helvetica,sans-serif">
${m.cardName ? `<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#9a8455">${esc(m.cardName.toUpperCase())} · THE KEY AHEAD</p>` : ""}
<p style="margin:0 0 14px;font-size:17px;color:#013566;font-family:Georgia,'Times New Roman',serif">${esc(hello)} Your full tarot report is unlocked.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("Order no.", m.orderId)}
${row("Item", "Full tarot report")}
${row("Amount", "US$1.99 · one-time, no renewal")}
${row("Paid on", formatPaidAt(m.paidAt))}
${row("Method", methodLabel(m.method))}
</table>
<div style="margin:18px 0 0;padding:12px 14px;background:#f1e8d4;border-left:3px solid #CBB27A;border-radius:8px;font-size:13px;line-height:1.6;color:#3b4660">${esc(waiver)}</div>
${report ? `<p style="text-align:center;margin:22px 0 6px"><a href="${esc(report)}" style="display:inline-block;background:#013566;color:#FDF6E9;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:999px;font-size:15px">Open your report</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 22px 20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#7a8597;border-top:1px solid #eee4cf">
${esc(seller)}<br><a href="${terms}" style="color:#013566">Terms of Use</a> · <a href="${refund}" style="color:#013566">Refund Policy</a>
</td></tr>
</table>
</div>`;
  return { subject, text, html };
}

export const isEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
