# Agentbox v1.3 设计稿 — 变更清单

27 张设计稿的来源：`1.3 Agentbox.zip`（2026-09-03）。本目录是原图 + 本清单。

**与 v1.2 的关系**：v1.2 管**上架侧**（Browse / Register / List an Agent / Publish
Status），v1.3 在其上补两块 v1.2 完全没画的东西：

1. **Browse Agents 的卡片详情**——点卡片从右侧滑出抽屉，v1.2 里点卡片还是跳详情页
2. **花钱之前的告知与拦截**——费用 Notice、余额不足、充值、兑换码

两版重叠的界面（Browse hero、Register 分节、Launch 面板）**以 v1.3 为准**，它更晚。

**本仓库是原型**，目的是 UI 展示。bs-api swagger 契约（见 v1.2 README §G）在这里
是**参考**，不是约束——它告诉我们后端已经有什么，但设计稿画了而契约还没有的界面
照做，见 §G。

本轮新增界面沿用 v1.2 的做法，在 UI 上挂 `V2` tag（`client/src/components/V2Badge.tsx`），
既有控件一个不删。

---

## A · Browse Agents · 卡片详情抽屉（本轮主体）

图：`Browse Agent.png`、`Browse Agent_Verified Only.png`、`Browse Agent_Card_Details.png`、
`_Slide up`、`_Media`、`_Media-1`、`_Media Empty`、`_Unverified`

| # | 改动 | 细节 |
|---|---|---|
| A1 | **点卡片开抽屉，不再跳页**（新增） | 右侧滑出，目录留在后面，关闭回到原滚动位置。宽度约 720px |
| A2 | 抽屉头部 | 方形 logo（约 56px，圆角）/ 名称 / chip 行 `Discord · Agent · AI · LLM` / 右上 `✕`；下方一句 tagline |
| A3 | 四列元信息条 | `Publisher` / `Hosting` / `Category` / `Model`，列间竖线，上下描边 |
| A4x | Hosting 两态 | 已认证 = 蓝勾 + `Verified`；未认证 = 灰圈 + `Not Verified`（`_Unverified`） |
| A5 | 两个 tab | `Overview` / `Media & Links`，下划线指示 |
| A6 | Overview | Plan eligible 提示条（柠檬描边）+ `About this Agent` 长文（滚动时提示条滑到吸顶头部之下，见 `_Slide up`） |
| A7 | Media & Links | `Publisher media` 标题 + 两张卡：`Related resources`（`Watch demo` / `View documentation`，各带 ↗）和 `Sample outputs`（缩略图 + `👁 Preview`） |
| A8 | 媒体空态 | `_Media Empty`：图标 + `No media yet` + `The user has not yet uploaded any media files.` |
| A9 | 样例输出灯箱 | `_Media-1`：全屏遮罩，右上工具条 —— 缩小 / 放大 / 左旋 / 右旋 / 下载 / 关闭 |
| A10 | 抽屉底部 CTA | 左侧 `Continue in My Agents to configure settings and deploy.`；右侧柠檬 `Set up this Agent →` |
| A11 | hero CTA 定稿 | **`Agent Registration →`** —— 2026-09-09 按新截图定，**推翻** v1.2 README §A 里取的 `Register an Agent →` |
| A12 | `Verified Only` 勾选态 | 方形勾选框，选中为柠檬底黑勾（v1.2 §A3 只画了未选态） |

## B · My Agents · 首次进入与交接

图：`After setting up this agent (assuming no agent had been registered previously)....png`、
`After setting up this agent (assuming you have previously registered an agent)....png`

| # | 改动 | 细节 |
|---|---|---|
| B1 | 费用 Notice 弹窗（新增） | 首次进入 My Agents 弹一次。正文：AgentBox 按实际用量计费，构建按构建时长计，部署后实例运行期间计费，模型用量与存储另计；**开始构建或部署之前不产生费用**。按钮 `View pricing details` + 柠檬 `I understand and acknowledge.` |
| B2 | `Set up this Agent` 的落点 | 从 Browse 抽屉过来后落到 My Agents，左栏**顶部新增一条 `{名称} (copy)`** 并选中 |
| B3 | Toast | `Finish setting up this agent.` |
| B4 | 两种入口态 | 之前没注册过任何 agent → 只有 Notice；之前注册过 → Notice + 上面的 copy 条目与 toast |

## C · Launch Sandbox

