# 起始页 · Startpage

一个「一屏上网入口」式的个人起始页：多引擎搜索、时间问候、每日一言、快捷跳转、Edge 每日壁纸。
左上角天气胶囊、时钟、搜索框、便签卡、一言、底部 Dock **各自独立成层**，没有 Bento 板 —— 整体按青柠起始页（limestart.cn）的版式重做。
**接口请求只走白名单（壁纸 / 一言 / 天气 / 搜索建议），图片请求只用于站点 favicon**，全部数据只存本机（localStorage + IndexedDB）。

- 技术栈：Next.js 15.5（App Router）+ React 19 + TypeScript strict + Tailwind CSS v4.3 + Motion 13 + Magic UI 风格组件（全部自绘，无额外运行时依赖）
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

### P0（首屏五要素，默认全部开启）

| 模块 | 行为 |
|---|---|
| **搜索引擎框** | 支持 Google / Bing / 百度（**已彻底移除 DuckDuckGo**），**默认 Google**（PRD 4.1 修订）。**点击左侧引擎图标循环切换**，**右键图标打开引擎菜单**。**Enter 与点搜索按钮一律在新标签页打开**（不再劫持当前页）；**输入为空时直接新标签打开当前引擎官网**（如 Google → `google.com`、Bing → `bing.com`）。左侧引擎图标显示**站点真实 favicon**（拿不到才退回内置 SVG），右侧是一颗正圆强调色按钮。输入 `/` 触发快捷指令面板（`/g` GitHub、`/b` 百度、`/bili` 哔哩哔哩），输入完整网址（如 `github.com`）时提示「直接打开」。表单是**原生 `method=get` 提交**，无 JS 也能搜索。聚焦时胶囊右侧扫过一道柔光（720ms 单向，不循环）。 |
| **时间与问候** | 大字号 `HH:MM`，**纯实心前景色**（不用渐变文字 —— 早期用 `background-clip: text` + 透明填充，在 Safari / 部分 Chromium 变体上不生效，时钟会彻底不可见）。可在设置里开启秒，秒以 0.56em 单独一档呈现，清晰可辨。按 5/9/12/14/18/23 点切换「早安 / 上午好 / 午安 / 下午好 / 晚上好 / 夜深了」，日期显示「周几 · 月日」。**问候与日期分两行居中**（同一行时两段文字长度差太大，视觉重心会被拉偏）。数字变化时只有 Magic UI 风格的**模糊上浮**轻过渡。字号用 `clamp(46px, min(10vw, 12vh), 104px)`，矮屏自动收小。 |
| **每日一言** | **没有任何容器 / 边框 / 玻璃底**，就是背景上的一行小字（对齐青柠起始页）。**聚焦搜索框时整块渐隐并轻微下沉，失焦后淡回**（`[data-dimmed]` + CSS transition）。**数据源默认走远程 API**（`v1.hitokoto.cn`），**3 秒超时静默回退**内置 36 条语录库（离线兜底）。**页面上只有一行正文与一行出处** —— 没有「远程 / 本地」标签、没有分类下拉、没有刷新按钮；**点正文就换一条**。切换时逐字 reveal（Magic UI TextAnimate）。 |
| **快捷跳转** | **一条悬浮 Dock**（参考青柠起始页底部）：不分组、不标题、不卡片，全部图标排成一行（窄屏自动折行），**常态只有图标没有文字**，名称是鼠标悬停时浮出的 macOS 式气泡。图标是**正圆**（与 999px 胶囊同一套圆角语言）。悬停时按 macOS Dock 的方式联动：当前项上浮 4px + 放大到 1.12、左右邻放大到 1.06、背后一团柔光，格子本身没有底色 / 阴影 / 描边。**首页不再有任何编辑入口** —— 增删改与排序全部收进「设置 → 快捷跳转」（`ShortcutManager`）。`Ctrl/Cmd + 1~9` 直达前九项。图标降级链：**用户自定义（上传图片 / Emoji）→ 站点自动抓取的 favicon → 名称首字母**；favicon 白底圆片会掺一成自有品牌色，和旁边的品牌色实心片是同一套投影与内高光。默认 12 项里内网服务（NAS / Jellyfin）给 Emoji，公网站点留空走 favicon。 |
| **每日壁纸** | **Edge / Bing 每日一图**（原 Magic UI Backgrounds 四种风格已彻底移除）。元数据取自 `bing.biturl.top`（白名单内，带 CORS），图片直链走 `www.bing.com/th?id=...`；成功后写进 IndexedDB，刷新先读缓存再拉网络，失败保留上一次成功结果。**图片先用 `new Image()` + `decode()` 预解码，解完才淡入** —— 否则大图会「先画出上半截再补下半截」，那半秒正好被淡入放大，看起来像被切成两半。可回溯「今天 / -1 天 / -3 天 / -7 天」，可关闭改为纯渐变兜底；可叠加一张自定义图片（优先级更高，远程 URL 或本地文件，≤8MB）；可调暗化程度与基础模糊；输入框聚焦时自动加深模糊（聚焦模式）。 |

