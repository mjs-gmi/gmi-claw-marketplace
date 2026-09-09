# Agentbox v1.2 设计稿 — 变更清单

31 张设计稿的来源：`1.2-改版.zip`（2026-09-08）。本目录是原图 + 本清单。
配套文档：Confluence《Agentbox V2.0 Interface Changes: New Flow and Features
Overview》（space IE, page 515375122）。两份是**互补**的：

- Confluence 页管 Sandbox 运行时（Lifecycle / Run / Terminal / Files / Spec·IDC / 构建等待）
- 本目录管**上架侧**（Browse / Register / List an Agent / Publish Status）—— Confluence 页一个字没提

本轮所有新增界面在 UI 上挂 `V2` tag（`client/src/components/V2Badge.tsx`），
既有控件一个不删。

---

## A · Browse Agents

图：`hero.png`、`Browse Agent.png`、`Browse Agent-1.png`、`Browse Agent_Code & Dev Tools.png`

| # | 改动 | 细节 |
|---|---|---|
| A1 | 顶部 hero banner（新增） | 眉标 `▪ DEPLOY · PUBLISH · GROW THE AGENT ECOSYSTEM`；主标题 `Help Great Agents ` + 柠檬色 `Get Deployed, Discovered, and Used.`；副文案 `Register, deploy, and test your Agent with Agentbox — then publish it to Agent Marketplace so more users can discover and use it.`；右侧柠檬 CTA |
| A2 | 区段头 | 眉标 `▪ AGENT MARKETPLACE`；标题 `Discover  Agents for your workflow.`；副文案 `Compare publisher, runtime, and access details, then deploy a private copy into your GMI account.` |
| A3 | `Verified Only` 复选框（新增） | 宽屏在分类行右端；窄屏移到副文案右侧 |
| A4 | 分类 pill 行 | 首项 `Recommended`（带火苗图标）+ 各分类 + `All`；某分类可挂 `NEW` 角标 |
| A5 | 卡片 | logo / 名称（可挂 `NEW`）/ publisher + 蓝色认证勾 / 描述 / 底部两个 chip |
| A6 | 分类筛选态 | 卡片底部 chip 从「分类」换成 `Custom tags` |
| A7 | 窄屏 | hero CTA 落到文案下方；分类行横向滚动；卡片 3 列 → 2 列 |

**设计稿内部不一致**（需定稿）：hero CTA 文案三张图三个说法 —— `Agent Registration →` / `Register an Agent →`。本轮统一取 `Register an Agent →`。

## B · Register an Agent（原型里没有这个页面）

图：`Register & List _ Browse entrance.png`、`Register _ Connect your agent.png`、`Register & List _ Connect your agent _ Fill in.png`、`Registration successful.png`、`My Agent_First publication successful._Ed Tem.png`

| # | 改动 | 细节 |
|---|---|---|
| B1 | 两个部署模式 tab | `Host on GMI`（挂柠檬 `DEFAULT` 角标）/ `Connect your agent` |
| B2 | Host on GMI 分节 | `Basics & Template` → `Runtime`（Image URL / **Region** / `Requires sign-in` 开关）→ `Public Access (Optional)`；完成的分节标题前有绿勾 |
| B3 | Connect your agent 分节 | `Basic`（内部标识）/ `Model API Key (Optional)` / `Endpoint`（`ACCESS URL`，须公网 HTTPS，GMI 上架前查 HTTP 200） |
| B4 | 右栏 `Summary`（新增） | 随 tab 变：Host on GMI = Project Name / Runtime / Requires sign-in / Region / Port Mappings / Custom Env Vars；Connect = Project Name / Deployment Type / Model API Key / Access URL / Badge（`POWERED BY GMI MODELS`） |
| B5 | 注册成功弹窗 | 标题 `Agent is registered. Spin up instances via API`；副文案 `Auto-approved — your template is registered with GMI and provisions containers on demand`；`GMI_MAAS_API_KEY` 代码块 + 复制按钮；按钮 `Go to My Agents →`，左键按入口变化：从 Browse 进来是 `Return to Browse Agents`，直接进来是 `Ok` |
| B6 | 离开确认 | `Alert Dialog.png`：`Do you want to leave registration?` / `If you leave the registration process, the information you have entered will not be saved.` / `Leave` · `Continue` |

