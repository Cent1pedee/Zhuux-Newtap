# 起始页 · Startpage

一个「一屏上网入口」式的个人起始页：**默认只有时间、搜索、一句话与底部快捷跳转**；点击时间后壁纸高斯模糊，中部浮出快捷方块与右上角设置入口。
参考 anheyu 新标签页的形态：背景是每日壁纸，控件压在上面，首屏不出现任何卡片与次级模块。
经典布局（便签、一言、顶栏）保留为可选模式，在设置 → 常规里切换。**天气模块已整体移除**（组件、配置、城市表、接口与设置分区全部删掉），页面不留任何占位。
**接口请求只走白名单（壁纸 / 一言 / 搜索建议），图片请求只用于站点 favicon**，全部数据只存本机（localStorage + IndexedDB）。

- 技术栈：Next.js 15.5（App Router）+ React 19 + TypeScript strict + Tailwind CSS v4.3 + Motion 13 + **shadcn/ui（Radix + sonner，官方组件经兼容层接入）** + Magic UI 风格组件（全部自绘，零额外运行时依赖）
- 部署形态：纯静态产物（`next build` 全静态预渲染），可直接托管到 Vercel / 任意静态服务器
- 无后端、无账号、无埋点

---

## 一、快速开始

```bash
pnpm install         # 安装依赖（严格按 pnpm-lock.yaml 还原）
pnpm dev             # 开发服务器 → http://localhost:3000
pnpm build           # 生产构建（静态预渲染）
pnpm start           # 启动生产服务器 → http://localhost:3000
```

要求 Node.js ≥ 20 与 pnpm ≥ 9（开发与验证环境为 Node v22.12.0 / pnpm 9.15.0）。

> 本项目锁定 **pnpm**：`package.json` 里声明了 `"packageManager": "pnpm@9.15.0"`，
> 仓库只提交 `pnpm-lock.yaml`（无 `package-lock.json`）。
> 用 npm / yarn 安装会生成第二份锁文件并可能装出不同版本，请勿混用。
> 未装 pnpm 时：`corepack enable && corepack prepare pnpm@9.15.0 --activate`（Node 20+ 自带 corepack）。

---

## 二、功能清单

### P0（简洁布局默认态：时间 / 搜索 / 一言 / Dock）

| 模块 | 行为 |
|---|---|
| **搜索引擎框** | 支持 Google / Bing / 百度（**已彻底移除 DuckDuckGo**），**默认 Bing**。**点击左侧引擎图标弹出引擎列表**（当前项带勾，选定即生效，不再「点一次换一个」；右键同样打开）。**Enter 与点搜索按钮一律在新标签页打开**（不再劫持当前页）；**输入为空时直接新标签打开当前引擎官网**（如 Bing → `bing.com`）。**搜索栏是三态胶囊**：未聚焦时两端图标完全隐藏，只留一条高斯模糊胶囊、占位文字居中；悬停底色加深；聚焦后引擎图标与放大镜从两侧淡入、胶囊放大到 1.015、阴影加深、输入内距从 20px 收到 4px（全部 180~280ms 同一条缓动）。左侧引擎图标显示**站点真实 favicon**（拿不到才退回内置 SVG），右侧是一枚灰色放大镜图标（无底色）。输入 `/` 触发快捷指令面板（`/g` GitHub、`/b` 百度、`/bili` 哔哩哔哩），输入完整网址（如 `github.com`）时提示「直接打开」。表单是**原生 `method=get` 提交**，无 JS 也能搜索。**聚焦且输入为空时展示最近 8 条搜索**（单条可删、可全部清除；独立 key，进不了配置也参与不了导出）。 |
| **时间（展开入口）** | 大字号 `HH:MM`，**纯实心白色前景**（不用渐变文字 —— 早期用 `background-clip: text` + 透明填充，在 Safari / 部分 Chromium 变体上不生效，时钟会彻底不可见）。**整块时间是一个按钮；点击它，或在页面任意位置右键，都会让壁纸 `blur(18px)`、亮度 0.82，时钟与搜索平滑上移、中部浮出快捷方块、右上角浮出设置齿轮**；齿轮先出二级菜单，选分类后才打开完整设置。再次点击 / 右键 / 按 Esc 收起。右键落在任意区域（壁纸、空白、Dock、一言）都有效，输入框与浮层内部保留原生菜单。经典布局没有展开态，右键改为唤出命令面板。悬停时时间背后浮出一团极淡的径向光，按下回弹 0.985，展开后整体退到 88% 不透明度把注意力让给方块。可在设置里开启秒；日期显示「周几 · 月日」；问候语默认关闭。数字变化时只有 Magic UI 风格的模糊上浮轻过渡。
| **每日一言**（默认显示） | **没有任何容器 / 边框 / 玻璃底**，就是背景上的一行小字（对齐青柠起始页）。简洁布局里贴着 Dock 上方，经典布局里同位置；默认开启，可在「模块显示 → 一言」关闭。**聚焦搜索框时整块渐隐并轻微下沉，失焦后淡回**（`[data-dimmed]` + CSS transition）。**数据源默认走远程 API**（`v1.hitokoto.cn`），**3 秒超时静默回退**内置 36 条语录库（离线兜底）。**页面上只有一行正文与一行出处** —— 没有「远程 / 本地」标签、没有分类下拉、没有刷新按钮；**点正文就换一条**。切换时逐字 reveal（Magic UI TextAnimate）。 |
| **快捷跳转** | 两处入口共用同一份配置：**① 点击时间后中部浮出的方块网格** —— 5 列（窄屏 4 列）、52px 图标片 + 常驻名称，末尾是「添加」方块（直达「设置 → 快捷跳转」）；**② 底部悬浮 Dock** —— 不分组、不标题、不卡片，全部图标排成一行（窄屏自动折行），常态只有图标，名称是鼠标悬停时浮出的 macOS 式气泡。**所有来源（自定义图片 / emoji / favicon / 首字母）都躺在同一枚中性浅色 squircle 上**：28% 相对圆角、顶部高光 + 冷灰渐变 + 一圈内描边；字形统一一档墨色、字号字重固定，favicon 统一 `grayscale(1)` 去色 —— 整条 Dock 读成一套图标，而不是彩色贴纸拼盘。favicon 按 `favicon.ico → apple-touch-icon.png → favicon.svg` 逐条探测，全失败才回退首字母。Dock 42px / 网格 52px 只是同一枚片的两个尺寸。悬停时按 macOS Dock 的方式联动：当前项上浮 4px + 放大到 1.12、左右邻放大到 1.06、片自身轻抬放大；齿轮 hover 转 90°，「添加」十字放大。**首页不提供编辑按钮** —— 增删改与排序全部收进「设置 → 快捷跳转」；列表用左侧六点把手**拖拽排序**（键盘聚焦把手后 ↑/↓ 移动一格），不再有逐条上移/下移按钮。
| **每日壁纸** | **Edge / Bing 每日一图**（原 Magic UI Backgrounds 四种风格已彻底移除）。元数据取自 `bing.biturl.top`（白名单内，带 CORS），图片直链走 `www.bing.com/th?id=...`；成功后写进 IndexedDB，刷新先读缓存再拉网络，失败保留上一次成功结果。**图片先用 `new Image()` + `decode()` 预解码，解完才淡入** —— 否则大图会「先画出上半截再补下半截」，那半秒正好被淡入放大，看起来像被切成两半。可回溯「今天 / -1 天 / -3 天 / -7 天」，可关闭改为纯渐变兜底；可叠加一张自定义图片（优先级更高，远程 URL 或本地文件，≤8MB）；可调暗化程度与基础模糊；输入框聚焦时自动加深模糊（聚焦模式）。遮罩只有一层中性暗色薄纱（两个主题同一套，亮色略轻），负责「曝光」；中轴压暗与上下薄纱由首页的 `.home-scrim` 负责，那里知道时钟与一言在哪。照片上的文字（时间 / 日期 / 名称 / 一言）因此一律是白色 + 暗投影 —— 壁纸是每日一图，明暗随机，只有背景恒定偏暗才能保证任意一张图都读得清。早先亮色主题在壁纸上叠过 0.32~0.72 的白雾，结果是双输：白字被白雾洗掉、照片也被压成粉彩（纯黑块被抬到 rgb(110,110,110)）；现在这张雾已彻底移除。 |

### P1 / P2（默认关闭，需在设置里显式开启）

| 模块 | 说明 |
|---|---|
| **命令面板**（P1） | `Cmd/Ctrl + K` 唤起，统一搜索快捷项、切换主题、换背景、打开设置、聚焦搜索框。方向键 + `Enter` 执行，`Esc` 关闭。另有「导入浏览器书签」（深链到设置页签）、「清除搜索历史」、「显示/隐藏便签」、「查看快捷键」四个动作。 |
| **天气** | **已移除**。组件、配置字段、城市坐标表、Open-Meteo 服务、白名单域名、CSP 定位权限与设置里的「天气」分区全部删除；首屏 JS 因此少了 7 kB。若以后要恢复，入口只剩 `git` 历史。 |
| **主题系统**（P1） | 亮 / 暗 / 跟随系统三态；8 个预设强调色 + 取色器，实时显示与底色的对比度并标注是否通过 AA。切换是**组件级 320ms 颜色过渡**：壁纸四层背景一个像素都不变，只有搜索胶囊 / Dock / 卡片 / 设置面板换材质（见 3.6）；**没有整页 View Transitions 快照，也没有圆形揭示**，不跳变、不白屏。 |
| **待办便签**（P2，经典布局） | 默认关闭（一张独立的 `.card-panel` 玻璃卡）。标题栏是**渐变圆徽 + 标题 + 「已保存」小药丸 + 字数胶囊**；卡片左沿有一道 accent 竖线，聚焦时点亮；输入区**没有边框与底色**、直接铺在卡片上（聚焦才浮出一圈 accent 内发光），**按内容自动长高**（超过 8 行才内部滚动）；输入框下沿有一条**字数进度**（按「已写 / 一屏舒适容量 240 字」计，写两行就能看见它长一点）。底部操作栏带图标、内容为空时整条收起，清空按钮悬停才染红。纯文本，输入后 300ms 防抖写入本机配置；字数超过 90% 的字数胶囊变警示色；内容随配置一起导出/导入，不产生任何网络请求。 |
| **配置导入导出 / 一键清除**（P2） | 导出为 `startpage-config-YYYY-MM-DD.json`；导入做类型防御合并（不认识的字段丢弃、类型不符不覆盖）；一键清除会二次确认，清空 localStorage 与 IndexedDB 后回到出厂配置。 |

