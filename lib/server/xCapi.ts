import "server-only";
import { X_PIXEL_ID_DEFAULT, buildXConversionBody, clientIp, parseTwclid, xPurchaseEventId } from "@/lib/billing/xConversion";

// X 전환 API로 결제 완료 보내기(owner 2026-11-25, 한국어 사이트). 결제 확인 라우트가 응답 뒤(after)에 부른다.
// 토큰은 Vercel 환경 변수 X_CAPI_TOKEN에만(코드·로그에 넣지 않음). 토큰이나 이벤트 ID가 없으면 아무것도 안 보낸다.
// 실패해도 결제·리포트에는 영향 없음 — 로그에는 상태 코드만(주문 번호·IP·쿠키는 남기지 않음).
export async function sendXPurchase(req: Request, order: { orderId: string; amount: number; currency: "KRW" | "USD" }) {
  const token = (process.env.X_CAPI_TOKEN || "").trim();
  const eventId = xPurchaseEventId();
  if (!token || !eventId) return;
  const pixel = (process.env.NEXT_PUBLIC_X_PIXEL_ID || X_PIXEL_ID_DEFAULT).trim();
  const body = buildXConversionBody({
    eventId,
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
    time: new Date(),
    twclid: parseTwclid(req.headers.get("cookie")),
    ip: clientIp(req.headers.get("x-forwarded-for")),
    userAgent: req.headers.get("user-agent"),
  });
  if (!body) return;
  try {
    const res = await fetch(`https://ads-api.x.com/12/measurement/conversions/${encodeURIComponent(pixel)}`, {
      method: "POST",
      headers: { "X-Pixel-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn("X 전환 API 실패:", res.status);
  } catch {
    console.warn("X 전환 API 호출 실패(네트워크)");
  }
}
