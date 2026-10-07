# 웰니스 타로 — 카드 그림 생성 프롬프트

> 캐릭터를 새로 그리지 않고, **완성된 쏠 캐릭터 그림을 참조 이미지로 첨부**한 뒤 카드 틀과 배경 장면만 AI에게 맡기는 방식입니다.
> 이미지 AI는 영어 프롬프트를 더 잘 알아들어서 영어로 썼습니다. 파일명은 `tarot_data.json`의 `image.file`을 따르세요.

## 1. 공통 프롬프트 (매번 캐릭터 이미지를 첨부하고 맨 앞에 붙이기)

```
Create a wellness tarot card using the attached character image as the main character. Keep the character exactly as in the reference: same face, proportions, colors, outfit and line style. Do not redesign it.
Card: vertical 2:3 ratio, soft watercolor storybook background, calm and healing mood. Frame and background colors follow this palette: deep navy (#013566), cream (#FDF6E9), muted sky blue (#C9D9E8), white, with subtle pearl-gold accents. Thin elegant border with gentle wave motifs. Leave an empty cream banner at the bottom for a title. Centered composition. No text, no letters, no numbers.
Scene:
```

네거티브 프롬프트를 넣을 수 있는 도구라면:

```
text, letters, watermark, scary, horror, gore, aggressive, photorealistic, harsh neon colors, redesigned character
```

## 2. 카드별 장면 (공통 프롬프트의 `Scene:` 뒤에 이어 붙이기)

| # | 카드명 | 첨부할 캐릭터 | 파일명 | 장면 |
|---|---|---|---|---|
| 0 | 첫 물장구 | 수달 | `card-00-splash.webp` | The character splashing happily into shallow water at dawn for the first time, small ripples, hopeful beginning. |
| 1 | 여덟 갈래의 손 | 문어 | `card-01-eight_hands.webp` | The character on a rock, each arm holding something useful: a shell, a pearl, sea glass, a small lantern, a starfish. Confident and playful. |
| 2 | 고요히 바라보기 | 왜가리 | `card-02-still_watch.webp` | The character standing still at the water's edge under a crescent moon, watching its calm reflection, quiet and wise. |
| 3 | 품어 주는 품 | 해달 | `card-03-embrace.webp` | The character floating on its back, hugging a small baby of its kind on its belly, wrapped in kelp, warm and nurturing. |
| 4 | 지키는 자리 | 펭귄 | `card-04-guard_place.webp` | The character standing tall and steady on an ice ledge, sheltering a small chick behind it, protective and reliable. |
| 5 | 오래된 지혜 | 거북 | `card-05-old_wisdom.webp` | The character resting on a sunlit seabed beside old stones and shells, small fish gathered around listening, wise and patient. |
| 6 | 나란히 헤엄 | 원앙 | `card-06-swim_together.webp` | Two of the character side by side on a calm pond, heads gently tilted toward each other, cherry petals on the water, tender connection. |
| 7 | 파도를 타는 힘 | 돌고래 | `card-07-ride_wave.webp` | The character leaping energetically through a curling wave, sparkling water spray, strong forward momentum. |
| 8 | 진주를 품는 힘 | 조개 | `card-08-pearl.webp` | The character slightly open, a softly glowing pearl inside, gentle waves around it, quiet inner strength. |
| 9 | 나만의 등불 | 바다의 노인 (**관계성 테스트 히든 캐릭터 일러스트를 첨부**, 거북으로 그리지 않음) | `card-09-lantern.webp` | The character holding a small warm lantern in a quiet boat on a dark calm sea at night, solitary but peaceful. |
| 10 | 물살의 순환 | 가오리 | `card-10-current_cycle.webp` | The character gliding in a wide circle along a spiral sea current, golden spiral pattern in the water, cycles and time. |
| 11 | 고요한 균형 | 백조 | `card-11-balance.webp` | The character floating perfectly still on a mirror-like lake, its reflection symmetrical below, soft morning light, balance. |
| 12 | 바위 위의 쉼 | 물범 | `card-12-rock_rest.webp` | The character lying lazily on a smooth rock, head tilted upside down to look at the sky, restful pause and a new perspective. |
| 13 | 새 집으로 이사 | 소라게 | `card-13-new_shell.webp` | The character stepping out of an old cracked shell into a new beautiful spiral shell, soft autumn light, gentle transition. |
| 14 | 물과 뭍 사이 | 개구리 | `card-14-between.webp` | The character sitting on a lily pad where a river meets the sea, two water colors blending softly, harmony. |
| 15 | 부풀어 오른 마음 | 복어 | `card-15-puffed.webp` | The character puffed up and a little anxious, loosely tangled in a soft seaweed thread that could easily slip off, gentle and slightly humorous. |
| 16 | 다시 쌓는 둑 | 비버 | `card-16-rebuild_dam.webp` | The character calmly rebuilding a small dam of branches after a soft flood, a few fallen sticks around, determined and reassuring. |
| 17 | 다시 빛나는 별 | 불가사리 | `card-17-star_again.webp` | The character glowing softly on the sea floor, reflected stars shimmering in the water above, quiet hope and healing. |
| 18 | 달빛 아래 떠다니기 | 해파리 | `card-18-moon_drift.webp` | The character drifting under a full moon, its translucent glow lighting a misty path, dreamy and mysterious but not dark. |
| 19 | 햇살 바위 | 물개 | `card-19-sun_rock.webp` | The character basking joyfully on a sunny rock, clapping, sun rays sparkling on the sea, pure happiness. |
| 20 | 부름에 답하다 | 혹등고래 | `card-20-answer_call.webp` | The character breaching gracefully toward the light, glittering spray, a sense of awakening and answering a call. |
| 21 | 한 바퀴의 바다 | 쏠 바다 친구들 모두 | `card-21-whole_sea.webp` | All Ssol sea characters together forming a gentle circle around a calm sea with a wreath of kelp and coral, wholeness and completion. |

