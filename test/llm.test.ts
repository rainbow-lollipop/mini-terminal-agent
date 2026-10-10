import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleToolCalls } from "../src/llm.ts";

test("按 index 归位分片、拼接参数、保持调用顺序", () => {
	const calls = assembleToolCalls({
		1: { id: "b", name: "run_command", args: '{"command":"ls"}' },
		0: { id: "a", name: "read_file", args: '{"path":"a.txt"}' },
	});
	assert.deepEqual(calls, [
		{ id: "a", type: "function", function: { name: "read_file", arguments: '{"path":"a.txt"}' } },
		{ id: "b", type: "function", function: { name: "run_command", arguments: '{"command":"ls"}' } },
	]);
});

test("空输入返回数组", () => {
	assert.deepEqual(assembleToolCalls({}), []);
});