### P1 / P2（默认关闭，需在设置里显式开启）

| 模块 | 说明 |
|---|---|
| **命令面板**（P1） | `Cmd/Ctrl + K` 唤起，统一搜索快捷项、切换主题、换背景、打开设置、聚焦搜索框。方向键 + `Enter` 执行，`Esc` 关闭。 |
| **天气**（P1） | **默认开启，固定在页面左上角**（状态胶囊：天气图标 + 温度 + 城市，操作钮平时隐藏、悬停/聚焦才浮出）。首屏先尝试一次静默定位（每会话只试一次，失败不弹权限也不打断视线）；**定位成功时会反查最近的已内置城市**并记为 `source: "geo"`，拿不到才展开「省份 + 城市」两个下拉（200 余城市内置在 `src/config/cities.ts`，**不查接口**），或点「使用我的定位」。**选省份只切换城市列表，不写配置也不收起浮层**，必须再选城市才落库。坐标只发给 `api.open-meteo.com`，15 分钟刷新一次。设置里的两个下拉与首页浮层**共用同一套药丸形样式**（无描边、聚焦浮 accent 环），旁边用一枚状态小药丸（「已定位 / 手动选择 / 未选择」+ 指示点）代替原来重复写一遍的「当前：省 · 市」。 |
| **主题系统**（P1） | 亮 / 暗 / 跟随系统三态；8 个预设强调色 + 取色器，实时显示与底色的对比度并标注是否通过 AA。切换时用 View Transitions 做**圆形揭示**（Magic UI Animated Theme Toggler）；不支持该 API 的浏览器退化为全局颜色过渡，不跳变、不白屏。 |
| **待办便签**（P2） | 默认开启（一张独立的 `.card-panel` 玻璃卡）。标题栏是**渐变圆徽 + 标题 + 「已保存」小药丸 + 字数胶囊**；卡片左沿有一道 accent 竖线，聚焦时点亮；输入区**没有边框与底色**、直接铺在卡片上（聚焦才浮出一圈 accent 内发光），**按内容自动长高**（超过 8 行才内部滚动）；输入框下沿有一条**字数进度**（按「已写 / 一屏舒适容量 240 字」计，写两行就能看见它长一点）。底部操作栏带图标、内容为空时整条收起，清空按钮悬停才染红。纯文本，输入后 300ms 防抖写入本机配置；字数超过 90% 的字数胶囊变警示色并轻微脉动；内容随配置一起导出/导入，不产生任何网络请求。 |
| **配置导入导出 / 一键清除**（P2） | 导出为 `startpage-config-YYYY-MM-DD.json`；导入做类型防御合并（不认识的字段丢弃、类型不符不覆盖）；一键清除会二次确认，清空 localStorage 与 IndexedDB 后回到出厂配置。 |

### 布局与一屏原则

