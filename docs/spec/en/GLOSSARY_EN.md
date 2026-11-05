# SSOL Tarot House — English edition: glossary & style guide (v1.2, 2026-11-05 — aligned with SSOL Astro House / Sowella AI glossary and the overseas persona review; full rules in the tarot translation prompt v1.1)

The English edition is a separate test (own site/data), built from the Korean v4.2 package. Translate meaning and tone, not word order. When a fixed term below exists, always use it exactly.

## 1. Names (fixed)
| Korean | English |
|---|---|
| 쏠 웰니스 하우스 | SSOL Wellness House |
| 쏠 타로 하우스 | SSOL Tarot House |
| 쏘웰라 (AI 대화) | Sowella AI (first mention; "Sowella" later in the same text) |
| 쏠 바다 친구들 | the SSOL Sea Friends |
| 정방향 / 역방향 | upright / reversed |
| 원래 타로 ○○ 카드 자리 | the place of ○○ in traditional tarot (keep English arcana names: The Fool, The Magician …) |

## 2. Cards (fixed card names · characters)
| no | Korean | English card name | Character |
|---|---|---|---|
| 0 | 첫 물장구 | The First Splash | River Otter |
| 1 | 여덟 갈래의 손 | Eight Arms | Octopus |
| 2 | 고요히 바라보기 | Quiet Watching | Heron |
| 3 | 품어 주는 품 | The Embrace | Sea Otter |
| 4 | 지키는 자리 | The Guardian's Post | Penguin |
| 5 | 오래된 지혜 | Old Wisdom | Turtle |
| 6 | 나란히 헤엄 | Swimming Side by Side | Mandarin Ducks |
| 7 | 파도를 타는 힘 | Riding the Wave | Dolphin |
| 8 | 진주를 품는 힘 | Making the Pearl | Clam |
| 9 | 나만의 등불 | My Own Lantern | The Old Man of the Sea |
| 10 | 물살의 순환 | The Turning Current | Stingray |
| 11 | 고요한 균형 | Still Balance | Swan |
| 12 | 바위 위의 쉼 | Rest on the Rock | Seal |
| 13 | 새 집으로 이사 | Moving to a New Shell | Hermit Crab |
| 14 | 물과 뭍 사이 | Between Water and Land | Frog |
| 15 | 부풀어 오른 마음 | The Puffed-Up Heart | Pufferfish |
| 16 | 다시 쌓는 둑 | Rebuilding the Dam | Beaver |
| 17 | 다시 빛나는 별 | The Star Shines Again | Starfish |
| 18 | 달빛 아래 떠다니기 | Drifting in Moonlight | Jellyfish |
| 19 | 햇살 바위 | Sunny Rock | Fur Seal |
| 20 | 부름에 답하다 | Answering the Call | Humpback Whale |
| 21 | 한 바퀴의 바다 | The Whole Sea | All the SSOL Sea Friends |

## 3. Positions, pages, other fixed terms
| Korean | English |
|---|---|
| 지나온 길 | The Road So Far |
| 지금의 흐름 | The Current Now |
| 앞으로의 열쇠 | The Key Ahead |
| 카드는 이렇게 말해요 | What the card says |
| 오늘 당신에게 온 세 장 | Your three cards today |
| 세 장이 함께 들려주는 이야기 | The story your three cards tell |
| 내 고민에 대어 보면 | What this means for you |
| 해결의 흐름 | How this resolves |
| 그래서, 이렇게 해 보세요 | So, here's what to try |
| 이번 주 실천 카드 | This week's practice cards |
| 쏘웰라와 이어서 이야기하기 | Keep talking with Sowella |
| 카드가 가리키는 방향 | Where the cards point |
| 이번 고민에서 끝까지 함께 볼 것 | What we'll keep in view |
| 선택지 / 결국 묻는 것 / 먼저 풀어야 할 물음 / 기한 | Your options / The real question / The question underneath / Deadline |
| 오늘 / 3일 안에 / 이번 주 | Today / Within 3 days / This week |
| 처방 | suggestion (never "remedy": it sounds like treatment) |
| 실천 | practice |
| 고민 | worry (in UI: "your question" / "what's on your mind") |
| 초반(1~2개월) / 중반(3~4개월) / 후반(5~6개월) | early on (months 1–2) / midway (months 3–4) / later (months 5–6) |
| 약 6개월 | about six months |
| 고민 영역: 직업·커리어 / 진로·자기계발 / 연애 / 가족 / 교우·사회관계 / 재정·생활안정 | Work & career / Direction & growth / Love / Family / Friends & social life / Money & stability |