**设计稿有两代 Register 页**：早期版分节是 Basics & Template / Infrastructure / Networking；后期版（`_Ed Tem`）是 Basics & Template / Runtime / Public Access。本轮按**后期版**做。
**缺口**：两代都只有 Region（= Confluence H 节的 IDC），**没有 Spec 选择**。Confluence H 明确要求 Register 能选 Spec，设计稿没画 —— 待设计补。

## C · List an Agent（对应原型 `ListClaw.tsx`）

图：`My Agent _ Public.png`、`_ Fill in 1`、`_ Fill in 2`、`_ normal`、`_ success`、`My Agent _ List an agent_ publish_Lock.png`

| # | 改动 | 细节 |
|---|---|---|
| C1 | 顶部说明块 | `Deploy-your-own listing` — `COPIED —` image / env names + defaults / ports + infra config；`NOT COPIED —` your secrets / GMI Models key |
| C2 | `Link a Template` + `REQUIRED` 角标 | 每个 listing 只能绑一个已发布 CE template；下方 `Detected badge: ✓ CE + MaaS — full GMI stack detected` |
| C3 | Template 下拉的锁定项（新增） | 含私有内容的 template 置灰不可选，右侧 `🔒 Private content found` |
| C4 | `Listing Identity` | Agent Name * / Publisher Name * / Category * / Tags (max 5) |
| C5 | Tags 变可删 chip | 每个 chip 带 `✕`，上限 5 |
| C6 | Logo 上传 | 空态 `Upload (Square≤256px)`；已传显示缩略图 + 右上 `✕` |
| C7 | 字数计数器 | Short Description `36/120`、Full Description `150/300` |
| C8 | `Sample Output (n/5)` | 缩略图带 `✕`；到 5 张时**隐藏** Upload 磁贴 |
| C9 | 右栏 `Live Card Preview` | 原型已有且是实时的，保留实时行为（设计稿里是静态占位） |
| C10 | 粘底 footer | 左侧说明 `Listing review runs on submit · Auto-approved if it passes  Unpublish any time — provisioned containers unaffected`；右侧 `Cancel` + 主按钮 |
| C11 | 提交成功弹窗 | `Your Agent Is Being Reviewed` / `We've received your listing. Our team will review it before it becomes available to the public. It will appear on the Agent Marketplace once approved.` / `Return to My Agent` · `To Browse Agents →` |

**设计稿内部不一致**（需定稿）：主按钮文案四张图三个说法 —— `Publish` / `Public` / `Continue to Review`。本轮统一取 `Publish`。

## D · My Agents · Publish Status（新增）

图：`My Agent_Publish Status.png`、`_Details`、`_Details-1`、`_Details_unpublish`、`_Details_Successfully republished.`、`_Under review`、`_Lock`、`_Lock hover`、`Sonner.png`

| # | 改动 | 细节 |
|---|---|---|
| D1 | `Publish Status` 入口（新增） | My Agents 左栏标题右侧，历史图标 + 文字 |
| D2 | Publish Status 弹窗（新增） | 可排序表：`Listing name` / `Template name` / `Review Status` / `Updated` + 行 `⋯` |
| D3 | Review Status 三态 | `Approved`（绿）/ `Under Review`（蓝）/ `Denied ⓘ`（红） |
| D4 | Denied 原因 | `ⓘ` hover → `Reason for failure` + 原因正文 |
| D5 | 长名截断 | 悬停显示完整名 |
| D6 | 行 `⋯` 菜单 | 已上架 → `Unpublish`（红）；其余 → `List an agent` |
| D7 | Unpublish 确认弹窗 | `Unpublish Agent` / `Unpublish this Agent will remove it from the Marketplace.` `Re-submitting will require a new review cycle.` `Are you sure you want to unpublish?` / `Cancel` · 红实心 `Unpublish` |
| D8 | Toast | `Published successfully`、`Resubmitted for review.` |

