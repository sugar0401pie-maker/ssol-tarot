@AGENTS.md

# CLAUDE.md — 쏠 타로 하우스 (가제)

쏠 웰니스 하우스의 세 번째 웰니스 테스트. `tarot.ssolwellnesshouse.com`에서 서비스한다.
개발 기준: `docs/spec/tarot-master-spec.md`(마스터 스펙) > `data/tarot_data.json` > `docs/design/design-guide.md`.
**v4.0부터 최신 문장은 `data/tarot_data.json`**이다. `db/쏠타로_문장DB.xlsx`는 v4 데이터보다 오래돼서 **지금 반영하면 안 된다**(미리보기: 187줄이 옛 문장으로 되돌아가고 경고 2·빠진 ID 24). owner가 엑셀을 v4에 맞춰 다시 만들기 전까지 `import_db.py`를 실행하지 않는다. 그때까지 `data/tarot_data.json`도 손으로 고치지 않는다(owner 패키지로만 교체).
owner 프로젝트 노트: `docs/project-note.md`. 출시 전 할 일: `docs/05_다음단계.md`.

## 0. 우선순위
안전 규칙(4장)이 다른 모든 지시보다 우선한다. 헷갈리면 멈추고 owner에게 묻는다.

## 1. 함께 일하는 사람
owner는 개발자가 아니다. 큰 변경마다 (1) 무엇을·왜 바꾸는지 쉬운 한국어로 설명 (2) 그 기능만 구현 (3) 테스트를 돌리고 실패도 그대로 보고 (4) owner가 코드 밖에서 할 일(클릭·설정)을 정확히 알려 준다. 관련 없는 기능은 건드리지 않는다.

## 2. 제품 원칙
- 운세·점술이 아니라 전문 심리상담사가 만든 **자기이해 웰니스 콘텐츠**. 카드는 미래를 맞히는 도구가 아니라 고민을 비추는 거울.
- "예언", "운명", "맞힌다"를 화면·메타 태그·광고 어디에도 쓰지 않는다.
- 진단 금지, 다른 사람 판정 금지, 관계 지속·종료 권유 금지. 선택은 사용자가 한다.
- 카드 해석·실천·처방 문구는 **상담사 검수 전 초안**이다. 검수 후에는 임의로 다듬지 않는다(문구는 `data/tarot_data.json`에서만 고친다, 코드에 하드코딩 금지).

## 3. 구조 (2026-10-07 결정)
- **별도 저장소·별도 주소**(이 저장소). 쏘웰라 채팅 앱(`Ssol-Wellness-House`, app.ssolwellnesshouse.com)·디저트 테스트(quiz.)와 **같은 Supabase 프로젝트·같은 계정**을 쓴다.
- 로그인 유지: `lib/supabase/shared-cookie-domain.ts`로 `.ssolwellnesshouse.com`에 세션 쿠키를 심는다(쏘웰라 저장소와 같은 로직). localhost·*.vercel.app에서는 host-only 쿠키.
- **로그인 없이 끝까지 할 수 있다**(owner 결정 3번). 로그인돼 있으면 세션에 user_id를 붙이고, 아니면 게스트 세션(접근 키)으로 진행. 로그인 화면은 `/login`(화면만, 실제 연결은 나중에 — 8장).
- 경로: 마스터 스펙은 `quiz.../tarot`를 전제로 썼지만 이 앱은 서브도메인이라 **루트 `/`가 테스트 시작**이고 결과는 `/result/[id]`.
- 결과는 쏘웰라 **마이페이지에 표시**하고 **쏘웰라 채팅 개인화에도 쓴다**(owner 요청 2026-10-07, 쏘웰라 저장소에서 읽기 전용으로 구현). 고민 원문을 채팅에 넘길지는 미정(`docs/05_다음단계.md`) — 정해질 때까지 카드·분류값만 넘긴다.

## 4. 안전 (스펙 6장)
- 서버 키워드(`lib/tarot/safety.js`의 `screenText`) + AI 분류(`crisis_level`, `violence`)를 `mergeSafety`로 합쳐 **항상 높은 쪽**.
- urgent면 카드로 넘어가지 않고 안전 안내 화면. 결제 화면도 보이지 않는다. 셔플·뽑기 도중 AI가 urgent를 주면 그 자리에서 전환.
- v4: 주의(watch) 단계는 삭제(owner 결정 S2). violence(구체 행동)·fear(관계 속 두려움)면 결과 1쪽에 안내 박스. violence면 다가가기 실천·처방 제외(`filterPractices`, `prescriptionsFor`).
- AI 실패·데이터 누락 시 더 조심스러운 쪽으로(분류 실패 → 미작성 모드처럼 해석, 연결 한 줄 실패 → 그 줄 없이).
- 안전 로직 테스트를 지우거나 느슨하게 만들어 빌드를 통과시키지 않는다.

