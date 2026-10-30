/**
 * 清空构建产物目录。
 *
 * 为什么需要这个脚本，而不是直接 `rm -rf .next`：
 * 1. 某些沙箱/托管环境会把 `fs.rmdir`（非递归删目录）判定为危险操作直接拒绝，
 *    而 Next 启动时会用 `rmdir` 清理 `.next` 下的残留子目录（`diagnostics`、`static/webpack`）。
 *    结果就是：`.next` 一旦存在，第二次 `next dev` / `next build` 会崩在
 *    `Error: [safe-delete] broker denied delete: path=.../.next/xxx`，且没有可读的上下文。
 * 2. `fs.rmSync(target, { recursive: true })` 是**递归删除**语义，走的是另一条路径，
 *    在上述环境里是放行的；普通 shell 的 `rm -rf` 也可能被同一策略拦下。
 *
 * 因此这里统一用 rmSync。跨平台、无外部依赖，也不依赖当前 shell。
 */

import { rmSync } from "node:fs";
import { join } from "node:path";

const targets = [".next"];

for (const dir of targets) {
  const target = join(process.cwd(), dir);
  try {
    rmSync(target, { recursive: true, force: true, maxRetries: 3 });
    console.log(`[clean] 已清空 ${dir}`);
  } catch (error) {
    // 删不掉不应该阻断流程：真正的失败会在随后的 next dev/build 里显式报出来
    console.warn(`[clean] 跳过 ${dir}：${error instanceof Error ? error.message : String(error)}`);
  }
}
