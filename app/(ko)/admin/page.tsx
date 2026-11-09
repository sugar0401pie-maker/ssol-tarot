import type { Metadata } from "next";
import AdminDashboard from "@/components/admin/AdminDashboard";

// 관리자 화면(owner 2026-11-09). 검색에 나오지 않게 하고, 데이터는 서버가 관리자 이메일을 확인한 뒤에만 준다.
export const metadata: Metadata = { title: "관리자 · 쏠 타로 하우스", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminDashboard />;
}