## 5. 코드 규칙
- `lib/tarot/*.js`는 owner 패키지(v4.0)의 원본 코드를 **로직 변경 없이** 그대로 둔 것이다(TS로 옮기지 않은 이유: 패키지 테스트(v4: 60개)가 검증한 코드를 그대로 쓰기 위해). 고치면 `lib/tarot/test_tarot.mjs`를 같이 고치고 `npm test`로 확인.
- **셔플은 서버에서만**(`deck.js`, node:crypto). 카드 순서는 클라이언트(응답·HTML)로 보내지 않는다. 사용자가 누른 자리 번호만 받는다.
- **결제 전 유료 본문(v4: 5쪽 결론부터 + 6~11쪽)은 클라이언트로 보내지 않는다**(`lib/tarot-glue/v4.ts`의 `sanitizeUnpaid` 허용 목록 — 5쪽 `locked`·읽기 지도·점수는 빠짐). 블러는 CSS 가림이 아니라 데이터가 없는 상태. 유료 리포트는 결제 전에 미리 만들지 않는다.
- 조사는 `lib/tarot/josa.js`로만.
- AI 호출은 `lib/server/ai.ts` 한 곳(OpenAI Responses API, 모델은 env `TAROT_AI_MODEL`). 프롬프트는 `lib/server/prompts.ts`에 `docs/spec/ai-prompts-tarot-v2.md`(A)·`ai-prompts-tarot-v4.md`(A2·C·D·E) 원문 그대로. 시스템 프롬프트 안에서 값을 치환하지 않고 user_data 블록으로 넘긴다.
- DB는 서버(service role)에서만 읽고 쓴다(`lib/server/*`, `import "server-only"`). 브라우저는 우리 API만 부른다.
- Next.js 16 — API를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽는다(AGENTS.md).
- `npm run lint`, `npm run build`, `npm test`를 끝내기 전에 돌린다. 로컬 포트 **3200**(3000은 owner의 다른 프로젝트, 3100은 쏘웰라).

## 6. Supabase 공유 규칙
- 같은 프로젝트를 디저트 테스트(`ssol_*` 테이블)·쏘웰라(접두사 없는 테이블)와 공유한다. **이 앱의 테이블은 `tarot_` 접두사**. `ssol_*`와 쏘웰라 테이블은 수정·삭제·권한 부여하지 않는다.
- 새 테이블은 service_role 권한이 자동으로 생기지 않는다 — 마이그레이션마다 GRANT를 명시한다.
- 마이그레이션은 `supabase/migrations/`. owner가 Supabase SQL Editor에서 직접 실행한다(실행 전 배포 금지 여부를 항상 안내).

## 7. 비밀·개인정보
- 키는 `.env.local`(커밋 안 됨)과 Vercel 환경변수에만. 값을 읽거나 출력하지 않는다.
- **고민 원문은 공유 카드·URL·로그·분석 이벤트에 넣지 않는다.** 서버 로그에도 남기지 않는다.
- 공유 카드에는 카드 3장·카드명·위치·방향만.
- 테스트용 가입에 `@example.com`을 쓰지 않는다(Resend가 거부 — 쏘웰라 저장소 기록).

