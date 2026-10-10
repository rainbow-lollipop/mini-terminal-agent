import type {
	ChatCompletionMessageFunctionToolCall,
	ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { Tool } from "./tools.ts";
import type { ToolSpec } from "./llm.ts";

// LLM依赖注入成函数类型：测试时传假实现，REPL里传真的 chat
export type LLM = (
	messages: ChatCompletionMessageParam[],
	tools: ToolSpec[],
	onText?: (delta: string) => void,
) => Promise<{ content: string; toolCalls: ChatCompletionMessageFunctionToolCall[] }>;

const SYSTEM = `你是一个跑在用户终端里的编码助手，只能在当前工作区内操作。
完成任务优先使用工具：先读文件了解现状，再改文件，用命令验证结果，不要凭空猜文件内容
工具返回「错误：...」时阅读错误换方案，同一个失败操作不要原样重试超过 2 次。`;

export async function runAgent(opts: {
	llm: LLM;
	tools: Tool[];
	cwd: string;
	history: ChatCompletionMessageParam[]; // 就地追加，跨轮复用
	approve: (question: string, preview?: string) => Promise<boolean>;
	onText?: (delta: string) => void;
	onTool?: (name: string, args: any) => void;
	maxIterations?: number;
}): Promise<void> {
	const { llm, tools, cwd, history, approve, onText, onTool, maxIterations = 15 } = opts;
	if (!history.some((m) => m.role === "system"))
		history.unshift({ role: "system", content: SYSTEM });
	for (let round = 0; round < maxIterations; round++) {
		const { content, toolCalls } = await llm(history, tools, onText);

		// 先落盘 assistant 消息（带不带 tool_calls 都要进历史，否则下一轮模型失忆）
		history.push(
			toolCalls.length
				? { role: "assistant", content, tool_calls: toolCalls }
				: { role: "assistant", content },
		);
		if (toolCalls.length === 0) return; // 模型认为完工了

		for (const tc of toolCalls) {
			const result = await execOne(tc, { tools, cwd, approve, onTool });
			history.push({ role: "tool", tool_call_id: tc.id, content: result });
		}
	}
	// 强停兜底：防止模型无限循环调工具
	history.push({
		role: "user",
		content: `已连续 ${maxIterations} 轮调用工具未完成，停止。请总结当前进展。`,
	});
}

// 单个工具调用的完整处理：找工具 -> 解析参数 -> 审批闸口 -> 执行
async function execOne(
	tc: ChatCompletionMessageFunctionToolCall,
	ctx: {
		tools: Tool[];
		cwd: string;
		approve: (q: string, p?: string) => Promise<boolean>;
		onTool?: (name: string, args: any) => void;
	},
): Promise<string> {
	const { tools, cwd, approve, onTool } = ctx;
	const tool = tools.find((t) => t.name === tc.function.name);
	if (!tool) return `错误：没有 ${tc.function.name} 这个工具`;

	let args: any;
	try {
		args = JSON.parse(tc.function.arguments || "{}");
	} catch {
		return "错误：工具参数不是合法 JSON，请修正后重试";
	}

	// --审批闸口：所有危险工具的唯一入口，别在单个工具里散写审批 --
	if (tool.needsApproval) {
		const preview = tool.preview ? await tool.preview(cwd, args) : undefined;
		const ok = await approve(`${tool.name}: ${summarize(args)}`, preview);
		if (!ok) return "用户拒绝了本次操作，请更换方案或直接询问用户";
	}

	onTool?.(tool.name, args);
	return tool.execute(cwd, args).catch((e) => `错误：${e.message}`);
}

function summarize(args: any): string {
	return args.command ?? args.path ?? JSON.stringify(args).slice(0, 80);
}
