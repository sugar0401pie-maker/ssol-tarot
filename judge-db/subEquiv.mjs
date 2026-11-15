// v2.3.22 — 채점할 때 같은 값으로 치는 세부 짝(data/sub_equivalents.json). 판별에는 쓰지 않음.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const DB = JSON.parse(fs.readFileSync(path.join(here, "data/sub_equivalents.json"), "utf8"));
const SET = new Set(DB.pairs.flatMap((p) => [`${p.a}|${p.b}`, `${p.b}|${p.a}`]));
export const sameSub = (gold, got) => !!gold && !!got && (gold === got || SET.has(`${gold}|${got}`));
