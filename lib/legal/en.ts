// 영문 사이트의 정책 문서 목록·사업자 정보(owner 2026-11-08 "영문 약관·방침·사업자 정보 전부").
// 문서 원문은 docs/policies/en/*.md(기획 초안 v1.1.2 — 법률 검토 전). 화면 주소는 /en/legal#<id>.
export const EN_DOCS = [
  { id: "terms", file: "05_terms-of-use.md", label: "Terms of Use" },
  { id: "privacy", file: "01_privacy-policy.md", label: "Privacy Policy" },
  { id: "worry-consent", file: "02_worry-consent.md", label: "Consent for What You Write" },
  { id: "health-data", file: "03_consumer-health-data-privacy-policy.md", label: "Consumer Health Data Privacy Policy" },
  { id: "cookies", file: "04_cookie-policy.md", label: "Cookie Policy" },
  { id: "refund", file: "07_refund-policy.md", label: "Refund Policy" },
  { id: "disclaimer", file: "06_disclaimer.md", label: "Disclaimer" },
] as const;

export const enLegalUrl = (id: (typeof EN_DOCS)[number]["id"]) => `/en/legal#${id}`;
export const EN_IMPRINT_URL = "/en/imprint";

// 사업자 정보(기획 08 문서 6장 영문 표기 그대로 — 한국어 하단 SiteFooter와 같은 사업자)
export const EN_BUSINESS = {
  name: "SSOL Wellness House",
  representative: "Junseok Kim",
  businessNo: "572-07-03549",
  mailOrderNo: "2026-Seoul Mapo-2770",
  address: "Room 408, 4F, 100 Dongmak-ro, Mapo-gu, Seoul, Republic of Korea",
  phone: "+82-10-2835-2263",
  email: "contact@ssolwellness.com",
} as const;
