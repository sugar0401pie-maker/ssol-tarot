# 영어판 안전 장치 초안 메모 (v0.1, 2026-11-03) — 전문가 검토용

## 1. 한국어와 영어 매칭은 어떻게 다른가
- 한국어는 띄어쓰기를 지운 뒤 낱말 조각(`죽고싶`)으로 찾음. 영어는 띄어쓰기가 뜻을 나누므로 지우지 않고, **소문자 + 따옴표 통일(’→') + 공백 하나로 정리 + wanna→want to, gonna→going to** 뒤 정규식(단어 경계 `\b`)으로 찾음.
- 한 패턴이 줄임말·아포스트로피 빠짐(`im`, `dont`, `cant`), 은어(kms, kys, unalive, sewerslide)까지 함께 받도록 씀.
- 영어는 죽음 관용 표현이 훨씬 많음(this job is killing me, I'm dead lol, dying to know, 💀). 그래서 `exceptions`를 **가장 먼저** 지운 뒤 판정함. 예외는 좁게 써서, 같은 글 안의 진짜 위기 표현은 그대로 걸리게 함.
- 한국어 `urgent_raw`(자살·자해 두 글자 오탐 대책)는 영어에선 필요 없어 빈 목록.
- 상대가 "헤어지면 죽겠다"는 협박은 한국어와 같이 `threat_reported`로 따로 빼서 urgent가 아닌 violence로 봄.
- 순서: exceptions 지움 → threat_reported 지우고 urgent 확인 → watch → none / violence(+협박) / fear(폭력 없을 때만). safety.js와 같음. JS로 옮길 때 각 패턴은 `new RegExp(p, "i")`.

## 2. 테스트 결과
- `python3 run_test.py` → 60문장 중 60 맞음, urgent 재현율 100%, none이 urgent로 잡힌 경우 0.
- 단, 테스트 문장을 만든 사람과 패턴을 만든 사람이 같아 실제 성능보다 좋게 나옴. 실제 영어 사용자 글(또는 원어민이 쓴 문장 200개 이상)로 다시 재야 함.
- 알려진 약점: "my friend self-harms"처럼 남의 이야기도 urgent로 걸림(안전 쪽 오탐, AI 분류와 합칠 때 보정). "I can't do this anymore" 같은 넓은 표현은 일부러 뺌(관계 글에 너무 많이 나옴) → AI 분류가 맡음.

## 3. 시장 선택 — CSO 결정 필요
- 상담 번호는 나라마다 다름. 다른 나라 번호를 보여 주면 위기 순간에 쓸모가 없음.
- 선택지: (a) 미국 하나로 시작(988 하나로 전화·문자 모두 됨, 가장 단순) / (b) US·UK·CA·AU를 접속 국가로 자동 선택 + 나머지는 GLOBAL(findahelpline.com) / (c) 처음부터 GLOBAL만.
- 추천: (b). 국가를 모르면 GLOBAL로 떨어지게.
- 캐나다: 요청서의 "Talk Suicide Canada 988"은 옛 이름. 지금은 "988 Suicide Crisis Helpline". 캐나다는 전국 단일 가정폭력 전화가 없어 sheltersafe.ca로 안내.
- 호주 Lifeline 문자(0477 131 114)는 24시간이 아님(낮 12시~자정).
- 번호는 2026-11-03 웹 검색으로 확인. 6개월마다 다시 확인.

## 4. 꼭 필요한 검토
- **영어권 임상 전문가(정신건강 전문가)가 키워드 단계 구분, 화면 문구, 상담 번호를 검토해야 함.** 이 초안은 최종본이 아님.
- 가능하면 그 나라 위기상담 기관의 안전 메시지 지침(예: 미국 988 / 영국 Samaritans 미디어 가이드라인)에 맞는지 함께 확인.
