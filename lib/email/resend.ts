import "server-only";
// Resend REST API 작은 도우미(쏠 아스트로 하우스 lib/email/resend.ts를 그대로 옮김 — SDK 없이 fetch만).
// RESEND_API_KEY가 없으면 조용히 건너뛴다: 메일은 부가 기능이라 리포트 저장·화면 표시는 막지 않는다.
// 보내는 주소는 쏘웰라와 같은 인증된 도메인(RESEND_FROM_EMAIL로 바꿀 수 있음).
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "쏠 타로 하우스 <noreply@ssolwellnesshouse.com>";

export async function sendEmail(params: { to: string; subject: string; text: string; html?: string; from?: string }): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY가 없어 메일 발송을 건너뜁니다.");
    return { ok: false, reason: "no_api_key" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: params.from ?? FROM_EMAIL, to: [params.to], subject: params.subject, text: params.text, ...(params.html ? { html: params.html } : {}) }),
    });
    // 받는 주소·본문은 로그에 남기지 않는다(개인정보) — 상태 코드만.
    if (!res.ok) {
      console.error("Resend 발송 실패:", res.status);
      return { ok: false, reason: `status_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("Resend 호출 오류:", e instanceof Error ? e.name : "unknown");
    return { ok: false, reason: "exception" };
  }
}