- 严格 `100dvh`，**页面本身不滚动**（`body` 与 `.app-shell` 均为 `overflow: hidden`）。
- 内容高于可用高度时按 `zoom` **等比缩小**（下限 0.6），保证一屏完整呈现；`main` 上写 `data-fit-scale` 便于验收。
- 只有设置面板内容区、搜索建议列表这类「本应滚动」的区域用 `thin-scroll` 内部滚动。
- 纵向层次（对齐青柠起始页）：**左上角天气胶囊 → 时钟 → 搜索框 → 便签卡 → 每日一言 → 底部 Dock**。每个模块都是独立组件、各自独立成层，**没有任何 Bento 便当板**（早期把便签与天气并排锁在一块板里，视觉上读成一个「大框」，已拆开）。天气是唯一脱离主列的元素 —— 它属于「常驻状态」，钉在顶栏左侧，不随内容高度浮动。
- **毛玻璃材质**统一由一组 token 驱动（`--panel-bg` / `--panel-highlight` / `--panel-refract` / `--panel-blur` / `--panel-shadow`）。两个主题下各只有**四处**玻璃、共用同一套配方：搜索胶囊（`.search-panel`）、便签卡（`.card-panel`）、底部 Dock（`.dock-pill`）与设置面板；天气胶囊（`.weather-row`）是第五处，但只用 `--blur-2`（20px）做更薄的一层，压在左上角不抢视线。配方是半透明底 + `backdrop-filter: blur(32px) saturate(1.6)` + 顶部内高光 + 下沿折射 + 外投影，视觉厚度靠层次叠加而不是把不透明度堆到接近实心，**全部不画描边**。
- **搜索框是两个主题都用的白色胶囊**（`--search-bg` / `--search-highlight` / `--search-bg-focus`），靠「亮」从背景里跳出来，只有下沉投影 + 一道顶部内高光、**没有 1px 描边**；因为底色恒白，`.search-panel` 内部就地改写 `--fg` 系列变量，深色主题下才不会变成白字白底。聚焦时用 CSS `[data-focused="true"]` 叠一圈 accent ring（不用 framer 内联 `boxShadow`，那会把玻璃的高光与投影一起冲掉）。
- 搜索胶囊与便签卡**统一 `max-width: 560px`**，一言 `520px`，都比内容列窄一档 —— 一列里出现两种宽度会读成「台阶」，统一之后时钟、搜索框、卡片、一言共用同一条中轴。天气胶囊不参与这条中轴（它在左上角，宽度由内容决定）。
- 快捷跳转沉到页面最底部，做成一颗**悬浮玻璃胶囊**（`.dock-pill`，999px 圆角），整排正圆图标被它托住；悬停时胶囊自身轻轻上浮 2px。`.dock-shell` 顶部留 32px 空档，供名称气泡浮出（否则气泡会压到一言的出处行上）。
- 时钟没有容器，直接压在大背景上，只靠字号成立。
- 卡片显隐、增删时用弹簧（stiffness 380 / damping 30）平滑移动，移除的先淡出再让位；悬停时卡片上浮 2px 并加深投影。`md` 以下自动退化为单列。

---

## 三、配置项说明

配置是**单一 JSON 对象**，存于 `localStorage["startpage.config.v1"]`。默认值在 [`src/config/defaults.ts`](src/config/defaults.ts)，结构定义在 [`src/config/types.ts`](src/config/types.ts)。

```ts
{
  version: 1,
  engineId: "google",                  // 当前引擎（默认 Google）
  engineOrder: ["google", ...],        // 引擎顺序（设置里可上下移动）
  quickCommands: [{ key: "/g", label: "GitHub", url: "..." }],
  groups: [{ id, name, items: [{ id, title, url, icon, emoji, letter, color }] }],

  theme:     { mode: "dark" | "light" | "system", accent: "#2F6FED" },
  clock:     { show: true, showSeconds: false },
  greeting:  { show: true, custom: "" },          // custom 非空时覆盖时段问候
  quote:     { show: true, source: "remote" | "local" },   // 默认远程 API，失败回退内置库
  background:{ source: "edge" | "none", offset: 0,  dim: 18, blur: 0, kenBurns: true },
  wallpaper: { source: "none" | "url" | "local", value: "" },  // 仅自定义图片叠加层
  suggest:   { enabled: false },                   // 实时搜索建议（仅 Bing 有 suggest 接口）
  weather:   { enabled: true, unit: "c" | "f", province: "", city: "", lat: null, lon: null, source: "none" | "manual" | "geo" },
  icons:     { autoFetch: true },                  // 抓取站点 favicon（默认开启）
  note:      { enabled: true, content: "" },       // 待办便签（P2，一张独立卡片）
  privacy:   { whitelist: ["v1.hitokoto.cn", "api.bing.com", "api.open-meteo.com", "bing.biturl.top"] },
  a11y:      { reducedMotion: null }               // null = 跟随系统；true = 强制减少
}
```

