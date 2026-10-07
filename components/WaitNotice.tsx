"use client";

import { useEffect, useState } from "react";
import { MoonEmblem } from "./Cards";
import { fill } from "@/lib/client/text";

export function WaitNotice({
  nickname,
  message,
  elapsedLabel,
  onLongWait,
}: {
  nickname: string;
  message: string;
  elapsedLabel: string;
  // TODO(owner 결정 대기): 오래 걸릴 때(예: 10초 이상) 추가 안내 문구와 기준이 정해지면 여기서 처리.
  onLongWait?: (seconds: number) => void;
}) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setMs(Date.now() - start), 250);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.floor(ms / 1000);
  useEffect(() => {
    if (seconds > 0) onLongWait?.(seconds);
  }, [seconds, onLongWait]);
  if (ms < 500) return null;
  return (
    <div className="flex flex-col items-center gap-5 text-center" role="status" aria-live="polite">
      <MoonEmblem />
      <p className="text-[15px] text-moon">
        {fill(message, { nickname })} {fill(elapsedLabel, { seconds })}
      </p>
    </div>
  );
}
