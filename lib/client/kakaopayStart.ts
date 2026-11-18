// 카카오페이 바로 결제(owner 2026-11-18): 주문 만들기 → 서버 카카오페이 준비 → 카카오페이 결제창으로 이동.
// 결과 화면(로그인 상태)과 /checkout(로그인을 막 마치고 온 경우)이 같이 쓴다. 금액은 서버가 정한다.
import { api, claimIfGuest } from "@/lib/client/api";
import { PAY_BUTTON_TERMS_VERSION } from "@/lib/billing/pricing";

type OrderRes = { orderId: string } | { comp: true; sessionId: string };

/** 성공하면 카카오페이로 이동(돌아오지 않음). 무료 열람 계정이면 { comp }. 오류는 ApiError로 던진다. */
export async function startKakaoPay(id: string, page: number, opts: { replace?: boolean } = {}): Promise<{ comp: string } | null> {
  await claimIfGuest(id); // 로그인 없이 본 결과면 먼저 계정에 붙인다(주문은 계정 결과에만)
  const o = await api<OrderRes>(`/api/tarot/session/${id}/checkout`, { body: { withdrawalAck: true, consentVersion: PAY_BUTTON_TERMS_VERSION } });
  if ("comp" in o) return { comp: o.sessionId };
  const r = await api<{ redirectUrl: string }>("/api/tarot/checkout/kakaopay/ready", { body: { orderId: o.orderId, page } });
  if (opts.replace) window.location.replace(r.redirectUrl);
  else window.location.assign(r.redirectUrl);
  return null;
}
