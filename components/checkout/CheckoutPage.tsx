"use client";

// 결제 화면(/checkout/{결과}?page=쪽) — 쏠 아스트로 하우스 결제 화면과 같은 흐름:
// 청약철회 안내 동의 → 서버가 주문을 만들고 금액을 정함 → 토스 결제 위젯 → 결제가 끝나면 토스가 /checkout/success로 보내고
// 그 화면이 서버에 승인 확인을 요청한다. 가짜 카운트다운·"지금만 할인" 같은 문구는 쓰지 않는다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { getRealSession } from "@/lib/supabase/browser";
import { REPORT_LIST_PRICE, WITHDRAWAL_CHECK_LABEL, WITHDRAWAL_NOTICE_LINES, won } from "@/lib/billing/pricing";
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

  // 결제는 로그인한 본인만(결과도 로그인해야 만들 수 있다)
  useEffect(() => {
    void getRealSession().then((s) => {
      if (!s) router.replace(`/login?next=${encodeURIComponent(`/checkout/${id}?page=${page}`)}`);
      else setChecked(true);
    });
  }, [router, id, page]);

  // 청약철회 안내에 동의해야 주문을 만들고 결제 수단을 연다
  useEffect(() => {
    if (!checked || !ack || order) return;
    api<Order>(`/api/tarot/session/${id}/checkout`, { body: { withdrawalAck: true } })
      .then(setOrder)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409 && /이미 결제/.test(e.message)) router.replace(back);
        else setError(e instanceof ApiError ? e.message : "주문을 만들지 못했어요.");
      });
  }, [checked, ack, order, id, router, back]);

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
            {order && (
              <div className="rounded-2xl border border-gold px-4 py-3">
                <p className="font-bold">{order.orderName}</p>
                <p className="text-sm text-moon/80">
                  {/* 금액은 서버가 정한 주문 금액 그대로. 정가보다 낮으면 11월 한정 할인 표시(lib/billing/pricing.ts) */}
                  {order.amount < REPORT_LIST_PRICE && <span className="mr-2 text-moon/50 line-through">{won(REPORT_LIST_PRICE)}</span>}
                  {won(order.amount)}
                  {order.amount < REPORT_LIST_PRICE && <span className="ml-2 font-medium text-gold-soft">11월 한정 할인</span>}
                </p>
              </div>
            )}
            {/* 결제 전 청약철회 안내(약관 제13조) — 동의해야 결제 수단이 열린다 */}
            <div className="rounded-2xl border border-moon/30 px-4 py-3 text-sm text-moon/90">
              <p className="mb-1 font-bold text-moon">결제 전 꼭 확인해 주세요</p>
              {WITHDRAWAL_NOTICE_LINES.map((l) => (
                <p key={l} className="mb-1 break-keep">
                  {l}
                </p>
              ))}
              <p className="mb-2">
                <Link href={TERMS_URL} target="_blank" className="underline">
                  이용약관 제13조(청약철회 및 환불) 보기
                </Link>
              </p>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={ack} disabled={!!order} onChange={(e) => setAck(e.target.checked)} />
                <span className="break-keep">{WITHDRAWAL_CHECK_LABEL}</span>
              </label>
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
              {order ? `${won(order.amount)} 결제하기` : ack ? "준비하는 중…" : "안내에 동의하면 결제할 수 있어요"}
            </button>
          </>
        )}
      </div>
      <PageFoot />
    </main>
  );
}
