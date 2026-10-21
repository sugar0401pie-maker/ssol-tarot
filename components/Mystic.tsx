"use client";

import { useEffect, useState } from "react";
import { cardImg } from "@/lib/client/cardImage";
import { fill } from "@/lib/client/text";
import { lineAt, ROTATE_MS } from "@/lib/client/rotate";

// 섞기·대기 화면의 신비한 연출(owner 2026-10-20): 가운데 달 엠블럼이 천천히 돌고, 그 둘레를 카드 뒷면 세 장과
// 금빛 별이 서로 반대로 돈다. 아래 안내 문구는 3초마다 바뀌며 은은하게 깜빡인다. 움직임 줄이기면 모두 멈춘다.
const BACK = cardImg("/images/tarot/card-back.webp", "48px");
const EMB = cardImg("/images/tarot/card-back.webp", "130px");

/** 가운데 엠블럼 + 도는 카드·별 고리 */
export function MysticOrbit({ children, size = 280 }: { children?: React.ReactNode; size?: number }) {
  const rCard = size / 2 - 22;
  const rStar = size / 2 - 48;
  return (
    <div className="mystic" style={{ width: size, height: size }} aria-hidden>
      <div className="mystic-ring mystic-ring-dash" />
      <div className="mystic-orbit mystic-orbit-cards">
        {[0, 1, 2].map((i) => (
          <span key={i} className="mystic-card" style={{ transform: `rotate(${i * 120}deg) translateY(${-rCard}px)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...BACK} alt="" draggable={false} />
          </span>
        ))}
      </div>
      <div className="mystic-orbit mystic-orbit-stars">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="mystic-star" style={{ transform: `rotate(${i * 60 + 30}deg) translateY(${-rStar}px)` }}>
            ✦
          </span>
        ))}
      </div>
      {children ?? (
        <div className="wait-emb mystic-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...EMB} alt="" draggable={false} />
        </div>
      )}
    </div>
  );
}

/** 3초마다 바뀌고 깜빡이는 안내 한 줄. {nickname}은 채우고, 닉네임을 모르면 "{nickname}님의 " 같은 부분을 뺀다. */
export function RotatingLine({ lines, nickname, className = "" }: { lines: string[]; nickname: string; className?: string }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setMs(Date.now() - start), 250);
    return () => clearInterval(t);
  }, []);
  const raw = lineAt(lines, ms);
  const text = nickname ? fill(raw, { nickname }) : raw.replace(/\{nickname\}님[의이에게을를]*\s*/g, "");
  const idx = Math.floor(ms / ROTATE_MS);
  return (
    <p key={idx} className={`mystic-line ${className}`}>
      {text}
    </p>
  );
}
