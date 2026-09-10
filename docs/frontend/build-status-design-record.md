# Component / State Design Record — BuildStatus

按 `.claude/skills/frontend-engineering/templates/component-state-design-record.md` 填写。

## Feature

- **Feature**：模板构建的状态与日志，落在 My Agents 的 agent 头部
- **Users / task**：发布者注册完 Agent 后，构建失败时要知道**为什么**、**下一步做什么**
- **Entry points**：`/dashboard`（agent 选中态）、`/dashboard/sandbox/:id/:tab`（头部同样可见）

### 起点不是空白

main 的 agent 头部**已经有**状态徽章和 `Retry build`：

```
Ready | Template hermes-v1 | Image ghcr.io/… | Spec … | IDC … | [Retry build] [Edit Template]
```

所以这次**不是加徽章**，是补它背后缺的三件：

| 缺口 | 现状 |
|---|---|
| 构建日志 | 完全没有。失败了看不到原因 |
| `error` vs `failed` 的区分 | main 从 `validation` + `preparation` 两个字段推出一个 `Build failed`，把「你的模板错了」和「构建系统炸了」合并成一句。**下一步动作不同**，不能合并 |
| 可执行的失败提示 | 没有。只有一个状态词 |

## Component Tree

```
AgentHeader (Dashboard.tsx，已存在)
└── TemplateStatusStrip (已存在：徽章 + 字段 + Retry/Edit)
    └── BuildLogDisclosure          ← 新增，负责展开/收起
        └── BuildStatus             ← 摘过来的组件
            ├── BuildStepper        （waiting → building → ready | error | failed）
            ├── BuildLogView        （增量日志 + live region）
            └── BuildFailureHint    （失败时的下一步）
```

- **可复用 vs 特性专属**：`BuildStatus` 必须**不知道**自己挂在 agent 头部还是别处。它只收一个构建视图对象。`BuildLogDisclosure` 是特性专属的壳。
- **不做成组件的**：状态徽章本身留在 `TemplateStatusStrip` 里不动 —— 它已经在了，抽出来只会制造一次无谓的重构。

### Props 接口

摘过来的版本收 `build: TemplateBuild`，那个类型来自 `lib/templatesModel.ts` —— 一个**只为 Templates 页存在**的数据模块，而 Templates 页我们决定不做。为了渲染一段日志把整个页面的数据模型拖进来，正是 skill 说的「props should be minimal」要避免的。

改成最小视图对象，`RuntimeImage` 用一个适配函数映射进来：

```ts
type BuildState = "waiting" | "building" | "ready" | "error" | "failed";

interface BuildView {
  state: BuildState;
  log: string;
  durationSec?: number;
  /** 失败时的下一步；ready/building 时不需要 */
  hint?: string;
}
```

`buildViewFor(image: RuntimeImage): BuildView` 留在 Dashboard 里，`BuildStatus` 不认识 `RuntimeImage`。

## State Ownership

| State | Owner | Kind | Why here |
|---|---|---|---|
| 日志文本 + `offset` | `BuildStatus` | local | 只有它消费；抬到父级会让每次 tail 都重渲染整条头部 |
| 已用时长 | `BuildStatus` | local | 同上，1 Hz 心跳不该越过组件边界 |
| 展开/收起 | `BuildLogDisclosure` | local | 是这一处的呈现状态，不是应用状态 |
| 用户是否已滚离底部 | `BuildStatus` | local | 决定要不要自动跟随，见无障碍 |
| 构建记录本身 | Dashboard | server（原型里是 mock） | 它属于 agent，头部其它字段也从这里来 |

**不放全局**：构建状态只在一个 agent 的头部用，进全局 store 没有第二个消费者。

## Data Fetching

| Data | Endpoint | 增量 | States |
|---|---|---|---|
| 构建状态 + 日志 | `GET /templates/{id}/builds/{buildID}/status?logsOffset=` | **`logsOffset` 续传**，只取 offset 之后的部分，调用方追加 | waiting / building / ready / error / failed |
| 重试 | `POST /templates/{id}/builds/{buildID}` | — | — |

- **轮询只在 `waiting`/`building` 时开**，到 `ready`/`error`/`failed` 立即停。
- **不做乐观更新**：`Retry build` 之后状态由后端返回决定，不本地先跳成 building。
- **竞态**：`offset` 存在 ref 里，响应乱序到达时按 offset 判断丢弃。

## Error and Loading UX

- **waiting**：`Waiting for the builder to start…`，不是空白
- **building**：脉冲点 + 实时耗时，日志随之增长
- **ready**：stepper 走完，日志保留可查
- **error**（模板的错）：红，末行给**可执行**的下一步，例如
  > Add pypi.org to the egress allowlist under Register → Networking, then rebuild.
- **failed**（构建系统的错）：橙，措辞明确不是用户的问题
  > The build host dropped mid-run. Nothing in your template caused this — retry the build.
- **空日志**：显式说「还没有输出」，不留空面板

## Accessibility and Responsive Notes

摘过来的版本这块是弱项，这次补上：

| 项 | 做法 |
|---|---|
| 日志是实时更新的区域 | `role="log"` + `aria-live="polite"` + 构建中 `aria-busy="true"`；读屏不会被每一行打断，但能感知 |
| 自动跟随底部 | **用户一旦向上滚动就停止自动跟随**，回到底部再恢复。无条件 scrollToBottom 会把正在读日志的人一直踢走 |
| 展开/收起 | `<button aria-expanded aria-controls>`，键盘可达 |
| 脉冲动画 | `@media (prefers-reduced-motion: reduce)` 下停掉 —— 全站目前 **0 处**该查询，这是第一处 |
| 颜色 | 状态不只靠颜色区分，stepper 的文字标签同时表达状态 |
| 断点 | 头部是横向字段条，窄屏已经 `flexWrap`；日志面板 `max-height` + 自身滚动，不撑破布局 |

## Testing Plan

原型没有测试基建，记录应测什么：

- **组件**：五个状态各渲染一次；日志增量追加不重复；用户滚离底部后不被强制拉回
- **集成**：注册 → 构建失败 → 头部显示 error → 展开看到 hint → Retry → 回到 building
- **无障碍**：axe 跑展开态；键盘从 Retry 到展开按钮到日志的顺序

## Alternatives Considered

1. **把 `templatesModel.ts` 一起搬过来** —— 否决。它是 Templates 页的数据模型，而那个页面已决定不做；搬过来等于为一段日志引入一个没有归属的模块。
2. **给 agent 头部加一个 Build tab** —— 否决。刚砍掉 Metrics / Logs 两个空 tab，不该马上加回一个。构建状态是**头部字段条的一部分**，展开即可。
3. **失败时自动展开日志** —— 否决（暂）。看着贴心，但头部会在用户没有请求的情况下跳高。改成失败时徽章可点、并有明显的展开提示。

## Open Questions

1. main 的 `RuntimeImage` 用 `validation` + `preparation` 两个正交字段推状态，契约是**一个** `state` 五态。适配函数能映射，但**长期该以契约为准把字段收敛成一个** —— 要不要现在就改，影响面比这次大
2. `error` 和 `failed` 的 hint 文案谁来定 —— 目前是我按最常见的失败（出网白名单）写的示例，需要真实的失败分类
