"use client";

import { useEffect, useState } from "react";
import { fill } from "@/lib/client/text";
import { MysticOrbit, RotatingLine } from "./Mystic";

// 대기 화면(design-preview 8번 + owner 2026-10-20): 카드 뒷면의 달 속 물결 엠블럼이 천천히 돌고 그 둘레를 카드·별이 돈다.
// 안내 문구는 copy.loading.messages를 3초마다 바꿔 가며 깜빡이고(없으면 기본 한 줄). 경과 초는 보여 주지 않고(owner 2026-10-22),
// 30초(copy.loading.long_wait_seconds)가 지나면 금색 다음 줄에 "조금만 더 기다려주시면 {닉네임}님의 결과가 완성돼요."(long_wait).
// 0.5초 안에 끝나면 아무것도 보이지 않는다.

// 닉네임이 없으면 "{nickname}님의 " 부분을 빼서 '당신님' 같은 말이 나오지 않게 한다(RotatingLine과 같은 원칙).
function longWaitLine(t: string, nickname: string): string {
  return nickname.trim() ? fill(t, { nickname }) : t.replace(/\{nickname\}님의\s*/, "");
}

export function WaitNotice({
  nickname,
  message,
  longWait,
  longWaitSeconds = 30,
  lines,
  onLongWait,
}: {
  nickname: string;
  message: string;
  longWait?: string;
  longWaitSeconds?: number;
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
      {longWait && seconds >= longWaitSeconds && <p className="fade-up mt-2 text-[13px] text-gold">{longWaitLine(longWait, nickname)}</p>}
    </div>
  );
}
