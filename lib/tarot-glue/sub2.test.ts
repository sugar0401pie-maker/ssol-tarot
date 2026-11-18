import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSub2, prepareFrame } from "./v4.ts";
import subDb from "../../data/worry_subtopics.json" with { type: "json" };

const ids = Object.keys((subDb as { subs: Record<string, unknown> }).subs);

test("2순위 세부: 1순위와 같거나 없는 id면 비운다", () => {
  assert.equal(cleanSub2({ sub_id: ids[0], sub2: ids[0] })!.sub2, null);
  assert.equal(cleanSub2({ sub_id: ids[0], sub2: "NO-SUCH" })!.sub2, null);
  assert.equal(cleanSub2({ sub_id: ids[0], sub2: ids[1] })!.sub2, ids[1]);
  assert.equal(cleanSub2({ sub_id: ids[0], sub2: null })!.sub2, null);
  assert.equal(cleanSub2(null), null);
});

test("결과 틀이 이겨 1순위가 바뀌어도 2순위가 1순위와 같아지지 않는다", () => {
  type Db = { subs: Record<string, { frame: string; area: string }>; frames: Record<string, { subs: string[]; rep: string; area: string }> };
  const S = (subDb as unknown as Db).subs, F = (subDb as unknown as Db).frames;
  // 대표 세부가 아닌 세부를 가진 틀을 하나 고르고, 다른 틀의 세부를 sub_id로 줘서 '틀이 이기는' 경우를 만든다
  const fid = Object.keys(F).find((f) => F[f].subs.length > 1)!;
  const rep = F[fid].rep;
  const other = ids.find((k) => S[k].frame !== fid && S[k].area === F[fid].area) ?? ids.find((k) => S[k].frame !== fid)!;
  type Fr = Parameters<typeof prepareFrame>[0];
  const out = prepareFrame({ frame_id: fid, sub_id: other, sub2: rep, area: F[fid].area } as unknown as Fr, null, "ko") as unknown as { sub_id: string; sub2: string | null };
  assert.notEqual(out.sub2, out.sub_id);
});
