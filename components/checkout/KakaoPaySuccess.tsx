"use client";

// 카카오페이에서 돌아온 화면(owner 2026-11-18). 카카오페이가 붙여 준 pg_token을 서버에 넘겨 '진짜 승인'을 받은 뒤
// 결제를 누른 결과 쪽으로 간다(토스 CheckoutSuccess와 같은 흐름 — 유료 리포트는 결과 화면에서 기다린다).
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, loadKey } from "@/lib/client/api";
import { metaTrack } from "@/lib/client/metaPixel";
import { Stars } from "../Cards";

const clampPage = (v: string | null) => Math.min(11, Math.max(1, Number.parseInt(v ?? "4", 10) || 4));

export default function KakaoPaySuccess() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [goResult, setGoResult] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const orderId = params.get("orderId");
    const pgToken = params.get("pg_token");
    const page = clampPage(params.get("page"));
    if (!orderId || !pgToken) {
      queueMicrotask(() => setError("결제 정보를 확인하지 못했어요."));
      return;
    }
    // 로그인 없이 결제한 경우(2026-11-18) 이 브라우저의 결과 접근 키로 확인받는다(approval_url의 id)
    const sid = params.get("id");
    api<{ ok: boolean; sessionId: string; amount: number | null }>("/api/tarot/checkout/kakaopay/approve", { key: sid && /^[0-9a-f-]{36}$/i.test(sid) ? loadKey(sid) : null, body: { orderId, pgToken } })
      .then((d) => {
        // 메타 광고 성과 측정: 승인된 결제만, 주문 번호로 한 번만(토스 결제와 같은 이벤트)
        if (d.amount) metaTrack("Purchase", { value: d.amount, currency: "KRW", content_name: "tarot_full_report" }, orderId);
        router.replace(`/result/${d.sessionId}/${page}?opened=1`);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "결제를 확인하지 못했어요.");
        if (e instanceof ApiError && e.status === 409 && e.sessionId) setGoResult(`/result/${e.sessionId}/${page}`);
        setCanRetry(e instanceof ApiError && e.status === 503);
      });
  }, [params, router]);

  return (
    <main className="night-bg relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-6">
      <Stars />
      <div className="auth relative z-[1] flex w-full max-w-md flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <p className="err" role="alert">
              {error}
            </p>
            {goResult && (
              <button type="button" className="btn block" onClick={() => router.replace(goResult)}>
                결과로 돌아가기
              </button>
            )}
            {canRetry && (
              <button type="button" className="btn block" onClick={() => window.location.reload()}>
                결제 다시 확인하기
              </button>
            )}
            <p className="small break-keep">이미 결제가 됐는데 이 화면이 보이면, 결제한 기기·브라우저에서 다시 열어 보시거나 contact@ssolwellness.com으로 알려 주세요.</p>
          </>
        ) : (
          <p className="small mystic-line">카카오페이 결제를 확인하고 있어요…</p>
        )}
      </div>
    </main>
  );
}
