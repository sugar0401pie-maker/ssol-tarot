# 영문판 AI 프롬프트 변경 메모 (2026-11-03)

기준: `ai-prompts-tarot-v4.md` v4.2(C·D·E1·E2·공통 규칙 v4) + `A2_고민틀_프롬프트_v4.6.txt` + `ai-prompts-tarot-v2.md`의 A(안전 판단 v4.1). 충돌 시 v4.2를 따름.
**JSON 키·코드값(domain/emotions/need/qtype/qsub/table/mode/worry_type/crisis_level 등)·출력 형식은 한 글자도 바꾸지 않음.** 사람이 읽는 값만 영어.

## 공통 (C·D·E1·E2)
- 규칙 10(~요/~니다 교대) 삭제 → "쉬운 미국 일상 영어, 2인칭, 짧은 문장, 축약형 허용, {nickname}으로 부르고 존칭·Mr./Ms. 없음"으로 교체.
- 규칙 11(~기 때문입니다) → "because가 들어간 완결 문장, 'Because …' 조각 문장 금지".
- 규칙 12·12-1 한국어 금지어 목록 → 글로서리의 영어 금지어(somehow, something, vibes, the universe, hold space, lean into, sit with, flow 단독 등) + 확신어 금지(definitely, certainly, guaranteed, always will, never will). 좋은 동사: focus on, decide, sort out, pick, choose, let go of, put down.
- 규칙 14 "영어 금지" → "한국어 낱말·이론명·심리 전문용어 금지".
- 자리 이름은 글로서리 고정어(The Road So Far / The Current Now / The Key Ahead), 기간은 early on (months 1–2) / midway (months 3–4) / later (months 5–6).
- 그 밖의 CSO 결정(방향은 코드가 정하고 바꾸지 않음, 제3안 금지, 부부 이혼·별거 결론 금지, 연애는 늘 방향, 돈은 방향만·금전 구체 판단 금지, 폭력이면 다가가기 권유 금지, 역방향은 나쁘지 않음, 지어내기·요일·기한 금지, 실제로 할 수 있는 단순 행동만, 7/8/9쪽 행동 역할 분리)은 그대로.

## 프롬프트별
| 파일 | 바꾼 것 | 이유 |
|---|---|---|
| A_classify_en.txt | 영역 설명·qsub 이름을 영어로, 한국 은어(읽씹·잠수·어장·자니?·환승·소프트 런칭) → 영어 은어(left on read, ghosting, breadcrumbing, "u up?" texts, monkey-branching, soft launch) | 영어권 사용자 말로 판별해야 함 |
| | 위기 예시 영어화: urgent = "I want to die", "kms", "unalive", "I won't be here much longer", 자해, 작별 준비 / watch = "I wish I could disappear", "what's the point of living" 등 / none = 관용 표현("starving to death", "died laughing", "this exam is killing me"), 이별 뒤 한 달 안 된 입맛 없음 | CSO 2026-10-22 기준 그대로 |
| | 예시 2개 추가: "헤어지면 죽겠다"로 붙잡음 → violence=true·urgent 아님 / 이별 4일째 못 먹음 → none | 영어 예시에서 놓치기 쉬운 두 경계를 명시 |
| | 모든 예시 JSON에 qtype·qsub(없으면 null)·fear를 채움 | 원본 예시는 키가 빠진 것이 섞여 있었음. 출력 형식 줄과 키를 맞춰 파싱 실패를 줄임(값 판단은 원본 그대로) |
| A2_frame_en.txt | 표 이름 옆에 글로서리 라벨, 기본 선택지 영어화, rank 예시 현지화(제주·세종·수원 → Honolulu·Denver·Austin, 공시 → civil service exam, 친정/시댁 → my parents'/my in-laws') | 영어 사용자 맥락 |
| | "(암시)" → " (implied)" | 사람이 읽는 값 |
| C_en.txt | teaser 두 틀을 영어 고정 문장으로, ask 틀 → "Until now, haven't you been …?" / "Right now, are you …?" / "From here, which would you rather choose: … or …?" | 글로서리의 자리 첫머리 규칙 |
| D_en.txt | 서버 결론 줄 → "To put the conclusion first: the three cards point to ‘○○’." / apply 2문단 시작 "예를 들어" → "For example," / 제안 위치 "9·10쪽" → "8–9쪽" | v4.2에서 8 처방·9 실천·10 쏘웰라로 바뀜(원문이 옛 쪽 번호) |
| E1_en.txt | head 틀 → "The three cards point to ‘{option}’." (strong: "clearly point to", slight: "point a little more to") / if_then 틀 영어화 / 첫머리에 "a tarot that suggests action: clearly, decisively, concretely" 추가 | 제품 톤 |
| E2_en.txt | bridge 틀 → "To move toward ‘○○’" / "To loosen the ‘○○’ that The Current Now showed" / 비결정형 "To bring The Key Ahead's ‘○○’ into your day-to-day" | 사람이 읽는 값 |

## 개발 확인 필요
- 검증기에서 한국어 문자열을 찾는 곳은 영어로 바꿔야 함: `(암시)`→`(implied)`, `세 장은 ‘…’ 쪽이에요`→`The three cards … point … to ‘…’.`, `예를 들어`→`For example,`, `다만`→`That said,`, 원문 보존 검사(원문 낱말 포함 여부)는 영어 단어 단위로.
- A2 사용자 블록의 비슷한 정답 5개(`frame_gold_v1.jsonl`, 글자 2~4그램 TF-IDF)는 한국어 데이터 → 영어판은 영어 정답 세트를 새로 만들거나 그전까지 예시 없이 호출. 예시 위 안내 한 줄 영어: "The examples below show how to pick the table and order the options. Don't copy their option wording; use the words from this worry."
- `safety.js` 서버 키워드도 영어 목록 필요(A의 urgent/watch 표현 참고).

## 길이 규칙 (한글 글자 → 영문 characters, ×1.9 후 반올림)
| 프롬프트 | 칸 | 한국어 | 영어 |
|---|---|---|---|
| C | now/hold/step line | 15~90자 | 30–170 |
| C | headline (비결정형) | 8~40자 | 15–75 |
| C | lead (비결정형, 1문장) | 25~120자 | 50–230 |
| C | ask | 15~95자 | 30–180 |
| D | story_head | 15~50자 | 30–95 |
| D | story 1문단 (2~3문장) | 80~300자 | 150–570 |
| D | story 2문단 (2~4문장) | 90~350자 | 170–670 |
| D | apply_head | 15~50자 | 30–95 |
| E1 | flow.head | 12~45자 | 25–85 |
| E1 | flow.body (2문장) | 60~230자 | 115–440 |
| E1 | direction.head | 20~50자 | 40–95 |
| E1 | direction.body (3~4문장) | 150~420자 | 285–800 |
| E1 | plan.how | 20~70자 | 40–135 |
| E2 | rx.bridge | 25~45자 | 50–85 |
| E2 | rx.title / three·week.title | 8~20자 | 15–40 |
| E2 | rx.how (1문장) | 35~70자 | 65–135 |
| E2 | rx.why | 25~60자 | 50–115 |
| E2 | three·week.how (1문장) | 35~65자 | 65–125 |
| E2 | three·week.why | 25~55자 | 50–105 |

문장 수 규칙(1문장·2~3문장 등)은 그대로. A·A2·D apply 문단에는 글자 수 규칙 없음.
