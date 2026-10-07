import type { Metadata } from "next";
import { Suspense } from "react";
import LoginScreen from "@/components/LoginScreen";

export const metadata: Metadata = { title: "로그인 · 쏠 타로 하우스" };

// useSearchParams(?next=)를 쓰는 화면이라 Suspense로 감싼다(Next.js 권장).
export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
