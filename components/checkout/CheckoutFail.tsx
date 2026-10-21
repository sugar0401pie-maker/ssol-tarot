"use client";

// 결제 실패·취소. 토스가 돌려준 code가 사용자 취소면 '멈췄어요' 문구. 결제 금액은 청구되지 않았다(승인 전).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Stars } from "../Cards";

const CANCEL_CODES = new Set(["PAY_PROCESS_CANCELED", "USER_CANCEL"]);

export default function CheckoutFail() {
  const params = useSearchParams();
  const id = params.get("id");
  const page = Math.min(11, Math.max(1, Number.parseInt(params.get("page") ?? "5", 10) || 5));
  const cancel = CANCEL_CODES.has(params.get("code") ?? "");
  const valid = id && /^[0-9a-f-]{36}$/i.test(id);
  return (
    <main className="night-bg relative flex min-h-dvh flex-col justify-center overflow-x-hidden px-6">
      <Stars />
      <div className="auth relative z-[1] mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="big">{cancel ? "결제를 멈췄어요" : "결제가 완료되지 않았어요"}</h1>
        <p className="small">{cancel ? "지금까지 본 결과는 그대로 남아 있어요." : "결제 금액은 청구되지 않았어요. 다시 시도하실 수 있어요."}</p>
        {valid && (
          <Link href={`/checkout/${id}?page=${page}`} className={cancel ? "linkish text-center" : "btn block"}>
            다시 결제하기
          </Link>
        )}
        <Link href={valid ? `/result/${id}/${page}` : "/results"} className={cancel ? "btn block" : "linkish text-center"}>
          결과로 돌아가기
        </Link>
      </div>
    </main>
  );
}
