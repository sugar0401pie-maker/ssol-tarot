-- 영문판(2026-11-05): 세션의 언어와 주문 통화.
-- tarot_sessions.locale: 'ko'(기본, 기존 결과 전부) | 'en'. 결과는 만든 언어로 고정된다.
-- tarot_orders.currency: 'KRW'(기본, 기존 주문 전부) | 'USD'(영문판 결제 — 연결 전).
-- 실행 전에도 한국어판은 그대로 동작한다(영문 세션만 만들어지지 않음).
alter table public.tarot_sessions add column if not exists locale text not null default 'ko';
alter table public.tarot_sessions drop constraint if exists tarot_sessions_locale_check;
alter table public.tarot_sessions add constraint tarot_sessions_locale_check check (locale in ('ko', 'en'));

alter table public.tarot_orders add column if not exists currency text not null default 'KRW';
alter table public.tarot_orders drop constraint if exists tarot_orders_currency_check;
alter table public.tarot_orders add constraint tarot_orders_currency_check check (currency in ('KRW', 'USD'));

-- 영문판 동의 기록(정책 문서 08: ① 18세 이상·이용약관·개인정보처리방침 / ② 고민 글 이용 — 고민을 쓸 때만).
-- 한국어판은 쓰지 않는다(약관 동의 방식이 다름). 문구 판은 consent_version.
alter table public.tarot_sessions add column if not exists terms_consent_at timestamptz;
alter table public.tarot_sessions add column if not exists worry_consent_at timestamptz;
alter table public.tarot_sessions add column if not exists consent_version text;