**设计稿内部不一致**（需定稿）：表头一版四列（Listing name / Template name / Review Status / Updated），一版三列（Publish name / Review Status / Updated）。本轮取**四列**版。
**错字**：设计稿写的是 `Timplate name`，实现里写 `Template name`。

## E · My Agents · Listing 控件（新增）

> **偏离设计稿**：设计稿把 listing 管理分在两处 —— agent 头部的 `Listing ▾` 下拉，
> 和 Publish Status 弹窗的行菜单。实现里**全部收进 Publish Status 弹窗**：
> 那里的行 `⋯` 是唯一入口，覆盖 draft / under review / denied / approved 四态的
> 全部动作（Complete listing / Edit listing / Fix & resubmit / View public
> listing / Repost / Withdraw / Unpublish）。
>
> **agent 页面只留 publish / unpublish 一个按钮**，没有菜单：
>
> | agent 的 listing 状态 | 头部按钮 |
> |---|---|
> | live | `Unpublish`（红描边）→ 共用同一个确认弹窗 |
> | draft / denied | `Publish` → 进 List an Agent 表单 |
> | under review | `Publish` 置灰 + 时钟图标，tooltip 说已提交、要改去 Publish Status 里 Withdraw |
> | 镜像被锁 | `Publish` 置灰 + 锁图标，tooltip 给 §E6 的原因 |
>
> 相应地，弹窗表格收了 **Draft** 行 —— 设计稿只列已提交的，但既然是唯一入口，
> 草稿也得能到达。§E5 的 `Under review` 药丸和 §E6 的 `🔒 Listing` 独立控件
> 都不再单独存在，两个状态折进了这一个按钮。



图：`My Agent_First publication successful.`、`_Repost`、`_activation Repost`、`_Unpblish`、`_suc`、`_Lock`、`_Lock hover`、`_Under review`

| # | 状态 | 界面 |
|---|---|---|
| E1 | 已上架 | `Listing ▾` → `Repost ⓘ`（置灰）/ `Edit listing` / `View public listing` / `Unpublish`（红） |
| E2 | Repost 可用 | 同上，`Repost` 变可点、`ⓘ` 去掉 |
| E3 | Repost 不可用 | `Repost ⓘ` hover → `Cannot be published` + `Listing to public requires a public image with no embedded secrets or credentials.` |
| E4 | 已下架 | 菜单只剩 `Repost` / `View public listing` / `Unpublish` |
| E5 | 审核中 | `Listing ▾` 旁出现置灰 `Under review` 药丸 |
| E6 | 被锁 | `Listing` 变 `🔒 Listing`，去掉 `▾`，不可点；hover → `Unable to Publish` + `Listing to public requires a public image with no embedded secrets or credentials.` |

## F · 全站统一叫 Sandbox（Confluence I 节）

只改**界面文案**，代码标识符（`Instance` / `RuntimeImage` / `runtimeClass` /
`sourceRuntimeId` / `instanceId` …）一律不动 —— 这是文案改名，不是重构。

| 原文案 | 改成 |
|---|---|
| `+ Instance` | `+ Sandbox` |
| `Instances` / `Instance Overview` / `Instance Detail` | `Sandboxes` / `Sandbox Overview` / `Sandbox Detail` |
| `Create Instance` / `Launch New Instance` / `Launch instance` | `Create Sandbox` / `Launch New Sandbox` / `Launch sandbox` |
| `Pause / Resume / Delete Instance` | `Pause / Resume / Delete Sandbox` |
| `N running instances` / `No instances yet` / `Paused instances` | `N running sandboxes` / `No sandboxes yet` / `Paused sandboxes` |
| `Runtime Template` | `Sandbox Template` |
| `Runtime ID` | `Sandbox ID` |
| `Runtimes`（正文里指运行实体的） | `Sandboxes` |
| `Source Runtime` | `Source Sandbox` |
| `Runtime class` | `Spec`（§I 的 `Compute Tier → Spec` 同一概念） |
| `Maximum active runtime` | `Maximum active time`（§A 说 lifecycle 文案要重写） |
| `Preparing runtime` / `Runtime ready — Launch enabled` | `Preparing template` / `Template ready — Launch enabled`（准备的是 Template，不是 sandbox） |

