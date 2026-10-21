// 카카오·네이버 로그인 실패 시 Supabase가 돌려주는 ?error=…&error_description=… 를 화면 문장으로(로그인 화면에서 보여 줌).
/** 돌아온 주소의 OAuth 오류(쿼리 또는 # 뒤)를 사람이 읽을 문장으로. 없으면 null. */
export function oauthErrorFromUrl(loc: { search: string; hash: string }): string | null {
  const q = new URLSearchParams(loc.search);
  const h = new URLSearchParams(loc.hash.replace(/^#/, ""));
  const code = q.get("error") ?? h.get("error");
  if (!code) return null;
  const desc = q.get("error_description") ?? h.get("error_description") ?? "";
  // 원문(desc)을 괄호로 함께 보여 준다 — 원인을 정확히 찾을 수 있게(예전엔 이메일 관련이면 원문을 숨겼다)
  if (/email/i.test(desc)) return `로그인한 계정의 이메일 확인에서 막혔어요. 잠시 후 다시 시도하거나 다른 방법으로 로그인해 주세요. (${desc.slice(0, 120)})`;
  return `로그인하지 못했어요. 잠시 후 다시 시도하거나 다른 방법으로 로그인해 주세요.${desc ? ` (${desc.slice(0, 120)})` : ""}`;
}

