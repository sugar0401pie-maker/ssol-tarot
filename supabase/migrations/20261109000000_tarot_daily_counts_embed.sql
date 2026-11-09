-- =====================================================================
-- 쏠 타로 — 의미 검색(임베딩) 성공·대체 횟수 집계(2026-11-09). Supabase SQL Editor에 전체를 붙여넣고 Run. 여러 번 실행해도 안전하다.
-- tarot_daily_counts에 두 항목을 더한다:
--   embed_ok        비슷한 고민 찾기에서 의미 검색을 쓴 횟수
--   embed_fallback  의미 검색을 쓰려다 실패·지연·색인 불일치로 글자 검색만 쓴 횟수
-- 숫자만 있고 고민 글·사람 정보는 없다. 실행 전에는 이 숫자만 안 쌓이고(경고 로그) 서비스는 그대로 동작한다.
-- 보는 법: select day, metric, value from tarot_daily_counts where metric like 'embed_%' order by day desc;
-- =====================================================================

alter table public.tarot_daily_counts drop constraint if exists tarot_daily_counts_metric_check;
alter table public.tarot_daily_counts add constraint tarot_daily_counts_metric_check
  check (metric in ('started', 'result', 'safety', 'paid', 'visit', 'embed_ok', 'embed_fallback'));
