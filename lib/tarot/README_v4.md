# 쏠 타로 v4.1 코드 — 개발자용

결과 화면을 넘겨 보기 11쪽으로 만든다. 결정형 고민(A인가 B인가, 또는 고민 뒤에 숨은 행동)이면 카드 점수로 방향을 정하고, 그 방향을 결론으로 보여 준다.
규칙은 `01_설계/규칙_v4.md`(S 안전 · R 방향 · V 검증)를 따른다. Node 18 이상이면 되고 외부 패키지는 없다.

## v4.1에서 바뀐 것 (CSO 2026-10-22)

| 무엇 | 내용 | 코드·데이터 |
|---|---|---|
| 고민 틀 A2 v4.6 | 출력 `{table, decision_source, mode, rank_reason, worry_type, options_ranked, core_question, hidden_question, deadline, duration, money, user_words, confidence}`. 옛 형식(option_axis)도 계속 받음 | `validateV4.parseFrame`, `decision.lean` |
| 점수표 10개 | approach·reunion·progress·continue·newlove·job·start·move·**express(표현)·boundary(경계)**. '일반 행동(act)'은 없음. start 이름 '시작·실행(한다/안 한다)'. 표마다 `poles`(+·− 뜻)·`implicit`(기본 선택지 2개) | `02_데이터/decision_tables.json` v3 |
| mode | axis: options_ranked = [+ 쪽, − 쪽] → 합 ≥ 0이면 [0], 아니면 [1]. rank: options_ranked = AI 추천 순위 → 카드 +면 1순위, −면 2순위. 3순위 이하는 결론이 되지 않음(`lean.not_concluded`) | `decision.lean` |
| 비슷한 예시(few-shot) | 판별 DB 고민 틀 정답 490건에서 고민 글과 가장 비슷한 정답 5개를 A2 사용자 입력에 붙임(글자 2~4그램 TF-IDF 코사인, 외부 라이브러리 없음) | `retrieve.js`, `frameInput.js` |
| 두 번째 의견 | 같은 5개의 점수 가중 투표 1순위 표가 A2 표와 다르고 **투표 비율 ≥ 0.6**(`decision_tables.json` `second_opinion.min_share`)이면 강도 한 단계 낮춤(strong→clear→slight, slight는 그대로) + `review_log`. 비율이 낮으면 로그만(below_min_share). 화면에는 결론 하나만 | `decision.secondOpinion`, `frameInput.afterFrame` |
| 안전 단계 다시 정리 | urgent = 직접 표현·자해 행동·작별 준비만. **watch 다시 사용** = 소극적 표현·한 달 이상 못 먹음/못 잠·술 의존·방에만 있음 → 결과·방향 그대로 + 마지막 쪽 맨 아래 작은 글씨 한 줄. none = 한 달 안 되게 못 먹음·관계/시험을 '끝낸다'·돈 관리 방식·관용 표현. violence(방향 끔 + 안내 박스 — 남이 말한 협박 "죽어버리겠대요"도 urgent가 아니라 violence, CSO 2차) / fear(안내 박스 + 방향 계산) | `safety.js`, `tarot_data.json` safety_keywords, `pagesV4` |
| 새 형식에서 table null | 방향 계산 안 함(연애 qsub_map으로 넘어가지 않음). 폭력 확인(violence)이어도 방향 끔 | `decision.pickTable` |

## 파이프라인 순서

| # | 언제 | 하는 일 | 코드 |
|---|---|---|---|
| 1 | 고민 제출 | 안전 키워드 1차 확인. urgent면 바로 안전 안내 | `safety.screenText` → `flow`(`localUrgent`) |
| 2 | 고민 제출 | A 분류(domain·emotions·need·qtype·qsub·crisis_level·violence·fear) | `selectCards.validateClassification` |
| 3 | 고민 제출 | **비슷한 정답 5개 찾기 → A2 사용자 입력 조립** | `frameInput.prepareFrameCall`(= `retrieve.findSimilar` + `buildFrameUserBlock` + `retrieve.voteTable`) |
| 4 | 고민 제출 | A2 고민 틀 v4.6 호출·검증 | `validateV4.parseFrame` |
| 5 | 고민 제출 | 안전 합치기(키워드와 AI 중 높은 쪽). urgent만 카드 멈춤, watch·none은 진행 | `safety.mergeSafety` → `nextScreenFor` (`AI_URGENT`) |
| 6 | 셔플·뽑기 | 22장 셔플(방향 포함) → 3장 뽑기 | `deck.createShuffle` → `pickSlot` / `picksFromSlots` |
| 7 | 3장째 | 점수표 고르기 → 방향 계산(mode axis/rank) → **두 번째 의견** → C 호출·검증 | `decision.pickTable` → `decision.lean` → `frameInput.afterFrame` → `validateV4.parseC` |
| 8 | 결제 후 | D(5·6쪽) 호출·검증, E(7~10쪽) 호출·검증 | `assembleReport.parseStoryApply`, `validateV4.parseE` |
| 9 | 조립 | 기존 10쪽 → v4 11쪽(watch면 마지막 쪽 맨 아래 ※ 한 줄) | `assembleReport.buildPages` → `pagesV4.buildPagesV4({..., safety})` |
| 10 | 화면 | 안전 안내 박스(폭력·두려움). watch는 박스 없음 | `assembleReport.buildSafetyNotice` |
| — | 운영 로그 | 두 번째 의견이 다를 때 `review_log`(고민 id·A2 표·유사도 표·투표 비율·점수·강도 전후)를 검수 대기로 쌓음 | `afterFrame().review_log` |

