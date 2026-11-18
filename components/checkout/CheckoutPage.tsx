"use client";

// 결제 화면(/checkout/{결과}?page=쪽) — 쏠 아스트로 하우스 결제 화면과 같은 흐름:
// 들어오자마자 토스 결제 위젯(결제 수단)을 보여 주고(owner 2026-11-04 "누르면 결제창 보이게"), [결제하기]를 누르면(약관 동의는 토스 결제창 안에서 — 2026-11-18)
// 그때 서버가 주문을 만들고 금액을 정함 → 토스 결제 → 결제가 끝나면 토스가 /checkout/success로 보내고 그 화면이 서버에 승인 확인을 요청한다.
// 주문은 동의한 뒤에만 만든다(주문에 약관 동의 버전을 기록하므로). 위젯 금액은 표시 가격으로 먼저 그리고, 주문 금액이 다르면 결제 직전에 맞춘다. 가짜 카운트다운·"지금만 할인" 같은 문구는 쓰지 않는다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { metaTrack } from "@/lib/client/metaPixel";
import { startKakaoPay } from "@/lib/client/kakaopayStart";
import { api, ApiError, claimIfGuest, loadKey } from "@/lib/client/api";
import { getRealSession } from "@/lib/supabase/browser";
import { PROMO_LABEL, REPORT_LIST_PRICE, REPORT_ORDER_NAME, PROMO_REPORT_PRICE, STORAGE_NOTE, NOTICE_AFTER, NOTICE_BEFORE, NOTICE_LINK, won } from "@/lib/billing/pricing";
import { usePromo } from "@/lib/client/usePromo";
import { TERMS_URL } from "@/lib/legal/urls";
import { Stars } from "../Cards";
import PageFoot from "../PageFoot";

// 결제창 키는 서버가 주문 통화(이 화면은 원화)로 골라 준다(/api/tarot/session/{id}/pay-config) — 브라우저에 키를 박아 두지 않는다.
type PayConfig = { currency: "KRW" | "USD"; clientKey: string | null; keyKind: "widget" | "api" | null; kakaopay?: boolean };

