import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "../src/agent.ts";
import type { Tool } from "../src/tools.ts";

const call = (id: string, name: string, argsJson: string) => ({
	id,
	type: "function" as const,
	function: { name, arguments: argsJson },
});

test("一次完整工具往返：调工具->回灌->最终回答", async () => {
	const turns = [
		{ content: "", toolCalls: [call("1", "read_file", '{"path": "a.txt"}')] },
		{ content: "读完了", toolCalls: [] },
	];
	let n = 0;
	const llm = async () => turns[n++];
	const history: any[] = [{ role: "user", content: "看下 a.txt" }];

	await runAgent({
		llm: llm as any,
		tools: [
			{
				name: "read_file",
				description: "",
				needsApproval: false,
				parameters: {},
				execute: async () => "文件内容",
			},
		],
		cwd: "/tmp",
		history,
		approve: async () => true,
	});

	assert.equal(history.length, 5); // system, user, assistant(tool_calls), tool, assistant(最终)
	assert.equal(history[3].content, "文件内容");
	assert.equal(history[4].content, "读完了");
});

test("审批拒绝：工具不执行，拒绝原因回灌给模型", async () => {
	const turns = [
		{ content: "", toolCalls: [call("1", "write_file", '{"path": "a.txt","content": "x"}')] },
		{ content: "好的，那不写了", toolCalls: [] },
	];
	let n = 0;
	let executed = false;
	const history: any[] = [{ role: "user", content: "写 a.txt" }];
	await runAgent({
		llm: (async () => turns[n++]) as any,
		tools: [
			{
				name: "write_file",
				description: "",
				needsApproval: true,
				parameters: {},
				execute: async () => {
					executed = true;
					return "已写入";
				},
			},
		],
		cwd: "/tmp",
		history,
		approve: async () => false,
	});
	assert.equal(executed, false);
	const toolMsg = history.find((m) => m.role === "tool");
	assert.match(toolMsg.content, /拒绝/);
});

test("参数不是合法 JSON：不执行，错误回灌", async () => {
	const turns = [
		{ content: "", toolCalls: [call("1", "read_file", "{bad json}")] },
		{ content: "知道了", toolCalls: [] },
	];
	let n = 0;
	let executed = false;
	const history: any[] = [{ role: "user", content: "看 a.txt" }];
	await runAgent({
		llm: (async () => turns[n++]) as any,
		tools: [
			{
				name: "read_file",
				description: "",
				needsApproval: false,
				parameters: {},
				execute: async () => {
					executed = true;
					return "x";
				},
			},
		],
		cwd: "/tmp",
		history,
		approve: async () => true,
	});
	assert.equal(executed, false);
	assert.match(history.find((m) => m.role === "tool").content, /JSON/);
});

test("模型调了不存在的工具：错误回灌不崩溃", async () => {
	const turns = [
		{ content: "", toolCalls: [call("1", "不存在的工具", "{}")] },
		{ content: "抱歉", toolCalls: [] },
	];
	let n = 0;
	const history: any[] = [{ role: "user", content: "hi" }];
	await runAgent({
		llm: (async () => turns[n++]) as any,
		tools: [] as Tool[],
		cwd: "/tmp",
		history,
		approve: async () => true,
	});
	assert.match(history.find((m) => m.role === "tool").content, /没有/);
});