예시 전체 흐름은 `fixtures/runCase.mjs`(도현님 결정형 · 서연님 재회)와 `demo_pipeline.mjs`(비결정형 3건 + 도현님 + 서연님)에 있다. `runCase(dir, data, tables, { index })`에 색인을 주면 few-shot 입력과 두 번째 의견까지 재현한다.

## 함수별 입출력

| 함수 | 입력 | 출력 |
|---|---|---|
| `screenText(text, kw)` | 원문, `data.safety_keywords` | `{level: "urgent"\|"watch"\|"none", violence, fear, matched}` |
| `mergeSafety(local, ai)` | 위 결과, A 분류 | 같은 모양(높은 쪽을 따름 — none < watch < urgent) |
| `nextScreenFor(safety)` | 합친 결과 | urgent → `"safety"`, 그 밖 → `"confirm"` |
| `watchNoteFor({data, safety})` | | watch면 `copy.safety.watch_note`, 아니면 null |
| `buildIndex(rows)` | 고민 틀 정답 줄들(`frame_gold_v1.jsonl`) | 색인 `{size, nearest(text, k=5, {excludeId})}` |
| `nearest(text, k=5, {excludeId})` | 고민 글 | 이웃 `[{id, score, text, table, tables, mode, ranked}]`(점수 내림차순, 마지막 색인) |
| `voteTable(neighbors)` | 이웃 | `{table, share, votes, top_score}` — 점수 가중 투표 1순위 표(null도 한 표)와 비율 |
| `findSimilar(text, {k, excludeId})` / `setRetriever(fn)` | | 운영 진입점. 임베딩 검색으로 바꿀 때 `setRetriever`만 바꿈 |
| `buildFrameUserBlock({worryText, examples})` | 고민 글, 이웃 | A2 사용자 입력 문자열(예시 = `<worry>` + `<answer>{"table","mode","options_ranked"}`, 맨 끝에 이번 고민) |
| `prepareFrameCall({worryText, k, excludeId, index})` | | `{user, neighbors, vote}` |
| `parseFrame(raw)` | A2 출력(문자열·객체, v4.6 또는 옛 형식) | `{frame\|null, errors[]}` — v4.6이면 `options`(= options_ranked)·`option_axis`({move:[0], stay:[1]})도 채움 |
| `isDecisionFrame(frame)` | | 새 형식: table이 있고 선택지 2개 이상 / 옛 형식: worry_type "decision" |
| `pickTable({frame, cls, tables, safety})` | 고민 틀, A 분류, 점수표, 안전 | 표 이름 10종 또는 `null` |
| `lean({picks, type, tables, frame, money?, name})` | 뽑은 카드 3장, 표 이름 | `{table, side: move\|stay, strength, score, mode: axis\|rank, pick: 0\|1, conclusion, option(= conclusion), other, not_concluded?, with_condition, cards[], small_note?}` |
| `secondOpinion({frameTable, simTable, strength, worryId?, simShare?, minShare = 0.6})` | A2 표, 유사도 표, 강도 | `{strength, lowered, disagree, review_log\|null}` |
| `afterFrame({frame, lean, vote, worryId, tables})` (min_share는 tables.second_opinion) | | `{lean(강도만 바뀜), review_log, second_opinion}` |
| `reasonFallback(meaning, side)` | 카드 뜻, 쪽 | "{뜻}이라/라, 움직이는/머무는 쪽을 가리켜요." |
| `parseC(raw, {decision, strength, frame, lean, violence})` | C 출력 | `{links, teaser_headline, teaser_lead, reasons, errors[]}`(걸린 칸만 null) |
| `parseE(raw, {lean, frame, violence})` | E 출력 | `{E\|null, errors[]}` |
| `buildPages({...})` | 기존 v3.3 인자 | 10쪽 배열 |
| `buildPagesV4({base, frame, lean, C, E, name, paid, data, safety})` | 10쪽, 위 결과들 | 11쪽 배열(`endingFails`). watch면 마지막 쪽 `fineprint` 칸 + 본문 끝 `※` 줄 |
| `endings.balance(lines, seed)` / `boldFirstLines(lines)` | 줄 배열 | ~요/~니다 50:50 / 문단 첫 문장 굵게 |
| `planHead(lean)` | lean 또는 null | 계획 블록 머리말 |

