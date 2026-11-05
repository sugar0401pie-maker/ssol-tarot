import { redirect } from "next/navigation";

// /result(번호 없이)는 볼 결과가 없어 빈 404였다(owner 2026-10-26) — 내 결과 목록으로 보낸다(로그인 확인은 /results가 한다).
export default function ResultIndex() {
  redirect("/results");
}
