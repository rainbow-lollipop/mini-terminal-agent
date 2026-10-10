import readline from "node:readline/promises";
import { runAgent } from "./agent.ts";
import { TOOLS } from "./tools.ts";
import { chat } from "./llm.ts";
import { ask } from "./approve.ts";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
// rl.question 在接口关闭（ctrl+C / ctrl+D）时 promise 永不结算，会以退出码 13 报 unsettled top-level await，这里主动退出
rl.on("SIGINT", () => process.exit(0));
rl.on("close", () => process.exit(0));
const history: ChatCompletionMessageParam[] = []; // 跨轮复用的对话历史

console.log("codex-mini 就绪（/help 查看命令，/exit 退出，ctrl+C 直接退出）");
while (true) {
	const input = (await rl.question("> ")).trim();
	if (!input) continue;
	if (input === "/exit") break;
	if (input === "/clear") {
		history.length = 0;
		console.log("上下文已清空");
		continue;
	}
	if (input === "/help") {
		console.log("/clear 清空上下文   /exit 退出");
		continue;
	}

	history.push({ role: "user", content: input });
	try {
		await runAgent({
			llm: chat,
			tools: TOOLS,
			cwd: process.cwd(),
			history,
			approve: (q, p) => ask(rl, q, p),
			onText: (d) => process.stdout.write(d),
			onTool: (name, args) =>
				process.stdout.write(`\n ${name} ${args.command ?? args.path ?? ""}\n`),
		});
		process.stdout.write("\n");
	} catch (e: any) {
		// 一轮失败不炸整个 REPL：历史保留，用户可以换个说法重试
		console.error(`\n出错：${e.message}（本轮中断，上下文保留）`);
	}
}

rl.close();
