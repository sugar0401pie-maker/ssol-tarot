"use client";

// 영문 결제 화면(/en/checkout/{결과}?page=쪽). 한국어판 CheckoutPage와 같은 순서:
// 로그인 확인 → 토스 결제 위젯(달러, 해외 카드·PayPal) → 동의 체크 → [결제하기]를 누를 때 서버가 주문을 만들고 금액(US$1.99)을 정함
// → 토스 결제 → /en/checkout/success에서 서버 승인 확인. 문구는 lib/i18n/checkoutEn.ts(기획 정책 문서 08 그대로).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, claimIfGuest } from "@/lib/client/api";
import { getRealSession } from "@/lib/supabase/browser";
import { REPORT_ORDER_NAME_EN, REPORT_PRICE_USD } from "@/lib/billing/pricing";
import { CHECKOUT_EN as T } from "@/lib/i18n/checkoutEn";
import { Stars } from "../Cards";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

type Order = { orderId: string; orderName: string; amount: number; currency?: "KRW" | "USD"; customerKey: string };
type Widget = Awaited<ReturnType<typeof import("@tosspayments/payment-widget-sdk")["loadPaymentWidget"]>>;

// 토스 위젯 금액(달러). country는 결제 수단 표시 기준 — 해외 결제(Visa·Mastercard·JCB·PayPal) 목록을 그리게 한다.
const usdAmount = (value: number) => ({ value, currency: "USD" as const, country: "US" });

export default function CheckoutPageEn({ id, page }: { id: string; page: number }) {
  const router = useRouter();
  const back = `/en/result/${id}/${page}`;
  const [checked, setChecked] = useState<boolean | null>(null);
  const [customerKey, setCustomerKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<Widget | null>(null);

  useEffect(() => {
    void getRealSession().then(async (s) => {
      if (!s) return router.replace(`/en/login?next=${encodeURIComponent(`/en/checkout/${id}?page=${page}`)}`);
      await claimIfGuest(id);
      setCustomerKey(s.user.id);
      setChecked(true);
    });
  }, [router, id, page]);

  useEffect(() => {
    if (!checked || !customerKey || !TOSS_CLIENT_KEY || widgetRef.current) return;
    let cancelled = false;
    void import("@tosspayments/payment-widget-sdk")
      .then(async ({ loadPaymentWidget }) => {
        const widget = await loadPaymentWidget(TOSS_CLIENT_KEY, customerKey);
        if (cancelled) return;
        widget.renderPaymentMethods("#toss-payment-methods", usdAmount(REPORT_PRICE_USD));
        widget.renderAgreement("#toss-agreement");
        widgetRef.current = widget;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError(T.widgetFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [checked, customerKey]);

  async function pay() {
    if (!ack || !widgetRef.current || busy) return;
    setError(null);
    setBusy(true);
    try {
      let o = order;
      if (!o) {
        const r = await api<Order | { comp: true; sessionId: string }>(`/api/tarot/session/${id}/checkout`, { body: { withdrawalAck: true } });
        if ("comp" in r) return router.replace(`/en/result/${r.sessionId}/${page}?opened=1`);
        o = r;
        setOrder(r);
      }
      // 서버 주문이 달러가 아니거나 금액이 다르면 결제하지 않는다(표시 금액과 청구 금액이 어긋나지 않게)
      if (o.currency !== "USD" || o.amount !== REPORT_PRICE_USD) throw new Error("amount mismatch");
      await widgetRef.current.requestPayment({
        orderId: o.orderId,
        orderName: o.orderName,
        successUrl: `${window.location.origin}/en/checkout/success?page=${page}`,
        failUrl: `${window.location.origin}/en/checkout/fail?id=${id}&page=${page}`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.message.includes("already paid")) return router.replace(back);
      setError(e instanceof ApiError ? e.message : T.openFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="night-bg relative flex min-h-dvh flex-col overflow-x-hidden">
      <Stars />
      <div className="auth relative z-[1] mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-6 pb-10 pt-7">
        <Link href={back} className="text-[13px] text-moon/80">
          {T.back}
        </Link>
        <h1 className="big">{T.title}</h1>
        {checked === null ? (
          <p className="small">{T.checking}</p>
        ) : (
          <>
            <div className="rounded-2xl border border-gold px-4 py-3">
              <p className="font-bold">{order?.orderName ?? REPORT_ORDER_NAME_EN}</p>
              <p className="mt-1 text-sm text-moon/80">{T.product}</p>
              <p className="mt-2 text-[12px] text-moon/60">{T.methods}</p>
            </div>
            <div className="px-1 text-sm text-moon/90">
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={ack} disabled={!!order} onChange={(e) => setAck(e.target.checked)} />
                <span>
                  {T.ackBefore}
                  <Link href="/en/legal#terms" target="_blank" className="underline">
                    {T.terms}
                  </Link>
                  {T.and}
                  <Link href="/en/legal#refund" target="_blank" className="underline">
                    {T.refund}
                  </Link>
                  {T.ackAfter}
                </span>
              </label>
            </div>
            {!TOSS_CLIENT_KEY && <p className="err">{T.notReady}</p>}
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
              {!ready && TOSS_CLIENT_KEY ? T.loading : busy ? T.opening : ack ? T.pay : T.needAck}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
