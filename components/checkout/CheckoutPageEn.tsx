"use client";

// 영문 결제 화면(/en/checkout/{결과}?page=쪽). 쏠 아스트로 하우스 영문 결제(components/en/CheckoutEn.tsx·lib/billing/enPayClient.ts)와 같은 방식.
// 결제위젯 키 한 벌로 MID 두 개(owner 정정 2026-11-06): 키는 한국어와 같고, 서버가 알려 준 variantKey 'dollar.only'(달러 MID)로
// 위젯을 한 번만 그린다(DEFAULT로 그리지 않음). 금액은 그리기 전에 setAmount({currency:"USD", value:1.99}).
//   결제위젯 키(…_gck_…): 위 방식으로 그리고 [결제하기]로 결제
//   API 개별 연동 키(…_ck_…): [카드 결제]·[PayPal] 버튼이 토스 결제창을 바로 연다(카드 = 해외카드 전용·영어 결제창)
// 주문(금액 US$1.99)은 서버가 정하고, 승인은 /en/checkout/success → 서버가 해외결제 상점 비밀 키로 확인한다.
// 문구는 lib/i18n/checkoutEn.ts(기획 정책 문서 08 그대로).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, claimIfGuest } from "@/lib/client/api";
import { getRealSession } from "@/lib/supabase/browser";
import { REPORT_ORDER_NAME_EN, REPORT_PRICE_USD } from "@/lib/billing/pricing";
import { CHECKOUT_EN as T } from "@/lib/i18n/checkoutEn";
import { Stars } from "../Cards";
import PageFoot from "../PageFoot";

// 결제창 키는 서버가 주문 통화(달러)로 골라 준다(/api/tarot/session/{id}/pay-config, owner 개발 전달 2026-11-06).
type PayConfig = { currency: "KRW" | "USD"; clientKey: string | null; keyKind: "widget" | "api" | null; variantKey: string };
const USD = { currency: "USD" as const, value: REPORT_PRICE_USD };

type Order = { orderId: string; orderName: string; amount: number; currency?: "KRW" | "USD"; clientKey?: string | null; customerKey: string; country?: string };
type Widgets = ReturnType<Awaited<ReturnType<typeof import("@tosspayments/tosspayments-sdk")["loadTossPayments"]>>["widgets"]>;
type PayMethod = "card" | "paypal";

const tossError = (e: unknown, fallback: string) => {
  const x = e as { code?: string; message?: string };
  if (x?.code === "USER_CANCEL" || x?.code === "PAY_PROCESS_CANCELED") return null;
  // 토스가 준 이유를 그대로 보여 준다(설정 문제를 바로 찾으려고 — 아스트로와 같음)
  return x?.code ? `${fallback} (${x.code}${x.message ? `: ${x.message}` : ""})` : e instanceof ApiError ? e.message : fallback;
};

