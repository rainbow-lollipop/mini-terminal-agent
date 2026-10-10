import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TOOLS } from "../src/tools.ts";

const tool = (name: string) => TOOLS.find((t) => t.name === name)!;
const tmpCwd = () => fs.mkdtemp(path.join(os.tmpdir(), "codex-"));

test("危险工具必须带审批标记", () => {
	assert.equal(tool("read_file").needsApproval, false);
	assert.equal(tool("write_file").needsApproval, true);
	assert.equal(tool("run_command").needsApproval, true);
});

test("read_file 路径越界返回错误字符串，不抛出", async () => {
	const cwd = await tmpCwd();
	const out = await tool("read_file").execute(cwd, { path: "../x.txt" });
	assert.match(out, /越界/);
});

test("read_file 文件不存在返回错误字符串", async () => {
	const cwd = await tmpCwd();
	const out = await tool("read_file").execute(cwd, { path: "ghost.txt" });
	assert.match(out, /错误/);
});

test("write_file 覆盖写入", async () => {
	const cwd = await tmpCwd();
	const out = await tool("write_file").execute(cwd, { path: "a.txt", content: "new" });
	assert.match(out, /已写入/);
	assert.equal(await fs.readFile(path.join(cwd, "a.txt"), "utf8"), "new");
});

test("run_command 跑通并合并 stdout/stderr", async () => {
	const cwd = await tmpCwd();
	const out = await tool("run_command").execute(cwd, { command: "echo hi && echo err 1>&2" });
	assert.match(out, /hi/);
	assert.match(out, /err/);
});

test(`run_command 非零退出不抛出，把输出回给模型`, async () => {
	const cwd = await tmpCwd();
	const out = await tool("run_command").execute(cwd, { command: "ls /不存在的目录" });
	assert.match(out, /No such file|没有那个文件|错误/);
});
