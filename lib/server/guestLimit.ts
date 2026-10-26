import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "./supabaseAdmin";
import { GUEST_RETENTION_MS, GUEST_WINDOW_MS, clientIp, deviceId, guestLimitReached } from "@/lib/tarot-glue/guestLimit";

// 로그인 없이 타로 보기(owner 2026-10-26): 시작 횟수 제한 + 7일 지난 기록·결과 정리.
// IP·기기 값은 서버 비밀값을 섞은 HMAC으로만 저장한다(원래 값을 남기지 않음). 로그에도 남기지 않는다.
const secret = () => process.env.TAROT_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const mac = (kind: string, v: string | null) => (v && secret() ? createHmac("sha256", secret()).update(`${kind}:${v}`).digest("hex") : null);

export class GuestLimitError extends Error {}

/** 로그인 없는 시작 한 번을 허락할지 확인하고, 허락하면 기록한다. 막히면 GuestLimitError. */
export async function checkGuestStart(headers: { get(name: string): string | null }): Promise<void> {
  const db = createAdminClient();
  const ipHash = mac("ip", clientIp(headers));
  const deviceHash = mac("device", deviceId(headers));
  const since = new Date(Date.now() - GUEST_WINDOW_MS).toISOString();
  const count = async (col: "ip_hash" | "device_hash", v: string | null) => {
    if (!v) return null;
    const { count: n, error } = await db.from("tarot_guest_starts").select("id", { count: "exact", head: true }).eq(col, v).gte("created_at", since);
    if (error) throw error; // 표가 없거나 실패 → 아래에서 막는다
    return n ?? 0;
  };
  let device: number | null;
  let ip: number | null;
  try {
    [device, ip] = await Promise.all([count("device_hash", deviceHash), count("ip_hash", ipHash)]);
  } catch (e) {
    console.warn("게스트 횟수 확인 실패 — 로그인 없는 시작을 막음:", e instanceof Error ? e.message : "unknown");
    throw new GuestLimitError();
  }
  if (guestLimitReached({ device, ip })) throw new GuestLimitError();
  const { error } = await db.from("tarot_guest_starts").insert({ ip_hash: ipHash, device_hash: deviceHash });
  if (error) {
    console.warn("게스트 시작 기록 실패 — 로그인 없는 시작을 막음:", error.message);
    throw new GuestLimitError();
  }
  void purgeOldGuestData();
}

/** 7일 지난 횟수 기록과, 계정에 붙지 않은(그리고 결제되지 않은) 결과를 지운다. 실패해도 시작은 막지 않는다. */
async function purgeOldGuestData() {
  const db = createAdminClient();
  const before = new Date(Date.now() - GUEST_RETENTION_MS).toISOString();
  const r1 = await db.from("tarot_guest_starts").delete().lt("created_at", before);
  if (r1.error) console.warn("게스트 기록 정리 실패:", r1.error.message);
  const r2 = await db.from("tarot_sessions").delete().is("user_id", null).is("paid_at", null).lt("created_at", before);
  if (r2.error) console.warn("로그인 없는 결과 정리 실패:", r2.error.message);
}
