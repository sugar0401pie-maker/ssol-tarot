"use client";

// 토스 결제창에서 돌아온 화면. 받은 값을 서버에 넘겨 '진짜 승인됐는지' 확인받은 뒤 결제를 누른 결과 쪽으로 간다
// (유료 리포트는 그 화면에서 만들어질 때까지 기다린다).
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Stars } from "../Cards";

const clampPage = (v: string | null) => Math.min(11, Math.max(1, Number.parseInt(v ?? "5", 10) || 5));

export default function CheckoutSuccess() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [goResult, setGoResult] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = params.get("amount");
    const page = clampPage(params.get("page"));
    if (!paymentKey || !orderId || !amount) {
      queueMicrotask(() => setError("결제 정보를 확인하지 못했어요."));
      return;
    }
    api<{ ok: boolean; sessionId: string }>("/api/tarot/checkout/confirm", { body: { paymentKey, orderId, amount: Number(amount) } })
      .then((d) => router.replace(`/result/${d.sessionId}/${page}`))
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
          <p className="small mystic-line">결제를 확인하고 있어요…</p>
        )}
      </div>
    </main>
  );
}