#### 把内网服务放进来

默认不留内网地址（`192.168.x.x` 对绝大多数人是打不开的死链）。要加 NAS / Grafana 这类服务：
设置 → 快捷跳转 → 添加，地址填 `http://192.168.1.10:5000`，图标选「Emoji」或上传图片 ——
内网地址抓不到 favicon，留空会一直显示首字母。这类请求只发生在 `<img>` 上，不经过 `safeFetch`，
因此不需要动白名单。

### 跨端适配（触屏 / 窄屏 / 旧引擎）

同一份代码要在桌面浏览器、手机竖屏、手机横屏、触屏设备与旧版内核上都不出错。规则集中在
[`src/styles/responsive.css`](src/styles/responsive.css)（样式已按 tokens / base / panels / widgets / chrome / layout / effects / responsive / utilities 拆分），媒体查询之外的分支一律不影响桌面既有观感：

| 场景 | 处理 |
|---|---|
| `< 640px` 设置面板 | 五个分类按 3 列网格排成 3 + 2（不再折成 4 + 1 让最后一项孤悬）。早期每个 tab 都是 `width:100%`，390px 屏上 nav 可滚宽度 2280px，要横滑 7 屏才够得着最后一个分类 |
| `≤ 420px` 顶栏 | 收紧动作组内边距与按钮尺寸（32 → 30）。320px 实测顶栏内容宽 **350px**，齿轮按钮原先被 `overflow:hidden` 裁掉 |
| `≤ 360px` | 两侧 gutter 16 → 12（一次省 8px），并保留 `flex-wrap` 作为极端文案的兜底 |
| 触屏（`hover: none`） | Dock 胶囊取消 hover 上浮（触屏点击会让 hover 状态粘住）；快捷项名称改为图标下常显（`title` 在移动端不生效） |
| `≤ 639px` Dock | 一行横向滑动 + 名称常显：每格 58×58、图标 38、热区 54×54、间距 6px，胶囊内距 4px（整条 **70px**，此前 83px）。两端按「是否真的还能滚」做渐隐 |
| `≤ 639px` 首页主列 | 三段式：时钟/搜索锚顶、一言居中（auto 外边距）、Dock 贴底。点时间展开方块时**时钟与搜索的位置不变**（390 视口实测 y 恒为 84 / 208），只有方块向下生长 —— 此前整列重新居中，时钟上跳 183px，看起来像「点一下时间搜索框弹出来」 |
| `≤ 639px` 且 `≤ 700px` 高 | 展开态收起一言（568 高的机器上四行方块本来放不下，一言再占 72px 会把第三行切在句子中间），并给主列底部 24px 渐隐提示还能滚动 |
| iOS Safari | 表单控件在 `≤ 820px` 时字号提到 16px。控件小于 16px 时 Safari 会在聚焦瞬间放大整页且不还原，表现为「点一下搜索框，整页错位」 |
| 刘海屏 | 顶栏 / 页脚补 `env(safe-area-inset-left/right)`，Dock 补 `safe-area-inset-bottom` |
| 横屏矮视口（`max-height: 460px`） | `--stack-gap` 收到 6px、Dock 顶部空档收到 10px。844×390 缩放到下限 0.6 后原本仍溢出 35px，现在为 3px（已在 `main` 内部可滚） |
| Toast | **固定 top-center + 20px 的 14px 圆角玻璃卡**，与设置面板共用 `--glass-bg-strong` / `--glass-border`；语气用同尺寸线性图标 + 色块表达（info / success / error），`--width` 固定 380px、多条展开堆叠不缩放。旧版是 bottom-center 的 34px 小胶囊、靠 ResizeObserver 实测 Dock 高度抬高：窄屏折行时偏移滞后、弹窗打开时压在「恢复出厂 / 完成」上、还会盖住一言；多条宽度随文字变、缩放叠成一摞参差碎片 |
| 旧引擎 | `height:100vh` 给 `dvh` 兜底；`zoom` 先做 `CSS.supports` 探测，不支持则退回「不缩放 + `main` 内滚」；下拉箭头用 `transform` 而非 `translate` 属性；图标底色先给纯色再叠 `color-mix` 渐变，避免整条 `background` 失效后图标变透明 |


### 一致性约束（形状 / 颜色 / 边距）

跨端与跨主题的差异，绝大多数不是「某个断点写错了」，而是同一个语义被两套值表达。以下四条是硬约束，改样式前先对照：

| 约束 | 具体规则 | 反例（都会在某一端露馅） |
|---|---|---|
| 圆角按角色分，不按数值猜 | `--radius-pill: 999px` 只服务「胶囊 / 正圆」；控件尺寸决定最终形状。控件用 `--radius-xs/sm/md`，卡片 `--radius-md/lg`，弹窗 `--radius-card`(18) | 把 `--radius-pill` 写成 10px：38×38 的设置圆钮变成圆角方块，而同一行搜索胶囊仍是 999px，一屏两种形状语言 |
| 语气色必须走 token | `--tone-success / --tone-warning / --tone-error` 亮暗各一套，小字对比度均 ≥ 4.8:1（实测 5.48 / 5.02 / 4.83） | 直接用 `text-emerald-400` / `text-amber-400` / `text-red-400`：白底只有 1.97 / 1.67 / 2.77:1，亮色主题下状态文字读不出来 |
| 弹窗在每一端都留边 | 面板宽 `calc(100% - 24px)`，圆角 18px；桌面再由 `max-w-*` 收窄 | 只写 `w-full` + `max-w-none`：390px 屏上弹窗左右贴边、圆角削在屏幕边缘，桌面端却有 336px 留白 |
| gutter 跟随断点 | 顶栏 / 页脚 / `main` 同一档：< 640px 为 16px，≥ 640px 为 24px（安全区用 `max()` 兜住） | 给 `.app-shell > header` 无条件写 16px：选择器优先级压过 `sm:px-6`，桌面顶栏比内容列左移 8px |


### 布局与一屏原则

- 严格 `100dvh`，**页面本身不滚动**（`body` 与 `.app-shell` 均为 `overflow: hidden`）。
- 内容高于可用高度时按 `zoom` **等比缩小**（下限 0.6），保证一屏完整呈现；缩到下限仍放不下（手机横屏）或浏览器不支持 `zoom` 时，由 `main` 内部滚动兜底，页面本身仍不滚动。`main` 上写 `data-fit-scale` 便于验收。
- 只有设置面板内容区、搜索建议列表这类「本应滚动」的区域用 `thin-scroll` 内部滚动。
- 纵向层次（对齐青柠起始页）：**时钟 → 搜索框 → 便签卡 → 每日一言 → 底部 Dock**。每个模块都是独立组件、各自独立成层，**没有任何 Bento 便当板**（早期把便签与天气并排锁在一块板里，视觉上读成一个「大框」，已拆开）。天气移除后，主列之外只剩右上角的设置入口。
- **毛玻璃材质**统一由一组 token 驱动（`--panel-bg` / `--panel-highlight` / `--panel-refract` / `--panel-blur` / `--panel-shadow`）。两个主题下各只有**四处**玻璃、共用同一套配方：搜索胶囊（`.search-panel`）、便签卡（`.card-panel`）、底部 Dock（`.dock-pill`）与设置面板。Dock 的名称气泡不再常驻 `backdrop-filter`（13 个隐藏合成层），只在真正浮出时才启用模糊。配方是半透明底 + `backdrop-filter: blur(32px) saturate(1.6)` + 顶部内高光 + 下沿折射 + 外投影，视觉厚度靠层次叠加而不是把不透明度堆到接近实心，**全部不画描边**。搜索胶囊例外：它按参考站用 `blur(10px) saturate(1.5)`，聚焦时降到 `blur(10px)`，见下一条。
- **搜索框对齐 newtab.anheyu.com 的三态玻璃胶囊**（`--search-bg` / `--search-bg-hover` / `--search-bg-focus`）：静止 25% 白 + 一圈 10px 柔光，悬停 60% 白且文字转深灰，聚焦 90% 白 + `0 4px 24px` 下沉投影；底色 / 阴影 / 文字色共用 250ms `cubic-bezier(.4,0,.2,1)`，看起来是同一颗胶囊在变色。**没有描边、没有 accent ring、没有扫光**，左右两端各 52px 空白格，里面只有一枚 20px 引擎图标与一枚灰色放大镜（悬停降到 72% 不透明度）。空输入时占位文字居中，开始输入后回到左对齐。亮色主题把「白字 + 半透明白底」换成「深灰字 + 更实的白底」，保留同一套动线。
- 搜索胶囊、快捷方块与一言**统一 `max-width: 560px`**（方块网格 392px，比搜索窄一档，对齐参考站的应用抽屉）—— 一列里出现两种宽度会读成「台阶」，统一之后时钟、搜索框、方块、一言共用同一条中轴。
- 快捷跳转沉到页面最底部，做成一颗**悬浮玻璃胶囊**（`.dock-pill`，999px 圆角），里面是一排 42px 的浅色 squircle 图标片（28% 相对圆角）；悬停时胶囊自身轻轻上浮 2px。`.dock-shell` 顶部留 32px 空档，供名称气泡浮出（否则气泡会压到一言的出处行上）—— 这一档空档在 `≤639px` 会收到 14px，因为手机上的名称已改成常显文字、不再有气泡。
- **小屏 Dock 是一行横向滑动，不是两行折行**：每格 58×66（触控热区 54×54，均大于 44px 下限）、间距 6px、名称常显在图标下方；滑到哪一端就在哪一端淡出提示还有内容。此前 12 个 46px 图标在 368px 宽里折成两行、间隙只有 4px，第二行剩余几个居中，整颗胶囊被撑成「药丸套药丸」，既挤又认不出是谁。
- 时钟没有容器，直接压在大背景上，只靠字号成立。
- 卡片显隐、增删时用弹簧（stiffness 380 / damping 30）平滑移动，移除的先淡出再让位；悬停时卡片上浮 2px 并加深投影。`md` 以下自动退化为单列。