export default function CheckoutPageEn({ id, page }: { id: string; page: number }) {
  const router = useRouter();
  const back = `/en/result/${id}/${page}`;
  const [checked, setChecked] = useState<boolean | null>(null);
  const [customerKey, setCustomerKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetsRef = useRef<Widgets | null>(null);
  const orderRef = useRef<Order | null>(null);
  const [cfg, setCfg] = useState<PayConfig | null>(null);
  const CLIENT_KEY = cfg?.currency === "USD" ? cfg.clientKey : null; // 달러 상점 키만 쓴다
  const KEY_KIND = CLIENT_KEY ? cfg?.keyKind ?? null : null;

  useEffect(() => {
    void getRealSession().then(async (s) => {
      if (!s) return router.replace(`/en/login?next=${encodeURIComponent(`/en/checkout/${id}?page=${page}`)}`);
      await claimIfGuest(id);
      const c = await api<PayConfig>(`/api/tarot/session/${id}/pay-config`).catch(() => null);
      // 한국어(원화) 결과면 한국어 결제 화면으로
      if (c?.currency === "KRW") return router.replace(`/checkout/${id}?page=${page}`);
      setCfg(c);
      setCustomerKey(s.user.id);
      setChecked(true);
    });
  }, [router, id, page]);

  // 결제위젯 키면 들어오자마자 외화결제 UI를 그린다
  useEffect(() => {
    if (!checked || !customerKey || !CLIENT_KEY || KEY_KIND !== "widget" || widgetsRef.current) return;
    const key = CLIENT_KEY;
    let cancelled = false;
    void (async () => {
      try {
        const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
        const toss = await loadTossPayments(key);
        const widgets = toss.widgets({ customerKey });
        await widgets.setAmount(USD);
        // 외화결제 UI만 쓴다 — 기본 UI(DEFAULT)는 국내 일반결제라 달러로 열면 2003으로 거절된다(DEFAULT로 되돌아가지 않음)
        await widgets.renderPaymentMethods({ selector: "#toss-en-methods", variantKey: cfg?.variantKey ?? "dollar.only" });
        if (cancelled) return;
        widgetsRef.current = widgets;
        setReady(true);
        // 약관 UI가 없는 외화결제 UI여도 결제는 되게(실패해도 무시 — 아스트로와 같음)
        void widgets.renderAgreement({ selector: "#toss-en-agreement" }).catch(() => undefined);
      } catch (e) {
        if (!cancelled) setError(tossError(e, T.widgetFailed));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checked, customerKey, CLIENT_KEY, KEY_KIND]);

  /** [결제하기]를 누를 때 주문을 만든다(토스 약관 UI 동의 뒤, 화면 문구 판을 주문에 기록). 무료 열람 계정이면 결과로 바로 간다(null). */
  async function ensureOrder(): Promise<Order | null> {
    if (orderRef.current) return orderRef.current;
    const r = await api<Order | { comp: true; sessionId: string }>(`/api/tarot/session/${id}/checkout`, { body: { withdrawalAck: true } });
    if ("comp" in r) {
      router.replace(`/en/result/${r.sessionId}/${page}?opened=1`);
      return null;
    }
    // 서버 주문이 달러·US$1.99가 아니거나, 주문이 알려 준 키가 이 화면 키와 다르면 결제하지 않는다(키·금액 혼선 방지)
    if (r.currency !== "USD" || r.amount !== REPORT_PRICE_USD) throw new Error("amount mismatch");
    if (r.clientKey && r.clientKey !== CLIENT_KEY) throw new Error("key mismatch");
    orderRef.current = r;
    return r;
  }

  const urls = () => ({
    successUrl: `${window.location.origin}/en/checkout/success?page=${page}`,
    failUrl: `${window.location.origin}/en/checkout/fail?id=${id}&page=${page}`,
  });

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.message.includes("already paid")) return router.replace(back);
      setError(tossError(e, T.openFailed));
    } finally {
      setBusy(false);
    }
  }

  // 결제위젯 키
  const payWidget = () =>
    run(async () => {
      if (!widgetsRef.current) return;
      const o = await ensureOrder();
      if (!o) return;
      await widgetsRef.current.requestPayment({ orderId: o.orderId, orderName: o.orderName, ...urls() });
    });

  // API 개별 연동 키: 카드(해외카드 전용·영어) 또는 PayPal 결제창을 바로 연다
  const payWindow = (method: PayMethod) =>
    run(async () => {
      if (!CLIENT_KEY || !customerKey) return;
      const o = await ensureOrder();
      if (!o) return;
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const payment = (await loadTossPayments(CLIENT_KEY)).payment({ customerKey });
      const common = { amount: USD, orderId: o.orderId, orderName: o.orderName, ...urls() };
      // SDK 타입은 일반 결제를 원화로 적어 두었지만 해외카드·PayPal은 USD 계약 — 요청 모양은 SDK PaymentRequest대로(아스트로와 같음)
      const request =
        method === "card"
          ? { ...common, method: "CARD", card: { useInternationalCardOnly: true, language: "EN" } }
          : { ...common, method: "FOREIGN_EASY_PAY", foreignEasyPay: { provider: "PAYPAL", country: o.country ?? "US" } };
      await payment.requestPayment(request as never);
    });

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
              <p className="font-bold">{REPORT_ORDER_NAME_EN}</p>
              <p className="mt-1 text-sm text-moon/80">{T.product}</p>
              <p className="mt-2 text-[12px] text-moon/60">{T.methods}</p>
            </div>
            {/* 약관·철회권 동의는 토스 결제창 안의 약관 UI에서 받는다(owner 2026-11-08 — 우리 체크박스 없앰) */}
            {/* 해외결제 상점 키가 없거나 알 수 없는 키면 결제를 열지 않는다(한국어 키로 대신하지 않음) */}
            {!KEY_KIND && <p className="err">{T.notReady}</p>}
            {KEY_KIND === "widget" && (
              <div className="overflow-hidden rounded-2xl bg-white">
                <div id="toss-en-methods" />
                <div id="toss-en-agreement" />
              </div>
            )}
            {error && (
              <p className="err" role="alert">
                {error}
              </p>
            )}
            {KEY_KIND === "widget" && (
              <button type="button" className="btn block" disabled={!ready || busy} onClick={payWidget}>
                {!ready ? T.loading : busy ? T.opening : T.pay}
              </button>
            )}
            {KEY_KIND === "api" && (
              <>
                <button type="button" className="btn block" disabled={busy} onClick={() => payWindow("card")}>
                  {busy ? T.opening : T.pay}
                </button>
                <button type="button" className="linkish text-center" disabled={busy} onClick={() => payWindow("paypal")}>
                  {T.payPaypal}
                </button>
              </>
            )}
          </>
        )}
      </div>
      <PageFoot locale="en" />
    </main>
  );
}