`background.source` 只有两个值：`edge`（Edge / Bing 每日一图，默认）与 `none`（纯渐变兜底，零网络请求）。`background.offset` 是往前回溯的天数，合法范围 0–7（见 `EDGE_WALLPAPER.maxOffset`）。自定义图片仍然走 `wallpaper` 分区，优先级高于每日壁纸。

**可调常量**（`src/config/site.ts`）：`LIMITS` 里是快捷项标题 16 字、分组名 12 字、单组最多 200 项、最多 12 组、一言超时 3000ms、建议超时 2500ms、图片超时 8000ms；`EDGE_WALLPAPER` 里是壁纸 API 基址、图片域、市场与最大回溯天数。

**请求白名单**在 [`src/config/site.ts`](src/config/site.ts) 的 `DEFAULT_WHITELIST` 统一维护，所有远程请求必须经过 [`src/lib/services.ts`](src/lib/services.ts) 的 `safeFetch`，命中白名单才放行（支持子域后缀匹配），否则抛 `WhitelistError` 且**根本不会发起 fetch**。

---

## 四、目录结构

```text
src/
  app/
    layout.tsx        # 元数据、JSON-LD、首屏主题内联脚本（防 FOUC）
    page.tsx          # 青柠式一屏编排（左上天气→时钟→搜索→便签→一言→Dock）+ 等比缩放 + 顶栏动作组 + 浮层挂载
    sitemap.ts        # /sitemap.xml
    robots.ts         # /robots.txt
    not-found.tsx     # 404
  components/
    clock.tsx  search-box.tsx  daily-quote.tsx  shortcut-dock.tsx  shortcut-icon.tsx
    shortcut-manager.tsx       # 快捷项增删改与排序（只在设置面板里出现）
    wallpaper.tsx              # Edge 每日壁纸层（预解码后淡入）+ 可选自定义图片叠加
    weather.tsx  settings-panel.tsx  command-palette.tsx  theme-sync.tsx  note-pad.tsx
    engine-glyph.tsx           # EngineBadge：优先取站点 favicon，失败退回内联 SVG（四色 G / Bing / 百度）
    ui/primitives.tsx          # Modal / Toast / Switch / Field / TextInput / Button / Segmented / Range
    magicui/                   # Magic UI 等价实现（全部自绘，零额外依赖）
      shimmer-button.tsx  moving-border.tsx  border-beam.tsx    # 按钮 / 边框
      spotlight-card.tsx  tilted-card.tsx                       # 卡片（备用，当前首页未用）
      blur-in.tsx  text-animate.tsx  animated-digits.tsx        # 文本 / 数字动效
      sparkles.tsx  spotlight.tsx
      animated-theme-toggler.tsx                                # View Transitions 主题切换
  config/
    site.ts     # 引擎、每日壁纸、强调色、白名单、限额
    types.ts  defaults.ts   # 配置形状与出厂值
    cities.ts   # 34 个省级行政区 / 200+ 城市坐标（离线，不查接口）
  lib/
    storage.ts     # localStorage / IndexedDB 封装 + 防御式深合并
    services.ts    # 白名单校验 + 超时的 fetch 封装
    quotes.ts      # 内置语录库
    commands.ts    # 快捷指令解析
    greeting.ts    # 时段问候与日期格式化
    color.ts       # 对比度计算（WCAG）
    favicon.ts     # favicon URL 拼装 + 内网地址识别（不经过白名单）
    motion.ts      # 统一动效变体与入场时序
    config-store.tsx  # 配置 Context + 减少动效偏好
  styles/
    globals.css    # 设计 token（间距/圆角/阴影/模糊/时长）+ 全部 Magic UI 类 + 主题变量
tests/             # Vitest 单元 / 组件测试（13 文件 172 项）
scripts/           # capture-shots.mjs：视觉验收截图脚本
e2e/               # Playwright 端到端测试（5 文件 38 项，含 axe 无障碍扫描）
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

### 5.2 单元 / 组件测试（Vitest，172 项）

```bash
pnpm test              # 单次运行
pnpm test:watch        # 监听模式
pnpm exec vitest run tests/commands.test.ts   # 只跑某个文件
```

覆盖范围：

| 文件 | 项数 | 验证内容 |
|---|---|---|
| `tests/commands.test.ts` | 16 | 快捷指令解析（长指令优先、`/github` 不误命中 `/g`、大小写、URL 编码）、直接网址识别、搜索 URL 拼接 |
| `tests/greeting.test.ts` | 19 | 时段边界左闭右开（5/9/12/14/18/23 点）、自定义问候优先、日期格式、补零、时间拆分 |
| `tests/quotes.test.ts` | 9 | 分类过滤、同日稳定、随机换条不重复 |
| `tests/color.test.ts` | 10 | 相对亮度、对比度、AA 阈值 |
| `tests/storage.test.ts` | 10 | 配置读写、防御式深合并（类型不符不覆盖、未知字段丢弃、可空字段兼容）、清除 |
| `tests/services.test.ts` | 17 | **白名单拒绝时 fetch 未被调用**、credentials omit、no-referrer、HTTP 500、超时抛错、suggest 截断 8 条、天气码映射 |
| `tests/search-box.test.tsx` | 12 | 默认引擎 Google、原生表单属性、点击循环 / 右键菜单、`/` 提示、指令跳转、Esc 清空、**空提交直接新标签打开引擎官网**、**回车与点按钮都在新标签打开（不劫持当前页）**、Shift+Enter |
| `tests/daily-quote.test.tsx` | 7 | 本地源零网络请求、默认远程取一条、远程失败静默回退、点正文换一条、**不存在来源标签 / 分类 / 刷新按钮**、出处含破折号、聚焦输入框时 `data-dimmed` 翻转 |
| `tests/shortcut-dock.test.tsx` | 12 | 首页 Dock：展平渲染 12 项、无分组标题、**首页不存在任何编辑 / 删除 / 前移后移 / 添加按钮**、悬停只有图标层、`target=_blank` + `title` 含「打开 」、空态是引导文案；设置内 `ShortcutManager`：列表 12 行、增删改、空名校验、URL 自动补全、删除二次确认、取消不删、前后调序持久化 |
| `tests/settings-panel.test.tsx` | 30 | **七个分类页签**全部设置项（搜索引擎 / 外观 / 快捷跳转 / 模块 / 背景 / 隐私与数据 / 关于）、每日壁纸开关与回溯天数、对比度校验、导入导出、一键清除、恢复出厂 |
| `tests/command-palette.test.tsx` | 11 | 默认条目、搜索过滤、方向键 + Enter、Esc、⌘K、点主题 / 每日壁纸开关 / 回溯 / 设置项真的改配置 |
| `tests/widgets.test.tsx` | 13 | 时钟（问候一致性、显隐、秒）、壁纸（关闭时只渲染渐变兜底且**零网络请求**、Edge 取回后渲染图片、自定义图片失败降级）、天气（默认开启、静默定位、选省市写入坐标、成功、失败） |
| `tests/note-pad.test.tsx` | 6 | 待办便签显式关闭时不渲染、回填已存内容、防抖落盘、清空与禁用态、「已保存」提示、2000 字截断 |

### 5.3 端到端测试（Playwright，38 项）

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
| `e2e/startpage.spec.ts` | 29 | 首屏五模块 + 无横向滚动、**每个模块各自独立成层（左上天气→时钟→搜索→便签卡→一言→底部 Dock，且不存在任何 bento 板）**、**玻璃容器均启用 backdrop-filter 且底色半透明**、**四种视口下整页/main 均无滚动且缩放系数在 0.6~1**、时钟走秒、**秒数可见且字号 ≥ 主数字一半**、**首屏请求分两层把关（接口走白名单、图片只允许 favicon）**（并断言「关壁纸 + 关图标抓取 + 一言切本地库后外部请求必须为 0」）、**聚焦搜索框时一言 `opacity` 归零、失焦复原**、引擎切换三种方式（默认 Google）、`/` 指令、**回车与点按钮都在新标签打开、空提交直接进引擎官网**、快捷项增改删**全流程都在设置里**（首页断言无编辑入口与无 `add-shortcut`）、**悬停只有图标层动（格子无底色/无阴影/无描边）**、图标前后调序与顺序持久化、Ctrl+1、**点一言正文换一条且无来源/分类/刷新**、每日壁纸开关与暗化滑杆、主题写 `html[data-theme]`、命令面板搜索执行、模块关闭后刷新保持、一键清除、导出下载、skip-link、焦点陷阱与焦点恢复、减少动效、**设置内「添加」再叠一层编辑弹窗时标题可见且 Esc 只关最上层** |
| `e2e/a11y.spec.ts` | 5 | axe-core 扫描首页（暗/亮）、设置面板**七个页签**、命令面板、快捷项编辑弹窗 —— 断言 **0 个 serious / critical** |
| `e2e/no-js.spec.ts` | 1 | 禁用 JS 后页面完整可读，搜索框通过原生表单 GET 真的跳转到 `https://www.google.com/search?q=...` |
| `e2e/reduced-motion.spec.ts` | 1 | 系统 `prefers-reduced-motion: reduce` 时，四个入场模块首帧即 `opacity:1`、无位移，一言的入场 `animation: none`、聚焦渐隐只淡出不位移，逐字动画降级 |
| `e2e/note.spec.ts` | 3 | 待办便签默认可见、可输入并在刷新后保留、关闭后便签卡整体退场且不留空盒子、清空按钮清内容且写回存储 |

