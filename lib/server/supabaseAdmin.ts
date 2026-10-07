import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 서버 전용 클라이언트(RLS 우회). 브라우저 코드에서 불러오면 "server-only" 때문에 빌드가 실패한다(키 노출 방지).
let admin: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase 서버 환경변수(URL, SERVICE_ROLE_KEY)가 설정되지 않았습니다.");
  }
  admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

// "Authorization: Bearer <토큰>"으로 로그인한 실제 사용자 id. 없거나 익명·무효면 null(게스트로 진행).
export async function getUserIdFromAuthHeader(header: string | null): Promise<string | null> {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const { data, error } = await createAdminClient().auth.getUser(match[1]);
  if (error || !data.user || data.user.is_anonymous) return null;
  return data.user.id;
}
