import OpenAI from "openai";
import type {
	ChatCompletionMessageFunctionToolCall,
	ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

const client = new OpenAI({
	baseURL: process.env.BASE_URL,
	apiKey: process.env.API_KEY,
});

export type ToolSpec = {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
};

// 纯函数：把流式 delta 的分片按 index 归位，拼成完整的 tool_calls
// 流式下模型一次调用的参数会被拆成很多片，必须按 index 聚合、arguments 字符串拼接
export function assembleToolCalls(
	pieces: Record<number, { id?: string; name?: string; args?: string }>,
): ChatCompletionMessageFunctionToolCall[] {
	return Object.entries(pieces)
		.sort(([a], [b]) => Number(a) - Number(b))
		.map(([, p]) => ({
			id: p.id!,
			type: "function" as const,
			function: { name: p.name!, arguments: p.args ?? "" },
		}));
}

// 一次对话：流式接收，文本增量实时回调 onText, 最后返回拼好的 content + toolCalls
export async function chat(
	messages: ChatCompletionMessageParam[],
	tools: ToolSpec[],
	onText?: (delta: string) => void,
): Promise<{ content: string; toolCalls: ChatCompletionMessageFunctionToolCall[] }> {
	const stream = await client.chat.completions.create({
		model: process.env.MODEL!,
		messages,
		tools: tools.map((t) => ({ type: "function" as const, function: t })),
		stream: true,
	});

	let content = "";
	const pieces: Record<number, { id?: string; name?: string; args: string }> = {};
	for await (const chunk of stream) {
		const delta = chunk.choices[0]?.delta;
		if (!delta) continue;
		if (delta.content) {
			content += delta.content;
			onText?.(delta.content);
		}
		for (const tc of delta.tool_calls ?? []) {
			pieces[tc.index] ??= { args: "" };
			if (tc.id) pieces[tc.index].id = tc.id;
			if (tc.function?.name) pieces[tc.index].name = tc.function.name;
			if (tc.function?.arguments) pieces[tc.index].args += tc.function.arguments;
		}
	}
	return { content, toolCalls: assembleToolCalls(pieces) };
}