Decision tables (labels): approach = Reaching out · reunion = Getting back together · progress = Taking the next step · continue = Staying together · newlove = New love · job = Changing jobs · start = Starting (do / don't) · move = Moving out · express = Speaking up · boundary = Setting boundaries.

## 4. Placeholders and Korean-only tokens
- Keep every `{name}`, `{nickname}`, `{c}`, `{c1}`, `{c2}`, `{c3}`, `{frag}`, `{option}`, `{now}`, `{hold}`, `{step}`, `{count}`, `{seconds}`, `{picked}` exactly as written.
- `{결론}` → `{conclusion}`.
- Korean particle tokens are removed in English: `{c:이}`, `{c:은}`, `{now:이}`, `{hold:을}`, `{hold:으로}`, `{step:으로}`, `{eul}` etc. → delete the `:…` part or the token, and rebuild the sentence so it reads naturally (e.g. `‘{c}’{c:이} 힘이 …` → `‘{c}’ came out …`).
- `{name}님` → `{name}` (no honorific). Never add "Mr./Ms.".
- Keep `**bold**` markers if present. Keep `\n` line breaks and `◦ • ▸ ※ #` symbols.
- Korean quotes ‘ ’ → keep ‘ ’ around card names and option names (the code uses them); other quotes → “ ”.

## 5. Voice and style (same rules as the Korean edition)
- Warm, plain, everyday American English. Second person ("you"). Short sentences. Contractions are fine ("you've", "it's").
- Concrete and factual: real scenes and actions, not abstractions. The reader came because things are hard — say clearly what has been hard and what is blocking them.
- Banned: vague or mystical filler ("somehow", "something", "a certain energy", "the universe", "vibes", "flow" on its own, "hold space", "lean into", "sit with"), certainty words ("definitely", "certainly", "always will", "never will", "guaranteed"), diagnoses or labels ("anxious attachment", "avoidant", "depression", "toxic"), literary flourishes ("illuminate", "embrace the light"). "Focus on", "decide", "sort out", "let go of", "choose", "put down" are good concrete verbs.
- Reversed cards are not "bad": energy held inward or overused. Don't use "bad card", "warning", "ominous".
- Don't predict dates; don't promise outcomes about other people.
- Korean alternates "~요/~니다" endings; English has no equivalent — ignore it.
- Keep the same number of sentences as the Korean text. If Korean says "한 문장", write one sentence.
- Length: English is usually 1.6–2.2× the Korean character count. Don't pad.
- Korean position-reading openers map like this: "그동안 …" → "Until now, you've …" / "So far, …"; "지금은 …" → "Right now, …"; "앞으로는 …" → "From here, …".

## 6. Decisions (2026-11-05)
- Full report price: US$1.99 (data rows use {price}). An optional "≈ local price" hint may show under it; the charge is always in USD.
- Sowella AI's free 3-day pass is a Sowella AI sign-up perk, not part of the tarot report.
- Crisis screen: crisis contacts by country (same list as SSOL Astro House) + findahelpline.com, and "please see a psychiatrist or another mental health professional". Never SSOL wellness sessions.
- Korean saju / zodiac animals are kept and labeled as Korean; other Korea-only life details are localized.
- Card pick slots use the position names: The Road So Far / The Current Now / The Key Ahead.
- UI words: "reading" not "test" (Start my reading); "your question" / "what's on your mind" rather than "worry" in UI copy.
- Traditional arcana names are shown, including Death (13) and The Devil (15), with a one-line reframe.
