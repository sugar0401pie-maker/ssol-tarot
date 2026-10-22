-- =====================================================================
-- 쏠 타로 v4.1 반영 (Supabase SQL Editor에 전체를 붙여넣고 Run). 여러 번 실행해도 안전하다.
--
-- 1) tarot_sessions.frame_vote : 고민 틀(A2)을 부를 때 함께 계산한 '비슷한 정답 5개'의 투표 결과
--    {table, share, top_score, neighbors:[{id, score, table}]}. 세 번째 카드를 뽑을 때 두 번째 의견(강도 한 단계 낮춤)에 쓴다.
-- 2) tarot_frame_reviews : 두 번째 의견이 A2와 다를 때 쌓는 검수 대기 기록(패키지 README_v4 '운영 로그' review_log).
--    owner 결정(2026-10-22): 고민 원문도 함께 저장한다(검수할 때 바로 읽을 수 있게). 원문이 들어 있으므로
--    tarot_sessions와 같은 수준으로 다룬다 — 서버(service_role)만 읽고 쓰고, 공유 카드·URL·로그에 넣지 않는다.
--    결과(세션)를 지우면 함께 지워진다(on delete cascade).
-- 읽기·쓰기는 서버만 — 이 앱의 다른 tarot_ 표와 같다(브라우저 정책 없음).
-- =====================================================================

begin;

alter table public.tarot_sessions add column if not exists frame_vote jsonb;

create table if not exists public.tarot_frame_reviews (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null unique references public.tarot_sessions (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  worry_text   text not null,           -- 고민 원문(owner 결정)
  frame        jsonb,                   -- A2가 정리한 고민 틀(점수표·선택지 등)
  vote         jsonb,                   -- 비슷한 정답 5개의 투표(표·비율·이웃 id)
  review_log   jsonb not null,          -- decision.secondOpinion의 기록(A2 표·유사도 표·비율·점수·강도 전후)
  lowered      boolean not null default false,  -- 실제로 강도를 한 단계 낮췄는지(비율이 0.6 미만이면 기록만)
  status       text not null default 'pending' check (status in ('pending', 'reviewed')),
  reviewer_note text,                   -- 검수하면서 적는 메모(owner가 표 편집기에서 직접)
  created_at   timestamptz not null default now()
);

create index if not exists tarot_frame_reviews_status_idx on public.tarot_frame_reviews (status, created_at desc);

alter table public.tarot_frame_reviews enable row level security;
revoke all on public.tarot_frame_reviews from anon, authenticated;
grant select, insert, update, delete on public.tarot_frame_reviews to service_role;

commit;
