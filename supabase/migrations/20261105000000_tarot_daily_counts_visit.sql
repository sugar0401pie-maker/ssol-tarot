-- =====================================================================
-- 쏠 타로 — 첫 화면 방문 수 집계(owner 2026-11-05). Supabase SQL Editor에 전체를 붙여넣고 Run. 여러 번 실행해도 안전하다.
-- tarot_daily_counts(20261102000000)에 'visit'(첫 화면을 연 횟수, 같은 브라우저 탭 묶음에서는 한 번만)을 더한다.
-- 숫자만 있고 사람·기기 정보는 없다. 이 SQL을 실행하기 전에는 방문 숫자만 안 쌓이고 서비스는 그대로 동작한다.
-- =====================================================================

alter table public.tarot_daily_counts drop constraint if exists tarot_daily_counts_metric_check;
alter table public.tarot_daily_counts add constraint tarot_daily_counts_metric_check
  check (metric in ('started', 'result', 'safety', 'paid', 'visit'));