### 5.4 一条命令跑完

```bash
pnpm test:all   # typecheck → lint → vitest → playwright
```

### 5.5 手工验收清单（建议按顺序点一遍）

1. **一屏**：在 1440×900、1366×768、1280×600、390×844 下刷新，页面均**无纵向 / 横向滚动条**；缩小窗口时内容整体等比缩小，不裁切顶部（`main[data-fit-scale]` 可查当前缩放）。
2. **入场**：刷新后壁纸先预解码再淡入（0.7s），时钟 150ms、搜索 300ms、卡片 450ms、一言 600ms 依次淡入。
3. **搜索**：默认显示 Google → 点图标变 Bing → 右键图标开菜单选「百度」→ **不输入任何内容直接点右侧圆钮或按 Enter，应新开一个 bing.com 标签，且当前页不跳走** → 回来输入 `hello` 按 Enter（新标签打开搜索结果）→ Shift+Enter 同样是新标签。
4. **快捷指令**：输入 `/` 看到三条提示 → 输入 `/g react` 回车，跳到 GitHub 搜索页；输入 `github.com` 出现「直接打开」提示。
5. **一言**：**点一下搜索框**，确认一言整体淡出、失焦后淡回 —— 且一言本身没有任何边框或玻璃底；**只有一行正文 + 一行出处（没有「远程/本地」标签、没有分类下拉、没有刷新按钮）**；点一下正文即换一条。
6. **快捷跳转**：在首页把指针移到 Dock 图标上，确认**只有图标上浮 + 柔光 + 上方浮出名称气泡**，没有卡片底色、**也没有任何编辑按钮**；然后设置 → 快捷跳转 → 点「添加」→ 名称留空保存（应报错且弹窗不关）→ 填名称与 `mysite.dev`（自动补 `https://`）保存 → 用 ↑↓ 调序 → 点铅笔改名 → 垃圾桶二次确认删除；回到首页 `Ctrl+1` 直达第一项。
7. **壁纸**：设置 → 背景 → 关掉「使用每日壁纸」，壁纸应变纯渐变、DevTools 里刷新后**不应有任何外部请求** → 重新打开，等照片淡入（元数据走 `bing.biturl.top`、图片走 `www.bing.com`）→ 把「壁纸回溯天数」切到 -3 天，照片应换一张 → 拉「暗化程度」→ 点「选择本地图片」上传一张图（优先级更高）→ 输入坏地址点「应用」（应提示并保留原图）→ 点「移除图片」回到每日壁纸。
8. **天气（左上角）**：页面左上角应有一颗天气胶囊（图标 + 温度 + 城市）。首次打开若浏览器已授权定位，会自动出现温度与城市名；不授权时点胶囊里的定位钮，或点位置钮展开浮层手选。**选「浙江省」后浮层必须仍然开着、城市下拉此时仍是空值**（这是修掉的 bug：以前选完省份整块收起），再选「杭州」才落库并显示温度。全程**不需要输入任何经纬度**，也**不会因为输入一个字就被弹窗抢走焦点**。
9. **主题**：点右上角太阳/月亮切换，观察**从按钮位置扩散的圆形揭示**（Chrome / Edge）；设置 → 外观 → 切「跟随系统」；点预设色或取色器改强调色，观察对比度标注；勾「减少动效」后所有动画应立即消失。
10. **设置面板**：点齿轮打开，左侧七个分类逐个点一遍，右侧内容淡入 + 轻微上移；把窗口压到 600 高，确认只有右侧内容区滚动、面板本身不超出视口；Esc 关闭后焦点回到齿轮按钮。
11. **命令面板**：`⌘K` / `Ctrl+K` 唤起 → 输入「背景」→ 方向键选中 → Enter 执行；再唤起后 Esc 关闭。
12. **待办便签**：默认已开启，直接在搜索框下方的独立卡片里输入几行文字 —— 输入区没有边框，聚焦时浮出一圈 accent 内发光、卡片左沿的竖线同时点亮；右上角字数胶囊开始累加、出现「已保存」小药丸，输入框下沿的进度条跟着变长；**继续输入到第 4 行，输入框会自己长高而不是冒出滚动条** → 刷新内容仍在 → 底部「清空」按钮消失（空态时整条操作栏与进度条一起收起）→ 去设置 → 模块关掉「显示待办便签」，这张卡片整体退场且上下留白自动收拢。
13. **隐私与图标**：打开 DevTools → Network，清空后刷新首页 —— **external 请求应只有三类：`bing.biturl.top` + `www.bing.com`（壁纸）、`v1.hitokoto.cn`（远程一言）、各站点自身的 `/favicon.ico`（图标）**，接口类请求全部落在白名单内。去设置 → 隐私与数据，确认「自动抓取站点图标（favicon）」**默认是开启的**（这是新默认值，早先是手动开启）；关掉它再刷新，favicon 请求应消失、Dock 图标退回品牌色首字母。再「导出配置」下载 JSON → 改几项后「导入配置」应还原 → 「一键清除全部数据」二次确认后回到出厂状态。
14. **无障碍**：按 Tab，第一下应出现「跳到主要内容」并可 Enter 跳转；打开设置后 Tab 不会跑到弹窗外；焦点环始终可见。

