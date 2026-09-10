# 来源

本目录是**原样复制**，不是本仓库编写的内容。

| | |
|---|---|
| 上游 | https://github.com/magnus919/agent-skills — `product-design-and-ux/` |
| 许可 | MIT（上游仓库） |
| 取用日期 | 2026-09-09 |
| 取用方式 | `raw.githubusercontent.com/magnus919/agent-skills/main/product-design-and-ux/…` |

## 装了什么

- `SKILL.md`
- `references/` 10 篇
- `templates/` 6 个

`evals/evals.json`（上游的技能评测集）**没装** —— 那是给技能作者验证技能本身用的，
不参与我们的日常工作。

`SKILL.md` 内部引用的 16 个相对路径已逐一核对，全部能在本地解析。

## 未安装的兄弟技能

`SKILL.md` 的路由段会把四类工作转出去，这四个技能上游都有，但**本仓库没装**：

| 转出目标 | 什么时候会撞上 |
|---|---|
| `product-discovery` | 需要用户证据、访谈、需求发现时 |
| `product-methodology` | 优先级排序、取舍决策时 |
| `web-accessibility` | WCAG / ARIA 深度合规工作 |
| `spec-driven-development` | 要写正式软件规格时 |

撞上时要么按需再装，要么按 `SKILL.md` 的原意把那部分工作显式交给人。
**没装不等于可以跳过** —— 尤其 `web-accessibility`，我们当前的无障碍缺口不小。

## 更新

上游有更新时重新拉一遍即可，本目录不做本地修改；真要改，先在这里记下改了什么、
为什么，否则下次更新会被悄悄覆盖掉。
