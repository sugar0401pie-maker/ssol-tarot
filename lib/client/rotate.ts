// 대기·섞기 안내 문구 돌리기(순수 함수, 테스트 있음). 3초마다 다음 줄, 끝나면 처음으로.
export const ROTATE_MS = 3000;
export function lineAt(lines: string[], elapsedMs: number, everyMs = ROTATE_MS): string {
  if (!lines.length) return "";
  return lines[Math.floor(Math.max(0, elapsedMs) / everyMs) % lines.length];
}
