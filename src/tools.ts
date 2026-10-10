import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolveInCwd } from "./path-guard.ts";
import { lineDiff } from "./approve.ts";

const execAsync = promisify(exec);

export type Tool = {
	name: string;
	description: string;
	parameters: Record<string, unknown>; // JSON Schema,给模型看的
	needsApproval: boolean;
	// 可选：执行前给用户看的预览（write_file 出diff，run_command 出命令本身）
	preview?: (cwd: string, args: any) => Promise<string>;
	// 约定：execute 不抛异常，失败也返回「错误...」字符串回灌给模型自纠
	execute: (cwd: string, args: any) => Promise<string>;
};

// 工具输出截断：命令输出可能巨大，全塞给模型既烧钱又爆上下文
function truncate(s: string, max = 4000): string {
	return s.length > max ? s.slice(0, max) + `\n...(已截断，共 ${s.length} 字符)` : s;
}

export const TOOLS: Tool[] = [
	{
		name: "read_file",
		description: "读取工作区内某个文本文件的内容",
		needsApproval: false,
		parameters: {
			type: "object",
			properties: { path: { type: "string", description: "相对于工作区的文件路径" } },
			required: ["path"],
		},
		async execute(cwd, { path: p }) {
			const abs = resolveInCwd(cwd, p);
			if (!abs) return `错误：路径越界 ${p}`;
			try {
				return truncate(await fs.readFile(abs, "utf8"));
			} catch (e: any) {
				return `错误：读不了 ${p} (${e.code ?? e.message})`;
			}
		},
	},
	{
		name: "write_file",
		description: "把内容整体写入工作区内某个文件（覆盖），目录不存在会自动创建",
		needsApproval: true,
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "相对工作区的文件路径" },
				content: { type: "string", description: "完整的文件内容" },
			},
			required: ["path", "content"],
		},
		// 预览 = 新旧内容的行级 diff，approve 层会把它打印出来
		preview: async (cwd, { path: p, content }) => {
			const abs = resolveInCwd(cwd, p);
			if (!abs) return `(路径越界，执行会失败)`;
			const old = await fs.readFile(abs, "utf8").catch(() => "");
			return lineDiff(old, content);
		},
		async execute(cwd, { path: p, content }) {
			const abs = resolveInCwd(cwd, p);
			if (!abs) return `错误：路径越界 ${p}`;
			await fs.mkdir(path.dirname(abs), { recursive: true });
			await fs.writeFile(abs, content, "utf8");
			return `已写入 ${p} (${content.length} 字符)`;
		},
	},
	{
		name: "run_command",
		description: "在工作区目录执行一条 shell 命令，返回合并后的输出。超时 30 秒自动终止",
		needsApproval: true,
		parameters: {
			type: "object",
			properties: { command: { type: "string", description: "要执行的 shell 命令" } },
			required: ["command"],
		},
		preview: async (_cwd, { command }) => `$ ${command}`,
		async execute(cwd, { command }) {
			try {
				const { stdout, stderr } = await execAsync(command, {
					cwd,
					timeout: 30000, // 超时自动 kill，防卡死
					maxBuffer: 1024 * 1024,
				});
				return truncate((stdout + stderr).trim());
			} catch (e: any) {
				// 非零退出码/超时都走这里：把已有输出回给模型，它自己判断怎么办
				const out = String(e.stdout ?? "") + String(e.stderr ?? "");
				return truncate(out.trim() || `错误：${e.message}`);
			}
		},
	},
];
