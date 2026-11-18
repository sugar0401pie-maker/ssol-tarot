-- 쏠 타로 하우스 — 로그인 없이 결제(owner 2026-11-18). 여러 번 실행해도 안전하다.
-- 로그인 없이 본 결과도 결제할 수 있게 주문의 user_id를 비워 둘 수 있게 한다.
-- 그런 주문은 결과 접근 키(브라우저에 저장된 키)로만 확인하고, 나중에 로그인해 결과를 저장하면 그 계정으로 채운다.
alter table public.tarot_orders alter column user_id drop not null;
