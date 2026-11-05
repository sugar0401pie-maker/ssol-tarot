// 첫 화면 방문을 셀지 정한다(owner 2026-11-05). 같은 탭 묶음(sessionStorage)에서는 한 번만 — 새로고침·뒤로 가기로 늘어나지 않게.
// 저장소를 쓸 수 없으면(사생활 보호 모드 등) 세지 않는다(같은 사람이 여러 번 세지는 쪽보다 덜 세는 쪽이 낫다).
export const VISIT_KEY = "tarot_visit_counted";

export function claimVisit(storage: Pick<Storage, "getItem" | "setItem"> | null | undefined): boolean {
  try {
    if (!storage || storage.getItem(VISIT_KEY)) return false;
    storage.setItem(VISIT_KEY, "1");
    return storage.getItem(VISIT_KEY) === "1";
  } catch {
    return false;
  }
}
