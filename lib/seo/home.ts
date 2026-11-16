// 첫 화면(/) 검색·링크 미리보기 문구(owner 2026-11-16 — owner 문구 그대로). 리포트 가격은 할인 기간에 맞춰 바뀌도록
// 지금 가격(currentReportPrice)을 넣는다(12월 1일부터 1,900원) — 첫 화면은 1시간마다 다시 만든다(app/(ko)/page.tsx revalidate).
// '10만 명'·'출시 2주'는 owner가 정한 표시 문구(첫 화면 참여자 수 DISPLAY_PARTICIPANTS와 같은 근거) — 바꾸려면 여기만.
import { currentReportPrice, won } from "../billing/pricing.ts";

export function homeMeta(now: Date = new Date()) {
  const price = won(currentReportPrice(now));
  return {
    title: `출시 2주 만에 사용자 10만명 돌파 - ${price} 타로 | 쏠 타로 하우스`,
    description: `그 사람 마음, 이 회사에 남을지, 계속 맴도는 그 고민. 한 줄로 적고 카드 세 장을 무료로 뽑아 보세요. 웰니스 타로가 전문 심리상담사의 시선으로 내 고민을 다시 읽고, 이번 주에 해 볼 실천까지 ${price}에 알려드려요.`,
    ogTitle: "고민 한 줄, 카드 세 장 | 쏠 타로 하우스",
    ogDescription: "무료 타로, 출시 2주 만에 10만 명이 뽑았어요. 고민 한 줄 적고 카드 세 장, 운세 말고 내 고민을 다시 보는 웰니스 타로예요. 전문 심리상담사가 만들었어요.",
  };
}
