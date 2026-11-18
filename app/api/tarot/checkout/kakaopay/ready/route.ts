import { NextResponse } from "next/server";
import { kakaopayReadyForOrder } from "@/lib/server/session";
import { authFrom, fail, readJson } from "@/lib/server/http";
import { kakaoReturnOrigin } from "@/lib/billing/kakaopay";
import { SITE_URL } from "@/lib/client/shareCard";

// 카카오페이 결제 준비(owner 2026-11-18): 이미 만든 내 주문(orderId)으로 카카오페이에 결제를 준비하고, 결제 화면 주소를 돌려준다.
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await authFrom(req); // 계정 또는 결과 접근 키(로그인 없이 결제)
    const r = await kakaopayReadyForOrder(auth, await readJson(req), {
      returnOrigin: kakaoReturnOrigin(new URL(req.url).origin, SITE_URL),
      userAgent: req.headers.get("user-agent") ?? "",
    });
    return NextResponse.json(r);
  } catch (e) {
    return fail(e, req);
  }
}