---

## 三、配置项说明

配置是**单一 JSON 对象**，存于 `localStorage["startpage.config.v1"]`。默认值在 [`src/config/defaults.ts`](src/config/defaults.ts)，结构定义在 [`src/config/types.ts`](src/config/types.ts)。

```ts
{
  version: 1,
  engineId: "bing",                    // 当前引擎（默认 Bing，菜单里选定后写回）
  engineOrder: ["google", ...],        // 引擎顺序（设置里可上下移动）
  quickCommands: [{ key: "/g", label: "GitHub", url: "..." }],
  groups: [{ id, name, items: [{ id, title, url, icon, emoji, letter, color }] }],

  theme:     { mode: "dark" | "light" | "system", accent: "#2F6FED" },
  clock:     { show: true, showSeconds: false },
  greeting:  { show: true, custom: "" },          // custom 非空时覆盖时段问候
  quote:     { show: true, source: "remote" | "local" },   // 默认远程 API，失败回退内置库
  background:{ source: "edge" | "none", offset: 0,  dim: 18, blur: 0, kenBurns: true },
  wallpaper: { source: "none" | "url" | "local", value: "" },  // local 存 idb: 引用，不存 dataURL
  suggest:   { enabled: false },                   // 实时搜索建议（仅 Bing 有 suggest 接口）
  icons:     { autoFetch: true },                  // 抓取站点 favicon（默认开启）
  note:      { enabled: true, content: "" },       // 待办便签（P2，一张独立卡片）
  privacy:   { whitelist: ["v1.hitokoto.cn", "api.bing.com", "bing.biturl.top"] },
  a11y:      { reducedMotion: null }               // null = 跟随系统；true = 强制减少
}
```

`background.source` 只有两个值：`edge`（Edge / Bing 每日一图，默认）与 `none`（纯渐变兜底，零网络请求）。`background.offset` 是往前回溯的天数，合法范围 0–7（见 `EDGE_WALLPAPER.maxOffset`）。自定义图片仍然走 `wallpaper` 分区，优先级高于每日壁纸。

**可调常量**（`src/config/site.ts`）：`LIMITS` 里是快捷项标题 16 字、分组名 12 字、单组最多 200 项、最多 12 组、快捷指令 32 条、白名单 32 个域名、一言超时 3000ms、建议超时 2500ms、图片超时 8000ms、图片体积上限 8MB（远程取图与本地自选共用 —— 图片本体存 IndexedDB，配置里只有几十字节的 `idb:` 引用）；`EDGE_WALLPAPER` 里是壁纸 API 基址、图片域、市场与最大回溯天数。

**请求白名单**在 [`src/config/site.ts`](src/config/site.ts) 的 `DEFAULT_WHITELIST` 统一维护，所有远程请求必须经过 [`src/lib/services.ts`](src/lib/services.ts) 的 `safeFetch`，命中白名单才放行（支持子域后缀匹配），否则抛 `WhitelistError` 且**根本不会发起 fetch**。

---

### 3.1 shadcn/ui 接入方式

组件由 `pnpm dlx shadcn@latest add ...` 生成到 `src/components/ui/`，配置在 `components.json`，
`cn()` 在 `src/lib/utils.ts`。接入分两类：

- 基础控件走 `ui/primitives.tsx` 兼容层，导出名、props、`data-testid` 和类名不变，业务代码不直接 import 官方组件；
- 同标签控件（`Textarea` / `NativeSelect`）由业务代码直接 import：原本就是原生 `<textarea>` / `<select>`，DOM 标签不变。

| 原 API | shadcn/ui 官方组件 | 说明 |
|---|---|---|
| `Modal` / `ConfirmDialog` | `Dialog` / `AlertDialog` | 焦点陷阱、Esc 层叠、滚动锁；兼容层补回无 `DialogTrigger` 时的焦点还原 |
| `ToastProvider` / `useToast` | `Toaster`（sonner） | `toast.custom()` 自绘统一卡片；`position="top-center"`、`--width` 固定、`expand` 展开堆叠，不再依赖 Dock 高度 |
| `SwitchButton` / `Switch` | `Switch` | 尺寸与滑块位置由 `.sp-switch` CSS 锁回原样 |
| `Segmented` | `RadioGroup` / `RadioGroupItem` | 扩展为支持 children |
| `Range` | `Slider` | DOM 从 `<input type=range>` 变为 `role="slider"`，测试改用方向键 |
| `TextInput` / `Button` / `Field` | `Input` / `Button` / `Label` | 官方默认样式由 `cn()` 用项目原有类名覆盖 |
| `FieldGroup` | `Label`（+ `role="group"`） | 多控件字段不能用 `<label>` |
| 原生 `<textarea>` | `Textarea` | 复位 `field-sizing:content` 等三项，见 `globals.css` |
| 原生 `<select>` ×4 | `NativeSelect` | `withWrapper={false}` 保留原有 DOM 与自绘箭头 |

官方 `Select` 基于 Radix，DOM 是 `role="combobox"` + portal 浮层，放不下 `value=""` 占位项，
测试里的 `fireEvent.change` / `selectOption` 也会失效，所以选了渲染原生 `<select>` 的 `NativeSelect`。
`withWrapper={false}` 只输出 `<select>`：外层已经有自己的容器与箭头时用它，避免官方 wrapper 的 `w-fit` 压掉宽度、还多出一个箭头。

`globals.css` 的 token 桥把 `--background` / `--foreground` / `--border` 别名到
`--bg-base` / `--fg` / `--glass-border`。`--accent` 不重定义，它是品牌蓝。
文件末尾的「shadcn/ui 外观兜底」段统一开关、分段、滑块、toast 与玻璃面板的描边和底色；
`NativeSelect` 的尺寸与聚焦环全部来自官方组件，项目不再维护第二套 select 样式。

对官方源码的改动：
- `sonner.tsx` 去掉 `next-themes`；
- `dialog.tsx` 的 `DialogContent` 增加 `overlayProps`；
- `radio-group.tsx` / `slider.tsx` 支持 `children` / `thumbLabel`；
- `native-select.tsx` 增加 `withWrapper`，`false` 时只渲染 `<select>`。

`/` 页 First Load JS 从 177 kB 增至当前 **229 kB**（Radix + sonner；后期统一 `cn`、按需加载与样式拆分又收回一部分）。

### 3.2 选型边界

选型按 magicui 优先、不适用时 shadcn。magicui registry 没有 `input` / `button`，
表单控件因此走 shadcn；动效组件优先 magicui。

- 4 类原生输入（隐藏 `type=file` ×3、`type=color`、主搜索、命令面板）由 shadcn `Input` 替换，
  `globals.css` 末尾复位官方默认排印。
- `BlurIn` 委托 magicui 官方 `blur-fade`（`magicui/blur-fade.official.tsx`），
  官方源码加了 `as` 和 `variant` 两个扩展，适配层沿用原动画参数。
- 保留原实现的项：
  - 业务侧 `<button>`：官方 `Button` 的默认底色、圆角、尺寸与现有按钮冲突；
  - `TextAnimate`：官方版 `as="p"`、`sr-only` span、`startOnView` 和 stagger 算法都与逐字结构不兼容；
  - `useAnimatedThemeToggle`：官方是组件，项目导出的是 hook；
  - `AnimatedDigits` / `Spotlight`：registry 没有语义对应项。

### 3.3 后续补齐的交互

| 能力 | 落点 | 关键约束 |
|---|---|---|
| 搜索历史 | `lib/search-history.ts` + `search-box.tsx` | 单独 localStorage key，最多 8 条；**不进 config**，因此不参与导入导出，也不会每次搜索都写整份配置 |
| 书签导入 | `lib/bookmarks.ts` + 设置 → 快捷跳转 | 解析 Netscape HTML；先预览再确认；与现有项按 URL 去重；遵守 `LIMITS.maxShortcuts` |
| 删除撤销 | `shortcut-manager.tsx` + toast 动作 | toast 新增可选 `action`；撤销按原索引插回，6 秒后消失 |
| 设置搜索 | `settings-panel.tsx` | 关键词表负责跨页签跳转，DOM 文本负责过滤；`MutationObserver` 等新页签挂载后再应用 |
| 快捷键帮助 | `shortcut-help.tsx` | `?` 触发，输入框内不触发；命令面板也有入口 |
| 按钮体系 | `primitives.tsx` 的 `Button` 复用 shadcn/ui 官方 `Button`（`buttonVariants`）：`primary→default / secondary→secondary / ghost→ghost / danger→destructive` 语义映射；**设置面板内所有按钮统一 32px 高 / 12px 内距 / 6px 图标间距 / 12.5px 字号 / 10px 圆角**，按压统一 `scale(.98)`，hover / focus-visible / disabled 全交给官方 cva。按钮组容器统一 `.settings-actions`（8px 间距，`--row` 变体给输入框 + 按钮用、不换行）。 |
| 模块级错误边界 | `widget-boundary.tsx` | 便签 / 一言 / 快捷跳转 / Dock 各自隔离；浮层用 `silent` 不渲染占位 |

错误边界的意义：React 19 在渲染期抛错会卸载整棵树，`app/error.tsx` 只能兜到整页。
现在一个模块出错只降级那一块，其余模块照常可用。

### 3.4 简洁布局与时间入口

首页默认 `home.simple = true`：只渲染时钟、搜索、一言与 Dock，没有顶栏、页脚与快捷方块。
时钟与搜索**在「一言以上」的可视区里垂直居中**（`margin-block: auto`，内容比可视区高时自动归零、从顶部开始滚，不会被裁掉）。点击时钟、**在页面任意位置右键**或按 Esc 进入/退出「展开态」——

