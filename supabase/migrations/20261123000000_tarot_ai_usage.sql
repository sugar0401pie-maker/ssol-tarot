-- AI 호출마다 실제 토큰 수 기록(owner 2026-11-23 "리포트마다 실제 토큰 수를 DB에 기록 — 사이트별·기능별 정확한 금액").
-- 한 줄 = AI 호출 1번. 토큰 수·모델·단계 이름(A·A2·C·D·E1·E2·embed …)·결과 번호·언어만 — 고민 글·AI 문장은 넣지 않는다.
-- 결과(tarot_sessions)가 보관 기간으로 지워져도 비용 기록은 남도록 session_id는 연결만 끊긴다(on delete set null).
-- app 칸: 지금은 'tarot'. 다른 사이트(쏘웰라·아스트로 등)도 같은 모양으로 쌓으면 사이트별로 나눠 볼 수 있다.
create table if not exists public.tarot_ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  app text not null default 'tarot',
  locale text,
  session_id uuid references public.tarot_sessions(id) on delete set null,
  kind text not null check (kind in ('text', 'embed')),
  stage text not null,
  model text not null,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reasoning_tokens integer not null default 0,
  ok boolean not null default true
);
create index if not exists tarot_ai_usage_created_idx on public.tarot_ai_usage (created_at);
create index if not exists tarot_ai_usage_session_idx on public.tarot_ai_usage (session_id);
alter table public.tarot_ai_usage enable row level security; -- 정책 없음 = 서버(service_role)만
grant select, insert on public.tarot_ai_usage to service_role;

-- 모델별 단가(1백만 토큰당 달러)와 환율. 값이 바뀌면 이 표만 고치면 아래 금액 보기가 따라간다.
-- gpt-5.6-luna 0.20/1.20은 쏘웰라 비용 측정(2026-09-22) 때 쓴 값, text-embedding-3-large 0.13.
-- 캐시된 입력 단가는 확인 전이라 일반 입력과 같게(실제보다 조금 많게) 둔다 — OpenAI 요금표로 확인되면 고칠 것.
create table if not exists public.tarot_ai_prices (
  model text primary key,
  input_usd_per_mtok numeric not null,
  cached_input_usd_per_mtok numeric not null,
  output_usd_per_mtok numeric not null,
  krw_per_usd numeric not null default 1400
);
alter table public.tarot_ai_prices enable row level security;
grant select, insert, update on public.tarot_ai_prices to service_role;
insert into public.tarot_ai_prices (model, input_usd_per_mtok, cached_input_usd_per_mtok, output_usd_per_mtok) values
  ('gpt-5.6-luna', 0.20, 0.20, 1.20),
  ('text-embedding-3-large', 0.13, 0.13, 0)
on conflict (model) do nothing;

-- 한 줄마다 금액(원). 모델 이름은 날짜가 붙은 이름(gpt-5.6-luna-2026-…)도 단가 표의 이름으로 맞춘다.
create or replace view public.tarot_ai_usage_cost with (security_invoker = true) as
select u.*,
  p.model as price_model,
  round((
    (greatest(u.input_tokens - u.cached_input_tokens, 0) * p.input_usd_per_mtok
     + u.cached_input_tokens * p.cached_input_usd_per_mtok
     + u.output_tokens * p.output_usd_per_mtok) / 1000000.0 * p.krw_per_usd
  )::numeric, 3) as cost_krw
from public.tarot_ai_usage u
left join lateral (
  select * from public.tarot_ai_prices x
  where u.model = x.model or u.model like x.model || '-%'
  order by length(x.model) desc limit 1
) p on true;
revoke all on public.tarot_ai_usage_cost from anon, authenticated;
grant select on public.tarot_ai_usage_cost to service_role;
