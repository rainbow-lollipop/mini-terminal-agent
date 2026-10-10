import type readline from "node:readline/promises";

// 最小行级 diff：动态规划求最长公共子序列
// 公共行保留为上下文，其余按归属标 - （旧删）/ + (新增)
// ponytail: O(n * m) 对配置文件和小源码足够，几千行的大文件会慢，届时换系统 diff 命令
export function lineDiff(oldStr: string, newStr: string): string {
	const a = oldStr === "" ? [] : oldStr.split("\n");
	const b = newStr.split("\n");
	// dp[i][j] = a[i...] 与 b[j..] 的 LCS 长度
	const dp: number[][] = Array.from({ length: a.length + 1 }, () => {
		return new Array(b.length + 1).fill(0);
	});
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	// 按 LCS 回溯，产出 diff 行
	const lines: string[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			lines.push(" " + a[i]);
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			lines.push("- " + a[i]);
			i++;
		} else {
			lines.push("+ " + b[j]);
			j++;
		}
	}
	while (i < a.length) lines.push("- " + a[i++]);
	while (j < b.length) lines.push("+ " + b[j++]);
	return lines.join("\n");
}

//审批交互：有预览先打印预览，然后等 y/n
// 复用 REPL 的 rl：同一条 stdin 挂两个 readline 会双重回显（y 变 yy）且抢输入
export async function ask(
	rl: readline.Interface,
	question: string,
	preview?: string,
): Promise<boolean> {
	if (preview) console.log(preview);
	const answer = (await rl.question(`${question} (y/n) `)).trim().toLowerCase();
	return answer === "y" || answer === "yes";
}