- 壁纸图片额外 `blur(18px)`、亮度 0.82，保留照片的色块与明暗，不会糊成纯色；
- **时钟与搜索平滑上移**：展开区的高度从 `0` 动画到一次实测的内容高度（520ms `ease-out-cubic`），主列是 auto 外边距居中，方块每长高一像素，时钟就被重新居中、往上让位 —— 不需要给时钟写任何 transform，也不会「点一下自己往上跳」；
- 中部浮出快捷方块（**没有托板、没有标题栏**，直接落在模糊壁纸上）：52px 实心片 + 站点图标 + 名称，末尾是虚线「添加」；方块本身带 30ms 级联淡入上浮，行距与搜索间距放在展开区的内层 padding 里，跟着高度一起长出来（margin 会瞬间生效、先跳 30px）；
- 右上角浮出设置齿轮；点齿轮先出**二级菜单**（组「设置分类」：常规 / 模块 / 快捷跳转 / 背景 / 搜索引擎；组「数据与信息」：隐私与数据 / 关于）。前五项打开主设置面板的对应页签，后两项**直接**打开各自的独立弹窗；
- 弹窗仍是上一版的「左侧页签 + 卡片分组」玻璃样式；打开时第一下 Esc 只关弹窗，展开态与模糊壁纸保留；
- 再次点击时间、在任意位置右键或按 Esc 收起，展开区高度收回 0、时钟落回居中位，壁纸同时回到清晰。

设置里把「简洁首页」关掉即回到经典布局：便签、一言按「模块」页签的开关显示。
这条分支让旧模块继续可用，同时不再挤占默认首屏。

### 3.5 设置层的层级：一个面板，不再有二级菜单

齿轮**直接打开主设置面板**。主面板本身就是完整的分类导航，再弹一层「去哪一页」的菜单属于重复导航；这一层已移除。

**主设置面板（五个页签，导航按两组分层）**
- **首页**：常规（布局 / 主题 / 强调色 / 动效）、模块（时间 / 便签 / 一言）、快捷跳转（站点列表 + **站点图标**开关）。
- **外观与服务**：背景（壁纸 / 暗角 / 暗化 / 模糊）、搜索引擎（引擎 / 建议 / 指令）。
- **页脚**：左侧「隐私与数据 · 关于」两个文字入口，右侧「恢复出厂 / 完成」。低频入口不再占页签，也不单独维护一套菜单。

几条硬规则：

1. **齿轮首帧就在**：旧版齿轮包在 `dynamic(SettingsMenu)` 里，chunk 未到时整块不渲染。现在齿轮直接内联；设置面板在展开态就预挂载（`open=false`）并预热 chunk —— 实测点击到弹窗可见约 **50ms**（未预热时 ~800ms）。
2. **隐私 / 关于是页脚子弹窗**：点开后在主面板之上叠一层**更轻的遮罩**（25% 黑 + 2px 模糊，而不是两层 45% 叠成黑屏），关闭回到原页签；独立视图（命令面板直达）共用同一个组件。
3. **站点图标开关归到快捷跳转**：它管的就是那排图标长什么样；隐私弹窗只剩白名单、备份与数据边界。
4. **重复说明只留一份**：隐私页与关于页曾各写一段「数据只存本机」，现在只在隐私弹窗里，关于页只留一行指路。
5. **导航分组**：五个分类落在一条浅槽里，桌面竖排显示「首页 / 外观与服务」两个 10.5px 组名与一条分隔线；选中项由 `layoutId` 共享一层胶囊底。
6. **窄屏 3 + 2**：390px 放不下一行五个，改用 3 列网格；组名隐藏。不要用 `display:contents`，它会打乱 `layoutId` 胶囊底的定位上下文。
7. **搜索无结果不再空白**：居中空状态（关键词回显 + 常用词建议 + 「清空搜索」+ 隐私/关于入口提示）。
8. **滚动渐隐按真实溢出**：`data-scrollable` 同时观察滚动容器与内层 `.settings-body`，并在内容根 childList 变化时重新挂观察器。
9. **独立弹窗高度**：按内容收高（上限 `min(88dvh,700px)`），正文底部 14px 渐隐；打开时焦点落在面板本身而不是右上角关闭按钮。

### 3.6 主题切换与性能

**主题只作用于组件，不作用于背景。** 背景层（`.wallpaper-layer` 的图片 / 纯色兜底、`.wallpaper-vignette`、`.wallpaper-scrim`、`.home-scrim`）在亮暗两套主题下是同一份 CSS，`scrimBackground()` 也不再接收 `isLight`。照片上的文字因此统一为白色 + 暗投影，不赌每日一图的明暗。切主题时只有搜索胶囊、Dock、卡片、设置面板等**有底色的面板**按 `data-theme` 换材质，并在 `base.css` 的白名单里做一段 320ms 颜色过渡；背景层一个像素都不重画。

**为什么不再做整页 View Transitions。** 旧实现（`animated-theme-toggler.tsx`，已删）以按钮为圆心拍两张整页位图做圆形揭示，并为不支持 VT 的浏览器准备了 `html.theme-animating *` —— 给页面上每个元素及伪元素强加 5 个属性的过渡。背景既然不该变，就没有理由为它拍快照。用 CDP `Performance.getMetrics` 实测一次切换：

| 指标 | 旧（VT 整页快照） | 现在 |
|---|---|---|
| 主线程任务 | 138 ms | 132 ms（分散在过渡内，无长任务） |
| 样式重算 | 67 次 | 63 次 |
| 布局 | 30 次 | 34 次 |
| 最大帧间隔 | **50 ms** | **17 ms（0 掉帧）** |
| 背景层变化 | 兜底 / 暗角 / 薄纱都变 | 四层全部不变 |

其它已落地的性能项：

1. **删掉天气模块**：组件 + 200 余城市坐标表 + 天气服务 + 设置分区 + 白名单域名 + preconnect 一并移除，首屏 JS **231 kB → 224 kB**，也少了一个 matchMedia 监听与一个 15 分钟轮询。
2. **常驻模糊层 20 → 6**：Dock 的 13 个名称气泡原本即使 `opacity: 0` 也各带 `backdrop-filter`，各占一个合成层；现在只在 hover / focus 浮出时才启用模糊。时钟背后那团暗晕也去掉了多余的 `filter: blur(12px)`（径向渐变本身就是柔的）。
3. **设置搜索不再监听整棵子树**：`MutationObserver` 从 `subtree: true` 收成只观察内容根节点的直接 `childList` —— 仍覆盖 `AnimatePresence mode="wait"` 延迟挂载新页签，但输入文字不再反复触发过滤；同时删掉 scroll 事件里每帧的强制布局。
4. **展开动画少一次同步布局**：`height: 0 → auto` 改成量一次内容高度后用像素值插值；`ResizeObserver` 只兜住内容真的变化。首页缩放的 measure effect 不再依赖整份 `config`（主题一变就重建观察器）。
5. **`will-change` 收敛**：壁纸图片从 `transform, filter` 收成 `transform`；主题过渡白名单不碰 `transform`，避免和 Motion 的 spring 二次回弹。
6. **删掉 13 个常驻合成层**：`.shortcut-icon-wrap` 的 `will-change: transform` 让 Dock 每个图标各占一层，A/B（CPU 4×）实测滚动主线程任务 **68ms → 43ms**、页签切换 **214ms → 188ms**；Motion 会在动画期间自行提升，不需要常驻声明。
7. **设置搜索用 `useDeferredValue` 解耦输入与过滤**：CPU 4× 下快速输入从 `343ms` 主线程 + **1 个 51ms 长任务**降到 `235~256ms` + **0 长任务**；`MutationObserver` 只在有关键词时连接，换页签不再多跑一次遍历。
8. **开关位移去重**：Tailwind v4 的 `translate-x-*` 写的是独立 `translate` 属性，会和 `.sp-switch` 的 `transform` 叠加，开启态滑块实际走 28px、越出轨道 12px。从 `ui/switch.tsx` 的 Thumb 移除那两个类，位移只由项目 CSS 一处负责；轨道与滑块统一 200ms 曲线，去掉 `margin-top: 2px` 补丁改 `align-self: center`。

最终 rAF 采样（1440×900）：展开/收起、Dock 悬停、主题切换、设置内容区滚动、页签切换 **全部 16.7ms 平均帧、worst 17ms、0 掉帧**；CPU 4× 节流下同样无 >32ms 帧。

### 3.7 右键范围、提示体系与图标细节

**右键是整页手势，不是时钟专属。** `page.tsx` 在 `document` 上挂一个 `contextmenu` 监听：简洁布局切换展开态，经典布局（没有展开态）改为唤出命令面板。时钟按钮与搜索引擎按钮保留自己的右键语义，靠 `event.defaultPrevented` 避免一次手势触发两下；输入框 / 可编辑区保留浏览器原生菜单（复制粘贴），浮层打开时不改动被遮住的那层页面。落点会有一圈 520ms 的淡蓝涟漪，动画结束即移除 —— 只动 `transform / opacity`，不产生常驻合成层。`?` 快捷键说明里也补了这一条。

**Toast 统一成一张卡片。** 位置固定 `top-center + 20px`，彻底不依赖 Dock 高度：旧版靠 `ResizeObserver` 实测 `.dock-shell` 抬到底部，窄屏 Dock 折行时偏移滞后、设置弹窗打开时气泡正好压在「恢复出厂 / 完成」上、还会盖住一言。现在是 14px 圆角玻璃卡（`--glass-bg-strong` / `--glass-border`），语气用同尺寸线性图标 + 色块表达，`--width` 固定 `min(92vw, 380px)`、三条以内展开堆叠不缩放，`z-index: 80` 保证在设置弹窗（50）与二级菜单（70）之上仍可见。去掉了那个会随 Dock 高度变化的 ResizeObserver，`push` 也变成稳定引用。

**图标是同一枚浅色 squircle。** 旧版「暗色中性片 + 品牌色小字」遇到 favicon 抓到的站点就变成彩色 logo，13 个格子读成两套图标，黑色标识还会消失在深色片里。现在所有来源（自定义图片 / emoji / favicon / 首字母）共用 28% 相对圆角、顶部高光、极轻品牌色渐变与一圈内描边；字形按品牌色统一压深（`color-mix` 掺 28% 深色）、字号字重固定，favicon 不再需要 `drop-shadow` 硬描白边。「添加」位也跟着做成浅色磨砂空片，不再是一个洞。

