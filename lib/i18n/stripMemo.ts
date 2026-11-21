// 데이터 파일(tarot_data.json 등)의 메모 칸을 빼고 화면 문구만 남긴다(owner 2026-11-21 "메모 칸 빼고 화면용 문구만").
// 메모 칸은 기획·개발이 남긴 설명("2026-10-21 owner: …", "Claude 초안", "대표님 원문")이라 화면에는 안 나오지만,
// 브라우저로 보내면 페이지 소스에서 누구나 읽을 수 있다. 서버에서만 쓰는 원본 데이터는 그대로 둔다.
// 메모 칸 이름 규칙: "_"로 시작 · rule로 끝남(rule, _rule, kakao_rule…) · _policy·_where로 끝남 · 아래 목록.
// 화면에 쓰는 칸(note·footnote·watch_note·sheet_note·pick_note 등)은 이 규칙에 걸리지 않는다 — 새 메모 칸은 이 규칙에 맞는 이름으로.
const MEMO_KEYS = new Set(["pages_note", "area_phrases_note", "key_note", "guess_note", "no_ask_note", "version"]);
export const isMemoKey = (k: string): boolean => k.startsWith("_") || /rule$/.test(k) || /_(policy|where)$/.test(k) || MEMO_KEYS.has(k);
// secret3.note는 이름은 화면 칸 같지만 쪽 구성 설명 메모다(화면은 페이지 객체의 note를 씀 — copy.result.secret3.note는 읽지 않음).
const MEMO_PATHS = new Set(["result.secret3.note"]);

export function stripMemo<T>(value: T, path = ""): T {
  if (Array.isArray(value)) return value.map((v) => stripMemo(v, path)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k;
      if (isMemoKey(k) || MEMO_PATHS.has(p)) continue;
      out[k] = stripMemo(v, p);
    }
    return out as T;
  }
  return value;
}
