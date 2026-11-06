"use client";

// 결제 화면(/checkout/{결과}?page=쪽) — 쏠 아스트로 하우스 결제 화면과 같은 흐름:
// 들어오자마자 토스 결제 위젯(결제 수단)을 보여 주고(owner 2026-11-04 "누르면 결제창 보이게"), 이용 약관에 동의한 뒤 [결제하기]를 누르면
// 그때 서버가 주문을 만들고 금액을 정함 → 토스 결제 → 결제가 끝나면 토스가 /checkout/success로 보내고 그 화면이 서버에 승인 확인을 요청한다.
// 주문은 동의한 뒤에만 만든다(주문에 약관 동의 버전을 기록하므로). 위젯 금액은 표시 가격으로 먼저 그리고, 주문 금액이 다르면 결제 직전에 맞춘다. 가짜 카운트다운·"지금만 할인" 같은 문구는 쓰지 않는다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, claimIfGuest } from "@/lib/client/api";
import { getRealSession } from "@/lib/supabase/browser";
import { PROMO_LABEL, REPORT_LIST_PRICE, REPORT_ORDER_NAME, PROMO_REPORT_PRICE, STORAGE_NOTE, TERMS_CHECK_AFTER, TERMS_CHECK_BEFORE, TERMS_CHECK_LINK, won } from "@/lib/billing/pricing";
import { usePromo } from "@/lib/client/usePromo";
import { TERMS_URL } from "@/lib/legal/urls";
import { Stars } from "../Cards";
import PageFoot from "../PageFoot";

// 결제창 키는 서버가 주문 통화(이 화면은 원화)로 골라 준다(/api/tarot/session/{id}/pay-config) — 브라우저에 키를 박아 두지 않는다.
type PayConfig = { currency: "KRW" | "USD"; clientKey: string | null; keyKind: "widget" | "api" | null };

type Order = { orderId: string; orderName: string; amount: number; customerKey: string };
type Widget = Awaited<ReturnType<typeof import("@tosspayments/payment-widget-sdk")["loadPaymentWidget"]>>;
type Methods = ReturnType<Widget["renderPaymentMethods"]>;