## 8. 결정 기록
- **2026-10-07 — 1단계 뼈대**: 인트로 → 환영·닉네임 → 경험 질문 → (처음 안내) → 고민 쓰기/건너뛰기 → 셔플(다시 섞기) → 뽑기 → 다 뽑음 → (대기) → 무료 결과(1~3번 + 안전 박스) + 잠금 미리보기(4~8번). AI 분류(A)·카드별 연결 한 줄(C)은 서버에서 백그라운드(`after`)로 돌리고, 실패하면 스펙의 대체 동작. **아직 없는 것**: 결제(토스, 1,900원)와 유료 리포트(D 프롬프트), 공유 시트, 로그인 화면, 인트로 히어로 최종 에셋, 대기 15초 이상 안내(미정 — `onLongWait` 자리만), 고민 원문 24시간 삭제(정책 미정), 원문 암호화 저장.
- **2026-10-07 — 로그인 화면(`/login`) — 화면만, 실제 로그인 연결은 나중에(owner 결정).** 카카오(#FEE500)·네이버(#03C75A) 버튼 + 이메일·비밀번호 폼 + 비밀번호 찾기 + 회원가입 링크, 밤 테마. 입력 검사(`lib/client/loginForm.ts`의 `checkLoginInput`)는 동작하고, 통과하면 "로그인 연결은 준비 중이에요" 안내만 뜬다(`LoginScreen.tsx`의 `// TODO: 실제 연동` 두 곳 — 쏘웰라 `authClient.ts`와 같은 호출, 네이버는 `custom:naver`). `?next=`로 돌아갈 곳을 받되 `safeNext()`로 우리 앱 안 경로만 허용(오픈 리다이렉트 방지, 테스트 있음). 회원가입은 같은 계정을 만드는 쏘웰라 가입 화면(`SIGNUP_URL`)으로 보낸다. 결과 화면 "결과 저장하기"는 로그인 안 돼 있으면 `/login?next=/result/{id}`로 보내고(예전엔 쏘웰라 링크 안내), 인트로 오른쪽 위에 "로그인" 링크를 뒀다.
- **2026-10-07 — owner 패키지 v2.5 반영.** 데이터(`data/*.json`)·원본 코드(`lib/tarot/*.js`, 테스트 44개)·문서(`docs/spec` 등)를 v2.5로 교체하고 문장 DB 엑셀과 반영 스크립트를 `db/`에 넣었다(엑셀↔JSON 미리보기 결과 바뀐 문장 0·경고 0 = 서로 일치 확인). 주요 변경: 역방향 전용 질문·마무리·깊이 읽기, 결과 2·3번에 "조금 더 들여다보기"(깊이 읽기, 무료 카드만 — 세 번째 카드 것은 결제 전 안 보냄), AI 실패·고민 미작성 대체 문장(유료 5번용), 화면에 보이던 "[확인필요]" 메모 제거, 처방 30칸이 쏠 실천 통합본 기반(`ssol_id`). **안전 키워드가 코드에서 데이터(`safety_keywords`)로 옮겨졌다** — 원본 `screenText(text, kw)`에 사전을 안 넘기면 옛 기본 목록만 써서 v2.5에 추가된 위험 20·주의 20·폭력 23개 중 새 단어를 놓친다. 그래서 서버는 반드시 `lib/tarot-glue/screenWorry.ts`(사전을 넘기는 한 곳)만 쓴다(테스트 있음). 카드 id·이름·그림 파일명·영역 분류는 v2.2와 같아 쏘웰라 쪽 `lib/tarot/catalog.ts`는 바꿀 필요 없음.
- **2026-10-20 — owner 패키지 v4.0(결정형 방향 제시) 반영.** 데이터(`data/tarot_data.json`·`decision_tables.json`·`worry_examples.json`)·원본 코드(`lib/tarot/*.js` + `decision`·`pagesV4`·`validateV4`·`fixtures/도현`, 테스트 60개)·문서(`docs/spec`, `docs/design`, `judge-db/`)를 교체. 흐름: 고민 제출 직후 A(분류)+A2(고민 틀) 병렬 → 3장째에 점수표로 방향 계산(`decide`, AI가 결론을 못 바꿈) → C 호출 → 11쪽 조립(`buildPages`→`buildPagesV4`) → 결제 전 `sanitizeUnpaid`. D·E(유료 본문)는 결제 연동 때 붙인다. 자리 이름이 **지나온 길/지금의 흐름/앞으로의 열쇠**로 바뀜(쏘웰라 catalog도 같이 바꿈). **마이그레이션 `20261020000000_tarot_v4.sql`(frame·fear 칸) owner 실행 필요** — 실행 전에도 저장은 그 칸만 빼고 다시 시도해서 동작한다(고민 틀이 저장 안 돼 방향 제시가 빠짐). 결과 화면은 시안 `docs/design/result-swipe-preview-v4.html`과 같은 11쪽 넘겨 보기(`components/ResultView.tsx` + `app/result/[id]/result-v4.css`는 시안 CSS를 값 그대로 `.tv4` 아래로 옮김, 줄 규칙은 `lib/client/pageBlocks.ts`·테스트). 도현 예시로 시안과 쪽별 스크린샷을 대조해 글자 크기·굵기·색·간격 일치 확인. 시안과 다른 점: 결제 전 5쪽 블러 아래는 데이터 고정 예시(6쪽 것 — 결론은 서버가 안 보냄), 결제 버튼 비활성("결제는 준비 중"), 공유하기는 준비 중 안내, 저장하기 = 계정 저장(claim), 1·11쪽 끝에 고지문, 11쪽에 "다른 고민으로 다시 해 보기". **데이터 불일치(owner 확인 대기)**: `copy.pick.slot_labels`가 옛 이름이라 뽑기 칸은 `positions` 이름을 쓴다. v4에서 '주의' 단계가 없어져 `screenWorry` 테스트의 "사는 게 지옥 같아요"를 watch → none으로 고침(설계 변경 반영, 위험·폭력 검사는 그대로).
- **2026-10-20 — 최적화·시안 재대조·공유·장면 그림(owner 요청).** ① 카드 그림은 Next 이미지 최적화로 화면 크기에 맞춰 받는다(`lib/client/cardImage.ts`, `next.config.ts` images — `/images/tarot/**`만 허용, 원본 파일은 그대로), 인트로는 다음 친구 한 장만 미리 받음, Supabase 도구는 로그인 쿠키가 있을 때만 불러옴(`lib/supabase/authCookie.ts`), 글꼴 미리 받기 끔 + Noto Sans KR 가변 글꼴(아스트로 하우스 10-18과 같은 방법). 측정(휴대폰 3배 화면, 압축 전): 첫 화면 그림 1,361KB → 119KB, 스크립트 748KB → 496KB. ② 시안 재대조: 요소마다 계산된 글자 크기·굵기·색·줄 간격·여백을 시안과 비교해 줄 간격(normal)·작은 글씨(11.67px)·역방향 표시 글꼴 3곳을 고침 → 위치·크기는 0.3px 안에서 같음(남은 화소 차이는 글꼴 가장자리 처리). ③ 데이터(owner 지시): 뽑기 칸 이름 `slot_labels`를 v4 자리 이름으로(`db/build_data.py`도), 결제 전 5쪽 블러용 고정 예시 `blur_samples.locked5`(민준님 예시, `pages`에 넣지 않음 — 원본 코드가 pages 키로 쪽 블러를 정하므로). ④ 검토 의견 반영(Claude 초안, owner 확인 필요): 결정형 결제 카드 문구 `paywall_title_decision`/`paywall_body_decision`(서버가 `decision`만 보냄 — 어느 쪽인지는 안 보냄), 기본 문구도 '이번 주에 무엇부터'로, 7쪽 블러 예시를 v4 모양(방향 + 이번 주 계획)으로 바꾸고 원본 테스트 기대값(`expected_pages_5차.json` 7쪽 blur)도 같은 값으로 갱신. ⑤ 카카오톡 공유(아스트로 하우스 방식): 4쪽부터 [공유하기] → 공유 창(카카오톡·링크 복사·다른 앱으로, 오른쪽 위 닫기). 카카오 카드 = 세 번째 카드 그림(`public/images/tarot/kakao/`, 800×800 jpg, 역방향은 돌린 판 — `scripts/make_share_images.mjs`로 생성, 카드 그림을 바꾸면 다시 돌림) + "내 앞으로의 열쇠는 ‘카드명’" + [나도 카드 뽑기], 주소는 사이트 첫 화면(utm). 고민 원문·닉네임·결과 주소 없음(`lib/client/shareCard.ts`, 테스트). 키 `NEXT_PUBLIC_KAKAO_JS_KEY`가 없거나 도메인 미등록이면 기기 공유창 → 링크 복사. 사이트 미리보기 그림 `app/opengraph-image.jpg`(카드 뒷면 세 장) + metadataBase. **이 환경은 카카오 CDN이 막혀 실제 카카오 카드는 확인 못 함.** ⑥ 장면 그림(아스트로 하우스 GuideArt 방식, 맨 위): `public/images/tarot/scenes/<장면>/`(intro·welcome·experience·first_time·worry·shuffle·draw·reveal·loading)에 파일을 넣으면 빌드 때 목록이 만들어지고 화면을 열 때마다 한 장 무작위, 없으면 아무것도 안 그림. 안전 안내 화면에는 넣지 않음.
- **2026-10-20 — 7쪽 제목 '해결의 흐름' → '카드가 가리키는 방향'(owner 결정).** `copy.result.pages`(key=flow) 제목만 바꿈, 원본 테스트 기대값(`expected_pages_5차.json`)의 7쪽 제목도 같은 값으로. 결정형 고민이면 7쪽 본문 첫 소제목도 같은 말('카드가 가리키는 방향', `copy.result.v4.direction_title`)이고 결제 전 예고(teaser7_decision)도 이 말로 시작해 겹친다 — 바꿀지는 owner 확인 대기.
