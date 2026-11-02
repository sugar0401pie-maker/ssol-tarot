-- =====================================================================
-- 쏠 타로 — 누적 인원 집계(owner 2026-11-02). Supabase SQL Editor에 전체를 붙여넣고 Run. 여러 번 실행해도 안전하다.
--
-- 로그인 없이 본 결과는 7일 뒤 지워지므로(20261026000100) tarot_sessions만 세면 누적 인원이 줄어든다.
-- 그래서 날짜(한국 시간)별 숫자만 따로 쌓는다. 사람·고민·카드 정보는 없고 숫자만 있다.
--   started = 테스트 시작 · result = 결과까지 봄 · safety = 위험 신호로 안전 안내 화면에서 멈춤 · paid = 유료 리포트 결제
-- 서버(service_role)만 읽고 쓴다.
-- =====================================================================

create table if not exists public.tarot_daily_counts (
  day date not null,
  metric text not null check (metric in ('started', 'result', 'safety', 'paid')),
  value bigint not null default 0,
  primary key (day, metric)
);

alter table public.tarot_daily_counts enable row level security;
revoke all on public.tarot_daily_counts from anon, authenticated;
grant select, insert, update on public.tarot_daily_counts to service_role;

-- 한 번에 1 올리기(동시에 여러 명이 와도 빠지지 않게 DB 안에서 더한다)
create or replace function public.tarot_count_inc(p_metric text)
returns void
language sql
as $$
  insert into public.tarot_daily_counts (day, metric, value)
  values ((now() at time zone 'Asia/Seoul')::date, p_metric, 1)
  on conflict (day, metric) do update set value = public.tarot_daily_counts.value + 1;
$$;
revoke all on function public.tarot_count_inc(text) from public, anon, authenticated;
grant execute on function public.tarot_count_inc(text) to service_role;

-- 지금 남아 있는 기록으로 처음 숫자를 채운다(이미 지워진 로그인 없는 결과는 셀 수 없음).
-- 이미 숫자가 있는 날은 건드리지 않는다(다시 실행해도 두 번 더해지지 않게).
insert into public.tarot_daily_counts (day, metric, value)
select d, m, n from (
  select (created_at at time zone 'Asia/Seoul')::date as d, 'started' as m, count(*) as n from public.tarot_sessions group by 1
  union all
  select (created_at at time zone 'Asia/Seoul')::date, 'result', count(*) from public.tarot_sessions where result_status = 'ready' group by 1
  union all
  select (created_at at time zone 'Asia/Seoul')::date, 'safety', count(*) from public.tarot_sessions where result_status = 'safety' group by 1
  union all
  select (paid_at at time zone 'Asia/Seoul')::date, 'paid', count(*) from public.tarot_sessions where paid_at is not null group by 1
) s
on conflict (day, metric) do nothing;
