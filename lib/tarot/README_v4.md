# 쏠 타로 v4.0 코드 — 개발자용

결과 화면을 넘겨 보기 11쪽으로 만든다. 결정형 고민(A인가 B인가)이면 카드 점수로 방향을 정하고, 그 방향을 결론으로 보여 준다.
규칙은 `쏠타로_규칙_v4초안.md`(S 안전 · R 방향 · V 검증)를 따른다. Node 18 이상이면 되고 외부 패키지는 없다.

## 파이프라인 순서

| # | 언제 | 하는 일 | 코드 |
|---|---|---|---|
| 1 | 고민 제출 | A 분류(domain·emotions·need·qtype·qsub·crisis_level·violence) | `selectCards.validateClassification` |
| 2 | 고민 제출 | A2 고민 틀(worry_type·options·option_axis·core_question·hidden_question·deadline·duration·money·table·user_words) | `validateV4.parseFrame` |
| 3 | 고민 제출 | 안전 확인: 키워드와 AI 판정을 합침. urgent면 카드를 멈추고 안전 안내 | `safety.screenText` → `mergeSafety` → `nextScreenFor` |
| 4 | 셔플·뽑기 | 22장 셔플(방향 포함) → 3장 뽑기 | `deck.createShuffle` → `pickSlot` / `picksFromSlots` |
| 5 | 3장째 | 점수표 고르기 → 방향 계산 → C 호출·검증 | `decision.pickTable` → `decision.lean` → `validateV4.parseC` |
| 6 | 결제 후 | D(5·6쪽) 호출·검증, E(7~10쪽) 호출·검증 | `assembleReport.parseStoryApply`, `validateV4.parseE` |
| 7 | 조립 | 기존 10쪽 → v4 11쪽 | `assembleReport.buildPages` → `pagesV4.buildPagesV4` |
| 8 | 화면 | 안전 안내 박스(폭력·두려움) | `assembleReport.buildSafetyNotice` |

예시 전체 흐름은 `fixtures/runCase.mjs`(도현님 결정형)와 `demo_pipeline.mjs`(비결정형 3건 + 도현님)에 있다.

## 함수별 입출력

| 함수 | 입력 | 출력 |
|---|---|---|
| `screenText(text, kw)` | 원문, `data.safety_keywords` | `{level: "urgent"\|"none", violence, fear, matched}` |
| `mergeSafety(local, ai)` | 위 결과, A 분류 | 같은 모양(높은 쪽을 따름. AI의 watch는 none) |
| `parseFrame(raw)` | A2 출력(문자열·객체) | `{frame\|null, errors[]}` |
| `pickTable({frame, cls, tables})` | 고민 틀, A 분류, `decision_tables.json` | 표 이름 8종 또는 `null` |
| `lean({picks, type, tables, frame, money?, name})` | 뽑은 카드 3장, 표 이름 | `{table, side: move\|stay, strength: strong\|clear\|slight, score, with_condition, option, other, cards[{position, score, weight, meaning}], small_note?}` |
| `reasonFallback(meaning, side)` | 카드 뜻, 쪽 | "{뜻}이라/라, 움직이는/머무는 쪽을 가리켜요." |
| `parseC(raw, {decision, strength, frame, lean, violence})` | C 출력 | `{links, teaser_headline, teaser_lead, reasons, errors[]}`(걸린 칸만 null) |
| `parseE(raw, {lean, frame, violence})` | E 출력 | `{E\|null, errors[]}` |
| `buildPages({...})` | 기존 v3.3 인자 | 10쪽 배열 |
| `buildPagesV4({base, frame, lean, C, E, name, paid, data})` | 10쪽, 위 결과들 | 11쪽 배열(`endingFails`: 말투를 못 바꾼 문장 끝) |
| `endings.balance(lines, seed)` / `boldFirstLines(lines)` | 줄 배열 | ~요/~니다 50:50 / 문단 첫 문장 굵게 |
| `planHead(lean)` | lean 또는 null | 계획 블록 머리말 |

- 방향 계산: 자리 가중치는 1·1·2. 합이 0 이상이면 move이고, |합| 3 이상은 strong, 1.5 이상은 clear, 그 아래는 slight. `frame.money`가 true면 `small_note`(R10)가 붙는다.
- 결정형의 조건은 `frame.worry_type === "decision"`이면서 `lean`이 있는 것이다(= `pickTable`이 null이 아님). 커리어 등은 `frame.table`만 믿는다. 연애는 `cls.qsub` → `qsub_map`로 표를 찾는다.

