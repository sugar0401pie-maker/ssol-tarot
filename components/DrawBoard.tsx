"use client";

import { useRef, useState } from "react";
import { CardBack } from "./Cards";

// 22장 뒷면 펼침(스펙 7.4). 모바일은 두 줄 부채꼴(위 11·아래 11), 넓은 화면은 한 줄 부채꼴.
// 손가락을 대고 훑으면 닿은 카드가 살짝 떠오르고, 떼는 순간 그 카드가 선택된다(작은 카드를 정확히 누르기 어려운 문제).
// 자리 번호(0~21)만 다룬다 — 어떤 카드가 있는지는 서버만 안다.
export function DrawBoard({
  count,
  taken,
  pending,
  onChoose,
}: {
  count: number;
  taken: number[];
  pending: number | null;
  onChoose: (slot: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);

  const slotAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest("[data-slot]") as HTMLElement | null;
    if (!el) return null;
    const n = Number(el.dataset.slot);
    return taken.includes(n) ? null : n;
  };

  const rows = [Array.from({ length: Math.ceil(count / 2) }, (_, i) => i), Array.from({ length: Math.floor(count / 2) }, (_, i) => i + Math.ceil(count / 2))];

  return (
    <div
      className="mt-4 w-full max-w-[720px] select-none touch-none"
      onPointerDown={(e) => {
        dragging.current = true;
        setHover(slotAt(e.clientX, e.clientY));
      }}
      onPointerMove={(e) => {
        if (dragging.current || e.pointerType === "mouse") setHover(slotAt(e.clientX, e.clientY));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        const s = slotAt(e.clientX, e.clientY);
        setHover(null);
        if (s !== null) onChoose(s);
      }}
      onPointerLeave={() => {
        dragging.current = false;
        setHover(null);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setHover(null);
      }}
    >
      {/* 모바일: 두 줄 */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((row, r) => (
          <Fan key={r} slots={row} taken={taken} hover={hover} pending={pending} onKey={onChoose} />
        ))}
      </div>
      {/* 태블릿·데스크톱: 한 줄 */}
      <div className="hidden md:block">
        <Fan slots={[...rows[0], ...rows[1]]} taken={taken} hover={hover} pending={pending} onKey={onChoose} />
      </div>
    </div>
  );
}

function Fan({
  slots,
  taken,
  hover,
  pending,
  onKey,
}: {
  slots: number[];
  taken: number[];
  hover: number | null;
  pending: number | null;
  onKey: (slot: number) => void;
}) {
  const n = slots.length;
  return (
    <div className="relative mx-auto flex h-[112px] justify-center md:h-[150px]">
      {slots.map((slot, i) => {
        const t = n > 1 ? i / (n - 1) - 0.5 : 0; // -0.5 ~ 0.5
        const isTaken = taken.includes(slot);
        const lifted = hover === slot || pending === slot;
        return (
          <button
            key={slot}
            type="button"
            data-slot={slot}
            aria-label={`${slot + 1}번째 카드`}
            disabled={isTaken}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onKey(slot);
              }
            }}
            className="relative -mx-[11px] w-[52px] shrink-0 transition-[transform,opacity] duration-150 md:-mx-[14px] md:w-[64px]"
            style={{
              transform: `translateY(${Math.abs(t) * 18 - (lifted ? 14 : 0)}px) rotate(${t * 24}deg)`,
              opacity: isTaken || pending === slot ? 0 : 1, // 누른 카드는 날아가는 복제본이 대신 보인다
              zIndex: lifted ? 50 : i,
            }}
            tabIndex={isTaken ? -1 : 0}
          >
            <CardBack className={`w-full ${lifted ? "ring-2 ring-gold" : ""}`} />
          </button>
        );
      })}
    </div>
  );
}