图：`My Agent_Start instance.png`、`My Agent_Instance_You need to select a region during setup..png`、
`_Select Model`、`_After selecting the model`、`_After selecting the model (with a discount)...`、
`_Check if there is a sufficient balance..png`、`My Agent_Doploy success.png`

| # | 改动 | 细节 |
|---|---|---|
| C1 | 居中弹窗，不是抽屉 | 标题 `Launch instance — {agent}`，副文案 `Provision a new container instance from this deployment.` |
| C2 | 字段顺序 | Image/Template（只读）→ Name → **Data Center Region** → **Compute Tier** → `Add Model` 开关 → 模型选择（开关打开才出现）→ Environment variables（带 `Import .env`） |
| C3 | Compute Tier | 两张单选卡（`Small` / `XSmall`），各带 `$/hr` 与规格行（见 §G1 的契约对照） |
| C4 | `Add Model` 开关 | 关闭时说明 `If no model is selected, this instance will only start the runtime environment.` |
| C5 | 折扣态 | `_with a discount`：模型行显示原价划掉 + 折后价 |
| C6 | 粘底 footer | 左 `Billing begins when the instance is started.` + 大字 `$ x/hr`；右 `Cancle` · 柠檬 `Create Instance` ⚠️ 错字见 §K |
| C7 | 余额校验 | `_Check if there is a sufficient balance.`：点 Create 前先查余额，不足则走 §D |
| C8 | 部署成功 | `My Agent_Doploy success.png` ⚠️ 文件名错字 `Doploy` |

## D · 计费拦截（新增）

图：`My Agent_Instance_Insufficient funds in user account; coupon.png`、
`_Insufficient funds in user account; top up account..png`、
`Register & List _ Coupon.png`、`Register & List _ top up.png`

| # | 改动 | 细节 |
|---|---|---|
| D1 | 余额不足提示条 | 底部居中，不是阻断式弹窗。红 ⓘ + `Insufficient credits` + `Deposit to continue or Redeem a coupon.` + 柠檬 `Deposit` + `✕` |
| D2 | `Top-up Credits` 弹窗 | `Deposit Amount` 输入 + 四个预设 `$10 / $50 / $200 / $1,000`；`Payment Method` 三选（Default / PayPal / Stripe）；选 Default 时展示已存卡 `VISA **** 1234` |
| D3 | `Redeem Coupon Code` 弹窗 | 顶部 `Gifted Credits` 卡面插画 + 说明 + `Enter a code` 输入 + `Cancel` · `Apply` |
| D4 | 两个入口共用 | Launch 和 Register 两条路径走同一套 D1–D3 |

## E · Register & List

图：`Register & List _ Host on GMI.png`、`Register & List _First-time entry.png`、
`Register & List _ Insufficient account balance.png`、`My Agent_Registration complete.png`

| # | 改动 | 细节 |
|---|---|---|
| E1 | 首次进入 Notice | `_First-time entry`：注册并创建 Agent 会产生小额费用，金额很小但事先告知。按钮同 §B1 |
| E2 | 分节确认为后期版 | `Basics & Template` / `Runtime`（Image URL / Region / `Requires sign-in`）/ `Public Access (Optional)` —— 与 v1.2 README §B 的定稿一致，v1.3 再次确认 |
| E3 | 右栏 Summary | `Project Name` / `Runtime` / `Requires sign-in` / `Region` / `Port Mappings` / `Custom Env Vars` |
| E4 | 余额不足 | 同 §D1，提示条压在页面底部，`Register` 按钮不禁用、点了才拦 |
| E5 | 注册完成后的 My Agents | `My Agent_Registration complete.png`：新 agent 进列表，实例表出现一条 `CREATING` + Reason `Pulling image…` |

## F · Listing 只读预览

图：`My Agent_Listing.png`、`My Agent_Details.png`

| # | 改动 | 细节 |
|---|---|---|
| F1 | `View public listing` 复用 A 的抽屉 | 同一个组件，只读模式 |
| F2 | 副标题替换 | tagline 位置改成 `This is how your Agent currently appears in Browse Agents` |
| F3 | 隐藏底部 CTA | 没有 `Set up this Agent` |

---

## G · 与 bs-api swagger 契约的对照

> **⚠️ 2026-09-09 更正。** 本节此前依据的是 Confluence《bs-api Sandbox (Runloop)》
> （最后修改 8/24）的摘要，那份摘要相对当前 swagger 已经过时。直接读
> `GET /api/v2/ec/openapi.yaml` 之后，本节原来的三条「契约里没有」**全部作废**。

