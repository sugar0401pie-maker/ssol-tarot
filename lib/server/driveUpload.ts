import "server-only";
// 고민 누적 엑셀을 owner의 구글 드라이브 폴더에 올린다(owner 2026-11-19 "메일 첨부 말고 드라이브에").
// 구글 서비스 계정은 개인 드라이브에 파일을 만들 저장 공간이 없어서, owner 계정으로 도는 Apps Script 웹 앱
// (docs/ops/drive-upload-apps-script.gs)에 파일을 보내고 그 스크립트가 지정 폴더에 저장한다.
// DRIVE_UPLOAD_URL(웹 앱 주소)·DRIVE_UPLOAD_SECRET(스크립트 속성과 같은 값)이 둘 다 있어야 동작.
// 주소·비밀값·파일 내용은 로그에 남기지 않는다.
export async function uploadToDrive(file: Uint8Array, filename: string): Promise<{ ok: boolean; reason?: string; url?: string }> {
  const url = process.env.DRIVE_UPLOAD_URL?.trim();
  const secret = process.env.DRIVE_UPLOAD_SECRET?.trim();
  if (!url || !secret) return { ok: false, reason: "not_configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" }, // Apps Script는 text/plain 본문을 그대로 받는다
      body: JSON.stringify({ secret, filename, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: Buffer.from(file).toString("base64") }),
      redirect: "follow", // Apps Script 응답은 googleusercontent로 한 번 넘겨서 돌아온다
      signal: AbortSignal.timeout(120_000),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
    if (!res.ok || !data?.ok) return { ok: false, reason: data?.error ?? `status_${res.status}` };
    return { ok: true, url: data.url };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.name : "exception" };
  }
}
