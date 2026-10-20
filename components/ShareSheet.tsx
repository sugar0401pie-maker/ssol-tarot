"use client";

import { useEffect, useRef, useState } from "react";
import { preloadKakao, shareKakaoCard } from "@/lib/client/kakaoShare";
import { shareCard, shareUrl, type ShareCopy } from "@/lib/client/shareCard";

// 결과 공유 창(쏠 아스트로 하우스 공유 시트를 줄인 판): 카카오톡 · 링크 복사 · 다른 앱으로.
// 카카오톡 = 세 번째 카드 그림이 든 카드(키·도메인 등록이 돼 있을 때), 아니면 기기 공유창 → 그것도 없으면 링크 복사 안내.
// 공유하는 건 사이트 첫 화면 주소와 카드 이름·그림뿐(고민 원문·닉네임·결과 주소 없음). 팝업이라 오른쪽 위 닫기 버튼.
export function ShareSheet({
  open,
  onClose,
  copy,
  third,
  decision,
}: {
  open: boolean;
  onClose: () => void;
  copy: ShareCopy & { sheet_title: string; sheet_note: string };
  third: { name: string; image: string; reversed: boolean };
  decision: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    preloadKakao();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const card = shareCard(copy, third, decision);

  async function copyLink(url: string, msg = "링크를 복사했어요.") {
    try {
      await navigator.clipboard.writeText(url);
      setNote(msg);
    } catch {
      setNote(`복사가 막혀 있어요. 이 주소를 복사해 주세요: ${url}`);
    }
  }

  async function device(url: string) {
    if (!navigator.share) return false;
    try {
      await navigator.share({ title: card.title, text: card.description.replace("\n", " "), url });
    } catch {
      /* 사용자가 취소 */
    }
    return true;
  }

  async function kakao() {
    setNote(null);
    if (await shareKakaoCard(card)) return;
    if (await device(shareUrl("kakao"))) return;
    await copyLink(shareUrl("kakao"), "링크를 복사했어요. 카카오톡 대화창에 붙여 넣어 보내 주세요.");
  }

  return (
    <div className="sheet-dim" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="sheet-x" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        <h3 id="share-title">{copy.sheet_title}</h3>
        <div className="share-grid">
          <button type="button" onClick={kakao}>
            <i style={{ background: "#FEE500", color: "#3C1E1E" }} aria-hidden>
              TALK
            </i>
            카카오톡
          </button>
          <button type="button" onClick={() => copyLink(shareUrl("link_copy"))}>
            <i style={{ background: "#E9E3D6", color: "#204870" }} aria-hidden>
              🔗
            </i>
            링크 복사
          </button>
          <button
            type="button"
            onClick={async () => {
              setNote(null);
              if (!(await device(shareUrl("device")))) await copyLink(shareUrl("device"), "이 기기에서는 공유창을 열 수 없어 링크를 복사했어요.");
            }}
          >
            <i style={{ background: "#204870", color: "#FCEFD4" }} aria-hidden>
              ↗
            </i>
            다른 앱으로
          </button>
        </div>
        {note && (
          <p className="sheet-note" role="status">
            {note}
          </p>
        )}
        <p className="sheet-small">{copy.sheet_note}</p>
      </div>
    </div>
  );
}
