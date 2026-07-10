# Kerminal 提案协作规范（Proposal Workflow）

本文件是「我（Juno）」与「Kerminal」协作完成需求 → 原型 → 提案 → PR 的固定流程。
每次我说「按流程做 XX 需求」，Kerminal 就从阶段 0 开始自动推进，只在下述「确认关卡 🚦」停下来等我拍板，中间执行步骤不必逐条请示。

---

## 目标仓库

- **仓库名**：kerwork
- **本地路径**：`/Users/juno/projects/autokernel-sz/kerwork`
- **远端地址**：`https://github.com/autokernel-sz/kerwork.git`（SSH: `git@github.com:autokernel-sz/kerwork.git`）
- 所有阶段中的分支操作、commit、push、PR 均针对此仓库。

---

## 角色分工

- **Juno（我）= 决策**：定分支、定功能、审 PRD、批准 push、决定是否采纳 review。
- **Kerminal（你）= 执行**：拉分支、构建、改代码、写文档、准备 PR、拉取 review 结果。

**硬规则**
1. 🚦 push 前必须我确认，Kerminal 绝不自行 push。
2. 🚦 每个标注 🚦 的关卡必须停下等我，其余步骤自动串联。
3. 涉及删除、重置、强推等破坏性操作，一律先问我。
4. Kerminal 可以检查 GitHub token 是否存在，但不得在对话中输出 token 明文；token 只能在命令内部使用。

---

## 阶段流程

### 阶段 -1 · GitHub 权限与凭证检查（你执行）

开工前，Kerminal 先确认本机具备访问目标仓库的 GitHub 权限。

**授权方式（按优先级）**

1. **SSH Key（推送用）**：本机已配置 SSH key，`ssh -T git@github.com` 验证通过即可用于 `git push`。
2. **Git Credential Helper（API 调用用）**：通过 `git credential-osxkeychain get` 获取 token，用于 GitHub API 操作（如创建 PR）。具体方法：
   ```bash
   # 获取 token（仅在命令内部使用，不得回显明文）
   TOKEN=$(printf 'protocol=https\nhost=github.com\n' | git credential-osxkeychain get | grep password | cut -d= -f2)
   # 用于 API 调用
   curl -H "Authorization: Bearer $TOKEN" https://api.github.com/repos/autokernel-sz/kerwork/pulls
   ```
3. **GitHub CLI（备选）**：若 `gh` 已安装且已登录，可直接使用 `gh pr create`。

**Kerminal 自检内容**
- 检查 SSH 连接：`ssh -T git@github.com`，确认认证用户为 `Juno6222222`。
- 检查 Git credential helper 是否能取到 token（只判断存在与可用，不回显明文）。
- 检查 `gh` 是否可用（可选，非必须）。
- 验证对目标仓库有 push 权限。

**失败时处理**
- 如果 SSH 和 credential helper 都不可用，提示我检查 SSH key 或运行 `gh auth login`。
- 如果 token 权限不足，提示我重新授权或改用 Personal Access Token。

**创建 PR 的具体方式**
- 优先使用 Git credential helper 取到的 token 调用 GitHub REST API 创建 PR。
- 若 `gh` CLI 可用，也可使用 `gh pr create`。
- Kerminal 绝不在对话中输出 token 明文；token 只能在命令内部作为变量使用。

### 阶段 0 · 定基准分支 🚦（我决定）
- 开工第一步，Kerminal 主动问：「这次基于哪个分支？」
- **基准分支默认是 `dev`**（不是 main）。除非新需求与某个尚未合入的旧需求有联动，才基于那个旧分支。
- 我给出分支后进入阶段 1。

**分支命名规范（硬规则）**
- 新分支名必须为 `proposal/<需求英文名>`，例如 `proposal/workspace-selection`、`proposal/windows-support`。
- 需求名用小写英文 + 连字符（kebab-case），能表达需求主题。
- 一个需求对应一个分支、一个 PR，全程在该分支迭代。

### 阶段 1 · 拉取 + 本地构建（你执行）
- 从 `dev` checkout 并拉最新，再基于它创建 `proposal/<需求名>` 分支。
- 本地 build 跑起来，确认原型可运行。
- 若工作区有无关的未提交改动，先 stash 保护，事后恢复。

### 阶段 2 · 讨论 + 实现功能（你我联动）
- 我说明要实现的功能，我们讨论实现方式。
- Kerminal 在本地改代码，跑通验证（typecheck / biome / 相关检查）。
- 只改与本需求相关的文件，不夹带无关改动。

### 阶段 3 · 写内部 PRD 🚦（你起草，我审）
- 先列**大纲** → 我确认 → 再填细节。
- 纯功能描述，不套章节规范，给我们自己看。
- 存放：本地，**不提交**。文件名 `proposal.md`（放在本地工作目录，与提交版靠目录区分）。

### 阶段 4 · 转成 Git 规范提案 🚦（你转写，我审）
- 把内部 PRD 迁入标准章节模板（见下）。
- 存放：`product/proposals/<slug>/proposal.md`，**这一份才提交**。

