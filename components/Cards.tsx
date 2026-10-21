"use client";

import { useState } from "react";
import { cardImg } from "@/lib/client/cardImage";

// 카드 앞면/뒷면 (디자인 가이드 6장).
// - 앞면 그림은 2:3, 카드명은 그림에 넣지 않고 하단 크림 띠(약 92% 높이)에 웹 글자로 얹는다.
// - 역방향: 그림만 180도 회전, 카드명은 띠에 얹지 않는다(부모가 카드 아래에 바로 선 글자 + "역방향" 칩).
// - 이미지가 없거나 못 불러오면 크림 배경 + 남색 테두리 + 카드명 대체 카드(크래시 없이).

// 최종 카드 그림(2026-10-07 owner 제공 "labeled" 버전)은 그림 하단 띠에 "번호 카드명 (캐릭터)"가 이미 인쇄돼 있다.
// 그 그림으로 바꾸면 true로 — 웹 글자 카드명을 겹쳐 쓰지 않는다.
const CARD_ART_HAS_LABEL = true; // 2026-10-20 owner 고화질 카드(이름 인쇄된 판)로 교체

// 카드 뒷면은 화면마다 크기가 달라도(뽑기 부채 52~64px, 섞기 144px) 같은 파일 하나를 받도록 크기를 한 값으로 고정한다.
const BACK = cardImg("/images/tarot/card-back.webp", "144px");

export function CardBack({ className = "" }: { className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-[6%] bg-night shadow-md ${className}`}>
      {!broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img {...BACK} alt="" draggable={false} decoding="async" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="h-full w-full rounded-[6%] border border-gold" />
      )}
    </div>
  );
}

export function CardFace({
  image,
  name,
  character,
  reversed,
  className = "",
  sizes = "(max-width: 384px) 30vw, 120px",
}: {
  image: string;
  name: string;
  character: string;
  reversed: boolean;
  className?: string;
  sizes?: string; // 화면에서 차지하는 너비(기본: 뽑기 화면 3칸)
}) {
  const [broken, setBroken] = useState(false);
  const alt = `${name} — ${character}${reversed ? " (역방향)" : ""}`;
  if (broken) {
    return (
      <div role="img" aria-label={alt} className={`flex aspect-[2/3] items-center justify-center rounded-[6%] border-2 border-card-line bg-card-cream p-2 text-center ${className}`}>
        <span className="font-serif text-sm font-bold text-card-line">{name}</span>
      </div>
    );
  }
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-[6%] shadow-md [container-type:inline-size] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...cardImg(image, sizes)}
        alt={alt}
        decoding="async"
        draggable={false}
        className={`h-full w-full object-cover ${reversed ? "rotate-180" : ""}`}
        onError={() => setBroken(true)}
      />
      {!reversed && !CARD_ART_HAS_LABEL && (
        <span
          aria-hidden
          className="absolute left-0 right-0 top-[92%] -translate-y-1/2 text-center font-serif font-bold leading-none text-card-line"
          style={{ fontSize: "7cqw" }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

// 역방향일 때 카드 아래에 붙는 이름 + 칩
export function CardCaption({ name, reversed, dark = false }: { name: string; reversed: boolean; dark?: boolean }) {
  if (!reversed) return null;
  return (
    <div className={`mt-1 flex flex-col items-center gap-0.5 text-center ${dark ? "text-moon" : "text-card-line"}`}>
      <span className="font-serif text-[12px] font-bold leading-tight">{name}</span>
      <span className={`rounded-full border border-gold px-1.5 text-[10px] ${dark ? "text-moon" : "text-card-line"}`}>역방향</span>
    </div>
  );
}

// 밤 화면 별가루. 위치는 고정 씨앗으로 만든 값이라 렌더마다 같다(Math.random을 쓰면 서버·브라우저 그림이 달라 깜빡임).
// owner 2026-10-21: 별을 더 많이 — 20개 → 64개, 그중 일부는 조금 크게.
const STARS: [number, number, number][] = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 64 }, () => [Math.round(rnd() * 980) / 10, Math.round(rnd() * 980) / 10, rnd() < 0.18 ? 3 : 2]);
})();
export function Stars() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map(([x, y, size], i) => (
        <span
          key={i}
          className="star"
          style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDelay: `${(i % 9) * 0.5}s`, animationDuration: `${3 + ((i * 7) % 4)}s` }}
        />
      ))}
    </div>
  );
}

// 달 속 두 물결 엠블럼(대기 화면) — 뒷면 그림 중앙을 단순화한 SVG
export function MoonEmblem({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="breathe">
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="2 4" />
      <circle cx="50" cy="50" r="34" fill="var(--moon)" />
      <path d="M22 54 q7-7 14 0 t14 0 t14 0 t14 0" fill="none" stroke="var(--night)" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 64 q6-6 12 0 t12 0 t12 0 t12 0" fill="none" stroke="var(--night)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// 금선 프레임 네 모서리 장식(디자인 가이드 4장) — 왼쪽 위·오른쪽 아래는 조개, 오른쪽 위·왼쪽 아래는 불가사리.
function Shell() {
  return (
    <svg viewBox="0 0 26 26" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
      <path d="M13 22 C5 20 3 12 6 7 C9 3 17 3 20 7 C23 12 21 20 13 22 Z" />
      <path d="M13 22 L9 6 M13 22 L13 4.5 M13 22 L17 6 M13 22 L6.5 9.5 M13 22 L19.5 9.5" />
    </svg>
  );
}
function Starfish() {
  return (
    <svg viewBox="0 0 26 26" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
      <path d="M13 3 L15.4 10 L22.8 10.2 L17 14.7 L19.1 21.8 L13 17.6 L6.9 21.8 L9 14.7 L3.2 10.2 L10.6 10 Z" />
      <circle cx="13" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function FrameCorners() {
  return (
    <div aria-hidden>
      <span className="frame-corner" style={{ left: 4, top: 4 }}><Shell /></span>
      <span className="frame-corner" style={{ right: 4, top: 4 }}><Starfish /></span>
      <span className="frame-corner" style={{ left: 4, bottom: 4 }}><Starfish /></span>
      <span className="frame-corner" style={{ right: 4, bottom: 4, transform: "rotate(180deg)" }}><Shell /></span>
    </div>
  );
}
