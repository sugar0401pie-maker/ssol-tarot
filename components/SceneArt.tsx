"use client";

import { useEffect, useState } from "react";
import { getImageProps } from "next/image";
import { pickSceneArt, type SceneArtMap, type SceneId } from "@/lib/client/sceneArt";

// 장면 맨 위 그림(쏠 아스트로 하우스 GuideArt와 같은 방식). 고르는 건 브라우저에서만 하고, 파일을 먼저 받아 확인한 뒤에만 그린다
// — 깨진 그림 아이콘이 보이지 않게, 그림이 없거나 못 받으면 자리를 차지하지 않는다.
// 화면 가로에 꽉 차게(최대 480px), 받은 그림의 비율 그대로(자르지 않음).
<<<<<<< HEAD
export function SceneArt({ map, id, className, sizes = "(max-width: 480px) 100vw, 480px" }: { map: SceneArtMap; id: SceneId; className?: string; sizes?: string }) {
=======
// reserve: 그림을 받는 동안에도 정사각형 자리를 먼저 잡아 둔다(결과 쪽 — owner 2026-10-21 "5쪽에 그림이 없어요": 느린 망에서 다 받기 전에
// 넘겨 버리면 그림이 없는 것처럼 보였다). 장면 그림은 모두 1080×1080 정사각형.
export function SceneArt({ map, id, className, sizes = "(max-width: 480px) 100vw, 480px", reserve = false }: { map: SceneArtMap; id: SceneId; className?: string; sizes?: string; reserve?: boolean }) {
>>>>>>> 497198fe5a04dc80429fd19da85609b1be61a941
  const [img, setImg] = useState<{ src?: string; srcSet?: string; sizes?: string } | null>(null);
  useEffect(() => {
    const src = pickSceneArt(map, id, Math.random());
    if (!src) return;
    const { props } = getImageProps({ src, width: 1080, height: 1080, alt: "", sizes });
    let alive = true;
    const probe = new window.Image();
    probe.sizes = props.sizes ?? "";
    if (props.srcSet) probe.srcset = props.srcSet;
    probe.onload = () => alive && setImg({ src: props.src, srcSet: props.srcSet, sizes: props.sizes });
    probe.src = props.src;
    return () => {
      alive = false;
    };
  }, [map, id, sizes]);
<<<<<<< HEAD
  if (!img) return null;
=======
  if (!img) return reserve && (map[id]?.length ?? 0) > 0 ? <div aria-hidden className={`${className ?? ""} scene-wait`} style={{ aspectRatio: "1 / 1" }} /> : null;
>>>>>>> 497198fe5a04dc80429fd19da85609b1be61a941
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 미리 받아 확인한 최적화 주소
    <img {...img} alt="" aria-hidden className={className ?? "fade-up relative z-[1] mx-auto block h-auto w-full max-w-[480px]"} />
  );
}