// 토스 결제위젯의 비회원 표시(@tosspayments/payment-widget-sdk ANONYMOUS와 같은 값 — SDK를 미리 불러오지 않으려고 값만 둠)
const ANONYMOUS_KEY = "@@ANONYMOUS";

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
  const [kakao, setKakao] = useState(false); // 카카오페이 직접 결제 버튼(서버에 CID·Secret key가 있을 때만, owner 2026-11-18)
  const kakaoStarted = useRef(false); // 카카오페이로 넘기기는 한 번만(개발 모드 이중 실행·새로고침 방지)
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
      // 로그인 없이도 결제(owner 2026-11-18): 이 브라우저에 결과 접근 키가 있으면 그대로, 없으면 로그인으로
      const key = loadKey(id);
      if (!s && !key) return router.replace(`/login?next=${encodeURIComponent(`/checkout/${id}?page=${page}`)}`);
      if (s) await claimIfGuest(id);
      // 이 결과의 통화·키를 서버에 묻는다. 영문(달러) 결과면 영문 결제 화면으로(원화 상점으로 달러를 요청하지 않게)
      const cfg = await api<PayConfig>(`/api/tarot/session/${id}/pay-config`, { key }).catch(() => null);
      if (cfg?.currency === "USD") return router.replace(`/en/checkout/${id}?page=${page}`);
      setClientKey(cfg?.clientKey ?? null);
      setKakao(cfg?.kakaopay === true);
      // 카카오페이가 켜져 있으면 주문서 없이 바로 카카오페이로(owner 2026-11-18). 동의는 결과 화면 버튼 아래 안내 문구.
      if (cfg?.kakaopay === true && !kakaoStarted.current) {
        kakaoStarted.current = true;
        metaTrack("InitiateCheckout", { content_name: "tarot_full_report", currency: "KRW" }, id);
        return void payKakao();
      }
      setCustomerKey(s ? s.user.id : ANONYMOUS_KEY); // 로그인 없이 결제면 토스 '비회원' 표시
      setChecked(true);
      // 메타 광고 측정(owner 2026-11-16): 결제 화면 열기 — 결과 번호로 한 번만
      metaTrack("InitiateCheckout", { content_name: "tarot_full_report", currency: "KRW" }, id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- payKakao는 첫 확인 때 한 번만(kakaoStarted)
  }, [router, id, page]);

  // 결제 수단은 화면에 들어오자마자 그린다(할인 여부를 알고 난 뒤 — 표시 가격으로)
  useEffect(() => {
    // 카카오페이가 켜져 있으면 토스 결제창은 숨긴다(owner 2026-11-18) — 카카오페이가 꺼져 있을 때만 토스로 결제(결제 길이 막히지 않게)
    if (!checked || kakao || !customerKey || promoState === null || !TOSS_CLIENT_KEY || widgetRef.current) return;
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
  }, [checked, kakao, customerKey, promoState, TOSS_CLIENT_KEY]);

  // 주문은 결제 버튼을 누를 때 만든다 — 금액은 서버가 정한다. 무료 열람 계정이면 null(결과로 바로 이동).
  async function ensureOrder(consentVersion?: string): Promise<Order | null> {
    if (order) return order;
    const r = await api<Order | { comp: true; sessionId: string }>(`/api/tarot/session/${id}/checkout`, { key: loadKey(id), body: { withdrawalAck: true, ...(consentVersion ? { consentVersion } : {}) } });
    // 기간 한정 무료 열람 계정: 결제창 없이 바로 결과로(결제 직후와 같이 세 번째 카드가 뒤집히며 열림)
    if ("comp" in r) {
      router.replace(`/result/${r.sessionId}/${page}?opened=1`);
      return null;
    }
    setOrder(r);
    return r;
  }

  // 카카오페이 직접 결제(owner 2026-11-18): 주문 → 서버가 카카오페이 결제 준비 → 카카오페이 결제 화면으로 바로 이동.
  // 이 화면(/checkout)은 거쳐 가기만 한다 — replace로 넘겨 뒤로 가기를 누르면 결과 화면으로 돌아간다.
  // 결제를 마치면 카카오페이가 /checkout/kakaopay로, 취소·실패면 /checkout/fail로 돌려보낸다.
  async function payKakao() {
    setError(null);
    setBusy(true);
    try {
      const res = await startKakaoPay(id, page, { replace: true });
      if (res) return router.replace(`/result/${res.comp}/${page}?opened=1`); // 무료 열람 계정
      return; // 카카오페이로 이동하는 동안 '카카오페이로 이동하고 있어요' 그대로
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /이미 결제/.test(e.message)) return router.replace(back);
      if (e instanceof ApiError && e.needLogin) return router.replace(`/login?next=${encodeURIComponent(`/checkout/${id}?page=${page}`)}`);
      setError(e instanceof ApiError ? e.message : "카카오페이 결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    setBusy(false);
  }

  async function pay() {
    if (!widgetRef.current || busy) return;
    setError(null);
    setBusy(true);
    try {
      const o = await ensureOrder();
      if (!o) return;
      // 위젯에 먼저 그린 표시 가격과 서버 주문 금액이 다르면(할인 경계 시각 등) 실제 청구 금액으로 맞춘다
      if (o.amount !== shownAmount) methodsRef.current?.updateAmount(o.amount);
      await widgetRef.current.requestPayment({
        orderId: o.orderId,
        orderName: o.orderName,
        successUrl: `${window.location.origin}/checkout/success?page=${page}&id=${id}`, // id: 로그인 없이 결제한 경우 결과 접근 키를 찾으려고
        failUrl: `${window.location.origin}/checkout/fail?id=${id}&page=${page}`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /이미 결제/.test(e.message)) return router.replace(back);
      if (e instanceof ApiError && e.needLogin) return router.replace(`/login?next=${encodeURIComponent(`/checkout/${id}?page=${page}`)}`);
      // 토스 결제창 오류는 토스가 준 코드·문구를 그대로 보여 준다(문의·원인 찾기용, 2026-11-18 카카오페이가 안 넘어가던 문제)
      const t = e as { code?: unknown; message?: unknown };
      if (!(e instanceof ApiError) && t?.code === "USER_CANCEL") return; // 사용자가 결제창을 닫음
      setError(
        e instanceof ApiError
          ? e.message
          : typeof t?.code === "string"
            ? `결제창을 열지 못했어요. ${typeof t.message === "string" ? t.message : ""} (오류 코드 ${t.code})`
            : "결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
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
        {/* 카카오페이로 바로 넘어가는 동안에는 '전체 리포트 결제' 제목을 그리지 않는다(owner 2026-11-18) — 토스 결제 화면일 때만 */}
        {checked === null ? (
          kakao ? (
            error ? (
              <div className="flex flex-col gap-4">
                <p className="err" role="alert">
                  {error}
                </p>
                <button type="button" className="btn block kakao" disabled={busy} onClick={payKakao}>
                  {busy ? "카카오페이로 이동하고 있어요…" : "카카오페이로 다시 결제하기"}
                </button>
              </div>
            ) : (
              <p className="small mystic-line">카카오페이로 이동하고 있어요…</p>
            )
          ) : (
            <p className="small">확인하는 중…</p>
          )
        ) : (
          <>
            <h1 className="big">전체 리포트 결제</h1>
            {kakao ? (
              <div className="flex flex-col gap-4">
                {error ? (
                  <>
                    <p className="err" role="alert">
                      {error}
                    </p>
                    <button type="button" className="btn block kakao" disabled={busy} onClick={payKakao}>
                      {busy ? "카카오페이로 이동하고 있어요…" : "카카오페이로 다시 결제하기"}
                    </button>
                  </>
                ) : (
                  <p className="small mystic-line">카카오페이로 이동하고 있어요…</p>
                )}
              </div>
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
            {/* 약관 안내(owner 2026-11-18): 동의는 토스 결제창의 약관 동의에서 받으므로 우리 체크 칸은 없애고 안내 문구만. 청약철회 제한은 약관 제13조(링크) */}
            <div className="px-1 text-[12.5px] leading-relaxed text-moon/80">
              <p className="break-keep">
                ※ {NOTICE_BEFORE}
                <Link href={TERMS_URL} target="_blank" className="underline">
                  {NOTICE_LINK}
                </Link>
                {NOTICE_AFTER}
              </p>
              <p className="mt-1 break-keep">※ {STORAGE_NOTE}</p>
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
            <button type="button" className="btn block" disabled={!ready || busy} onClick={pay}>
              {!ready && TOSS_CLIENT_KEY ? "결제창을 불러오는 중…" : busy ? "결제창을 여는 중…" : `${won(shownAmount)} 결제하기`}
            </button>
              </>
            )}
          </>
        )}
      </div>
      <PageFoot />
    </main>
  );
}