**故意没改的三处**：
1. Browse Agents 副文案 `Compare publisher, runtime, and access details` —— 这句是 v1.2 设计稿原文，`runtime` 在这里是「怎么跑的」，换成 sandbox 反而读不通
2. `curl … /v1/agents/{id}/runtimes` 和 `runtime_id` —— API 字段名，不是界面文案。**API 要不要跟着改，需要后端确认**
3. 模拟的容器日志行 `[t] runtime: starting container` —— 那是容器进程的输出，不是产品命名

## G · 真实 API 契约（bs-api Sandbox / Runloop）

来源：Confluence《bs-api Sandbox (Runloop)》（space Elasticclo, page 495485321），
契约以 swagger 为准（`GET /api/v2/ec/openapi.yaml`），2026-08-13 复测 24/24 PASS。

**控制面** `$API_BASE = …/api/v2`，`Authorization: Bearer <session access token>`
- `POST /sandboxes` —— **只收** `template_id` / `idc_name` / `timeout` / `env_vars` / `metadata`
- `GET /sandboxes/{id}` → `data.state`
- `POST /sandboxes/{id}/connect` `{timeout}` → 换数据面凭据
- `DELETE /sandboxes/{id}`
- `GET /sandbox-product-specifications?idc_name=`、`GET/POST /templates`（建模板必填 `name/idc_name/resources/build` + `Idempotency-Key` 头）

**数据面** `https://{sandbox_key}.{domain}`，`X-Access-Token: <sandbox_access_token>`
- `POST/GET /files?path=` —— 单文件、按显式路径
- `POST /executions?wait=true&wait_timeout_seconds=` → `execution_id`；`wait=false` 异步
- `POST /executions/{id}/cancel` —— **空 body**
- `POST /shell`、`POST /shell/control`（`{action:"resize",cols,rows}` / `{action:"close"}`）、`wss://{sandbox_key}.{domain}/shell/connect`

### 这份契约替我们答掉的问题

| 原来的疑问 | 答案 |
|---|---|
| API 要不要跟着改叫 sandbox | **不用改，本来就是** `/api/v2/sandboxes`。原型里那段 `/v1/agents/{id}/runtimes` 是编的，已按真实契约重写 |
| Spec 能不能在 Launch 改（§H） | **不能**。create 只收五个字段，Spec 在 Template 的 `resources` 里 —— §H 说的没错 |
| IDC 能不能在 Launch 选（§H） | **能**，`idc_name` 是 create 参数 |
| Lifecycle 是什么（§A） | 一个 `timeout`，创建时给，从创建那刻算起 —— §A 描述的就是它 |
| Files 为什么不能浏览目录（§G） | 数据面只有按 path 的单文件读写，**没有列目录接口** |
| Run 的取消（§B） | `POST /executions/{id}/cancel`，空 body |
| Terminal 是不是真 TTY（§C） | 是，WebSocket `/shell/connect`；resize 和 close 都是真的控制消息 |
| 访问凭据怎么换（§D） | `POST /sandboxes/{id}/connect` |

### ⚠️ 这份契约暴露的冲突

1. **swagger 里没有 pause / snapshots / actions**（原文：「**没有**：pause/snapshots/actions、aliases、shell*（数据面）」）。
   而原型里 Pause / Resume / Snapshot 是**大块功能** —— Snapshots 顶部 tab、
   Create/Restore Snapshot 弹窗、Organization Snapshots、暂停盘费成本模型，
   全部没有 API 支撑。**这是产品决策，不是我能定的。**
2. **没有 `/logs`、没有 `/usage`** —— 原型的 Analytics/Usage 面板同样没有后端。
3. 示例里的 `request_id` 幂等语义在 swagger 里没有对应，只有 `X-Request-ID` 头和
   建模板的 `Idempotency-Key`。重写后的示例不再宣称幂等保证。

## H · Run / Files / Terminal（按真实契约做实）

三块都落在 sandbox 详情抽屉，tab 顺序 `Overview · Access · Files · Run · Terminal · Logs · Config`，
后三个新增的挂 `V2`。行 `⋮` 菜单也加了 `Run` / `Terminal` / `Files` 三个直达入口
（原来要点三下才摸得到），只在 Running 时出现。

