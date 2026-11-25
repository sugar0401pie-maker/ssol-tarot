// X(트위터) 전환 API — 결제 완료(owner 2026-11-25). 순수 함수만(서버 전송은 lib/server/xCapi.ts).
// 보내는 것: 결제 시각·이벤트 ID·주문 번호(conversion_id — 브라우저 픽셀 이벤트와 같은 값으로 중복 제거)·금액·통화와
// 광고 클릭 식별자(twclid) 또는 접속 IP·브라우저 정보. 이메일·전화번호·고민 글·닉네임은 보내지 않는다(개인정보처리방침 X 항목과 같음).

export const X_PIXEL_ID_DEFAULT = "rk3w9";

/** 결제 완료 이벤트 ID — owner가 준 X 이벤트 코드의 'tw-rk3w9-rk7qr'(2026-11-25)를 기본값으로. 비밀값이 아니다.
 *  Vercel 환경 변수 NEXT_PUBLIC_X_PURCHASE_EVENT_ID가 있으면 그 값이 우선. 브라우저 픽셀과 서버가 같은 값을 쓴다. */
export const X_PURCHASE_EVENT_ID_DEFAULT = "tw-rk3w9-rk7qr";
export function xPurchaseEventId(): string | null {
  const v = (process.env.NEXT_PUBLIC_X_PURCHASE_EVENT_ID || X_PURCHASE_EVENT_ID_DEFAULT).trim();
  return /^tw-[a-z0-9]+-[a-z0-9]+$/i.test(v) ? v : null;
}

/** X 픽셀이 심는 _twclid 쿠키 값에서 클릭 식별자만 꺼낸다(JSON {"twclid":…} 또는 값 그대로). */
export function parseTwclid(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|;\s*)_twclid=([^;]*)/);
  if (!m) return null;
  let raw = m[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* 그대로 */
  }
  try {
    const j = JSON.parse(raw) as { twclid?: unknown };
    if (j && typeof j.twclid === "string") raw = j.twclid;
  } catch {
    /* JSON이 아니면 값 그대로 */
  }
  return /^[A-Za-z0-9_-]{6,200}$/.test(raw) ? raw : null;
}

/** 요청의 첫 번째 접속 IP(Vercel x-forwarded-for). 형식이 이상하면 null. */
export function clientIp(forwardedFor: string | null | undefined): string | null {
  const ip = (forwardedFor || "").split(",")[0]?.trim() || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

export type XPurchase = {
  eventId: string;
  orderId: string;
  amount: number; // 원화 정수(또는 달러 표시 금액)
  currency: "KRW" | "USD";
  time: Date;
  twclid?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** 보낼 본문. 식별자가 하나도 없으면(twclid도, IP+브라우저도 없음) null — X가 받지 않으므로 보내지 않는다. */
export function buildXConversionBody(p: XPurchase): Record<string, unknown> | null {
  const id: Record<string, string> = {};
  if (p.twclid) id.twclid = p.twclid;
  const ua = (p.userAgent || "").slice(0, 512);
  if (p.ip && ua) {
    id.ip_address = p.ip;
    id.user_agent = ua;
  }
  if (Object.keys(id).length === 0) return null;
  return {
    conversions: [
      {
        conversion_time: p.time.toISOString(),
        event_id: p.eventId,
        conversion_id: p.orderId,
        value: p.amount,
        price_currency: p.currency,
        number_items: 1,
        identifiers: [id],
      },
    ],
  };
}
