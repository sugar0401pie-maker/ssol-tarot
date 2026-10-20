-- 쏠 타로 v4.0(결정형 방향 제시) 반영: tarot_sessions에 칸 두 개 추가.
--   frame : A2 '고민 틀'(worry_type·선택지·결국 묻는 것·기한 등). 사용자가 쓴 말이 들어 있어 고민 원문과 같은 수준으로 다룬다
--           (서버 전용, 공유 카드·URL·로그에 넣지 않음).
--   fear  : 관계 속 두려움(S4-5, "그 사람이 무서워요") — 결과에 안내 박스만 붙고 진행은 그대로.
-- links 칸은 그대로 두고 v4부터 C 출력 전체(한 줄·질문·teaser·reasons·headline·lead)를 담는다.
-- 여러 번 실행해도 안전하다.

alter table public.tarot_sessions add column if not exists frame jsonb;
alter table public.tarot_sessions add column if not exists fear boolean not null default false;
