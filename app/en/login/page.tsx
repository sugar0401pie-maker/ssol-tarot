import type { Metadata } from "next";
import { Suspense } from "react";
import EnLoginScreen from "@/components/auth/EnLoginScreen";
import { loadSceneArt } from "@/lib/server/sceneArt";

export const metadata: Metadata = { title: "Sign in · SSOL Tarot House" };

export default function EnLoginPage() {
  return (
    <Suspense>
      <EnLoginScreen sceneArt={loadSceneArt()} />
    </Suspense>
  );
}
