"use client";

import { useEffect, useState } from "react";
import { fill } from "@/lib/client/text";
import { MysticOrbit, RotatingLine } from "./Mystic";

// 대기 화면(design-preview 8번 + owner 2026-10-20): 카드 뒷면의 달 속 물결 엠블럼이 천천히 돌고 그 둘레를 카드·별이 돈다.
// 안내 문구는 copy.loading.messages를 3초마다 바꿔 가며 깜빡이고(없으면 기본 한 줄), 경과 초는 금색 다음 줄.
// 0.5초 안에 끝나면 아무것도 보이지 않는다.

export function WaitNotice({
  nickname,
  message,
  elapsedLabel,
  lines,
  onLongWait,
}: {
  nickname: string;
  message: string;
  elapsedLabel: string;
  lines?: string[];
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
    <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
      <MysticOrbit />
      <RotatingLine lines={lines?.length ? lines : [message]} nickname={nickname} className="mt-6 min-h-[3.2em] max-w-[300px] font-serif text-[16px] leading-relaxed text-moon" />
      <p className="mt-2 text-[12px] text-gold">{fill(elapsedLabel, { seconds })}</p>
    </div>
  );
}