### Run —— `POST /executions`

| 阶段 | 界面 |
|---|---|
| 输入 | 命令框 + Run；`cwd`（默认 `/home/user`）和 `timeout` 收在一个折叠里 |
| 还在跑 | 脉冲点 + 实时耗时，输入框和 Run 锁住，`waiting for output…` |
| 跑完 | **结果先行** `exit 0 · 2.6s`，输出在下面；底部 `execution_id` / `status` / `exit_code` / `cwd` |
| 超时 | 保留已产出的部分输出，明说 Sandbox 没事、没有替你重试 |
| 取消 | 只在跑的时候出现；`cancelling…` → `cancelled` |
| 取消失败 | 命令先跑完了 —— 报真实结果并说明取消是晚到的，不假装取消成功 |

`running` / `cancelled` 这两个态原来类型里就有、颜色也定了，但 `mockExec` 是同步返回成品的，
**永远渲染不出来**。拆成 `mockExecStart` / `mockExecOutcome` 才让它们可达。

去掉了原来那句「**Replaces** Open Shell」——§C 要的是两者并存。

### Files —— `/files?path=`

上传和下载**拆成两块、各自一个路径框**（共用一个说不清路径是给哪个方向的）。
默认路径改成 `/home/user/`（跟 API 示例一致）。路径以 `/` 结尾保留原文件名，
给全路径则重命名。传输中有进度条，失败按 API 能区分的三类给原因和做法：
`Invalid path` / `Permission denied` / `File too large`（并说明没写入、没有半截文件），
下载另有 `Not a file` / `No such file`。非 Running 时说清楚当前是什么状态。

「没有目录浏览」那句补上了**为什么**（API 没有列目录接口），并指向 Run 里的 `ls`。

### Terminal（全新）—— `wss://{sandbox_key}.{domain}/shell/connect`

`connecting → connected → closed / dropped` 四态，`Reconnect` 回到连接中。
`cd` 保留且提示符跟着变（这是跟 Run 的根本区别），Ctrl-C 打断当前行，
Ctrl-D / `exit` 关闭，↑↓ 翻历史，`clear` 清屏。

§C 特别点的两件事都做实了：
- **拖动改大小真的传下去** —— `ResizeObserver` 量真实像素 → 算 cols/rows → 走
  `resize` 控制消息，终端里能看到 `[control] resize → 67×15`
- **关闭真的断开** —— `Close session` 发 `close`，不是把面板藏起来

另有一个 `Simulate drop` 按钮（虚线框，仅原型用）走掉线 → 重连那条路。

## I · Image 与 Spec 的归属

Confluence §H 定了 Spec 只能在 Template 上改。**Image 同理**：

- **改的地方**：Register 时定，之后在 Sandbox Template 卡片上用 `Replace Image` 改
- **Launch 面板**：只读展示，并明说「Set by this Agent's Sandbox Template — change it there with Replace Image, not per sandbox」
- Template 拥有 Image + Spec；Launch 拥有 IDC、model、lifecycle、env

## J · 命名与错字（其余）

| 位置 | 现状 | 改成 |
|---|---|---|
| 分类 | `Date & Analytics` | `Data & Analytics` |
| Register / List footer | `Cancle` | `Cancel` |
| Publish Status 表头 | `Timplate name` | `Template name` |
| Register footer 主按钮 | `application` | `Register` |
| 侧栏 | `Models Hub` / `Model Hub` 混用 | 统一 `Model Hub` |
| 侧栏 | `Setting` / `Settings` 混用 | 统一 `Settings` |

## 待定稿（阻塞项）

1. hero CTA：`Agent Registration` 还是 `Register an Agent`
2. List an Agent 主按钮：`Publish` / `Public` / `Continue to Review`
3. Publish Status 表：四列还是三列
4. Register 页按早期版（Infrastructure / Networking）还是后期版（Runtime / Public Access）
5. Register 的 **Spec 选择**设计稿缺失（Confluence H 节要求）
6. 「已下架」态菜单为什么没有 `Edit listing`——有意还是漏画
