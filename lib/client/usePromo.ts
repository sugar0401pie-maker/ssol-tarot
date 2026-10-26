"use client";
import { useSyncExternalStore } from "react";
import { isPromoActive } from "@/lib/billing/pricing";

// 11월 할인 중인지(브라우저 시계 기준, 화면 표시용). 서버 렌더에서는 null — 할인 띠가 서버/브라우저 그림이 달라 깨지는 일을 막고,
// 화면이 열린 뒤 한 번 정해진다. 실제 청구 금액은 서버(createCheckout)가 따로 정하고, 결제 화면은 그 금액을 그대로 보여 준다.
const noop = () => () => {};
export function usePromo(): boolean | null {
  return useSyncExternalStore(noop, () => isPromoActive(), () => null);
}