export default function CheckoutPage({ id, page }: { id: string; page: number }) {
  const router = useRouter();
  const back = `/result/${id}/${page}`;
  const [checked, setChecked] = useState<boolean | null>(null); // 로그인 확인 중 null
  const [customerKey, setCustomerKey] = useState<string | null>(null); // 서버 주문의 customerKey와 같은 값(로그인 사용자 id)
  const [TOSS_CLIENT_KEY, setClientKey] = useState<string | null | undefined>(undefined); // undefined = 아직 모름
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<Widget | null>(null);
  const methodsRef = useRef<Methods | null>(null);
  // 주문을 만들기 전에도 상품·가격 상자를 먼저 보여 준다(owner 2026-11-02). 표시용 — 실제 청구는 서버 주문 금액.
  const promoState = usePromo();
  const promo = promoState === true;
  const shownAmount = order?.amount ?? (promo ? PROMO_REPORT_PRICE : REPORT_LIST_PRICE);

  // 결제는 로그인한 본인만(결과도 로그인해야 만들 수 있다)
  // 로그인 없이 본 결과(2026-10-26)면 로그인한 지금 이 브라우저의 결과를 먼저 계정에 붙인다 — 주문은 계정 결과에만 만든다.
  useEffect(() => {
    void getRealSession().then(async (s) => {
      if (!s) return router.replace(`/login?next=${encodeURIComponent(`/checkout/${id}?page=${page}`)}`);
      await claimIfGuest(id);
      // 이 결과의 통화·키를 서버에 묻는다. 영문(달러) 결과면 영문 결제 화면으로(원화 상점으로 달러를 요청하지 않게)
      const cfg = await api<PayConfig>(`/api/tarot/session/${id}/pay-config`).catch(() => null);
      if (cfg?.currency === "USD") return router.replace(`/en/checkout/${id}?page=${page}`);
      setClientKey(cfg?.clientKey ?? null);
      setCustomerKey(s.user.id);
      setChecked(true);
    });
  }, [router, id, page]);

  // 결제 수단은 화면에 들어오자마자 그린다(할인 여부를 알고 난 뒤 — 표시 가격으로)
  useEffect(() => {
    if (!checked || !customerKey || promoState === null || !TOSS_CLIENT_KEY || widgetRef.current) return;
    let cancelled = false;
    const amount = promoState ? PROMO_REPORT_PRICE : REPORT_LIST_PRICE;
    void import("@tosspayments/payment-widget-sdk")
      .then(async ({ loadPaymentWidget }) => {
        const widget = await loadPaymentWidget(TOSS_CLIENT_KEY, customerKey);
        if (cancelled) return;
        methodsRef.current = widget.renderPaymentMethods("#toss-payment-methods", amount);
        widget.renderAgreement("#toss-agreement");
        widgetRef.current = widget;
        setReady(true);
      })
      .catch(() => {
        // 토스 결제창을 불러오지 못하면 '준비하는 중…'에서 멈추지 않게 안내(다시 시도는 새로고침)
        if (!cancelled) setError("결제창을 불러오지 못했어요. 인터넷 연결을 확인하고 이 화면을 새로고침해 주세요.");
      });
    return () => {
      cancelled = true;
    };
  }, [checked, customerKey, promoState, TOSS_CLIENT_KEY]);

  async function pay() {
    if (!ack || !widgetRef.current || busy) return;
    setError(null);
    setBusy(true);
    try {
      // 동의한 뒤에야 주문을 만든다 — 금액은 서버가 정한다
      let o = order;
      if (!o) {
        const r = await api<Order | { comp: true; sessionId: string }>(`/api/tarot/session/${id}/checkout`, { body: { withdrawalAck: true } });
        // 기간 한정 무료 열람 계정: 결제창 없이 바로 결과로(결제 직후와 같이 세 번째 카드가 뒤집히며 열림)
        if ("comp" in r) return router.replace(`/result/${r.sessionId}/${page}?opened=1`);
        o = r;
        setOrder(r);
      }
      // 위젯에 먼저 그린 표시 가격과 서버 주문 금액이 다르면(할인 경계 시각 등) 실제 청구 금액으로 맞춘다
      if (o.amount !== shownAmount) methodsRef.current?.updateAmount(o.amount);
      await widgetRef.current.requestPayment({
        orderId: o.orderId,
        orderName: o.orderName,
        successUrl: `${window.location.origin}/checkout/success?page=${page}`,
        failUrl: `${window.location.origin}/checkout/fail?id=${id}&page=${page}`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /이미 결제/.test(e.message)) return router.replace(back);
      setError(e instanceof ApiError ? e.message : "결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-x-hidden">
      <Stars />
      <div className="auth relative z-[1] mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-6 pb-10 pt-7">
        <Link href={back} className="text-[13px] text-moon/80">
          ← 결과로 돌아가기
        </Link>
        <h1 className="big">전체 리포트 결제</h1>
        {checked === null ? (
          <p className="small">확인하는 중…</p>
        ) : (
          <>
            {/* 쏠 타로 하우스 결제 상자가 먼저(owner 2026-11-02). 금액은 주문이 생기면 서버가 정한 주문 금액, 그 전에는 같은 계산(lib/billing/pricing.ts)으로 표시만 */}
            {(() => {
              const amount = shownAmount;
              const discounted = amount < REPORT_LIST_PRICE;
              return (
                <div className="rounded-2xl border border-gold px-4 py-3">
                  <p className="font-bold">{order?.orderName ?? REPORT_ORDER_NAME}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-moon/80">
                    {discounted && <span className="text-moon/50 line-through">{won(REPORT_LIST_PRICE)}</span>}
                    <span className="text-[16px] font-bold text-moon">{won(amount)}</span>
                    {/* '내 타로 결과'의 '전체 열람 가능' 표시와 같은 둥근 강조 */}
                    {discounted && <span className="inline-block rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold text-night-deep">{PROMO_LABEL}</span>}
                  </p>
                </div>
              );
            })()}
            {/* 이용 약관 동의 한 줄(owner 2026-11-02) — 동의해야 [결제하기]가 눌린다(결제 수단은 먼저 보임). 청약철회 제한은 약관 제13조(링크) */}
            <div className="px-1 text-sm text-moon/90">
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={ack} disabled={!!order} onChange={(e) => setAck(e.target.checked)} />
                <span className="break-keep">
                  [필수] {TERMS_CHECK_BEFORE}
                  <Link href={TERMS_URL} target="_blank" className="underline">
                    {TERMS_CHECK_LINK}
                  </Link>
                  {TERMS_CHECK_AFTER}
                </span>
              </label>
              <p className="mt-2 break-keep pl-6 text-[11.5px] leading-relaxed text-moon/60">※ {STORAGE_NOTE}</p>
            </div>
            {TOSS_CLIENT_KEY === null && <p className="err">결제 설정이 아직 준비되지 않았어요.</p>}
            {/* 토스 위젯이 그려지는 자리(흰 바탕이 필요) */}
            <div className="overflow-hidden rounded-2xl bg-white">
              <div id="toss-payment-methods" />
              <div id="toss-agreement" />
            </div>
            {error && (
              <p className="err" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn block" disabled={!ready || !ack || busy} onClick={pay}>
              {!ready && TOSS_CLIENT_KEY ? "결제창을 불러오는 중…" : busy ? "결제창을 여는 중…" : ack ? `${won(shownAmount)} 결제하기` : "약관에 동의하면 결제할 수 있어요"}
            </button>
          </>
        )}
      </div>
      <PageFoot />
    </main>
  );
}
