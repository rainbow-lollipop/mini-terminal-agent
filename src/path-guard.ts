import path from "node:path";

// 把模型给的路径解析并限制在 cwd 内：越界返回 null
// 为什么不用 startsWith(cwd)就完事：'/tmp/proj-evil' 也 startsWith('/tmp/proj')
// 所以必须拼上路径分隔符再比
export function resolveInCwd(cwd: string, p: string): string | null {
	const abs = path.resolve(cwd, p);
	if (abs === cwd) return null; // cwd 本身不合法（不给删目录的机会）
	if (!abs.startsWith(cwd + path.sep)) return null; // 逃出工作区
	return abs;
}
