"use client";

// 결제 화면(/checkout/{결과}?page=쪽) — 쏠 아스트로 하우스 결제 화면과 같은 흐름:
// 이용 약관 동의(약관 링크) → 서버가 주문을 만들고 금액을 정함 → 토스 결제 위젯 → 결제가 끝나면 토스가 /checkout/success로 보내고
// 그 화면이 서버에 승인 확인을 요청한다. 가짜 카운트다운·"지금만 할인" 같은 문구는 쓰지 않는다.
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

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

type Order = { orderId: string; orderName: string; amount: number; customerKey: string };
type Widget = Awaited<ReturnType<typeof import("@tosspayments/payment-widget-sdk")["loadPaymentWidget"]>>;

export default function CheckoutPage({ id, page }: { id: string; page: number }) {
  const router = useRouter();
  const back = `/result/${id}/${page}`;
  const [checked, setChecked] = useState<boolean | null>(null); // 로그인 확인 중 null
  const [ack, setAck] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<Widget | null>(null);
  // 주문을 만들기 전에도 상품·가격 상자를 먼저 보여 준다(owner 2026-11-02). 표시용 — 실제 청구는 서버 주문 금액.
  const promo = usePromo() === true;

  // 결제는 로그인한 본인만(결과도 로그인해야 만들 수 있다)
  // 로그인 없이 본 결과(2026-10-26)면 로그인한 지금 이 브라우저의 결과를 먼저 계정에 붙인다 — 주문은 계정 결과에만 만든다.
  useEffect(() => {
    void getRealSession().then(async (s) => {
      if (!s) return router.replace(`/login?next=${encodeURIComponent(`/checkout/${id}?page=${page}`)}`);
      await claimIfGuest(id);
      setChecked(true);
    });
  }, [router, id, page]);

  // 이용 약관에 동의해야 주문을 만들고 결제 수단을 연다
  useEffect(() => {
    if (!checked || !ack || order) return;
    api<Order | { comp: true; sessionId: string }>(`/api/tarot/session/${id}/checkout`, { body: { withdrawalAck: true } })
      .then((o) => {
        // 기간 한정 무료 열람 계정: 결제창 없이 바로 결과로(결제 직후와 같이 세 번째 카드가 뒤집히며 열림)
        if ("comp" in o) return router.replace(`/result/${o.sessionId}/${page}?opened=1`);
        setOrder(o);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409 && /이미 결제/.test(e.message)) router.replace(back);
        else setError(e instanceof ApiError ? e.message : "주문을 만들지 못했어요.");
      });
  }, [checked, ack, order, id, router, back, page]);

  useEffect(() => {
    if (!order || !TOSS_CLIENT_KEY) return;
    let cancelled = false;
    void import("@tosspayments/payment-widget-sdk")
      .then(async ({ loadPaymentWidget }) => {
        const widget = await loadPaymentWidget(TOSS_CLIENT_KEY, order.customerKey);
        if (cancelled) return;
        widget.renderPaymentMethods("#toss-payment-methods", order.amount);
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
  }, [order]);

  async function pay() {
    if (!order || !widgetRef.current) return;
    setError(null);
    try {
      await widgetRef.current.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/checkout/success?page=${page}`,
        failUrl: `${window.location.origin}/checkout/fail?id=${id}&page=${page}`,
      });
    } catch {
      setError("결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요.");
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
              const amount = order?.amount ?? (promo ? PROMO_REPORT_PRICE : REPORT_LIST_PRICE);
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
            {/* 이용 약관 동의 한 줄(owner 2026-11-02) — 동의해야 주문을 만들고 결제 수단이 열린다. 청약철회 제한은 약관 제13조(링크) */}
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
            {!TOSS_CLIENT_KEY && <p className="err">결제 설정이 아직 준비되지 않았어요.</p>}
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
            <button type="button" className="btn block" disabled={!ready} onClick={pay}>
              {order ? `${won(order.amount)} 결제하기` : ack ? "준비하는 중…" : "약관에 동의하면 결제할 수 있어요"}
            </button>
          </>
        )}
      </div>
      <PageFoot />
    </main>
  );
}
