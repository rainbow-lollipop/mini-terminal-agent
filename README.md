# codex-mini

一个迷你版的终端里的极简Agent。

## 跑起来

    pnpm install
    cp .env.example .env   # 填你的中转地址/key/模型
    pnpm start

## 能干什么

    > 把 config.json 里的 timeout 改成 30     # 自动读文件 → 出 diff → 你确认 → 写入
    > 跑一下 npm test                          # 出命令审批 → 执行 → 汇报结果

## 边界

- 只能操作启动目录（cwd）内的文件，越界会被拦截
- 写文件和跑命令都要人工批准（y/n）
- Ctrl+C 退出；/clear 清空对话上下文
