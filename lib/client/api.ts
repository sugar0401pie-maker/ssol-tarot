import { getAccessToken } from "@/lib/supabase/browser";

// 타로 API 호출. 게스트 키는 이 브라우저에만 저장한다(URL에는 넣지 않음 — 결과 링크만으로는 열리지 않게).
const KEY_PREFIX = "ssol_tarot_key_";

export function saveKey(id: string, key: string) {
  try {
    localStorage.setItem(KEY_PREFIX + id, key);
  } catch {
    /* 저장이 막힌 브라우저 — 이번 화면에서는 메모리의 키로 계속 진행 */
  }
}

export function loadKey(id: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + id);
  } catch {
    return null;
  }
}

// 로그인 없이 타로 보기의 하루 횟수 제한(같은 기기 3번)을 세는 이 브라우저의 임의 값. 개인 정보가 아니고, 서버는 바꾼 값만 저장한다.
const DEVICE_KEY = "ssol_tarot_device";
function deviceIdOf(): string | null {
  try {
    let v = localStorage.getItem(DEVICE_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, v);
    }
    return v;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  // sessionId: 결제 확인에서 "이미 결제한 결과"일 때 그 결과로 보내 주려고 서버가 함께 보낸 값
  // needLogin: 로그인 없이 볼 수 있는 횟수를 다 써서 로그인을 권해야 할 때
  constructor(public status: number, message: string, public sessionId?: string, public needLogin = false) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; key?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.key) headers["x-tarot-key"] = opts.key;
  const device = deviceIdOf();
  if (device) headers["x-tarot-device"] = device;
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const j = json as { error?: string; sessionId?: string; needLogin?: boolean };
    throw new ApiError(res.status, j.error ?? "잠시 후 다시 시도해 주세요.", j.sessionId, j.needLogin === true);
  }
  return json as T;
}

export type PickResponse = {
  slot: number;
  position: string;
  positionName: string;
  reversed: boolean;
  card: { id: string; no: number; name: string; character: string; image: string };
  isLast: boolean;
};

export type ResultCard = PickResponse["card"] & { reversed: boolean; position: string; positionName: string };

// 결과 한 쪽(서버 sanitizeUnpaid가 고른 칸만). 결제 전 6~11쪽은 body가 null이고 blur(고정 예시 문장)만 온다.
export type ResultPage = {
  page: number;
  title: string;
  access: string;
  question?: string;
  saysTitle?: string;
  says?: string[];
  card?: { position: string; name: string; character: string; reversed: boolean; keywords: string[]; arcana?: string; image: string };
  body?: string | null;
  free?: string;
  teaser?: string;
  blur?: string | null;
  // v4.1 watch(주의): 마지막 쪽 맨 아래 작은 글씨 한 줄("※ …"). 결제 전에도 온다.
  fineprint?: string;
  next?: string | null;
  back?: string | null;
};

export type ResultResponse =
  | { status: "safety" | "drawing" | "preparing" }
  | {
      status: "ready";
      nickname: string;
      createdAt: string;
      cards: ResultCard[];
      pages: ResultPage[];
      notice: string | null;
      paid: boolean;
      decision?: boolean;
      saved: boolean;
    };

/** 로그인한 상태에서 이 브라우저에 키가 있는 결과(로그인 없이 본 것)를 계정에 붙인다. 이미 붙어 있으면 그대로. 실패는 조용히(false). */
export async function claimIfGuest(id: string): Promise<boolean> {
  const key = loadKey(id);
  if (!key || !(await getAccessToken())) return false;
  try {
    await api(`/api/tarot/session/${id}/claim`, { key, body: {} });
    return true;
  } catch {
    return false;
  }
}
