-- =====================================================================
-- 쏠 타로 — 광고 소재(UTM) 기록(owner 2026-11-14 "utm 저장 진행").
-- Supabase SQL Editor에 전체를 붙여넣고 Run. 여러 번 실행해도 안전하다.
--
-- ① tarot_sessions.utm: 그 결과를 시작한 사람이 처음 들어온 주소의 utm_source·medium·campaign·content·term(최근 30일 안).
--    사람 정보는 없고 광고 이름표만 있다.
-- ② tarot_utm_counts: 날짜(한국 시간) × utm_source × utm_campaign × utm_content × 단계별 숫자.
--    visit 방문 · started 테스트 시작 · worry 고민 씀 · skip 고민 건너뜀 · result 결과까지 봄 · paid 결제 건수
--    · paid_krw 결제 금액(원) · paid_usd_cents 결제 금액(달러, 센트)
--    로그인 없이 본 결과가 보관 기간 뒤 지워져도 숫자는 줄지 않는다. 값이 비어 있으면 '' 로 저장(엑셀에는 '없음').
-- 서버(service_role)만 읽고 쓴다.
-- =====================================================================

alter table public.tarot_sessions add column if not exists utm jsonb;

create table if not exists public.tarot_utm_counts (
  day date not null,
  source text not null default '',
  campaign text not null default '',
  content text not null default '',
  metric text not null check (metric in ('visit', 'started', 'worry', 'skip', 'result', 'paid', 'paid_krw', 'paid_usd_cents')),
  value bigint not null default 0,
  primary key (day, source, campaign, content, metric)
);

alter table public.tarot_utm_counts enable row level security;
revoke all on public.tarot_utm_counts from anon, authenticated;
grant select, insert, update on public.tarot_utm_counts to service_role;

-- 한 번에 더하기(동시에 여러 명이 와도 빠지지 않게 DB 안에서 더한다)
create or replace function public.tarot_utm_inc(p_source text, p_campaign text, p_content text, p_metric text, p_by bigint default 1)
returns void
language sql
as $$
  insert into public.tarot_utm_counts (day, source, campaign, content, metric, value)
  values ((now() at time zone 'Asia/Seoul')::date, left(coalesce(p_source, ''), 100), left(coalesce(p_campaign, ''), 100), left(coalesce(p_content, ''), 100), p_metric, p_by)
  on conflict (day, source, campaign, content, metric) do update set value = public.tarot_utm_counts.value + excluded.value;
$$;
revoke all on function public.tarot_utm_inc(text, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.tarot_utm_inc(text, text, text, text, bigint) to service_role;