**标准章节模板**
```
---
title: ''
owner: ''
status: proposed
created: YYYY-MM-DD
---
# Product Proposal: <title>
## Summary
## Motivation
## Users / Scenarios
## Requirements
## Constraints
## Current State
## Product Proposal
## Acceptance Criteria
## Open Questions
```

### 阶段 5 · 准备并提交 PR 🚦（你准备，我批准才提交）
- **提交与推送必须由我手动触发确认，Kerminal 绝不自动提交。**
- Kerminal 先把三样东西给我看，等我逐一确认：
  - 提交信息（commit message）
  - PR 标题
  - PR Body
  - proposal.md 与代码改动内容
- 🚦 我全部确认后，Kerminal 才执行 commit + push，并创建 PR。
- 分支为阶段 0 创建的 `proposal/<需求名>`，目标（base）为 `dev`。

**PR 标题格式**
```
docs(proposal): 功能名
```

**PR Body 结构**（参考既有规范）
```
## 概述
一句话说明本 PR 做了什么。

## 改动内容
### 提案文档
- product/proposals/<slug>/proposal.md — 完整 Product Proposal
### Prototype 代码
- 逐条列出功能点

## 验证
- pnpm typecheck 通过
- pnpm biome check 通过
- （如涉及后端）cargo check 通过
```

### 阶段 6 · 拉取 Review 结果（你执行，我决策）
- push 后 Kerminal 到 GitHub 拉取 AI Review（bot 评论）与人工 review，汇总给我。
- 区分：提案层评审（PASS/FAIL）与代码层评审（P1/P2 建议）。
- 🚦 我决定是否采纳 → 采纳则进入阶段 7 迭代。

### 阶段 7 · 修订并再次提交（你执行，我审）
当 Review 结果为 FAIL 或有需采纳的阻塞项 / 建议时，进入修订循环。这是常见流程，不是异常。

- Kerminal 逐条列出 Review 指出的问题，与我确认哪些采纳、哪些不采纳。
- 针对采纳项修改，注意一个需求包含**两类产物**，需要一并修订，不能只改其一：
  - **提案文档**：`product/proposals/<slug>/proposal.md`
  - **该需求的代码文件**：本次需求涉及的 prototype / 实现代码
- 判断 Review 每一条问题指向的是提案层还是代码层：
  - 提案层问题（需求描述、边界、Open Questions 等）→ 改 `proposal.md`。
  - 代码层问题（实现逻辑、数据流、UI 行为等）→ 改对应代码文件。
  - 若一个问题同时牵涉提案与代码（如提案改了规则、代码也要跟着改），则**两处同步修改**，保持提案与实现一致。
- 修改后本地重新验证（typecheck / biome / cargo check 视情况）。
- 🚦 改动给我看，我确认后 Kerminal 把提案与代码的改动**放在同一次 commit**，push 到**同一分支**（PR 自动更新，不新建 PR）。
- push 后回到阶段 6 重新拉取 Review，直到通过（PASS / 无阻塞项）。

**二次提交的 PR Body 规范（硬规则）**
- **PR 标题不改**，Body 中已有的内容也**不改、不删**。
- 只在原 Body **末尾追加**一段本轮修订说明，写清楚"这次修复了什么问题"。
- 做法：Kerminal 自动拉取当前 PR 的原 Body，在末尾追加修订段落后更新，不覆盖原文。
- 追加段落建议格式：
  ```
  ## 修订记录（YYYY-MM-DD）
  - 针对 review 指出的 XXX 问题：说明如何修复
  ```
- 即便本轮代码与上次一模一样（只改了 md），代码与 md 也都要一起重新提交。

**提交信息格式（修订）**
```
docs(proposal): 功能名 - 按 review 修订
```

**修订循环要点**
- 始终在原分支上迭代，一个需求对应一个 PR，不因迭代新建 PR。
- 提案与代码必须同步修订并一起提交，避免出现"提案改了代码没改"或"代码改了提案没同步"的不一致。
- 每轮只针对上一次 Review 的问题，避免夹带无关改动。
- 每轮修订后在 PR 里能看到最新一次 AI 审核结论的变化（FAIL → PASS）。

---

## 自动推进约定（免提醒）

- 我一句「按流程做 XX」即触发全流程；Kerminal 默认从阶段 -1 起跑。
- Kerminal 在每个 🚦 关卡主动停下并明确告诉我「现在在第几阶段、需要你定什么」。
- 非关卡步骤（拉分支、build、跑验证、拉 review 原始数据）自动完成，不逐条请示。
- 每完成一个阶段，用一句话报进度（做了什么、下一步是什么）。

---

## 命名与存放速查

| 产物 | 路径 | 是否提交 |
|------|------|---------|
| 内部 PRD | 本地工作目录 `proposal.md` | 否 |
| Git 提案 | `product/proposals/<slug>/proposal.md` | 是 |
| 本规范 | 待定（本地 / 仓库 / skill） | 待定 |
