-- 영문판 결제(US$1.99, owner 2026-11-05) — 주문 통화 칸.
-- amount 칸(정수)은 그대로: 원화는 원, 달러는 센트(1.99달러 = 199)로 저장한다. 기존 주문은 모두 원화(KRW).
-- 실행 전에도 한국어 결제는 그대로 동작한다(코드가 이 칸을 쓰는 것은 달러 주문뿐). 영문 결제(TAROT_USD_CHECKOUT=1)를 켜기 전에 실행.
alter table public.tarot_orders
  add column if not exists currency text not null default 'KRW';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tarot_orders_currency_check') then
    alter table public.tarot_orders add constraint tarot_orders_currency_check check (currency in ('KRW', 'USD'));
  end if;
end $$;
comment on column public.tarot_orders.currency is 'KRW(amount=원) | USD(amount=센트)';