**本轮补的动效细节**（全部有 `[data-motion="reduce"]` 兜底）：右键涟漪、齿轮 hover 旋转 90°、快捷片 hover 轻抬放大、名称 hover 提亮、toast 图标弹入、按钮按压反馈。rAF 实测：右键展开 / 收起、toast 弹出平均 **16.7ms、worst 17ms、0 掉帧**；空闲 200ms 主线程任务 5ms、0 次布局。

### 3.8 时钟阴影与界面修复

**时钟阴影从「四层压暗」收到「一层环境光 + 两层轻投影」。** 旧版叠了：壁纸薄纱、`.home-scrim` 中轴椭圆（中心 0.52）、`.home-clock::after` 的 0.5 深椭圆、以及 24px/56px 三层黑色 `text-shadow`。在雪地、霜花这类亮壁纸上会读成一枚**边界可辨的暗圆盘**，数字外再套一圈黑雾 —— 这就是「生硬」的来源。

现在：

- `.home-clock::after` 是一层比时钟宽近 4 倍的椭圆环境光（`inset:-150% -85%`），峰值 0.13，用 6 个色标拟合钟形衰减（0% → 18% 几乎不掉，38% 后加速，最后 15% 收到 0）。人眼对二阶突变敏感，线性两段式会留下圆锥边界，钟形曲线看不出中心在哪。
- 文字只保留「1px 接触 + 16px 环境」两层投影，峰值 ≤ 0.34；细笔画不再被黑边包住，最亮壁纸上仍可读。
- 悬停反馈从「背后开一盏灯」（亮色主题 0.68 白圆斑）改成极淡的整体提亮（0.055 / 亮色 0.09），范围与阴影同尺寸；触屏 `(hover:none)` 下直接关掉，避免点完时间那团提亮一直粘着。
- `.home-scrim` 中轴椭圆同步从 0.52 收到 0.44、末端 84% → 90%，压暗更平缓。
- 没有 `filter` / `backdrop-filter` / 额外合成层；减少动效偏好不变。

**本轮修复的界面问题**（每条都能在 E2E 里找到对应断言）：

| 问题 | 表现 | 修复 |
|---|---|---|
| 搜索「暗角」 | 停在「常规」页签、0 项、整块空白 | 关键词表按各页签真实 DOM 文本重写；「暗角」归背景 |
| 搜索「快捷键」 | 跳到「关于」页签、同样空白 | 删掉 DOM 里不存在的关键词；无结果统一走空状态 |
| 搜索无结果 | 只剩一块背景，没有任何反馈 | 居中空状态：回显关键词 + 常用词建议 + 「清空搜索」+ 隐私/关于入口提示 |
| 滚动渐隐标记 | 切页签后反过来：要滚的标 false、不滚的标 true | RO 同时观察 `.settings-body`，并在内容根 childList 变化时重挂 |
| 隐私 / 关于重复 | 两页各写一段「数据只存本机」，互相指路 | 合并为隐私弹窗一份；关于页只留一行指路 |
| 隐私弹窗截断 | 620px 上限把最后一段切在半空，且没有滚动提示 | 上限 700px + 正文底部 14px 渐隐 |
| 弹窗焦点环 | 打开即聚焦关闭按钮，一圈 3px 轮廓像渲染错误 | 焦点落在面板（`tabIndex=-1`），`outline:none` |
| 移动端导航 | 4 + 1 折行，最后一项孤悬左侧 | 3 列网格排成 3 + 2 |
| 关于页复制 | `navigator.clipboard` 不可用时静默无反应 | 明确提示「当前环境不支持剪贴板」 |
| 帮助弹窗焦点 | 从「关于」进入后关闭，焦点丢到 body | `returnFocusTo` 传回齿轮 |

### 3.9 搜索三态、图标统一与拖拽排序

| 问题 | 修改 |
|---|---|
| 设置入口首帧缺失 | 齿轮从 `dynamic(SettingsMenu)` 里取出、直接内联；设置面板在展开态预挂载并预热 chunk。点击 → 弹窗可见 ≈50ms（旧 ≈350ms，chunk 未到时 ≈800ms） |
| 二级菜单冗余 | 主面板已是完整导航，删除 `settings-menu.tsx` 与整套菜单样式；齿轮直接开面板，隐私 / 关于收进页脚文字入口（子弹窗 + 轻遮罩） |
| favicon 抓不到 | 单一路径 `/favicon.ico?size=` → 三条候选 `favicon.ico → apple-touch-icon.png → favicon.svg`（去掉会 404 的 query），逐条 onError 降级；全失败回退统一首字母 |
| 排序交互 | Motion `Reorder` 替换上移/下移按钮：六点把手起拖、拖动行浮起实底、落手写回配置；键盘聚焦把手后 ↑/↓ 移动一格 |
| Dock 配色不统一 | 去掉按站点品牌色染片底与字形；统一白色渐变片 + 中性墨色；favicon `grayscale(1)` 去色；编辑器移除「图标底色」选择器 |
| 搜索栏三态 | 未聚焦隐藏两端图标（`html[data-js="1"]` 才隐藏，无 JS 保持可见可提交）、占位居中；悬停底色加深；聚焦图标淡入 + 胶囊 `scale(1.015)` + 阴影加深 + 内距 20→4px |

### 3.10 图标恢复彩色、引擎徽标放大与 Dock 首帧稳定

| 问题 | 修改 |
|---|---|
| 图标全灰、不美观 | 上一轮为「材质统一」给 favicon 加了 `grayscale(1)`，一排图标只剩灰阶形状、站点辨识度下降。移除滤镜恢复站点原色；浅色片底保留，继续负责托住深色 logo |
| 引擎图标偏小 | 徽标 20 → 28px，内置字形与 favicon 的绘制占比 56% → 66%；搜索框左侧图形由约 11px 提升到 18px，与右侧 18px 搜索键同一量级；引擎菜单项 20 → 22px |
| Dock 先闪默认列表 | 首帧仍渲染出厂列表（无 JS 时可用），但 `dock-shell[data-ready="false"]` 下整条胶囊 `opacity:0 + translateY(16px)`；本地配置读完后置 `data-ready="true"`，胶囊带 spring 从下方浮入。占位高度 46px（小屏 70px）与最终一致，不会把时钟/搜索顶上去 |
| 排序后 icon 错乱 / 消失 | favicon 候选链的解析结果按站点 URL 记进模块级缓存（`src/lib/use-favicon.ts`）：排序、切布局、重开设置导致的重挂载直接从上次的候选与「已加载」状态继续，不再退回 `.ico` 或首字母；favicon 改为绝对定位，字母占位与图片永远叠在同一格，不会被挤成上下两截 |

### 3.11 刷新后 Dock 残留旧布局

| 问题 | 修改 |
|---|---|
| 增删改后刷新，Dock 先闪一下旧布局 | 持久化数据本身是对的，问题在 `ready` 翻转那一帧：`AnimatePresence` 会把被删掉的出厂项保留 160ms 播退出动画，同 id 换位的项会从默认位置做 layout 滑动 —— 胶囊同时在淡入，实测 13 项（3 个已删除项）一直显示到 opacity 0.83，再跳成 10 项。给 `AnimatePresence` 加 `key={ready ? "ready" : "pending"}`：两套列表分属不同子树，切到 ready 时整体重建，退出 / 布局动画都不发生，首个可见帧就是本地配置的最终顺序；入场只由胶囊浮入负责 |

## 四、目录结构

```text
src/
  app/
    layout.tsx        # 元数据、JSON-LD、首屏主题内联脚本（防 FOUC）
    page.tsx          # 简洁首页（默认时间/搜索/一言/Dock；点时间 → 快捷方块 + 右上设置）/ 经典一屏 + 等比缩放 + 浮层挂载
    sitemap.ts        # /sitemap.xml
    robots.ts         # /robots.txt
    not-found.tsx     # 404
    error.tsx         # 段级错误边界（重试 / 回首页），避免异常时整页纯白
  components/
    clock.tsx  search-box.tsx  daily-quote.tsx  shortcut-dock.tsx  shortcut-icon.tsx
    shortcut-grid.tsx          # 点击时间后浮出的快捷托板（标题 + 管理 + 站点方块 + 添加方块）
    shortcut-manager.tsx       # 快捷项增删改与排序（只在设置面板里出现）
    wallpaper.tsx              # Edge 每日壁纸层（预解码后淡入）+ 暗角 + 可选自定义图片叠加
    settings-panel.tsx  command-palette.tsx  theme-sync.tsx  note-pad.tsx
    shortcut-help.tsx          # 按 ? 打开的快捷键说明浮层
    widget-boundary.tsx        # 模块级错误边界：一个模块渲染失败不拖垮整页
    engine-glyph.tsx           # EngineBadge：优先取站点 favicon，失败退回内联 SVG（四色 G / Bing / 百度）
    ui/                        # shadcn/ui 官方组件（CLI 生成，见 components.json）
      dialog.tsx  alert-dialog.tsx  switch.tsx  radio-group.tsx  slider.tsx
      label.tsx  input.tsx  button.tsx  sonner.tsx
      textarea.tsx  native-select.tsx   # 同标签官方组件（便签 / 省市下拉）
      primitives.tsx          # 兼容层：把官方组件包装成项目原有 API（签名/testid 不变）
    settings/                  # 设置面板的分区与控制器（壳留在 settings-panel.tsx）
      controller.ts            # 草稿状态 + 引擎排序 / 指令 / 背景 / 白名单 / 导入导出 / 定位
      search-tab.tsx  appearance-tab.tsx  shortcuts-tab.tsx  modules-tab.tsx
      background-tab.tsx  privacy-tab.tsx  about-tab.tsx  tab-icons.tsx
    magicui/                   # Magic UI 等价实现（零额外依赖，只保留真正在用的 4 个）
      blur-fade.official.tsx  # 官方 registry 源码（BlurIn 适配层委托，含 2 处最小扩展）
      animated-digits.tsx  blur-in.tsx  text-animate.tsx        # 文本 / 数字动效
  config/
    site.ts     # 引擎、每日壁纸、强调色、白名单、限额
    types.ts  defaults.ts   # 配置形状与出厂值
  lib/
    storage.ts     # localStorage / IndexedDB 封装（mergeConfig 转发给 config-schema）
    search-history.ts  # 搜索历史：独立 localStorage key，最多 8 条
    bookmarks.ts       # 浏览器书签 HTML 解析、URL 去重、限额截断
    image-store.ts # 图片资源库：本体进 IndexedDB，配置只留 idb: 引用；旧 dataURL 自动迁移
    use-stored-image.ts # 把 idb:/data:/http(s) 三种取值解析成可直接用的 img src
    config-schema.ts # 配置字段级 schema：枚举 / 数值范围 / 数组元素 / 限额的导入校验
    services.ts    # 白名单校验 + 超时的 fetch 封装
    quotes.ts      # 内置语录库
    commands.ts    # 快捷指令解析
    greeting.ts    # 时段问候与日期格式化
    color.ts       # 对比度计算（WCAG）
    favicon.ts     # favicon URL 拼装 + 内网地址识别（不经过白名单）
    motion.ts      # 统一动效变体与入场时序
    config-store.tsx  # 配置 Context + 减少动效偏好
  styles/
    globals.css    # 只留 @import 与 dark 变体；顺序即层叠顺序
    tokens.css     # 设计 token（间距/圆角/阴影/模糊/时长）+ 主题变量 + shadcn 语义映射
    base.css  panels.css  widgets.css  chrome.css
    layout.css  effects.css  responsive.css  utilities.css  shadcn-compat.css
tests/             # Vitest 单元 / 组件测试（28 文件 277 项，有覆盖率门禁）
.github/workflows/ci.yml  # CI：typecheck → lint → 覆盖率 → build → e2e
scripts/           # capture-shots.mjs：视觉验收截图脚本
e2e/               # Playwright 端到端测试（5 文件 61 项，含 axe 无障碍扫描）
```