## 실패 시 대체 경로

| 상황 | 결과 |
|---|---|
| 고민 미작성 | A·A2·C·D·E 호출 안 함. frame=null → 1쪽 틀 상자 없음, E 없는 비결정형 경로 |
| A2 탈락(`parseFrame`의 frame=null) 또는 `pickTable`=null | 비결정형 경로(방향 계산 안 함) |
| C 전체 탈락(now/hold/step line) | `links=null` → 2~4쪽 AI 한 줄 없음, 5쪽 headline·lead는 DB 조각(`composeTop`) |
| C teaser만 탈락 | 5쪽 첫 문구 = R7 두 틀(`teaserFallback`: strong·clear 1안 / slight 2안) |
| C reasons만 탈락 | 5쪽 카드별 한 줄 = `reasonFallback(lean.cards[i].meaning)` |
| D 탈락 | 5·6쪽 = DB 조합 문장(`comboStory`·`apply_fallback`) |
| E 탈락, 결정형 | 7쪽 = 코드 방향 블록(결론 + 카드별 한 줄 + ※). 계획 블록 없음. 8쪽 = 기존 열쇠 + DB 신호, 9·10쪽 = DB 처방·실천(9쪽 맨 위에 결론 headline·lead) |
| E 탈락, 비결정형 | 7쪽 = 흐름 + 이렇게 읽은 이유, 8쪽 = 열쇠 + DB 신호, 9·10쪽 = DB |
| E 통과, 비결정형 | 7쪽 = 흐름 + 이렇게 읽은 이유 + "이번 주에 이것부터", 8쪽 = E.change |
| 결제 전 | 6~11쪽 body=null, 블러는 `copy.result.blur_samples.pages`(11쪽 번호) |

재생성은 1회까지 하고, 그래도 실패하면 위 대체 경로로 간다. `errors`는 운영 로그에 남긴다.

## 렌더러 줄 머리 규칙

| 줄 머리 | 그리기 |
|---|---|
| `## ` | 큰 제목(5쪽 첫 문구, 9쪽 결론 headline) |
| `**…**` | 굵게(문단 첫 문장, 결론 줄) |
| `◦ ` | 목록 |
| `▸ ` | 연결 줄(처방이 어느 분석에서 나왔는지) |
| `• ` | 굵은 목록(처방 제목, 실천 카드) |
| `※ ` | 작은 글씨(R10 돈 안내. 굵게·말투 변환 안 함) |
| `[[읽기 지도: …]]` / `[…]` | 읽기 지도 / 이미지·버튼 자리 |
| 소제목 | `pagesV4.SUBHEADS`의 줄, 그리고 `PLAN_HEAD_RE`(/이번 주에 이것부터$/)에 맞는 줄 |

계획 머리말(`PLAN_HEADS`, 데이터 `copy.result.v4.plan_head`):

| 경우 | 머리말 |
|---|---|
| 변화형 표(job·start·move), stay | 남는 쪽으로 정했다면, 이번 주에 이것부터 |
| 변화형 표(job·start·move), move | 옮기는 쪽으로 정했다면, 이번 주에 이것부터 |
| 관계형 표(approach·reunion·progress·continue·newlove) | ‘{선택지 이름}’ 쪽으로 정했다면, 이번 주에 이것부터 |
| 비결정형 | 이번 주에 이것부터 |

## 데이터 (v4.0)

- `copy.result.pages`는 11쪽 기준이다(8쪽 key=`change`). `buildPages`(10쪽)는 key로 제목·teaser·블러를 찾는다.
- `copy.result.v4`는 11쪽 고정 문구다. 코드는 데이터를 먼저 쓰고, 없으면 `pagesV4.V4_COPY`를 쓴다.
- `copy.safety.fear_box`는 관계 속 두려움(S4-5) 안내다.
- `safety_keywords`
  - `deprecated_watch`: 코드가 쓰지 않는다(S2 삭제, 기록용).
  - `violence`: 구체 행동만 담는다.
  - `fear`: 그 사람이 무섭다는 표현이다.
- 주의: `07_DB/build_data.py`로 tarot_data.json을 다시 만들면 위 변경이 사라진다. 빌드 스크립트에도 같은 변경이 필요하다.

## 테스트

```
cd 03_코드
node test_tarot.mjs        # 전체 단위 테스트(도현님 11쪽 = fixtures/도현/expected_pages_5차.json)
node demo_pipeline.mjs     # 01_설계/example-reports/ 에 01~04 예시 리포트 생성
```
