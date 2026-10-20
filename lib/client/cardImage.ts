import { getImageProps } from "next/image";

// 카드 그림은 원본(720×1080, 고화질로 바꾸면 더 큼)을 그대로 내려보내지 않고, Next 이미지 최적화로
// 화면에 보이는 크기에 맞춘 작은 파일(srcset)을 받게 한다. 원본 파일은 public/images/tarot/에 그대로 둔다.
// sizes = 화면에서 실제로 차지하는 너비(CSS px). 브라우저가 기기 해상도에 맞는 크기를 고른다.
const W = 720;
const H = 1080;

export function cardImg(src: string, sizes: string) {
  const { props } = getImageProps({ src, width: W, height: H, alt: "", sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}

// CSS 배경으로 쓸 때(인트로 원형 친구) — 고정 너비 하나의 최적화 주소.
export function cardBgUrl(src: string, cssWidth: number) {
  const { props } = getImageProps({ src, width: cssWidth, height: Math.round((cssWidth * H) / W), alt: "" });
  return props.src; // 고정 크기 이미지는 src가 2배(레티나) 크기
}