## 3. 카드 뒷면 — 달 물결 시안으로 확정

최종 뒷면은 CSO가 보낸 달 물결 시안(`06_디자인/images/card-back.webp`)입니다. 다시 그릴 때만 아래 프롬프트를 참고하세요.

```
Tarot card back design, vertical 2:3, symmetrical, deep navy background (#013566), cream (#FDF6E9) and pearl-gold line art of a stylized wave inside a moon circle at the center, delicate shell and starfish motifs in the corners, minimal and elegant, no text.
```

## 4. 히어로 이미지 (인트로·온보딩)

```
Wide mobile hero illustration, 3:4 ratio, a calm night sea under a large soft moon, a small library-like wooden pavilion floating on the water with warm lantern light, seven tarot cards with navy-and-pearl-gold backs fanned out in the air above the water, soft watercolor storybook style, palette deep navy #01365C, cream #FDF6E9, muted sky blue, subtle pearl gold, peaceful and inviting, no text.
```

## 5. 만들 때 주의할 점

1. **0번 카드를 먼저 뽑아** 마음에 드는 결과를 스타일 기준으로 고정하세요. 미드저니는 `--sref`에 그 이미지를, ChatGPT는 같은 대화창에서 "앞 카드와 같은 틀과 배경 스타일로"라고 이어서 요청합니다.
2. **캐릭터가 바뀌지 않았는지** 원본과 나란히 놓고 확인하세요. 얼굴·색이 달라졌으면 다시 생성합니다.
3. **21번 단체 카드**는 배경과 원형 틀만 AI로 만들고, 캐릭터 PNG는 디자인 툴에서 직접 배치하세요.
4. **9번 바다의 노인**은 관계성 테스트 원칙 그대로 헤밍웨이 이름·얼굴·원문 인용을 넣지 않습니다.
5. **카드명은 그림에 넣지 않습니다.** AI가 한글을 깨뜨리므로 하단 크림 배너 자리에 웹 글자로 얹습니다.
6. 최종 파일은 720×1080px 이상 WebP로 저장하고, 원본 PNG는 별도 보관하세요.