- 방향 계산: 자리 가중치는 1·1·2. 합이 0 이상이면 move(axis: + 쪽 / rank: 1순위)이고, |합| 3 이상은 strong, 1.5 이상은 clear, 그 아래는 slight. `frame.money`가 true면 `small_note`(R10)가 붙는다.
- 결정형 경로 = `lean`이 있고 `isDecisionFrame(frame)`. worry_type은 원래 모양 그대로라(implicit이면 relationship_question 등) 경로 판단에 쓰지 않는다(옛 형식만 worry_type "decision").
- 옛 형식 frame에서 table이 null이면 연애는 `cls.qsub` → `qsub_map`로 표를 찾는다. 새 형식에서 table null은 A2의 '방향 없음' 판단이라 그대로 null.

## 실패 시 대체 경로

| 상황 | 결과 |
|---|---|
| 고민 미작성 | A·A2·C·D·E 호출 안 함. frame=null → 1쪽 틀 상자 없음, E 없는 비결정형 경로 |
| 이웃 찾기 실패(색인 없음 등) | 예시 없이 `<worry>…</worry>`만으로 A2 호출(예전과 같음), 두 번째 의견 건너뜀 |
| A2 탈락(`parseFrame`의 frame=null) 또는 `pickTable`=null | 비결정형 경로(방향 계산 안 함) |
| 두 번째 의견 불일치 | 결론(쪽·선택지)은 그대로, 강도만 한 단계 낮춤 + review_log |
| C 전체 탈락(now/hold/step line) | `links=null` → 2~4쪽 AI 한 줄 없음, 5쪽 headline·lead는 DB 조각(`composeTop`) |
| C teaser만 탈락 | 5쪽 첫 문구 = R7 두 틀(`teaserFallback`: strong·clear 1안 / slight 2안) |
| C reasons만 탈락 | 5쪽 카드별 한 줄 = `reasonFallback(lean.cards[i].meaning)` |
| D 탈락 | 5·6쪽 = DB 조합 문장(`comboStory`·`apply_fallback`) |
| E 탈락, 결정형 | 7쪽 = 코드 방향 블록(결론 + 카드별 한 줄 + ※). 계획 블록 없음. 8쪽 = 기존 열쇠 + DB 신호, 9·10쪽 = DB 처방·실천(9쪽 맨 위에 결론 headline·lead) |
| E 탈락, 비결정형 | 7쪽 = 흐름 + 이렇게 읽은 이유, 8쪽 = 열쇠 + DB 신호, 9·10쪽 = DB |
| E 통과, 비결정형 | 7쪽 = 흐름 + 이렇게 읽은 이유 + "이번 주에 이것부터", 8쪽 = E.change |
| 결제 전 | 6~11쪽 body=null, 블러는 `copy.result.blur_samples.pages`(11쪽 번호). watch면 11쪽 `fineprint`는 결제 전에도 있음 |

재생성은 1회까지 하고, 그래도 실패하면 위 대체 경로로 간다. `errors`는 운영 로그에 남긴다.

## 렌더러 줄 머리 규칙

| 줄 머리 | 그리기 |
|---|---|
| `## ` | 큰 제목(5쪽 첫 문구, 9쪽 결론 headline) |
| `**…**` | 굵게(문단 첫 문장, 결론 줄) |
| `◦ ` | 목록 |
| `▸ ` | 연결 줄(처방이 어느 분석에서 나왔는지) |
| `• ` | 굵은 목록(처방 제목, 실천 카드) |
| `※ ` | 작은 글씨(R10 돈 안내 · v4.1 watch 안내. 굵게·말투 변환 안 함) |
| 쪽 객체 `fineprint` | v4.1 watch: 마지막 쪽 맨 아래 작은 글씨(결제 전 블러 쪽에서도 그림) |
| `[[읽기 지도: …]]` / `[…]` | 읽기 지도 / 이미지·버튼 자리 |
| 소제목 | `pagesV4.SUBHEADS`의 줄, 그리고 `PLAN_HEAD_RE`(/이번 주에 이것부터$/)에 맞는 줄 |

