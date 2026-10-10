import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveInCwd } from "../src/path-guard.ts";

const cwd = "/tmp/proj";

test("工作区内相对路径放行", () => {
	assert.equal(resolveInCwd(cwd, "src/a.ts"), "/tmp/proj/src/a.ts");
});

test("../ 逃逸被拦截", () => {
	assert.equal(resolveInCwd(cwd, "../evil.txt"), null);
});

test("绝对路径越界被拦截", () => {
	assert.equal(resolveInCwd(cwd, "/etc/passwd"), null);
});

test("cwd 本身不合法（不给删目录的机会）", () => {
	assert.equal(resolveInCwd(cwd, "."), null);
});
