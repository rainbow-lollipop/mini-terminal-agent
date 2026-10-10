import { test } from "node:test";
import assert from "node:assert/strict";
import { lineDiff } from "../src/approve.ts";

test("标出修改行：上下文保留，改动行 -/+ 成对", () => {
	assert.equal(lineDiff("a\nb\nc", "a\nB\nc"), " a\n- b\n+ B\n c");
});

test("新文件（旧内容为空）全是 +", () => {
	assert.equal(lineDiff("", "x\ny"), "+ x\n+ y");
});

test("内容没变则全是上下文行", () => {
	assert.equal(lineDiff("a\nb", "a\nb"), " a\n b");
});
