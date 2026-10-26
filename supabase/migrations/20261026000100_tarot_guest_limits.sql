-- =====================================================================
-- 쏠 타로 — 로그인 없이 타로 보기(owner 2026-10-26) + 횟수 제한 기록 (Supabase SQL Editor에 전체를 붙여넣고 Run). 여러 번 실행해도 안전하다.
--
-- tarot_guest_starts : 로그인 없이 테스트를 시작할 때마다 한 줄. 같은 기기 24시간 3번 · 같은 인터넷 주소(IP) 24시간 20번 제한을 센다.
--   IP와 기기 값은 원래 값 대신 서버 비밀값을 섞어 바꾼 값(HMAC-SHA256)만 저장한다 — 이 표만 봐서는 원래 IP를 알 수 없다.
--   보관 7일(owner 결정) — 서버가 새 게스트 시작 때마다 7일 지난 줄을 지운다.
-- 로그인 없이 만든 결과(tarot_sessions.user_id 없음)도 7일 지나면 같은 방식으로 지운다(로그인해 계정에 붙은 결과는 그대로).
-- 서버(service_role)만 읽고 쓴다. 실행 전 배포하면: 기록 표가 없어 제한을 셀 수 없으므로 로그인 없는 시작을 막는다(더 조심스러운 쪽).
-- =====================================================================

create table if not exists public.tarot_guest_starts (
  id bigint generated always as identity primary key,
  ip_hash text,
  device_hash text,
  created_at timestamptz not null default now()
);
create index if not exists tarot_guest_starts_ip_idx on public.tarot_guest_starts (ip_hash, created_at);
create index if not exists tarot_guest_starts_device_idx on public.tarot_guest_starts (device_hash, created_at);
create index if not exists tarot_guest_starts_created_idx on public.tarot_guest_starts (created_at);

alter table public.tarot_guest_starts enable row level security;
revoke all on public.tarot_guest_starts from anon, authenticated;
grant select, insert, delete on public.tarot_guest_starts to service_role;

-- 로그인 없는 결과를 7일 뒤 지울 때 쓰는 색인
create index if not exists tarot_sessions_guest_created_idx on public.tarot_sessions (created_at) where user_id is null;