### 5.6 视觉验收截图（可选）

```bash
pnpm build && pnpm run start --port 3100   # 先起服务
node scripts/capture-shots.mjs             # 输出到 shots/，每张打印三个溢出量
```

脚本用本机 Chrome（`channel: "chrome"`）在 **18 个场景**下截图：暗/亮主题 1440×900、1280×600 矮屏、390×844 移动端、设置面板的外观 / 背景 / 快捷跳转 / 模块 / 搜索引擎 / 隐私与数据六个页签、命令面板、搜索框聚焦（accent ring + 柔光扫过 + 一言渐隐）、Dock 悬停（放大 + 柔光 + 名称气泡）、关闭每日壁纸的纯渐变兜底、回溯 -3 天的亮色主题、快捷项编辑弹窗（自动取 favicon 预览）、开启便签后的一屏表现。
每张都会打印 `docScroll / mainScroll / horizontal`，三项都应为 `0`（一屏原则的机器可验证据）。

### 5.7 性能与产物体检

```bash
pnpm build
# 产物分析：/ 页面 First Load JS ≈ 175 kB（shared 103 kB）
pnpm exec serve .next   # 或用 pnpm start，再用 Lighthouse 移动模拟跑一遍
```

Lighthouse 目标（PRD 6.1）：LCP < 1.2s、FCP < 0.8s、CLS < 0.1、TBT < 100ms。

