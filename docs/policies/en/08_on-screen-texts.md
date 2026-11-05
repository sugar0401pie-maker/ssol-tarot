# On-screen notices and consent texts (개발용)

개발에 바로 넣을 화면 문구예요. 위치는 한국어로, 문구는 영어로 적었어요. [ ] 안의 링크는 각 정책 페이지로 연결해요. 아스트로판과 달리 출생정보가 없어서 **동의 체크박스 ②는 고민을 쓸 때만** 나와요.

## 1. 닉네임 화면 (/en, 환영 화면) — 체크박스 ① 1개

빈 칸으로 시작하고, 체크해야 닉네임 확인 버튼(이렇게 불러주세요)이 켜져요.

| 자리 | 문구 |
| --- | --- |
| 체크박스 ① (필수) | I am 18 years old or older, I agree to the [Terms of Use], and I have read the [Privacy Policy]. |
| 미체크 시 안내 | Please tick the box to continue. |

## 2. 고민 쓰기 화면 — 체크박스 ② (고민을 쓸 때만, 별도 동의)

입력란에 글자를 쓰기 시작하면 [Submit] 버튼 위에 나타나요. 체크해야 [Submit]이 켜져요. [I'd rather keep it in my head](고민 없이 진행)에는 동의가 필요 없어요.

| 자리 | 문구 |
| --- | --- |
| 체크박스 ② (필수, 별도 동의) | I agree that SSOL may use what I write, including anything about my health, relationships or safety, to create my reading and to check for signs that I may need help. My text is sent to OpenAI to help write my reading. [Details] |
| ② 아래 작은 글씨 | Used only for your reading and your safety · Never shown on your share card · Kept until you delete your account (30 days if you don't sign in) · You can withdraw anytime. |
| 입력란 아래 작은 글씨 | Please leave out other people's names and contact details. "My manager" or "my ex" is enough. |
| ② 옆 AI 안내 한 줄 | Your text goes to OpenAI only to help write your reading. It isn't used to train AI and is deleted there within 30 days. Prefer not to? Tap "I'd rather keep it to myself" and still get your cards. |
| [Details] 팝업 | 02_worry-consent 전문 |
| 미체크 시 안내 | Please tick the box to submit. If you'd rather not, you can still draw cards without writing anything. |

## 3. 결과 화면 — 면책 한 줄

| 자리 | 문구 |
| --- | --- |
| 무료 결과·전체 리포트 맨 아래 | For entertainment and self-reflection only. The cards don't predict the future. Not medical, psychological, legal or financial advice. [Disclaimer] |
| 돈·투자·큰 지출 고민일 때(7쪽 맨 아래, 기존 fineprint 대체) | The final call is yours, {name}. The cards can't see amounts or terms, so they can't be a basis for real money decisions. Please decide carefully. |

## 4. 결제 화면

청약철회권 포기는 약관에 두고, 결제 버튼 바로 위에 안내 문구만 넣어요(체크박스 아님).

| 자리 | 문구 |
| --- | --- |
| 상품명·가격 | Full report — US$1.99, one-time payment. No subscription, no automatic renewal. |
| 가격 아래 작은 글씨(선택) | ≈ {local_price} · You'll be charged in US dollars. (영국 GBP·독일 EUR·인도 INR 등 접속 국가 통화로 하루 환율 표시, 결제는 USD) |
| 결제 버튼 위 | Your report unlocks right after payment. By paying, you ask us to deliver it now and agree that you can't cancel once it is shown, as set out in the [Terms of Use] and [Refund Policy]. |
| 결제 버튼 | Pay US$1.99 and see my full reading |
| 결제수단 안내 | Visa · Mastercard · JCB · PayPal. Your bank may add a foreign-transaction fee. |
| 결제 완료 | Payment complete. Your full report is ready. We've emailed you a receipt and order confirmation. |
| 결제 실패 | Payment didn't go through, and you were not charged. Please try again or use another method. |

**주문 확인 이메일 (결제 직후 자동 발송, 필수)** — EU·UK 소비자법상 청약철회권이 없어지려면 이 내용을 이메일 등 남는 매체로 보내야 해요. 로그인 없이 결제한 경우 결제 화면에서 받은 이메일(토스·PayPal)로 보내요. **이메일에 고민 글·카드 해석은 넣지 않아요.**

| 자리 | 문구 |
| --- | --- |
| 제목 | Your SSOL Tarot House full report — order confirmation |
| 본문 | Thanks for your order. Order no. [번호] · Full tarot report · US$1.99, one-time payment, no renewal · Paid on [date, time] with [method]. |
| 철회권 확인 | Before paying, you asked us to deliver your report right away and acknowledged that you lose your right to cancel once it is shown to you. |
| 하단 | Seller: SSOL Wellness House · 572-07-03549 · Room 408, 4F, 100 Dongmak-ro, Mapo-gu, Seoul · contact@ssolwellness.com · Contact number +82-10-2835-2263 · [Terms of Use] · [Refund Policy] |

## 5. 쿠키 배너 (EU·UK 접속 시 첫 방문, 그 외 지역은 하단 작은 배너)

| 자리 | 문구 |
| --- | --- |
| 본문 | We use essential cookies to run this site. With your OK, we also use analytics cookies to improve it and ad cookies to measure our X ads. We never send what you write to anyone for ads. [Cookie Policy] |
| 버튼 | Accept all · Reject optional · Choose |
| [Choose] 항목 | Essential (always on) · Preferences · Analytics · Advertising |
| 저장 버튼 | Save my choices |

"Reject optional"은 "Accept all"과 같은 크기·강조로 보여야 해요(EU 기준). 거부하면 Google Analytics와 X 픽셀을 불러오지 않아요.

## 6. 푸터 (홈 화면 포함 모든 페이지)

| 자리 | 문구 |
| --- | --- |
| 링크 | Imprint (Impressum) · Terms of Use · Privacy Policy · Cookie Policy · Refund Policy · Disclaimer · Consumer Health Data Privacy Policy · Cookie settings · Do Not Sell or Share My Personal Information |
| Imprint (Impressum) 페이지 | 독일 디지털서비스법(DDG) §5용. 사업자 정보 그대로: SSOL Wellness House · Representative: Junseok Kim · Business registration no. 572-07-03549 · Mail-order business registration no. 2026-Seoul Mapo-2770 · Room 408, 4F, 100 Dongmak-ro, Mapo-gu, Seoul, Republic of Korea · contact@ssolwellness.com · +82-10-2835-2263 |
| 사업자 정보 1줄 | SSOL Wellness House · Representative: Junseok Kim · Business registration no. 572-07-03549 · Mail-order business registration no. 2026-Seoul Mapo-2770 |
| 사업자 정보 2줄 | Room 408, 4F, 100 Dongmak-ro, Mapo-gu, Seoul, Republic of Korea |
| 사업자 정보 3줄 | Contact number: +82-10-2835-2263 · contact@ssolwellness.com |
| 저작권 | © 2026 SSOL Wellness House |

워싱턴주 건강정보법상 Consumer Health Data Privacy Policy 링크는 홈 화면에서 눈에 띄게 보여야 해요.

## 7. Do Not Sell or Share 페이지

| 자리 | 문구 |
| --- | --- |
| 제목 | Do Not Sell or Share My Personal Information |
| 본문 | We don't sell your personal information. We do use the X pixel to measure our ads, which California law may treat as "sharing." Turn it off below. We also honor Global Privacy Control signals from your browser. |
| 토글 | Allow ad measurement (X) — On / Off |
| 저장 후 | Saved. We won't share your information for ads on this browser. |

## 8. 쏘웰라 AI 버튼 (10쪽, 영어 채팅 열림)

| 자리 | 문구 |
| --- | --- |
| 리포트 화면 버튼 | Start a chat with Sowella AI |
| 버튼 위 안내 | Sowella AI is our wellness coaching chat. New members get a free 3-day pass. |
| 버튼 아래 작은 글씨 | Sowella AI will use what you wrote, your cards and your reading (the full report if you bought it) to tailor the chat. Replies are written by AI. |
| 로그인 안 했을 때 | Sign in to chat with Sowella AI. Your reading moves to your account. |
| 3일권 시작 안내(쏘웰라 가입 시) | Your free 3-day pass starts now and ends on [date, time]. |
| 3일권 종료 | Your 3-day Sowella AI pass ends today. |

쏘웰라 채팅 페이지에는 Google Analytics·X 픽셀을 넣지 않아요. 채팅 화면에는 "You're talking to AI, not a human" 고지를 항상 보이게 둬요.

## 9. 위기·폭력 안내

국가별 연락처 카드(아스트로판과 같은 목록)를 그대로 쓰고, 제목·본문만 아래처럼 넣어요. 위기(urgent)면 카드 진행을 멈추고 이 화면을 보여 줘요.

| 자리 | 문구 |
| --- | --- |
| 위기 화면 제목 | Right now, a real voice matters more than the cards |
| 위기 화면 본문 | What you wrote tells us you're going through something really hard. You don't have to get through it alone. You can talk to someone right now: [국가별 번호]. SSOL Tarot House isn't for emergencies. If you need ongoing help, please see a psychiatrist or another mental health professional near you. |
| 위기 화면 버튼 | Find mental health care near you · Go back |
| 버튼 연결 | 아스트로 위기 카드와 같은 국가별 번호(미국·캐나다 988, 영국·아일랜드 116 123, 호주 13 11 14, 뉴질랜드 1737, 인도 14416, 싱가포르 1767, 독일 TelefonSeelsorge, 프랑스 3114, UAE 800-4673) + 그 외 findahelpline.com. 쏠 웰니스 세션(한국)으로는 연결하지 않음 |
| 폭력 안내 박스 | Being hit or threatened isn't something you should handle alone. Please reach out for help: {dv_line} (24 hours), or {emergency} in an emergency. |
| 주의(watch) 안내 한 줄(결과 맨 아래) | When things feel really hard, you don't have to carry it alone. {crisis_line} (24 hours) is there to listen. |

## 10. 날짜·시간 표기 (영문판 전체)

결과 저장일·영수증·주문 확인 이메일·3일권 종료 시각은 월 이름으로 써요(아스트로와 같음): Nov 5, 2026 · 14:30 (24시간제). 숫자만 쓴 날짜(11/05/2026)는 영국·독일·인도에서 일·월이 바뀌어 읽혀요.
