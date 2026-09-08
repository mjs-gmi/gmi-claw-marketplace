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
> 全部动作。头部控件保留（状态得挨着 Agent 显示），但点它是打开 Publish Status，
> 不再挂第二份菜单。相应地，弹窗表格也收了 **Draft** 行 —— 设计稿只列已提交的，
> 但既然是唯一入口，草稿也得能到达。



图：`My Agent_First publication successful.`、`_Repost`、`_activation Repost`、`_Unpblish`、`_suc`、`_Lock`、`_Lock hover`、`_Under review`

| # | 状态 | 界面 |
|---|---|---|
| E1 | 已上架 | `Listing ▾` → `Repost ⓘ`（置灰）/ `Edit listing` / `View public listing` / `Unpublish`（红） |
| E2 | Repost 可用 | 同上，`Repost` 变可点、`ⓘ` 去掉 |
| E3 | Repost 不可用 | `Repost ⓘ` hover → `Cannot be published` + `Listing to public requires a public image with no embedded secrets or credentials.` |
| E4 | 已下架 | 菜单只剩 `Repost` / `View public listing` / `Unpublish` |
| E5 | 审核中 | `Listing ▾` 旁出现置灰 `Under review` 药丸 |
| E6 | 被锁 | `Listing` 变 `🔒 Listing`，去掉 `▾`，不可点；hover → `Unable to Publish` + `Listing to public requires a public image with no embedded secrets or credentials.` |

## F · 命名与错字（Confluence I 节 + 本设计稿）

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
