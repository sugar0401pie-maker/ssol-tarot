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

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; key?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.key) headers["x-tarot-key"] = opts.key;
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? "잠시 후 다시 시도해 주세요.");
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
      saved: boolean;
    };