> **关于体积**：首屏 JS 为 175 kB（Next 统计口径，gzip 前），**不再追求 PRD 里 < 60KB gzip 的目标** ——
> 该预算与「Next.js 15 + React 19 基线（shared 103 kB）」不可兼得，而要手感丝滑就必须让 Motion 留在主 bundle 里
> （而不是为了抠体积把它拆成异步块、换来首屏动画延迟）。已做的优化仍然保留：设置面板 `next/dynamic` 按需加载，
> 未引入状态库 / UI 库 / 图标库 / 字体文件，Magic UI 组件全部自绘无额外运行时。

---

## 六、隐私与数据边界

| 数据 | 位置 | 默认 |
|---|---|---|
| 用户配置 | localStorage | 启用，仅本机 |
| 自定义背景图片缓存 | IndexedDB（`startpage` / `images`） | 启用，仅本机 |
| 内置语录库 | 静态包 | 启用，零请求 |
| 每日壁纸元数据 | `bing.biturl.top` | **开启**（默认） |
| 每日壁纸图片 | `www.bing.com` | **开启**（默认，`<img>` 直链） |
| 远程一言 | `v1.hitokoto.cn` | **开启**（默认），3 秒超时静默回退内置库 |
| 搜索建议 | `api.bing.com` | **关闭**，显式开启 |
| 天气 | `api.open-meteo.com` | **开启**（默认），仅发坐标 |
| 站点 favicon | 各站点自身 `/favicon.ico` | **开启**（默认），`<img>` 直链、`referrerPolicy="no-referrer"`、不带 Cookie |
| 统计 | — | 未接入任何第三方统计 |

