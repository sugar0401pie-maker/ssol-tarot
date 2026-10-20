"use client";

import { useEffect, useState } from "react";
import { getImageProps } from "next/image";
import { pickSceneArt, type SceneArtMap, type SceneId } from "@/lib/client/sceneArt";

// 장면 맨 위 그림(쏠 아스트로 하우스 GuideArt와 같은 방식). 고르는 건 브라우저에서만 하고, 파일을 먼저 받아 확인한 뒤에만 그린다
// — 깨진 그림 아이콘이 보이지 않게, 그림이 없거나 못 받으면 자리를 차지하지 않는다.
// 화면 가로에 꽉 차게(최대 480px), 받은 그림의 비율 그대로(자르지 않음).
export function SceneArt({ map, id, className, sizes = "(max-width: 480px) 100vw, 480px" }: { map: SceneArtMap; id: SceneId; className?: string; sizes?: string }) {
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
  if (!img) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 미리 받아 확인한 최적화 주소
    <img {...img} alt="" aria-hidden className={className ?? "fade-up relative z-[1] mx-auto block h-auto w-full max-w-[480px]"} />
  );
}