| # | 设计稿画了 | 旧结论（错） | 契约实际 |
|---|---|---|---|
| G1 | Launch 的 Compute Tier 选择器（§C3） | 「不能做，Spec 属于 Template」 | **可以做。** `POST /sandboxes` 收 `product`（档位 SKU，见 `GET /products`），传入时以该档位规格 launch 并按该档位计费，覆盖模板固化的规格。限制是：档位须与生效 IDC 一致、在售、架构与模板一致；不支持的后端返回 422 `Template.ProviderNotSupported` |
| G2 | 余额不足 / 充值 / 兑换码（§D 整块） | 「没有任何端点」 | **仍然成立** —— swagger 里确无余额、充值、兑换码。保留 `NoApiBadge` |
| G3 | `Add Model` 开关（§C2） | 落在契约内 | 不变 |

### 另外三处也要一并撤回

| 我们曾经的判断 | 契约实际 |
|---|---|
| 「没有 snapshots」 | `POST /snapshots` 存在；`snapshot_id` 是 `POST /sandboxes` 的**合法创建来源**，与 `template_id` 二选一（`oneOf`）。Runloop 还允许 `snapshot_id` + `product` 覆盖快照规格 |
| 「没有构建日志」 | `/templates/{id}/builds`、`/builds/{id}`、`/builds/{id}/logs` 都存在。`BuildStatus` 方向正确 |
| 「出网策略没有端点」 | `POST /sandboxes` 收 `egress_control`（布尔，**创建后不可改**）与 `egress`（初始 allowlist）；`POST /sandboxes/{id}/actions` 的 `update_egress_policy` 可全量替换 allowlist，仅限创建时 `egress_control=true` 的 sandbox |

### 仍然成立的一条

**pause / resume 确实不存在。** `/sandboxes/{id}/actions` 只有
`update_egress_policy` 一个动作。状态枚举里有 `paused`，但注明「仅会由提供挂起能力的
IDC 返回；**Runloop 不提供 pause/resume**」。§2.1 的标注不用动。

---

## K · 错字与命名

| 位置 | 现状 | 改成 |
|---|---|---|
| Launch footer 按钮 | `Cancle` | `Cancel`（与 v1.2 §K 同一处） |
| 文件名 | `My Agent_Doploy success.png` | 界面里写 `Deploy` |
| 分类 pill | `Date & Analytics` | `Data & Analytics`（与 v1.2 §K 同一处） |

---

## 待定稿

§G1 / §G2 已确认**原型阶段不阻塞**，按设计稿做。剩下三条是设计稿本身没说清的：

1. §A2 chip 行 `Discord · Agent · AI · LLM` 的来源 —— 是 listing 的 tags，还是另一个字段？设计稿没说
2. §A7 `Related resources` 的两条链接对应 List an Agent 的 `Demo Video URL` / `Documentation Link`，但设计稿没画两者都为空时这张卡是否整块消失（只画了 §A8 的整个 tab 空态）
3. §B1 与 §E1 是两个不同的 Notice（一个讲用量计费、一个讲注册费），文案不同但结构一样 —— 确认是有意的两条，还是同一条的两次出图

---

## 实现记录（本轮）

按远端 v1.2 的做法：新增界面挂 `V2Badge`（默认可见），无后端的挂 `NoApiBadge`
（`?review=1` 才显示），既有控件一个不删。

| 节 | 落在哪 |
|---|---|
| A | `client/src/components/AgentDrawer.tsx`（新增）+ `Marketplace.tsx` 接线；`clawData.ts` 增量补 `chips` / `tagline` / `about` / `defaultModel` 四个可选字段与 `chipsFor` / `taglineFor` / `aboutFor` / `modelFor` / `isVerified` 派生函数 |
| B | `Dashboard.tsx`：`CostNotice` + `sessionStorage` 交接 + toast |
| C | `Dashboard.tsx` Launch 面板：`Add Model` 开关（包住既有 Model 段）、`Compute Tier` 选择卡、Create 前查余额 |
| D | `client/src/components/BillingDialogs.tsx`（新增），Launch 与 Register 两处共用 |
| E | `DeployWizard.tsx`：首次进入 Notice + Register 前查余额 |
| F | `Dashboard.tsx`：Publish Status 行菜单的 `View public listing` 改为开 §A 的抽屉（`mode="listing"`） |