所有**接口**请求走 `safeFetch`：`credentials: "omit"`（不带 Cookie）、`referrerPolicy: "no-referrer"`、`cache: "no-store"`，且必须命中白名单。favicon 与壁纸图片是 `<img>` 直链，不经过 `safeFetch`，但同样带 `referrerPolicy="no-referrer"`、不带任何凭据。

---

## 七、已知限制

- **浏览器矩阵**：仅在 Chrome（Playwright 内置 + 本机 Chrome）上跑过自动化；Safari / Firefox 依赖标准的 `backdrop-filter`、`color-mix()`、`dvh`、`offset-path`，CSS 里已写 `-webkit-` 前缀与降级色，但未做真机回归。主题切换的圆形揭示只在支持 View Transitions 的浏览器上出现，其余退化为颜色过渡。
- **移动端**：布局自适应（Dock 在窄屏自动折行、设置面板导航由竖排转为横排），但 PRD 定位是桌面优先，移动端只保证「可用」。
- **天气**：依赖浏览器 Geolocation 与 open-meteo 可用性；定位失败时静默退化为「选省市」，取数失败显示重试按钮，均不影响其余模块。
- **favicon 抓取**：**默认开启**，且**不经过白名单** —— 白名单约束的是 `safeFetch` 发出的接口请求，而 favicon 是浏览器直接加载的静态图片（`<img>`，`no-referrer`、无 Cookie），两者不会互相限制。抓不到（内网地址、站点反爬如 npm 403 / caniuse 406 / 微博 ERR_CONNECTION_CLOSED）时自动退回品牌色首字母。想完全关闭去设置 → 隐私与数据。
- **一屏原则**：默认配置（便签开启）在 1440×900、1366×768、1280×600、1024×560、390×844 下均完整一屏、无滚动（矮屏会等比缩小，实测 1280×600 为 0.852）。再放不下时只有 `main` 内部滚动，页面本身不会出现整页滚动条。
- **每日壁纸依赖第三方**：元数据来自 `bing.biturl.top`、图片来自 `www.bing.com`，任一不可达时自动降级为纯渐变（`FALLBACK_GRADIENT`），不会留白屏。图片只在 `<img>` 里加载，不经 `safeFetch`。