계획 머리말(`PLAN_HEADS`, 데이터 `copy.result.v4.plan_head`):

| 경우 | 머리말 |
|---|---|
| 변화형 표(job·start·move), mode axis, stay | 남는 쪽으로 정했다면, 이번 주에 이것부터 |
| 변화형 표(job·start·move), mode axis, move | 옮기는 쪽으로 정했다면, 이번 주에 이것부터 |
| 관계형 표(approach·reunion·progress·continue·newlove) + express·boundary, 또는 mode rank(표 상관없이) | ‘{선택지 이름}’ 쪽으로 정했다면, 이번 주에 이것부터 |
| 비결정형 | 이번 주에 이것부터 |

## 데이터 (v4.1)

- `decision_tables.json` v3 (2026-10-22): 표 10개, 표마다 `label`·`covers`·`move`·`stay`·`poles{plus, minus}`·`implicit[+, −]`·`scores`(44칸, + 26). express·boundary 점수는 `nlu/act_split_tables.json`.
- `copy.result.pages`는 11쪽 기준이다(8쪽 key=`change`). `buildPages`(10쪽)는 key로 제목·teaser·블러를 찾는다.
- `copy.result.v4`는 11쪽 고정 문구다. 코드는 데이터를 먼저 쓰고, 없으면 `pagesV4.V4_COPY`를 쓴다.
- `copy.safety.fear_box`는 관계 속 두려움(S4-5) 안내, `copy.safety.violence_box`는 상담센터·경찰서 안내, `copy.safety.watch_note`는 watch 작은 글씨 한 줄.
- `safety_keywords`
  - `urgent`: 죽음에 대한 직접 표현·자해 행동·작별 준비만. `urgent_raw`: 두 글자(자살·자해, 원문 그대로 검사).
  - `watch`: 소극적 표현·술 의존·방에만 있음·절망 확신·섭식(옛 이름 `deprecated_watch`도 읽음). 기간이 붙은 '한 달 이상 못 먹음/못 잠'은 코드의 `safety.WATCH_RE`가 봄.
  - `violence`: 구체 행동만. `fear`: 그 사람이 무섭다·물건 던지기·벽/책상 치기. `exclude`: 관용 표현 예외.
- 주의: `07_DB/build_data.py`로 tarot_data.json을 다시 만들면 위 변경이 사라진다. 빌드 스크립트에도 같은 변경이 필요하다.

## 테스트·평가

```
cd 03_코드
node test_tarot.mjs        # 전체 단위 테스트(도현님 11쪽 = fixtures/도현/expected_pages_5차.json, 새 형식 A2 = fixtures/도현/A2_out_v46.json)
node demo_pipeline.mjs     # 01_설계/example-reports/ 에 01~05 예시 리포트 생성(05 = 재회, few-shot 입력·두 번째 의견 포함)

cd ../08_판별DB
node run_eval.mjs keyword               # 안전 키워드만 — 정답은 data/worry_examples_v2.jsonl(새 기준)
node run_eval_frame.mjs                 # (a) 유사도만 1순위 정확도(leave-one-out) + (c) 두 번째 의견 불일치 비율(A2 결과 = eval/preds_T6_v46.jsonl)
node run_eval_frame.mjs model ./model_adapter_example.mjs [최대]   # (b) 실제 모델로 A2 v4.6(+예시 5개) 호출 → eval/preds_frame_<시각>.jsonl
node run_eval_frame.mjs score eval/preds_frame_<시각>.jsonl        # (b) 표 정확도·방향 줌/안 줌 + (c)
```

결과 숫자와 해석은 `08_판별DB/README.md` v0.4. 요약(2026-10-22):

| 평가 | 결과 |
|---|---|
| 단위 테스트 | 72개 통과 |
| 안전 키워드(정답 worry_examples_v2 1,432 · 새 기준) | 위험 놓침 0/11 · 주의 놓침 18/68 · 위기 아닌데 멈춤 0 · 위기 아닌데 watch 0 · 폭력 놓침 16/45 |
| (a) 유사도만 1순위 표(T6, leave-one-out) | 47.8% (이웃 1개만 41.2%) · 방향 줌/안 줌 일치 90.4% |
| (b) v4.6 A2 기존 결과(예시 붙이기 전) | 점수표 92.4% · 방향 줌 89.8% / null일 때 안 줌 100% |
| (c) 두 번째 의견(min_share 0.6) | 비율 ≥ 0.6이고 다름 7.3% · 강도 낮춤 5.5% · 그중 A2가 실제로 틀린 것 13.9%(5/36) · A2 오답 37건 중 5건 걸러 냄 (하한 없이면 61.8% · 47.8%) |