### 与设计稿的三处偏离

1. **§C2 字段顺序未完全照搬。** 设计稿是 Template → Name → Region → Compute Tier →
   Add Model → Model → Env；远端已按 swagger 相关性排过一遍
   （Template → Add Model → IDC → Compute Tier → Name → Lifecycle → Env）。
   本轮**补齐了缺的两个控件**（`Add Model`、`Compute Tier`），**没有为了顺序去动
   远端已有的结构** —— 那些段落挂着 swagger 注解，重排的收益不抵风险。要不要对齐
   顺序，等设计确认。
2. **卡片点击保留了原路由作为回退。** §A1 说点卡片开抽屉，实现里普通点击开抽屉，
   `⌘`/`Ctrl` + 点击仍走 `/marketplace/{id}` —— 不想把"在新标签页打开"这个能力拿掉。
3. **§F 替掉了远端原本的兜底。** 远端 `onView` 原先是跳到 Marketplace 并 toast 说明
   「按 listing 深链要等 listing 带上已发布 id」。有了抽屉就不需要那个 URL 了，
   直接就地预览。

### §G 的两处，按原型口径处理

`Compute Tier`（§C3）和计费拦截三件套（§D）都**按设计稿做了**，各自挂 `NoApiBadge`
说明尚无端点。接后端时看 §G 表格。

---

## 2026-09-09 · Browse Agents 按新截图定稿

来源：`Agent Marketplace` 页顶部截图（hero 到分类行）。这一版把 v1.2 的两条待定稿
关掉了，并砍掉三块截图里没有的内容。

| # | 定的事 | 之前 |
|---|---|---|
| 1 | hero CTA = **`Agent Registration →`** | v1.2 README §A 取的是 `Register an Agent →`，本次推翻 |
| 2 | 分类行 = **`Recommended`（火苗）· 五个分类 · `All`**，整行装在一个浅色托盘里，激活项是深色药丸 | 代码里是 `["All", ...分类]`，没有 Recommended —— v1.2 README §A4 早就写了要有，代码一直没跟上，这次补齐 |
| 3 | 落地页默认停在 **Recommended**，不是 `All` | 之前默认 `All` |
| 4 | `Verified Only` = **方形勾选框**，靠右 | 之前是圆形勾 + 滑块开关的组合 |

### 砍掉的三块（截图里 hero 之后直接就是 AGENT MARKETPLACE）

- `Browse Agents` 大标题与其副文案
- **Coding Agent Plan 推广条**
- **OpenClaw 插件横幅**（含那条 `openclaw plugins install …` 命令与 `Not on OpenClaw? Register →`）

### 目录头右侧一并移除

- 搜索框 `Search Agents…`
- `Sort` 下拉（Featured / Trending / Most Used / Recently Updated / New）
- `+ Register an Agent` 按钮（hero 的 CTA 已经承担这件事）

**Sort 移除后的补偿**：排序不再是用户可选项，`Recommended` 这一档接管了策展顺序
（promoted 置顶，其后已认证优先）。其余分类维持源顺序。

### 导航改名

`Register & List` → **`Register Template`**（侧栏、顶栏页面标题、相关注释一并改）。

⚠️ **这三块是既有功能，不只是版式调整**：Coding Agent Plan 是商业化入口，OpenClaw
横幅是获客入口，搜索框在目录长起来之后是刚需。截图上没有就照做了，但如果只是这版
构图没画，需要说一声加回来。

---

## 2026-09-09 · Pause / Resume / Snapshot 排进 2.1

三者都**还没做**，界面一个不删，加挂 `2.1` 标识。

**新组件** `client/src/components/V21Badge.tsx`（含整块用的 `V21Note`）。

### 挂在哪

| 位置 | |
|---|---|
| Sandbox 详情头部按钮 | `Pause` · `Resume` · `Create Snapshot` |
| 实例行 `⋮` 菜单 | `Save as Snapshot`（running 与 suspended 两个分支） |
| My Agents 顶部 tab | `Snapshots` |
| Create Snapshot 弹窗标题 | |
| Organization Snapshots 页 | 标题 + 页顶一条 `V21Note` 整块说明 |

### 为什么默认可见，不跟 `NO API` 一起藏进 review 模式

