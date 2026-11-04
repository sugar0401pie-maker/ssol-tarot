// /about(테스트 상세 소개, SEO용) 문구 — owner 2026-11-04 전달 `tarot_타로하우스_상세소개페이지_v2.md` 1장 본문 그대로.
// 원문의 "(홈, 자료 n쪽)" 근거 표시는 넣지 않았다. 아래 항목은 owner 확정 전까지 화면·JSON-LD 모두에서 뺐다(주석으로만 남김).
//  - ⚠️ 표 '유료 990원' 행(장 구성 확인), FAQ 3·4·5·6·8·9·13
//  - 원문에 ⚠️는 없지만 지금 서비스와 달라 뺀 것(owner 확인 대기):
//    · 표 '무료' 행 + FAQ 7 "결과 4쪽까지 — 카드 3장과 내 고민 해석": 2026-11-02부터 세 번째 카드는 결제 뒤에 열린다.
//      실제 무료 범위 = 1~3쪽(첫 번째·두 번째 카드 + 고민 풀어보기), 4쪽은 세 번째 카드 뒷면 + 결제 상자.
//    · 표 '쏘웰라 이용권' 행 + FAQ 10 "리포트 결제 시 3일 무료 이용권 포함": 쏘웰라 3일 무료는 쏘웰라에 처음 들어온 날부터
//      누구에게나 주는 체험이라, 타로 결제로 생기는 혜택이 아니다(이미 체험을 쓴 사람은 결제해도 받지 못함).
//  - '만든 사람'(원문 "quiz와 같은 문단")은 문단이 첨부되지 않아 비워 둠.
//  - ⏸ FAQ 14 "내가 쓴 고민은 어떻게 쓰이나요?" / 15 "환불이 되나요?": 개정 약관 확정 후 약관 문구와 똑같이 게시.
// 가격은 lib/billing/pricing.ts의 currentReportPrice()로 넣는다(할인이 끝나면 페이지도 자동으로 정가).

export type Faq = { q: string; a: string };
export type FaqGroup = { title: string; items: Faq[] };

export const ABOUT_PATH = "/about";

export const aboutTitle = "쏠 타로 하우스 — 고민 한 줄로 뽑는 바다 친구들의 오늘의 마음 카드 | 쏠 웰니스 하우스";

export const aboutDescription = (price: string) =>
  `고민을 한 줄로 쓰고 바다 생물 타로 카드 3장을 뽑아요. 22장 자체 제작 카드로 내 고민을 풀어 보고, 전체 리포트(${price})에서 이번 주 실천을 받아요. 예측이 아닌 자기 이해 도구예요.`;

export const H1 = "쏠 타로 하우스 — 바다 친구들이 건네는 오늘의 마음 카드";

export const INTRO =
  "고민을 한 줄로 쓰고 카드 세 장을 뽑으면, 바다 친구들이 내 고민에 맞는 해석과 웰니스 처방을 건네요. 22장 모두 쏠 웰니스 하우스가 직접 만든 바다 생물 타로 카드예요. 미래를 맞히는 도구가 아니라, 지금 마음에 걸리는 고민을 다른 각도에서 바라보게 돕는 도구예요.";

export const participantsLine = (n: number, asOf: string) => `지금까지 ${n.toLocaleString("ko-KR")}명이 참여했어요 (${asOf} 기준 주간 집계)`;

export const AT_A_GLANCE: [string, string][] = [
  ["입력", "지금의 고민 한 줄"],
  ["카드", "바다 생물 × 원래 타로 22장 (자체 제작), 그중 3장을 뽑아요"],
  ["출시", "2026년 10월 30일"],
  ["하지 않는 일", "미래 예측, 진단, 상담 대신하기"],
];

export const steps = (price: string): { strong: string; rest: string; before?: string }[] => [
  { before: "", strong: "랜딩", rest: "에서 시작해요." },
  { strong: "고민 한 줄을 입력", rest: "해요." },
  { strong: "카드 3장을 뽑아요.", rest: "" },
  { strong: "내 고민에 대한 해석", rest: "을 읽어요. (무료)" },
  { before: "더 보려면 ", strong: price, rest: "을 결제하고 세 장이 이루는 관계, 웰니스 처방, 이번 주 실천을 열어요." },
  { before: "처방은 ", strong: "쏘웰라", rest: "로 이어 갈 수 있어요." },
];

export const HOW_TITLE = "타로를 어떻게 다루나요";
export const HOW =
  "타로는 미래를 맞히는 도구가 아니라 지금 마음에 걸리는 고민을 다른 각도에서 바라보게 돕는 도구예요. 카드마다 오늘 해볼 수 있는 작은 웰니스 제안을 함께 드려요.";

export const faqGroups = (price: string): FaqGroup[] => [
  {
    title: "이용 방법",
    items: [
      { q: "어떻게 이용하나요?", a: `고민을 한 줄로 쓰고, 카드 세 장을 뽑아서, 내 고민에 대한 해석을 읽어요. 더 자세한 리포트는 ${price}이에요.` },
      { q: "고민은 어떻게 써야 하나요?", a: "한 줄이면 충분해요. 요즘 마음에 걸리는 일을 편하게 적어 주세요." },
    ],
  },
  {
    title: "결과와 가격",
    items: [{ q: "카드는 누가 그렸나요?", a: "쏠 웰니스 하우스가 직접 만든 카드예요. 바다 생물 캐릭터 22장이에요." }],
  },
  {
    title: "신뢰와 안전",
    items: [
      {
        q: "타로가 미래를 맞히나요?",
        a: "아니요. 타로 카드는 과학적으로 검증된 예측 방법이 아니에요. 쏠 타로 하우스는 미래를 맞히기보다 고민을 다른 각도에서 생각해 보게 돕는 도구로 써요.",
      },
    ],
  },
];

export const DISCLAIMER = "쏠 웰니스 하우스의 서비스는 의학적 진단·치료·처방을 제공하지 않으며, 전문 의료·상담을 대신하지 않습니다.";
export const CTA = "테스트 보러 가기";

/** 화면과 같은 데이터로 만든 구조화 데이터(FAQ 글자가 화면과 똑같아야 함). 가격(offers)·후기는 넣지 않는다. */
export function aboutJsonLd(site: string, price: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${site}${ABOUT_PATH}#app`,
        name: "쏠 타로 하우스",
        description: aboutDescription(price),
        url: `${site}/`,
        mainEntityOfPage: `${site}${ABOUT_PATH}`,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        inLanguage: "ko-KR",
        isAccessibleForFree: true,
        publisher: { "@id": "https://www.ssolwellnesshouse.com/#org" },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqGroups(price)
          .flatMap((g) => g.items)
          .map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
}
