"use client";

// 결제 실패·취소. 토스가 돌려준 code가 사용자 취소면 '멈췄어요' 문구. 결제 금액은 청구되지 않았다(승인 전).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Stars } from "../Cards";
import { CHECKOUT_EN } from "@/lib/i18n/checkoutEn";

const KO = { cancelTitle: "결제를 멈췄어요", failTitle: "결제가 완료되지 않았어요", cancelBody: "지금까지 본 결과는 그대로 남아 있어요.", failBody: "결제 금액은 청구되지 않았어요. 다시 시도하실 수 있어요.", tryAgain: "다시 결제하기", backToReading: "결과로 돌아가기" };

const CANCEL_CODES = new Set(["PAY_PROCESS_CANCELED", "USER_CANCEL"]);

export default function CheckoutFail({ locale = "ko" }: { locale?: "ko" | "en" }) {
  const T = locale === "en" ? CHECKOUT_EN : KO;
  const P = locale === "en" ? "/en" : "";
  const params = useSearchParams();
  const id = params.get("id");
  const page = Math.min(11, Math.max(1, Number.parseInt(params.get("page") ?? "5", 10) || 5));
  const cancel = CANCEL_CODES.has(params.get("code") ?? "");
  const valid = id && /^[0-9a-f-]{36}$/i.test(id);
  return (
    <main className="night-bg relative flex min-h-dvh flex-col justify-center overflow-x-hidden px-6">
      <Stars />
      <div className="auth relative z-[1] mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="big">{cancel ? T.cancelTitle : T.failTitle}</h1>
        <p className="small">{cancel ? T.cancelBody : T.failBody}</p>
        {/* 토스가 돌려준 실패 이유·주문 번호를 그대로(설정 문제를 바로 찾고 토스 문의에 쓰려고 — 아스트로와 같음). 사용자 취소면 숨김 */}
        {!cancel && (params.get("code") || params.get("orderId")) && (
          <p className="break-all text-[12px] leading-relaxed text-moon/60">
            {params.get("code") && <>{params.get("code")}{params.get("message") ? `: ${params.get("message")}` : ""}<br /></>}
            {params.get("orderId") && <>{locale === "en" ? "Order no." : "주문 번호"} {params.get("orderId")}</>}
          </p>
        )}
        {valid && (
          <Link href={`${P}/checkout/${id}?page=${page}`} className={cancel ? "linkish text-center" : "btn block"}>
            {T.tryAgain}
          </Link>
        )}
        <Link href={valid ? `${P}/result/${id}/${page}` : locale === "en" ? "/en" : "/results"} className={cancel ? "btn block" : "linkish text-center"}>
          {T.backToReading}
        </Link>
      </div>
    </main>
  );
}