`reviewMode.ts` 的原则是：**为我们自己写的注解**藏起来，**回答用户真实疑问的**留下。

- `NO API`（紫色虚线）= 「swagger 里有没有这个端点」—— 团队关心，操作者不关心 → 藏
- `R0/R1/IND` = 「计划在哪个 release」—— 同上 → 藏
- **`2.1`（琥珀）= 「这个按钮现在按下去不会发生任何事，2.1 才有」** —— 看原型的人**一定会**去点 Pause，这个答案该长在按钮上，而不是躺在文档里 → **留**

两者是**不同的陈述**，可以同时出现：`NO API` 是契约事实，`2.1` 是路线图决策。所以
`Pause` 上会同时看到 `2.1` 和（review 模式下的）`NO API`。

### 验证

`?review=0` 时 `NO API` 消失、`2.1` 仍在。

---

## 2026-09-09 · 直接读 swagger 后的生命周期更正

来源：`GET https://ce-tot.gmicloud-dev.com/api/v2/ec/openapi.yaml`（429 KB，直接读取，
非 Confluence 摘要）。以下五条都已改进代码。

### 1 · 「不限时间」是个不存在的承诺，已删除

> `timeout` … **省略或小于等于 0 时按 300 秒处理**

省略 `timeout` 不是「永不过期」，是**给你最短的 5 分钟**。原先的
`maxActive: "off"` → `No automatic limit` 把最短说成了无限。现在：

- 该选项从种子数据与文案里移除
- 没有到期时间可读时显示 **`Expiry unknown`**（琥珀），并在 tooltip 里说明省略 = 300 秒
- `durationLabel("off")` → `300 seconds (API default when timeout is omitted)`

### 2 · `/timeout` 是「从现在起重算」，不是「从创建起算的总时长」

> **以当前时间为基准**重设存活时长 … 仅 running 可设置，其余状态返回 409
> **调用方不能从自己的请求参数推出生效值，以响应里的 `new_end_at` 为准**

原实现设的是「从创建起算的新总量」并拒绝更早的值 —— 语义整个错了，而且违反了上面
第二句。现在：

- `Instance.endAt` 是**唯一权威到期时间**，由「后端」给出，前端只格式化
- `maxActive` 降级为「创建时请求了多久」，仅供展示 —— 一次 extend 之后它不再描述死期
- Extend 面板文案改为 **`minutes from now`**，并明说「**a smaller number brings it closer**」
- 非 running 调用直接拒绝并说明（对应 409）

### 3 · 延长会让访问令牌失效

> `sandbox_access_token` 的有效期与 sandbox 的生命周期一致。
> **延长 sandbox 存活时需重新调用 connect 接口获取新的令牌**

Extend 之后按 sandbox 标记 `tokenStale`，Terminal 上方给出提示：之前复制的令牌已失效，
重新连接即可取新的。toast 也带这句。

### 4 · `connect` 的 floor 语义得到确认

> 传 `timeout` 且大于 0 时顺带延长存活时间（**只延长不缩短**）
> 响应恒定返回落定后的权威到期时间 `end_at`

上一轮按「只抬下限」实现是对的，契约原文如此。

### 5 · 状态枚举收敛到六个

`SandboxControlState` = `provisioning · running · paused · checkpointing · updating · failed`

- 内部 `creating` 对外表达为 **`provisioning`**
- **`deleting` 不在枚举内** —— 删除受理后详情返回 404，该状态只出现在删除接口的受理响应里
- `paused` 仅由提供挂起能力的 IDC 返回

实现上新增 `controlState()` 把内部过渡态映射到这六个词，`statusLabel` 与 `statusDot`
都只读它 —— 同一个外部状态不可能在两个页面显示成两种说法或两种颜色。

---

## 给 Horst 的同步项

Confluence《bs-api Sandbox (Runloop)》最后修改 8/24，其中这句已与 swagger 不符：

> **没有**：pause/snapshots/actions、aliases、shell*（数据面）

实际 swagger 里 `/snapshots`、`/sandboxes/{id}/actions`、`/shell`、`/shell/connect`、
`/shell/control` **都存在**，`Create 仅允许 template_id/idc_name/timeout/env_vars/metadata`
也不再准确（还有 `snapshot_id`、`product`、`secure`、`egress_control`、`egress`）。
这句里现在只有 **pause/resume 不存在**仍然成立。

### 文件操作只有读写两个动作（2026-09-09 加）

