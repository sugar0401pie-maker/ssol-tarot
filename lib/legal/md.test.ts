import { test } from "node:test";
import assert from "node:assert/strict";
import { mdToHtml, inline } from "./md.ts";

test("제목·문단·굵게·목록·표를 바꾸고 첫 제목은 따로 돌려준다", () => {
  const { title, html } = mdToHtml("# Terms\n\nHello **there**.\n\n## 1. Who\n\n- a\n- b\n\n| A | B |\n| --- | --- |\n| x | y |\n", "t-");
  assert.equal(title, "Terms");
  assert.match(html, /<p>Hello <strong>there<\/strong>\.<\/p>/);
  assert.match(html, /<h3 id="t-1-who">1\. Who<\/h3>/);
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<th>A<\/th><th>B<\/th>/);
  assert.match(html, /<td>x<\/td><td>y<\/td>/);
  assert.doesNotMatch(html, /---/);
});
test("문서 안 글자는 HTML로 실행되지 않는다", () => {
  assert.equal(inline("<script>x</script>"), "&lt;script&gt;x&lt;/script&gt;");
});
test("이메일은 메일 링크로", () => {
  assert.match(inline("Email contact@ssolwellness.com."), /<a href="mailto:contact@ssolwellness\.com">/);
});