---

## 五、测试流程

### 5.0 一次性准备

```bash
pnpm install
# Playwright 使用本机已安装的 Chrome（channel: "chrome"），无需下载浏览器内核。
# 如需用 Playwright 自带内核，执行：pnpm exec playwright install chromium，
# 并把 playwright.config.ts 里的 channel: "chrome" 删掉。
```

### 5.1 静态检查（先跑，最快失败）

```bash
pnpm typecheck       # tsc --noEmit，TS strict 全量类型检查
pnpm lint            # ESLint（next/core-web-vitals + next/typescript）
```

期望：`typecheck` 无输出；`lint` 输出 `0 problems`。

### 5.2 单元 / 组件测试（Vitest，277 项）

```bash
pnpm test              # 单次运行
pnpm test:watch        # 监听模式
pnpm test:coverage     # 带覆盖率 + 阈值门禁（低于 70% 直接失败）
pnpm exec vitest run tests/commands.test.ts   # 只跑某个文件
```

覆盖范围：

| 文件 | 项数 | 验证内容 |
|---|---|---|
| `tests/commands.test.ts` | 16 | 快捷指令解析（长指令优先、`/github` 不误命中 `/g`、大小写、URL 编码）、直接网址识别、搜索 URL 拼接 |
| `tests/greeting.test.ts` | 19 | 时段边界左闭右开（5/9/12/14/18/23 点）、自定义问候优先、日期格式、补零、时间拆分 |
| `tests/quotes.test.ts` | 8 | 分类过滤、同日稳定、随机换条不重复 |
| `tests/color.test.ts` | 10 | 相对亮度、对比度、AA 阈值 |
| `tests/config-schema.test.ts` | 15 | 导入闸门：可空字段（`a11y.reducedMotion` 写成字符串必须被拒）、非法枚举、数值越界 clamp、快捷项/分组/白名单的元素级校验与 LIMITS 限额、默认配置往返一致 |
| `tests/config-store.test.tsx` | 4 | 跨标签页同步：外部写入跟手更新、应用后不回写、清空回到出厂、无关键不触发 |
| `tests/csp.test.ts` | 13 | 安全响应头纯函数：dev 必须含 `'unsafe-eval'` 且不含 `upgrade-insecure-requests`、生产反之；`connect-src` 不得缺失（缺了会回退 `default-src 'self'` 掐断接口）、`form-action` 覆盖三家引擎 |
| `tests/favicon.test.ts` | 4 | favicon 候选链：三条路径顺序、不再拼 `?size=`、内网/非法地址返回空、能力判断与候选链一致 |
| `tests/use-favicon.test.tsx` | 3 | 候选链断点续传：失败后推进到下一候选、重挂载从该候选继续且保留已加载状态、全部失败不再重复探测、缓存按站点 URL 隔离 |
| `tests/storage.test.ts` | 12 | 配置读写、防御式深合并（类型不符不覆盖、未知字段丢弃、可空字段兼容）、清除 |
| `tests/services.test.ts` | 23 | **白名单拒绝时 fetch 未被调用**、credentials omit、no-referrer、HTTP 500、超时抛错、suggest 截断 8 条、自定义壁纸体积与超时 |
| `tests/search-box.test.tsx` | 16 | 默认引擎 Bing、原生表单属性、**点击图标弹出引擎列表（当前项带勾、不会自动切下一个）**、菜单选定后写回、右键同样开菜单、`/` 提示、指令跳转、Esc 清空、**空提交直接新标签打开引擎官网**、**回车与点按钮都在新标签打开（不劫持当前页）**、Shift+Enter |
| `tests/daily-quote.test.tsx` | 7 | 本地源零网络请求、默认远程取一条、远程失败静默回退、点正文换一条、**不存在来源标签 / 分类 / 刷新按钮**、出处含破折号、聚焦输入框时 `data-dimmed` 翻转 |
| `tests/shortcut-dock.test.tsx` | 13 | 首页 Dock：展平渲染 13 项、无分组标题、**首页不存在任何编辑 / 删除 / 前移后移 / 添加按钮**、悬停只有图标层、`target=_blank` + `title` 含「打开 」、空态是引导文案；设置内 `ShortcutManager`：列表 13 行、增删改、空名校验、URL 自动补全、删除二次确认、取消不删、前后调序持久化 |
| `tests/settings-panel.test.tsx` | 41 | **五个页签**（常规 / 模块 / 快捷跳转 / 背景 / 搜索引擎）全部设置项、导航两组分层、**隐私与关于不再占页签**、**独立弹窗承载白名单 / 导出 / 一键清除**、**站点图标开关归到快捷跳转**、每日壁纸开关与回溯天数、对比度校验、导入导出、恢复出厂；**本地图片落的是 `idb:` 引用而非 dataURL**、写失败明确报错、拒绝 dataURL 地址、点「往前回溯」标题不再重置偏移、上传图标存成引用 |
| `tests/command-palette.test.tsx` | 14 | 默认条目、搜索过滤、方向键 + Enter、Esc、⌘K、点主题 / 每日壁纸开关 / 回溯 / 设置项真的改配置 |
| `tests/scroll-lock.test.ts` | 3 | 浮层滚动锁的引用计数语义：多个浮层叠加时「最后一个关的人还原」、重复释放不把计数减穿、还原成锁之前的值 |
| `tests/image-store.test.ts` | 11 | 图片资源库：引用格式、内容去重（同图只占一份）、非图片数据拒绝、写入失败抛错、内存缓存命中、删除回收、旧配置 dataURL 迁移与幂等性 |
| `tests/field-group.test.tsx` | 3 | `FieldGroup` 点标题不触发内部选项（`label` 激活行为回归）、`role=group` 可访问名、`Field` 仍保留单控件转发 |
| `tests/widgets.test.tsx` | 10 | 时钟（问候一致性、显隐、秒、点击 / 右键触发展开）、壁纸（关闭时只渲染渐变兜底且**零网络请求**、Edge 取回后渲染图片、自定义图片失败降级） |
| `tests/note-pad.test.tsx` | 6 | 待办便签显式关闭时不渲染、回填已存内容、防抖落盘、清空与禁用态、「已保存」提示、2000 字截断 |
| `tests/search-history.test.ts` | 6 | 去重、8 条上限、忽略空串与指令、单删 / 全清、坏 JSON 不抛错、不写配置 key |
| `tests/bookmarks.test.ts` | 7 | 书签 HTML 解析：实体、嵌套文件夹、`javascript:` 过滤、文件内去重、URL 去重、上限、标题截断 |
| `tests/bookmark-import.test.tsx` | 1 | 导入流程：先预览、确认后写入、跳过与现有项重复的书签 |
| `tests/shortcut-undo.test.tsx` | 1 | 删除后从 toast 撤销，按原位置恢复 |
| `tests/shortcut-help.test.tsx` | 4 | `?` 打开、输入框内不触发、已打开不重复触发、列出主要快捷键 |
| `tests/shortcut-grid.test.tsx` | 3 | 快捷方块：展平 13 项 + 添加方块、**无托板 / 无管理按钮**、`_blank` 跳转、添加方块深链回调、关闭图标抓取时每个方块都有首字母兜底 |
| `tests/widget-boundary.test.tsx` | 3 | 模块抛错只降级自己、兄弟节点仍在、重试恢复、silent 模式不渲染占位 |

### 5.3 端到端测试（Playwright，61 项）

```bash
pnpm test:e2e                            # 全量（自动 build + start，端口 3100）
pnpm exec playwright test e2e/a11y.spec.ts   # 只跑无障碍扫描
pnpm exec playwright test -g "快捷跳转"       # 按标题过滤
pnpm exec playwright test --headed           # 有头模式观察
pnpm exec playwright show-report             # 打开上次的 HTML 报告
```

Playwright 会自动执行 `pnpm run build && pnpm run start --port 3100`（见 `playwright.config.ts` 的 `webServer`），结束后自动关闭，不需要手动起服务。

> 注意 pnpm 与 npm 的参数分隔差异：npm 需要 `npm run start -- --port 3100`，pnpm 直接 `pnpm run start --port 3100`。
> 写成 `pnpm run start -- --port 3100` 会把 `--port` 当成目录名，Next 会报 `Invalid project directory`。
> 改完代码若复用旧服务，先 `pkill -f "next-server"` 再 build，否则可能测到旧构建。

