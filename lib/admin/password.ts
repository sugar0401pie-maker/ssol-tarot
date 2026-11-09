// 관리자 화면 입장 암호(owner 2026-11-09): 관리자 계정으로 로그인했어도 이 암호를 한 번 더 넣어야 데이터를 준다.
// 저장소에는 암호 원문을 두지 않고 scrypt 요약값만 둔다. 암호를 바꾸려면 아래 SALT·HASH를 새로 만들어 바꾼다:
//   node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');console.log(s,c.scryptSync('새 암호',s,32).toString('hex'))"
import { scryptSync, timingSafeEqual } from "node:crypto";

export const ADMIN_PASS_SALT = "73c27bf3b9eb5b822669526e2d809275";
export const ADMIN_PASS_HASH = "6860a384549e0d35bb724bfc81fc3fb25ace14fe08f73f202960d0a9943f29e7";

export function checkAdminPassword(input: unknown, salt = ADMIN_PASS_SALT, hash = ADMIN_PASS_HASH): boolean {
  if (typeof input !== "string" || !input || input.length > 200) return false;
  const want = Buffer.from(hash, "hex");
  const got = scryptSync(input, salt, want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}
