// 카카오페이 바로 결제(owner 2026-11-18): 주문 만들기 → 서버 카카오페이 준비 → 카카오페이 결제창으로 이동.
// 결과 화면과 /checkout이 같이 쓴다. 로그인 없이도 된다(결과 접근 키). 금액은 서버가 정한다.
import { api, claimIfGuest, loadKey } from "@/lib/client/api";
import { PAY_BUTTON_TERMS_VERSION } from "@/lib/billing/pricing";

type OrderRes = { orderId: string } | { comp: true; sessionId: string };

/** 성공하면 카카오페이로 이동(돌아오지 않음). 무료 열람 계정이면 { comp }. 오류는 ApiError로 던진다. */
export async function startKakaoPay(id: string, page: number, opts: { replace?: boolean } = {}): Promise<{ comp: string } | null> {
  // 로그인돼 있으면 이 브라우저의 결과를 먼저 계정에 붙이고, 아니면 결과 접근 키로 로그인 없이 결제(owner 2026-11-18)
  await claimIfGuest(id);
  const key = loadKey(id);
  const o = await api<OrderRes>(`/api/tarot/session/${id}/checkout`, { key, body: { withdrawalAck: true, consentVersion: PAY_BUTTON_TERMS_VERSION } });
  if ("comp" in o) return { comp: o.sessionId };
  const r = await api<{ redirectUrl: string }>("/api/tarot/checkout/kakaopay/ready", { key, body: { orderId: o.orderId, page } });
  if (opts.replace) window.location.replace(r.redirectUrl);
  else window.location.assign(r.redirectUrl);
  return null;
}