| 文件 | 项数 | 覆盖内容 |
|---|---|---|
| `e2e/startpage.spec.ts` | 47 | 首屏四模块 + 无横向滚动、**天气节点与占位全部为 0**、**每个模块各自独立成层（时钟→搜索→便签卡→一言→底部 Dock，且不存在任何 bento 板）**、**玻璃面板均启用 backdrop-filter 且底色半透明**、**主题切换时壁纸四层背景完全不变、只有组件换材质**、**五个分类页签的按钮高度/内距/间距/字号/圆角各自唯一**、**开关关闭/开启/连续四次切换/滚动时滑块始终在轨道内、相对偏移精确 2↔16px**、**整页四个区域右键统一唤出、输入框与浮层保留原生语义**、**toast 固定顶部且多条几何一致 / 不压一言与 Dock / 层级高于浮层**、**Dock 与网格图标同一套 squircle 比例与材质**、**隐私与关于从设置页脚打开子弹窗、主面板只剩五个分类且无二级菜单**、**设置搜索陈旧关键词不再留空白面板、无结果给出空状态**、**滚动渐隐标记与实际溢出始终一致**、**时钟阴影是无边界环境光（无 0.5 深色盘、无 24/56px 黑晕）**、**四种视口下整页/main 均无滚动且缩放系数在 0.6~1**、时钟走秒、**秒数可见且字号 ≥ 主数字一半**、**首屏请求分两层把关（接口走白名单、图片只允许 favicon）**（并断言「关壁纸 + 关图标抓取 + 一言切本地库后外部请求必须为 0」）、**聚焦搜索框时一言 `opacity` 归零、失焦复原**、**搜索栏三态（未聚焦隐藏图标 / 悬停加深 / 聚焦淡入并放大）**、**默认 Bing，点引擎图标弹列表并可选定（不会自动切下一个）**、`/` 指令、**回车与点按钮都在新标签打开、空提交直接进引擎官网**、快捷项增改删**全流程都在设置里**（首页断言无编辑入口与无 `add-shortcut`）、**悬停只有图标层动（格子无底色/无阴影/无描边）**、**拖拽把手排序（及 ↑/↓ 键盘兜底）与顺序持久化**、Ctrl+1、**点一言正文换一条且无来源/分类/刷新**、每日壁纸开关与暗化滑杆、主题写 `html[data-theme]`、命令面板搜索执行、模块关闭后刷新保持、一键清除、导出下载、skip-link、焦点陷阱与焦点恢复、减少动效、**设置内「添加」再叠一层编辑弹窗时标题可见且 Esc 只关最上层** |
| `e2e/a11y.spec.ts` | 5 | axe-core 扫描首页（暗/亮）、设置面板**五个页签 + 隐私 / 关于两个独立弹窗**、命令面板、快捷项编辑弹窗 —— 断言 **0 个 serious / critical** |
| `e2e/no-js.spec.ts` | 1 | 禁用 JS 后页面完整可读，搜索框通过原生表单 GET 真的跳转到 `https://www.bing.com/search?q=...` |
| `e2e/reduced-motion.spec.ts` | 1 | 系统 `prefers-reduced-motion: reduce` 时，四个入场模块首帧即 `opacity:1`、无位移，一言的入场 `animation: none`、聚焦渐隐只淡出不位移，逐字动画降级 |
| `e2e/note.spec.ts` | 3 | 待办便签默认可见、可输入并在刷新后保留、关闭后便签卡整体退场且不留空盒子、清空按钮清内容且写回存储 |

### 5.4 一条命令跑完

```bash
pnpm test:all   # typecheck → lint → 覆盖率 → playwright
```

### 5.5 CI

`.github/workflows/ci.yml` 两个 job，PR 与 push 到 main 都跑：

| Job | 步骤 | 说明 |
|---|---|---|
| `quality` | `typecheck` → `lint` → `test:coverage` → `build` | 按失败速度排序；覆盖率低于阈值直接失败，不进入构建 |
| `e2e` | `test:e2e` | `needs: quality`；失败时上传 `test-results/` 作为 artifact，保留 7 天 |

pnpm 版本不写死，由 `pnpm/action-setup@v4` 读 `package.json` 的 `packageManager` 字段，避免 CI 与本地装出两套依赖树。E2E 复用 `ubuntu-latest` 自带的 Google Chrome（与 `playwright.config.ts` 的 `channel: "chrome"` 对齐），不额外下载内核。

### 5.6 手工验收清单（建议按顺序点一遍）

1. **一屏**：在 1440×900、1366×768、1280×600、390×844 下刷新，页面均**无纵向 / 横向滚动条**；缩小窗口时内容整体等比缩小，不裁切顶部（`main[data-fit-scale]` 可查当前缩放）。
2. **入场**：刷新后壁纸先预解码再淡入（0.7s），时钟 150ms、搜索 300ms、卡片 450ms、一言 600ms 依次淡入。
3. **搜索**：**未聚焦时只看到一条模糊胶囊**（两端图标隐藏、占位居中）；悬停底色加深；点进去两端图标淡入、胶囊轻微放大；默认显示 Google → 点图标变 Bing → 右键图标开菜单选「百度」→ **不输入任何内容直接点右侧放大镜或按 Enter，应新开一个 bing.com 标签，且当前页不跳走** → 回来输入 `hello` 按 Enter（新标签打开搜索结果）→ Shift+Enter 同样是新标签。
4. **快捷指令**：输入 `/` 看到三条提示 → 输入 `/g react` 回车，跳到 GitHub 搜索页；输入 `github.com` 出现「直接打开」提示。
5. **一言**：**点一下搜索框**，确认一言整体淡出、失焦后淡回 —— 且一言本身没有任何边框或玻璃底；**只有一行正文 + 一行出处（没有「远程/本地」标签、没有分类下拉、没有刷新按钮）**；点一下正文即换一条。
6. **右键与 toast**：在壁纸左上角、右侧空白、Dock、一言上分别右键，四次都应唤出 / 收起快捷方块，落点有一圈淡蓝涟漪；搜索框里右键应弹出浏览器原生菜单且页面不切换。按 `Ctrl+1/2/3` 连发三条提示，应全部固定在顶部居中、同宽同高、不压住一言与 Dock；打开设置再触发一条，提示仍应浮在弹窗之上而不是压在「完成」按钮上。经典布局下右键应唤出命令面板。
7. **快捷跳转**：在首页把指针移到 Dock 图标上，确认**只有图标上浮 + 柔光 + 上方浮出名称气泡**，没有卡片底色、**也没有任何编辑按钮**；然后设置 → 快捷跳转 → 点「添加」→ 名称留空保存（应报错且弹窗不关）→ 填名称与 `mysite.dev`（自动补 `https://`）保存 → 用 ↑↓ 调序 → 点铅笔改名 → 垃圾桶二次确认删除；回到首页 `Ctrl+1` 直达第一项。
8. **壁纸**：设置 → 背景 → 关掉「使用每日壁纸」，壁纸应变纯渐变、DevTools 里刷新后**不应有任何外部请求** → 重新打开，等照片淡入（元数据走 `bing.biturl.top`、图片走 `www.bing.com`）→ 把「壁纸回溯天数」切到 -3 天，照片应换一张 → 拉「暗化程度」→ 点「选择本地图片」上传一张图（优先级更高）→ 输入坏地址点「应用」（应提示并保留原图）→ 点「移除图片」回到每日壁纸。
9. **主题切换**：在设置 → 常规里把主题从暗色切到亮色（经典布局也可点顶栏的太阳/月亮按钮）。**壁纸必须一帧都不变** —— 图片、纯色兜底、暗角、薄纱、中轴柔光都保持原样；变的只是搜索胶囊、Dock、设置面板、卡片这些 UI 组件。切换应无掉帧、无白闪，也没有满屏扩散动画。
10. **主题**：点右上角太阳/月亮切换，切换应是组件级 320ms 颜色过渡，**没有整页快照、没有圆形揭示动画**；设置 → 外观 → 切「跟随系统」；点预设色或取色器改强调色，观察对比度标注；勾「减少动效」后所有动画应立即消失。
11. **设置面板**：点齿轮**直接**打开（不再有二级菜单），左侧五个分类按「首页 / 外观与服务」两组逐个点一遍，右侧内容淡入 + 轻微上移；把窗口压到 600 高，确认只有右侧内容区滚动、面板本身不超出视口；Esc 关闭后焦点回到齿轮按钮。再从页脚分别点「隐私与数据」「关于」：应在面板之上叠一层更轻的弹窗，关闭回到原页签；弹窗打开时关闭按钮不应有一圈焦点轮廓，内容超长时底部有渐隐。
12. **命令面板**：`⌘K` / `Ctrl+K` 唤起 → 输入「背景」→ 方向键选中 → Enter 执行；再唤起后 Esc 关闭。
13. **待办便签**：默认已开启，直接在搜索框下方的独立卡片里输入几行文字 —— 输入区没有边框，聚焦时浮出一圈 accent 内发光、卡片左沿的竖线同时点亮；右上角字数胶囊开始累加、出现「已保存」小药丸，输入框下沿的进度条跟着变长；**继续输入到第 4 行，输入框会自己长高而不是冒出滚动条** → 刷新内容仍在 → 底部「清空」按钮消失（空态时整条操作栏与进度条一起收起）→ 去设置 → 模块关掉「显示待办便签」，这张卡片整体退场且上下留白自动收拢。
14. **隐私与图标**：打开 DevTools → Network，清空后刷新首页 —— **external 请求应只有三类：`bing.biturl.top` + `www.bing.com`（壁纸）、`v1.hitokoto.cn`（远程一言）、各站点自身的 `/favicon.ico`（图标）**，接口类请求全部落在白名单内。去设置 → 隐私与数据，确认「自动抓取站点图标（favicon）」**默认是开启的**（这是新默认值，早先是手动开启）；关掉它再刷新，favicon 请求应消失、Dock 图标退回品牌色首字母。再「导出配置」下载 JSON → 改几项后「导入配置」应还原 → 「一键清除全部数据」二次确认后回到出厂状态。
15. **无障碍**：按 Tab，第一下应出现「跳到主要内容」并可 Enter 跳转；打开设置后 Tab 不会跑到弹窗外；焦点环始终可见。

