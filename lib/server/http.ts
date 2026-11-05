import "server-only";
import { NextResponse } from "next/server";
import { TarotError, loadSession } from "./session";
import { getUserIdFromAuthHeader } from "./supabaseAdmin";
import { toEnglishError } from "./errorsEn";

/** 영문 화면에서 온 요청인지(브라우저 api()가 x-tarot-locale 헤더를 붙임) — 오류 문구 언어만 고른다. */
export const isEnRequest = (req?: Request | null) => req?.headers.get("x-tarot-locale") === "en";

// 게스트는 "x-tarot-key" 헤더(세션 시작 때 받은 키), 로그인 사용자는 Bearer 토큰으로 세션에 접근한다.
export async function authFrom(req: Request) {
  const key = req.headers.get("x-tarot-key");
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization")).catch(() => null);
  return { key, userId };
}

export async function sessionFrom(req: Request, id: string) {
  return loadSession(id, await authFrom(req));
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function fail(e: unknown, req?: Request | null) {
  const en = isEnRequest(req);
  const msg = (m: string) => (en ? toEnglishError(m) : m);
  if (e instanceof TarotError) {
    // 결제 쪽 오류는 화면이 다음 행동을 고를 수 있게 몇 가지 표시를 함께 보낸다(이미 결제됨, 결과 번호)
    const extra = e as TarotError & { paid?: boolean; sessionId?: string; needLogin?: boolean };
    return NextResponse.json({ error: msg(e.message), ...(extra.needLogin ? { needLogin: true } : {}), ...(extra.paid ? { paid: true } : {}), ...(extra.sessionId ? { sessionId: extra.sessionId } : {}) }, { status: e.status });
  }
  console.error("타로 API 오류:", e instanceof Error ? e.message : "unknown");
  return NextResponse.json({ error: msg("잠시 후 다시 시도해 주세요.") }, { status: 500 });
}
