-- =====================================================================
-- 쏠 타로 하우스 — 유료 리포트 결제(토스) 주문 + 결과별 유료 리포트 저장 (Supabase SQL Editor에 전체를 붙여넣고 Run)
-- 쏠 아스트로 하우스 astro_orders(20261008000100)와 같은 방식. 여러 번 실행해도 안전하다.
--
-- 결제 흐름: 서버가 주문(pending)을 만들고 금액(1,900원)을 정한다 → 토스 결제창 → 서버가 시크릿 키로 토스에 승인 확인(confirm)한
-- 뒤에만 paid로 바꾸고 유료 리포트(D·E)를 만든다. 브라우저가 보낸 금액·결과는 믿지 않는다.
-- 읽기·쓰기는 서버(service_role)만 한다 — 이 앱의 다른 tarot_ 표와 같다(브라우저 정책 없음).
-- =====================================================================

begin;

create table if not exists public.tarot_orders (
  id                  uuid primary key default gen_random_uuid(),   -- 토스 orderId로 그대로 쓴다
  user_id             uuid not null references auth.users (id) on delete cascade,
  session_id          uuid not null references public.tarot_sessions (id) on delete cascade,
  amount              integer not null check (amount > 0),
  status              text not null default 'pending' check (status in ('pending', 'paid', 'canceled')),
  payment_key         text,
  method              text,
  withdrawal_version  text,                                         -- 결제 전 동의한 청약철회 안내 문구 버전
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

create index if not exists tarot_orders_user_idx on public.tarot_orders (user_id, created_at desc);
create index if not exists tarot_orders_session_idx on public.tarot_orders (session_id);
-- 한 결과에 결제 완료 주문은 하나만(두 탭에서 동시에 결제해도 두 번째는 저장이 막히고, 서버가 그 결제를 토스에서 취소한다)
create unique index if not exists tarot_orders_one_paid_per_session on public.tarot_orders (session_id) where status = 'paid';

alter table public.tarot_orders enable row level security;
revoke all on public.tarot_orders from anon, authenticated;
grant select, insert, update, delete on public.tarot_orders to service_role;

-- 결과별 유료 리포트(결제 후 서버가 D·E로 만든다)
alter table public.tarot_sessions add column if not exists paid_at timestamptz;
alter table public.tarot_sessions add column if not exists report jsonb;
alter table public.tarot_sessions add column if not exists report_status text not null default 'none';
alter table public.tarot_sessions add column if not exists report_started_at timestamptz;
do $$ begin
  alter table public.tarot_sessions add constraint tarot_sessions_report_status_check
    check (report_status in ('none', 'generating', 'ready', 'failed'));
exception when duplicate_object then null; end $$;

commit;
