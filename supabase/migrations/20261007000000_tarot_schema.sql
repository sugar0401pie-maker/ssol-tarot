-- 쏠 타로 하우스 1단계 테이블 (마스터 스펙 9장).
-- 같은 Supabase 프로젝트를 디저트 테스트(ssol_*)·쏘웰라(접두사 없음)와 공유하므로 이 앱은 tarot_ 접두사만 쓴다.
-- ssol_* 와 쏘웰라 테이블은 건드리지 않는다.
--
-- 모든 읽기·쓰기는 서버(service_role)에서만 한다. 고민 원문(worry_text)과 카드 순서가 들어 있어서
-- 브라우저(anon/authenticated)에는 정책을 하나도 열지 않는다. RLS는 켜 두되 정책이 없으므로 브라우저 키로는 0행.
-- 쏘웰라 마이페이지·채팅도 서버(service_role)로 읽는다.

create table if not exists public.tarot_sessions (
  id uuid primary key default gen_random_uuid(),
  -- 게스트 접근 키의 sha256(hex). 원래 키는 브라우저에만 있다(결과 URL에는 넣지 않음).
  access_key_hash text not null,
  -- 로그인돼 있었거나 나중에 저장하면 채워진다. 계정 삭제 시 기록은 남기고 연결만 끊는다.
  user_id uuid references auth.users (id) on delete set null,
  nickname text not null check (char_length(nickname) between 1 and 10),
  experience text check (experience in ('returning', 'first')),
  -- 고민 원문. 공유 카드·URL·로그에 넣지 않는다. 암호화 저장·24시간 삭제는 정책 확정 후 추가 [확인필요].
  worry_text text check (worry_text is null or char_length(worry_text) <= 300),
  worry_skipped boolean not null default false,
  -- 'none'(아직/건너뜀) | 'pending' | 'done' | 'failed'
  classification_status text not null default 'none',
  classification jsonb,
  -- 서버 키워드 결과와 AI 결과를 합친 최종 안전 단계(항상 높은 쪽)
  safety_level text not null default 'none' check (safety_level in ('none', 'watch', 'urgent')),
  violence boolean not null default false,
  current_shuffle_id uuid,
  reshuffle_count integer not null default 0,
  picked_slots integer[] not null default '{}',
  -- [{id, reversed, position}] 뽑은 순서대로
  picks jsonb not null default '[]'::jsonb,
  -- 카드별 고민 연결 한 줄 + 질문(AI C). step(세 번째 카드)은 결제 전 클라이언트로 보내지 않는다.
  links jsonb,
  -- 'started' | 'drawing' | 'preparing' | 'ready' | 'safety'
  result_status text not null default 'started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tarot_sessions_user_idx on public.tarot_sessions (user_id, created_at desc);

-- 셔플 기록(재현·감사용). "다시 섞을게요"마다 한 줄.
create table if not exists public.tarot_shuffles (
  id uuid primary key,
  session_id uuid not null references public.tarot_sessions (id) on delete cascade,
  card_order text[] not null,
  reversed jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists tarot_shuffles_session_idx on public.tarot_shuffles (session_id);

alter table public.tarot_sessions enable row level security;
alter table public.tarot_shuffles enable row level security;

-- 새 테이블은 service_role 권한이 자동으로 생기지 않는다(공유 프로젝트 규칙) → 명시적으로 준다.
grant select, insert, update, delete on public.tarot_sessions to service_role;
grant select, insert, update, delete on public.tarot_shuffles to service_role;