### 5.7 视觉验收截图（可选）

```bash
pnpm build && pnpm run start --port 3100   # 先起服务
node scripts/capture-shots.mjs             # 输出到 shots/，每张打印三个溢出量
```

脚本用本机 Chrome（`channel: "chrome"`）在 **19 个场景**下截图：
每张都会打印 `docScroll / mainScroll / horizontal`，三项都应为 `0`（一屏原则的机器可验证据）。

### 5.8 性能与产物体检

```bash
pnpm build
# 产物分析：/ 页面 First Load JS ≈ 225 kB（shared 103 kB）
pnpm exec serve .next   # 或用 pnpm start，再用 Lighthouse 移动模拟跑一遍
```

Lighthouse 目标（PRD 6.1）：LCP < 1.2s、FCP < 0.8s、CLS < 0.1、TBT < 100ms。

> **关于体积**：首屏 JS 为 225 kB（Next 统计口径，gzip 前），**不再追求 PRD 里 < 60KB gzip 的目标** ——
> 该预算与「Next.js 15 + React 19 基线（shared 103 kB）」不可兼得，而要手感丝滑就必须让 Motion 留在主 bundle 里
> （而不是为了抠体积把它拆成异步块、换来首屏动画延迟）。已做的优化仍然保留：设置面板 `next/dynamic` 按需加载，
> 未引入状态库 / UI 库 / 图标库 / 字体文件，Magic UI 组件全部自绘无额外运行时。

---

## 六、隐私与数据边界

| 数据 | 位置 | 默认 |
|---|---|---|
| 用户配置 | localStorage | 启用，仅本机 |
| 自定义背景图片 / 自定义图标 | IndexedDB（`startpage` / `images`，配置里只存 `idb:` 引用） | 启用，仅本机 |
| 内置语录库 | 静态包 | 启用，零请求 |
| 每日壁纸元数据 | `bing.biturl.top` | **开启**（默认） |
| 每日壁纸图片 | `www.bing.com` | **开启**（默认，`<img>` 直链） |
| 远程一言 | `v1.hitokoto.cn` | **开启**（默认），3 秒超时静默回退内置库 |
| 搜索建议 | `api.bing.com` | **关闭**，显式开启 |
| 站点 favicon | 各站点自身 `/favicon.ico` | **开启**（默认），`<img>` 直链、`referrerPolicy="no-referrer"`、不带 Cookie |
| 自定义壁纸图片 | 用户自己填的图片地址 | **关闭**（默认用每日壁纸）；开启后按用户填写的域名取图 |
| 统计 | — | 未接入任何第三方统计 |

所有**接口**请求走 `safeFetch`：`credentials: "omit"`（不带 Cookie）、`referrerPolicy: "no-referrer"`、`cache: "no-store"`，且必须命中白名单。favicon 与壁纸图片是 `<img>` 直链，不经过 `safeFetch`，但同样带 `referrerPolicy="no-referrer"`、不带任何凭据。

**唯一的白名单例外**是自定义壁纸的取图（`fetchUserImage`）：域名由用户当场输入，无法预先枚举，写成白名单等于要求用户先手动配一次自己的图床。它保留与 `safeFetch` 相同的隐私姿势（不带 Cookie、不带 referrer、8s 超时），并额外限制 **8MB 流式体积上限** —— 原实现直接 `res.blob()`，一张大图能同时撑爆内存与 IndexedDB 配额。

### 安全响应头

`next.config.ts` 统一下发（由 `next start` / Vercel 生效，纯静态托管需自行配置）：

| 头 | 值 | 作用 |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`；`script-src 'self' 'unsafe-inline'`；`img-src 'self' data: blob: https:`；`frame-ancestors 'none'`；`object-src 'none'`；`form-action` 限定三家引擎 | 挡脚本/样式注入、被嵌套、表单被劫持 |
| `Referrer-Policy` | `no-referrer` | 出站请求一律不带来源页 |
| `Permissions-Policy` | `geolocation=()`，其余传感器/支付一律关闭 | 页面不需要任何设备能力 |
| `X-Content-Type-Options` | `nosniff` | 禁止 MIME 嗅探 |
| `X-Frame-Options` | `DENY` | `frame-ancestors` 的旧浏览器兜底 |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | 强制 HTTPS 两年，首次 http 访问不被降级（浏览器只在 https 响应里接受，dev 无副作用） |
| `Cross-Origin-Opener-Policy` | `same-origin` | 不与其它源共享 browsing context group；外跳全部带 `noopener`，不依赖 opener |
| `Cross-Origin-Resource-Policy` | `same-origin` | 本站资源不允许被别站内联；**只约束别人加载我们**，不影响加载 bing 壁纸与各站 favicon |

`script-src` 必须带 `'unsafe-inline'`（首屏主题脚本与 Next 水合脚本都是内联的；换 nonce 要求动态渲染，会毁掉全静态产物）。

**开发与生产的差异**（由 `src/lib/csp.ts` 的 `buildCsp(isDev)` 生成，有单测守着）：

| 指令 | 生产 | 开发 | 原因 |
|---|---|---|---|
| `script-src` | `'self' 'unsafe-inline'` | 额外加 `'unsafe-eval'` | `next dev` 用 webpack 以 eval 注入模块 + React Refresh。缺它浏览器抛 `Evaluating a string as JavaScript violates ...`，且发生在客户端 bundle 执行前 → **hydration 完全不发生**：页面看得见，但点设置、切主题、搜索建议全部无反应 |
| `upgrade-insecure-requests` | 有 | **无** | dev 跑在 `http://localhost`，这条会把同源资源与 HMR 的 `ws://` 一起升级成 https/wss，热更新直接失联 |
`connect-src` 故意写 `https:` 而不是白名单列表 —— 自定义壁纸与用户自定义白名单都允许填任意域名，写死会把这两处功能打死；接口层的白名单仍由 `safeFetch` 在代码里强制，有单测守着「白名单外不发请求」。

---

## 七、故障排查

### `Error: [safe-delete] broker denied delete: path=.../.next/xxx`

**表现**：`pnpm dev` 或 `pnpm build` 启动阶段直接退出，栈里出现 `node-safe-delete-shim`。

**原因**：`.next` 里的残留目录（`diagnostics`、`static/webpack`）需要清理，而某些沙箱/托管环境会拦截
非递归的目录删除。**与项目代码无关**，新机器或干净目录不会出现。

**处理**：先 `pnpm clean` 再重试；仍不行就直接删掉 `.next`（必要时用有权限的终端执行 `rm -rf .next`）。
`pnpm build` 已挂 `prebuild: pnpm clean`，所以在能正常删除的环境里不会再撞到。

### 页面能看见，但点什么都没反应（开发模式）

**原因**：CSP 的 `script-src` 缺 `'unsafe-eval'`，客户端 bundle 一行都没执行，hydration 没发生。
控制台里能搜到 `Evaluating a string as JavaScript violates the following Content Security Policy directive`。

**处理**：检查 `src/lib/csp.ts` 的 `buildCsp(isDev)` —— 开发分支必须带 `'unsafe-eval'`；
`tests/csp.test.ts` 里有对应断言，删掉会立刻红灯。

### `Failed to load resource: net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` / `ERR_BLOCKED_BY_ORB`

**不是 bug**。这是个别站点（npmjs.com 发 `Cross-Origin-Resource-Policy: same-origin`、caniuse.com 把
`/favicon.ico?search=` 302 到 HTML 页）拒绝了跨源取图。`shortcut-icon.tsx` 的 `onError` 会按降级链
退回品牌色首字母，功能不受影响。

### 改了设置，刷新后又回到旧值

**表现**：右下角弹出「本地存储写入失败，设置可能无法保存」，刷新后配置回退。

**原因**：`localStorage` 配额满（最常见是把大图直接上传成自定义壁纸）、Safari 隐私模式、或被浏览器策略禁用，`setItem` 抛错 → `saveConfig` 返回 `false`。界面里的状态已经变了，但没落盘。

**处理**：`ConfigProvider` 会广播 `startpage:persist-error`，由 `ToastProvider` 显示提示（只在首次失败时弹一次，避免每改一个字弹一次）。清理站点存储后重试。图片（壁纸与自定义图标）已统一存 IndexedDB，配置里只有引用，所以「传一张大图」不再会撑爆 localStorage；若仍报错，多半是隐私模式禁用了 IndexedDB（`putStoredImage` 会抛错，界面上会直接显示「图片保存失败」而不是谎报成功）。

## 八、已知限制

- **浏览器矩阵**：仅在 Chrome（Playwright 内置 + 本机 Chrome）上跑过自动化；Safari / Firefox 依赖标准的 `backdrop-filter`、`color-mix()`、`dvh`、`offset-path`，CSS 里已写 `-webkit-` 前缀与降级色，但未做真机回归。主题切换的圆形揭示只在支持 View Transitions 的浏览器上出现，其余退化为颜色过渡。
- **移动端**：布局自适应（Dock 在窄屏自动折行、设置面板导航由竖排转为横排），但 PRD 定位是桌面优先，移动端只保证「可用」。
- **favicon 抓取**：**默认开启**，且**不经过白名单** —— 白名单约束的是 `safeFetch` 发出的接口请求，而 favicon 是浏览器直接加载的静态图片（`<img>`，`no-referrer`、无 Cookie），两者不会互相限制。抓不到（内网地址、站点反爬如 npm 403 / caniuse 406 / 微博 ERR_CONNECTION_CLOSED）时自动退回品牌色首字母。想完全关闭去设置 → 隐私与数据。
- **一屏原则**：默认配置（便签开启）在 1440×900、1366×768、1280×600、1024×560、390×844 下均完整一屏、无滚动（矮屏会等比缩小，实测 1280×600 为 0.852）。再放不下时只有 `main` 内部滚动，页面本身不会出现整页滚动条。
- **每日壁纸依赖第三方**：元数据来自 `bing.biturl.top`、图片来自 `www.bing.com`，任一不可达时自动降级为纯渐变（`FALLBACK_GRADIENT`），不会留白屏。图片只在 `<img>` 里加载，不经 `safeFetch`。