数据面只给 `POST /files?path=` 和 `GET /files?path=`。对照同类产品：

| | 文件操作 | 目录列举 |
|---|---|---|
| E2B | read / write / **list** / watchDir / rename / remove / makeDir / exists | 有 |
| Daytona | **list_files** / upload / download / create_folder / delete / find-replace / set_permissions / move | 有 |
| Cloudflare | readFile / writeFile / exists / mkdir / deleteFile / renameFile / moveFile | 无 |
| Runloop | read / write / upload / download | 无 |
| **我们** | 读 / 写 | 无 |

**没有 list 不是问题** —— Runloop 和 Cloudflare 也没有，控制台用 Terminal 的 `ls`
顶，我们的 Filesystem 面板已经把这句写在界面上了。

**问题是我们连 Cloudflare 那一档都不到**：`exists` / `mkdir` / `delete` / `rename`
/ `move` 五个动作，没有 list 的两家都有，我们一个都没有。要不要往 bs-api 提，是产品
决定，不是前端的。

### 单文件大小上限

上传的「File too large」分支原本写着 **100 MB**，那个数字是原型自己编的，契约里没有。
已改成不提具体数字（`MOCK_OVERSIZE_MB` 只作为触发器，让被拒状态在原型里可达）。
**swagger 或后端如果有真实上限，告诉我，我把数字放回去。**

---

## 2026-09-09 · Register Template 页重构到 §E2 的分节版式

`DeployWizard.tsx` 之前是**编号步骤器**（1 Basics & Template → 2 Infrastructure →
3 Networking → 4 Env Variables → 5 Review & Register）加右侧 `Live Cost Estimate`
面板，且 2–4 折在一个 `Advanced settings` 折叠块里。本轮换成 §E2 / §E3 的版式。

| 位置 | 之前 | 现在 |
|---|---|---|
| 分节 | 5 个编号步骤，其中 3 个折在 `Advanced settings` 里 | 三张平铺卡片：`Basics & Template` / `Runtime` / `Public Access (Optional)`。Connect tab 是 `Basic` / `Model API Key (Optional)` / `Endpoint`（v1.2 §B3） |
| 完成态 | 无 | 分节标题后跟一枚绿勾（v1.2 §B2） |
| 右栏 | `Live Cost Estimate` + Tip + Cancel/Register | `Summary`（§E3 六行；Connect tab 换成 §B4 的五行，含 `POWERED BY GMI MODELS` 徽标） |
| 提交区 | 右栏底部 | 页面底部 sticky `ActionBar`，`Cancel` + `Register`／`Submit` |
| 离开确认 | 无，Cancel 直接跳走 | `LeaveRegistration`（v1.2 §B6） |

### 为什么把 Runtime 从 `Advanced settings` 里放出来

Image URL 是**必填**。把它折进一个副标题写着「using GMI defaults」的折叠块，
是 Register 按钮变成死路的直接原因 —— 用户看到禁用的按钮，而它要的字段在一个
看起来「已经有默认值、不用管」的抽屉里。禁用原因文案能救急，但正确做法是让
承载必填项的分节本身在屏幕上。`Advanced settings` 折叠块因此整个去掉。

原来那条禁用原因（`An image is required. Open Advanced settings → Infrastructure
→ Customize and set the Sandbox image.`）随之改成 `An image is required — add the
Image URL under Runtime.`，并从右栏搬到 sticky `ActionBar` 上，跟着按钮走。

### 单价去哪了

`Live Cost Estimate` 面板删掉了，$/hr 留在 Runtime 卡里 **Spec 选择卡的每一张**上
—— 定价由这个选择决定，数字贴在做选择的地方。§E1 的首次进入 Notice 和 §E4 的
余额拦截都没动。

### 一并清掉的死代码

`StepperRow` / `STEPS` / `CONNECT_STEPS` / `StepId`（步骤器）、`SectionHeader`
（编号圆角标）、`LiveCostPanel`、`RegisterPanel`、`SourceCard`、`StepInfrastructure`
（内容拆成 `RuntimeSection`）、`StepConnectReview`（Summary 栏就是 review）。
`maxLifetime` / `idleTimeout` / `dockerSource` 三个 state 只喂折叠启发式，一并去掉
—— lifecycle 本来就在 Launch 定，不在 Register 定。

`StepNetworking` / `StepEnvVars` 的折叠行保留：它们是**可选**的，折起来合理。
