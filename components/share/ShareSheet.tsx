"use client";

// 결과 공유 창 — 쏠 아스트로 하우스 공유 시트와 같은 구성(owner 2026-10-21, 색은 타로 하우스 것):
// 카카오톡 · 링크 복사 · 네이버 블로그 · X(트위터) · 인스타그램 · 유튜브 + 공유 이미지 미리보기·저장.
// 공유하는 건 사이트 첫 화면 주소와 세 번째 카드(앞으로의 열쇠) 그림·이름뿐 — 고민 원문·닉네임·결과 주소 없음.
// 카카오톡 = 카카오 카드(JavaScript 키·도메인 등록 시) → 기기 공유창(이미지 포함) → 링크 복사 안내.
// 인스타그램·유튜브는 웹에서 바로 올리는 주소가 없어 공유 이미지를 기기 공유창으로 넘기거나 저장 후 앱에서 올리도록 안내.
import { useEffect, useRef, useState } from "react";
import { preloadKakao, shareKakaoCard } from "@/lib/client/kakaoShare";
import { shareCard, shareImageTexts, shareMessage, shareUrl, type ShareChannel, type ShareCopy } from "@/lib/client/shareCard";
import { BRAND_PATHS } from "./brandIcons";
import KakaoTalkLogo from "./KakaoTalkLogo";
import { composeShareImage } from "./shareImage";

type Key = "kakao" | "link" | "blog" | "x" | "insta" | "youtube";
const CHANNEL: Record<Key, ShareChannel> = { kakao: "kakao", link: "link_copy", blog: "naver_blog", x: "x", insta: "instagram", youtube: "youtube" };

const brand = (k: keyof typeof BRAND_PATHS, fill: string, size: number) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fill={fill} d={BRAND_PATHS[k]} />
  </svg>
);
const LINK_ICON = (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d="M10.5 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.2 1.2M13.5 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.2-1.2" fill="none" stroke="#204870" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SHARES: Array<{ key: Key; label: string; bg: string; icon: React.ReactNode }> = [
  { key: "kakao", label: "카카오톡", bg: "#FEE500", icon: <KakaoTalkLogo size={34} /> },
  { key: "link", label: "링크 복사", bg: "#E9E3D6", icon: LINK_ICON },
  { key: "blog", label: "네이버 블로그", bg: "#03C75A", icon: brand("naver", "#fff", 20) },
  { key: "x", label: "X(트위터)", bg: "#000", icon: brand("x", "#fff", 20) },
  { key: "insta", label: "인스타그램", bg: "linear-gradient(45deg,#F58529,#DD2A7B 45%,#8134AF 75%,#515BD4)", icon: brand("instagram", "#fff", 24) },
  { key: "youtube", label: "유튜브", bg: "#FF0000", icon: brand("youtube", "#fff", 24) },
];

export function ShareSheet({
  open,
  onClose,
  copy,
  third,
  decision,
  nickname,
}: {
  open: boolean;
  onClose: () => void;
  copy: ShareCopy & { sheet_title: string; sheet_note: string };
  third: { name: string; image: string; reversed: boolean; positionName: string };
  decision: boolean;
  nickname: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [png, setPng] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    preloadKakao();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 공유 이미지는 창을 처음 열 때 한 번 만든다(결과가 바뀌지 않는 한 같다)
  useEffect(() => {
    if (!open || png) return;
    let alive = true;
    void composeShareImage(third.image, third.reversed, shareImageTexts(third)).then((b) => {
      if (!alive) return;
      setPng(b);
      setPreview(b ? URL.createObjectURL(b) : null);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  if (!open) return null;
  const card = shareCard(copy, third, decision);
  const message = shareMessage(copy, third, decision);
  const file = png ? new File([png], "ssol-tarot.png", { type: "image/png" }) : null;
  const canShareFile = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });

  async function copyLink(url: string, msg = "링크를 복사했어요.") {
    try {
      await navigator.clipboard.writeText(url);
      setNote(msg);
    } catch {
      setNote(`복사가 막혀 있어요. 이 주소를 복사해 주세요: ${url}`);
    }
  }
  /** 휴대폰 공유창으로 그림+글 보내기. 됐으면 true. */
  async function shareFile(url: string) {
    if (!canShareFile || !file) return false;
    try {
      await navigator.share({ files: [file], text: `${message}\n${url}` });
    } catch {
      /* 사용자가 취소 */
    }
    return true;
  }
  function saveImage() {
    if (!png) return false;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(png);
    a.download = "ssol-tarot.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  }

  async function share(key: Key) {
    setNote(null);
    const url = shareUrl(CHANNEL[key]);
    const enc = encodeURIComponent;
    switch (key) {
      case "link":
        return copyLink(url);
      case "kakao":
        if (await shareKakaoCard(card)) return;
        if (await shareFile(url)) return;
        if (navigator.share) {
          try {
            await navigator.share({ title: card.title, text: message, url });
          } catch {
            /* 취소 */
          }
          return;
        }
        return copyLink(url, "링크를 복사했어요. 카카오톡 대화창에 붙여 넣어 보내 주세요.");
      case "blog":
        window.open(`https://share.naver.com/web/shareView?url=${enc(url)}&title=${enc(message.split("\n")[0])}`, "_blank", "noopener");
        return;
      case "x":
        if (await shareFile(url)) return;
        window.open(`https://twitter.com/intent/tweet?text=${enc(message)}&url=${enc(url)}`, "_blank", "noopener");
        return;
      case "insta":
      case "youtube": {
        const app = key === "insta" ? "인스타그램" : "유튜브";
        if (await shareFile(url)) return;
        if (saveImage()) setNote(`공유 이미지를 저장했어요. ${app}에서 이 이미지를 올려 주세요.`);
        else setNote("이미지를 만드는 중이에요. 잠시 뒤 다시 눌러 주세요.");
        return;
      }
    }
  }

  return (
    <div className="sheet-dim" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden />
        <button ref={closeRef} type="button" className="sheet-x" onClick={onClose} aria-label="닫기">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h3 id="share-title">{copy.sheet_title}</h3>
        <p className="kicker">{nickname ? `${nickname}님의 타로 결과를 나눠 보세요. ` : ""}고민 내용은 공유되지 않아요.</p>
        <div className="share-grid">
          {SHARES.map((x) => (
            <button key={x.key} type="button" onClick={() => void share(x.key)}>
              <i style={{ background: x.bg }}>{x.icon}</i>
              {x.label}
            </button>
          ))}
        </div>
        {note && (
          <p className="sheet-note" role="status">
            {note}
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저에서 만든 이미지(blob) */}
        {preview ? <img src={preview} alt={`공유 이미지 미리보기: ${third.name} 카드`} className="share-preview" /> : <p className="sheet-small">이미지를 만드는 중…</p>}
        <button type="button" className="btn fill share-save" disabled={!png} onClick={saveImage}>
          공유 이미지 저장하기
        </button>
        <p className="sheet-small">{copy.sheet_note}</p>
      </div>
    </div>
  );
}
