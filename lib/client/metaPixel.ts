// 메타 픽셀 표준 이벤트 보내기(owner 2026-11-16). 픽셀이 없으면(ID 없음·차단) 아무것도 하지 않는다.
// 보내는 것: 이벤트 이름 + 금액·통화·콘텐츠 이름뿐(고민 글·닉네임·이메일·카드 이름은 보내지 않음).
// owner가 준 픽셀 ID(2026-11-16 — 광고 계정 1431039370695467 소유 'ssol tarot house'. 예전 tarothouse 1509917721196311은 개인 광고 계정 소속이라 캠페인에 연결 안 돼 교체)를 기본값으로 — Vercel 환경 변수 NEXT_PUBLIC_META_PIXEL_ID가 있으면 그 값이 우선.
export const DEFAULT_META_PIXEL_ID = "28980812814878410";
export function metaPixelId(): string | null {
  const id = (process.env.NEXT_PUBLIC_META_PIXEL_ID || DEFAULT_META_PIXEL_ID).trim();
  return /^\d{6,20}$/.test(id) ? id : null;
}

type Fbq = (cmd: "track", event: string, params?: Record<string, string | number>, opts?: { eventID?: string }) => void;

/** 같은 키(예: 주문 번호)로는 한 번만 보낸다(새로고침·뒤로 가기로 결제 완료가 두 번 세지지 않게). */
export function metaTrack(event: "ViewContent" | "InitiateCheckout" | "Purchase" | "Lead", params: Record<string, string | number> = {}, onceKey?: string) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return;
  if (onceKey) {
    const k = `ssol_meta_${event}_${onceKey}`;
    try {
      if (window.sessionStorage.getItem(k)) return;
      window.sessionStorage.setItem(k, "1");
    } catch {
      /* 저장소를 못 쓰면 그냥 보낸다 */
    }
  }
  try {
    fbq("track", event, params, onceKey ? { eventID: `${event}-${onceKey}` } : undefined);
  } catch {
    /* 광고 측정 실패는 서비스에 영향 없게 */
  }
}
