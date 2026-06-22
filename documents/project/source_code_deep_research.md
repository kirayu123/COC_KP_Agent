# COC KP Agent 竞品与开源项目源码深度调研

调研日期：2026-06-16  
目标：把可拉取的类似项目尽量拉到本地，阅读源码后提炼可复用设计，避免重复造轮子，同时明确许可证与版权边界。

## 1. 本地源码储备

已拉取或局部下载到 `external/` 的项目如下：

| 项目 | 本地路径 | 来源 | 许可证识别 | 主要类型 | 对本项目价值 |
| --- | --- | --- | --- | --- | --- |
| CoC7-FoundryVTT | `external/CoC7-FoundryVTT` | https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT | GPL-3.0 | Foundry COC7 系统 | 角色/规则/VTT 交互参考，不能直接复制 |
| Investigator Wizard | `external/call-of-cthulhu-foundryvtt-investigator-wizard` | https://github.com/Miskatonic-Investigative-Society/call-of-cthulhu-foundryvtt-investigator-wizard | Foundry/Chaosium 限制 | Foundry 内容包 | 人物创建流程参考 |
| cthulhu-editor | `external/cthulhu-editor` | https://github.com/ecyrbe/cthulhu-editor | GPL-2.0 | Web 人物卡 | Schema、IndexedDB、导入导出参考 |
| Cocai | `external/Cocai` | https://github.com/StarsRail/Cocai | AGPL | AI COC 聊天/三栏 UI | UI 与线索管理参考，不能嵌入复制 |
| coc-keeper-runtime | `external/coc-keeper-runtime` | https://github.com/LLLin000/coc-keeper-runtime | MIT | AI Keeper runtime | 架构分层高度相关 |
| Chronicle-Keeper | `external/Chronicle-Keeper` | https://github.com/The-RavenKing/Chronicle-Keeper | MIT | Foundry AI co-DM | 多层记忆、命令式管理参考 |
| GameMasterAI | `external/GameMasterAI` | https://github.com/deckofdmthings/GameMasterAI | MIT 文件存在，package 标注 UNLICENSED | AI DM Web app | 摘要与存档思路参考 |
| AI-RPG-Engine | `external/AI-RPG-Engine` | https://github.com/l497996153/AI-RPG-Engine | MIT | 通用 AI RPG 引擎 | 模块化剧本、guardrail、结构化状态参考 |
| coc-dice-bot | `external/coc-dice-bot` | https://github.com/Asurazpr/coc-dice-bot | unknown | Discord COC 骰子 | COC7 判定透明度参考 |
| cthulhu-roller | `external/cthulhu-roller` | https://gitlab.com/mtczekajlo/cthulhu-roller | MIT | Discord COC 骰子 | 成功等级、幸运花费、对抗排序参考 |
| dorian | `external/dorian` | https://github.com/thomcuddihy/dorian | MIT | 简单 Discord 骰子 | 最小判定实现参考 |
| cthulhu_bot | `external/cthulhu_bot` | https://github.com/caphosra/cthulhu_bot | unknown | Discord 骰子/角色卡 | 多规则族与对抗检定参考 |
| callofcthulhubot | `external/callofcthulhubot` | https://github.com/mortified-hugo/callofcthulhubot | MIT | Discord helper | 资料型 bot 参考，内容需谨慎 |
| cthulhu | `external/cthulhu` | https://github.com/olemak/cthulhu | unknown | React 人物创建 | 早期人物卡 UI 参考 |
| fvtt-CoC7-amnesia | `external/fvtt-CoC7-amnesia` | https://github.com/JamesAlday/fvtt-CoC7-amnesia | MIT | Foundry 模块 | 隐藏技能/逐步揭示机制参考 |
| Call_of_Cthulhu_7e_NPC | `external/Call_of_Cthulhu_7e_NPC` | https://github.com/JamesAlday/Call_of_Cthulhu_7e_NPC | unknown | Roll20 NPC sheet | NPC 表单和 roll template 参考 |
| achtung-cthulhu-coc7 | `external/achtung-cthulhu-coc7` | https://github.com/zedafty/achtung-cthulhu-coc7 | unknown | Roll20 sheet | 大型 sheet worker、技能列表、公式校验参考 |
| Roll20 CoC sheet | `external/roll20-character-sheets/Call_of_Cthulhu_7th_Ed` | https://github.com/Roll20/roll20-character-sheets | unknown | Roll20 sheet | 官方生态内表单/掷骰模板参考 |

说明：Roll20 大仓库完整 clone 失败，已通过 GitHub API/Raw 文件局部下载 `Call_of_Cthulhu_7th_Ed` 目录的关键 HTML/CSS/JSON 文件。

## 2. 总体判断

不建议重复建设完整 VTT、纯人物卡编辑器或全自动 AI 主持。现有生态已经覆盖地图、token、光照、完整角色卡、Discord 骰子等能力。本项目最有价值的定位仍然是 **KP Copilot / Keeper Screen**：把模组理解、跑团历史、线索状态、人物状态、规则判定和可追溯 AI 建议整合成一个由 KP 确认的控制台。

最值得吸收的四条主线：

1. **规则引擎要确定、透明、可审计**：骰子候选值、奖励/惩罚骰、成功等级、对抗排序、幸运花费都应作为结构化结果保存。
2. **记忆系统要分层**：短期上下文、场次摘要、长期事实、实体状态、语义检索、来源引用分开管理。
3. **模组/场景要结构化**：Scene、NPC、Clue、Trigger、RevealGate、ProgressClock 应成为一等对象，而不是只把模组当长文本。
4. **AI 只做建议，不直接改正式状态**：所有剧情推进、线索揭示、NPC 状态、角色状态都必须经过 KP 确认。

## 3. 项目逐个深调

### 3.1 CoC7-FoundryVTT

重点阅读：

- `coc7/apps/dice-pool.js`
- `coc7/apps/san-check-card.js`
- `coc7/apps/actor-importer.js`
- `coc7/models/actor/character-system.js`
- `coc7/models/actor/document-class.js`

源码观察：

- `dice-pool.js` 是成熟的 COC7 掷骰池实现，包含 difficulty、successLevel、bonus/penalty dice、luck spent、malfunction、隐藏 roll data 等大量状态。
- `san-check-card.js` 把 SAN 检定做成完整交互流程，覆盖理智损失、疯狂发作、神话知识增长、免疫与怪物 SAN 数据。
- `actor-importer.js` 使用正则从原始文本导入 Actor，对 NPC/Creature 文本导入很有启发。
- `character-system.js` 中角色模型包含 characteristics、attribs、conditions、monetary、development、biography、sanityLossEvents、backstory 等维度。

可借鉴：

- 设计 `RollRequest` 与 `DiceResult` 时，保留完整候选骰、难度、成功等级、幸运消耗、异常标记。
- 设计 `SanityCheckFlow`，不要只做一个“扣 SAN”按钮，而是保存触发源、成功/失败损失、是否疯狂、后续状态。
- 做 NPC/怪物导入时，先从“半结构化文本解析”入手，而不是要求用户一开始填完整表单。

风险：

- GPL-3.0，且与 Foundry/Chaosium 授权边界强相关。只能作为行为参考，不能复制代码或内置受限内容。

### 3.2 cthulhu-editor

重点阅读：

- `src/types/index.ts`
- `src/constants/skills.ts`
- `src/db/db.ts`
- `src/pages/EditorPage.tsx`

源码观察：

- 使用 Zod 定义强 schema：Characteristic、Skill、Weapon、Identity、Trackers、Backstory、Wealth、InvestigatorData。
- Skill 用 discriminated union 区分 static、standard、custom，并带 `checked` 字段支持成长检查。
- `skills.ts` 中固定了 69 个技能槽位、基础值、派生值，如 `DEX/2`、`EDU`。
- 使用 Dexie/IndexedDB 本地保存人物卡与分类，编辑器有自动保存机制。

可借鉴：

- 我们应为调查员卡建立强 schema，并在导入时做 validation，不要直接让自由文本进入核心状态。
- 技能应有 canonical key、显示名、基础值、当前值、成长标记、别名/i18n。
- 人物卡导入支持 JSON/Markdown/PDF 解析后，应落到同一个标准数据模型。

风险：

- GPL-2.0，不适合复制代码进入闭源或商业产品。Schema 思想可借鉴，字段与实现应自建。

### 3.3 coc-dice-bot / cthulhu-roller / dorian / cthulhu_bot

重点阅读：

- `external/coc-dice-bot/cocbot/mechanics/checks.py`
- `external/coc-dice-bot/cocbot/mechanics/dice.py`
- `external/cthulhu-roller/src/roller/croll.rs`
- `external/cthulhu-roller/src/roller/success_level.rs`
- `external/dorian/dorian.py`
- `external/cthulhu_bot/src/commands/skill.rs`
- `external/cthulhu_bot/src/commands/opposed.rs`

源码观察：

- `coc-dice-bot` 保留奖励/惩罚骰的所有候选十位骰、个位骰、最终选择值，适合审计和展示。
- `cthulhu-roller` 的 `SuccessLevel` 有 rank、threshold、delta 逻辑，适合计算“花费多少幸运能提升成功等级”。
- `dorian.py` 是极简实现：解析 `b/p/t`，一次 d100，按 regular/hard/extreme/critical/fumble 输出。
- `cthulhu_bot` 同时支持 CoC6、CoC7、Delta Green、BRP 2023，并实现了 CoC7 对抗检定排序。

可借鉴：

- 规则引擎第一版应实现：
  - d100 普通检定
  - 奖励/惩罚骰，且记录候选值
  - regular/hard/extreme/critical/fumble
  - opposed roll
  - luck spending delta
  - 规则族预留：CoC7 优先，CoC6/DG/BRP 后续扩展
- 输出结构建议：

```ts
type PercentileRollResult = {
  roll: number;
  ones: number;
  tensCandidates: number[];
  selectedTens: number;
  target: number;
  difficulty: "regular" | "hard" | "extreme";
  successLevel: "fumble" | "failure" | "regular" | "hard" | "extreme" | "critical";
  successRank: number;
  luckToRegular?: number;
  luckToHard?: number;
  luckToExtreme?: number;
  ruleSet: "coc7";
};
```

风险：

- 多个骰子项目许可证不同；MIT 项目可参考更深，但仍建议自建实现。未知许可证项目只读设计，不复制实现。

### 3.4 coc-keeper-runtime

重点阅读：

- `src/dm_bot/adventure/models.py`
- `src/dm_bot/trigger/models.py`
- `src/dm_bot/trigger/engine.py`
- `src/dm_bot/reveal/models.py`
- `src/dm_bot/scene/round.py`
- `src/dm_bot/rules/dice.py`
- `src/dm_bot/store/db.py`

源码观察：

- `Adventure`、`Scene`、`Clue`、`NPC`、`TriggerRef`、`BlockerRef` 已经接近我们需要的结构化模组模型。
- Trigger 系统包含 `TriggerEvent`、`Reaction`、`Trigger`、`TriggerChain`、`AuditEntry`，能记录触发链与审计。
- Reveal 系统用 `RevealGate` 与 `KnowledgeState` 管理线索是否对玩家开放。
- Round 系统有 `WAITING / COLLECTING / RESOLVING / NARRATING` 状态，并按 DEX 排序解析行动。
- SQLite schema 包含 sessions、characters、blockers、trigger_chains、audit_entries、reveal_gates。

可借鉴：

- 这是与本项目架构最接近的仓库。建议吸收模块边界：
  - `adventure`：模组、场景、线索、NPC
  - `trigger`：触发条件、反应、审计
  - `reveal`：玩家已知/未知状态
  - `rules`：确定性规则
  - `store`：SQLite 持久化
  - `surface`：UI/Discord/CLI 适配层
- 我们应加入 `AuditEntry`，记录“AI 建议、KP 是否采纳、采纳后改了哪些状态”。

风险：

- 源码中部分中文/文档有编码问题，规则内容也可能混有版权敏感文本。建议只借架构，不直接导入内容。

### 3.5 Chronicle-Keeper

重点阅读：

- `scripts/memory/memory-manager.js`
- `scripts/memory/vector-store.js`
- `scripts/chat/commands.js`
- `scripts/game-mechanics/skill-checks.js`

源码观察：

- 记忆系统分为 ShortTermMemory、LongTermMemory、EntityMemory、VectorStore、Summarizer。
- `getContext()` 组合短期消息、长期记忆、实体、语义检索与 session summary。
- `vector-store.js` 支持 Ollama embedding，不可用时退化为关键词搜索。
- 命令系统提供 `/memory search/save/clear/browse/export/stats` 等手工管理能力。

可借鉴：

- 本项目记忆架构应分层，并允许 KP 手工保存、搜索、编辑、删除记忆。
- 语义检索要有降级策略：没有 embedding 服务时可用 SQLite FTS/关键词检索。
- “AI co-DM”定位比“AI DM”更适合本项目。

风险：

- Foundry/D&D 背景较强；规则逻辑不能直接迁移到 COC，但记忆架构可用。

### 3.6 AI-RPG-Engine

重点阅读：

- `backend/engine/memory.py`
- `backend/main.py`
- `backend/tools.json`
- `backend/modules/*/module.json`
- `backend/modules/*/prompts.md`

源码观察：

- 采用模块目录：`module.json + content.md + prompts.md`，让不同 TRPG/视觉小说通过 schema 驱动。
- `SessionMemoryStore` 有 timeline 与 entity_index，并能按实体召回最近记忆。
- AI 输出中包含 `[NARRATIVE]`、`[OPTIONS]`、`[STATE]`，guardrail 返回 `PASS / ROLL_REQUIRED / REJECT`。
- `tools.json` 提供结构化 tool calling：保存/检索记忆。

可借鉴：

- Demo 模组可以采用类似结构：

```text
modules/rainy_archive/
  module.json      # 元信息、系统、schema
  content.md       # 模组正文
  prompts.md       # KP 建议提示词、guardrail
  scenes/*.md      # 可选，结构化场景
```

- AI 输出必须区分叙事建议、可选行动、待确认状态变化。
- `ROLL_REQUIRED` 很适合用于“玩家行动需要检定”的 guardrail。

风险：

- 示例模块可能含版权内容，不能作为我们的默认内置模块。结构可用，内容自制。

### 3.7 Cocai

重点阅读：

- `src/game_state/data_models.py`
- `src/agentic_tools/roll_dices.py`
- `src/async_panes/history.py`
- `public/play.js`

源码观察：

- GameState 包含 phase、history、clues、illustration_url、pc。
- Clue 用 id/title/content/found_at 管理。
- 三栏 UI：左侧 history/clues，中间插图 + chat，右侧 PC stats + skill buttons。
- history 更新前会让 LLM 判断最新对话是否实质推进剧情，再摘要写入历史。

可借鉴：

- Demo UI 建议采用三栏结构：
  - 左：时间线、线索、NPC、地点
  - 中：当前场景、玩家行动输入、跑团日志
  - 右：AI 建议、规则判定、人物状态
- 线索应该是结构化卡片，支持 found_at、相关 NPC/地点、是否已展示给玩家。
- “是否值得写入长期历史”可以作为 AI 辅助判断，但最终由 KP 确认。

风险：

- AGPL，不建议复制实现。产品定位偏 AI 主持，不应照搬。

### 3.8 GameMasterAI

重点阅读：

- `server/models/GameState.js`
- `client/gamemasterai/src/components/ChatRoom.vue`
- `client/gamemasterai/src/components/NotePanel.vue`
- `server/openai-api.js`

源码观察：

- GameState 保存 gameSetup、conversation、summaryConversation、summary、token 计数、systemMessageContentDM。
- ChatRoom 每隔固定消息数生成摘要，并把摘要作为 system reminder 放回上下文。
- NotePanel 允许用户手动编辑摘要。
- OpenAI API 调用较旧，代码质量不适合作为实现参考。

可借鉴：

- “AI Notetaker”比“AI 主持”更贴近真实 KP 刚需。
- 摘要必须可编辑，因为 AI 摘要一旦错了会污染长期上下文。
- 保存 conversation 与 summaryConversation 分离是可取的。

风险：

- package 中标注 UNLICENSED，虽有 LICENSE 文件但需进一步确认。代码老旧，不建议复用。

### 3.9 Roll20 / Achtung Cthulhu / NPC Sheet

重点阅读：

- `external/roll20-character-sheets/Call_of_Cthulhu_7th_Ed/coc_7th_ed.html`
- `external/achtung-cthulhu-coc7/src/3-worker.js`
- `external/Call_of_Cthulhu_7e_NPC/coc_7e_npc.html`

源码观察：

- Roll20 sheet 大量使用 roll template，预先计算 success、hard、extreme，支持 SAN、Luck、Insanity、技能、武器等表单。
- Achtung 的 sheet worker 有公式校验、奖励/惩罚骰切换、Whisper GM、chat name、技能默认值、技能点统计。
- NPC sheet 重点是简化 Keeper 创建与掷骰，而不是完整玩家人物卡。

可借鉴：

- KP 控制台需要“快速 NPC 卡”，字段比调查员卡少，但要能立刻发起技能/攻击/SAN 相关检定。
- 技能点、公式、伤害、射程等输入必须校验，不能完全自由文本。
- Whisper/私密信息机制可以转化为“仅 KP 可见 / 玩家已展示”状态。

风险：

- Roll20 sheet 大多未知或平台相关许可证。只看交互，不复制模板。

### 3.10 fvtt-CoC7-amnesia

重点阅读：

- `scripts/amnesia.js`
- `scripts/handleSkillClick.js`
- `scripts/getBaseSkillValue.js`
- `scripts/baseSkills.js`

源码观察：

- 模块把真实技能值隐藏在 Dhole's House JSON 中，玩家点击/掷骰时再揭示。
- `getBaseSkillValue` 处理 Cthulhu Mythos、Dodge、Drive、Fighting、Firearms、Language、Science 等特殊基础值。
- 揭示时会通知 GM 与角色拥有者。

可借鉴：

- 本项目可以支持“信息遮罩”：技能、身份、记忆、线索、NPC 动机不必一开始全部对玩家可见。
- Demo 中可以实现线索/状态的 `keeper_only / revealed / player_visible` 三态。
- Dhole's House JSON 是值得优先兼容的人物卡导入格式。

风险：

- Foundry 依赖强；实现可参考，但 UI/平台逻辑需自建。

## 4. 对本项目架构的修订建议

### 4.1 核心模块

建议 Demo 架构分为：

- `campaign`：团、场次、日志、摘要
- `character`：调查员、NPC、怪物、状态
- `adventure`：模组、场景、地点、线索、handout
- `rules`：COC7 检定、SAN、对抗、成长、伤害
- `memory`：短期上下文、长期事实、实体状态、语义检索
- `assistant`：AI 建议、guardrail、来源引用、待确认状态变更
- `audit`：KP 采纳记录、状态变更记录、骰子记录
- `resource`：本地 Markdown/PDF 资源索引

### 4.2 数据对象补充

在现有需求文档对象之外，建议新增：

- `SceneState`：当前场景进度、可见线索、隐藏线索、活跃 NPC、压力源。
- `RevealGate`：线索/handout/真相的开放条件，如 skill_check、scene_state、manual。
- `Trigger`：玩家行动、时间推进、检定结果触发的反应。
- `AuditEntry`：谁在何时基于什么来源改了什么状态。
- `AssistantSuggestion`：AI 建议本身，带 confidence、sources、risk_flags、proposed_changes。
- `EntityMemory`：NPC/地点/物品/组织/线索的长期事实。

### 4.3 Demo 最小闭环

最小闭环不应追求“完整 COC 工具箱”，而应证明差异化价值：

1. 导入/创建 2 名调查员。
2. 导入自制短模组，结构化出 3 个场景、3 个 NPC、5 条线索、2 个 handout。
3. KP 输入玩家行动。
4. 系统返回：
   - 当前可推进剧情
   - 建议检定
   - 可能揭示线索
   - NPC 反应
   - 来源引用
   - 待确认状态变更
5. KP 点选采纳/编辑/拒绝。
6. 系统写入日志、更新线索状态、生成下一轮上下文。
7. 检定工具返回透明骰子结果，并可把结果关联到日志。

## 5. 明确不做或后做

第一版不要做：

- 完整 VTT 地图、光照、token 移动。
- 完整商业规则书内容内置。
- 官方或第三方商业模组内置。
- AI 自动替 KP 修改正式团状态。
- 完整人物创建向导。
- 多人实时联机。

第二阶段再考虑：

- Foundry/Roll20 导入导出。
- Dhole's House JSON 完整兼容。
- handout 模板生成器。
- Discord/QQ/KOOK bot 适配。
- 语音转写与自动日志。
- 本地模型/Ollama 支持。

## 6. 许可证与版权边界

可更深入借鉴的 MIT 项目：

- `coc-keeper-runtime`
- `Chronicle-Keeper`
- `cthulhu-roller`
- `dorian`
- `AI-RPG-Engine`
- `fvtt-CoC7-amnesia`

只建议观察、不复制的项目：

- `CoC7-FoundryVTT`：GPL-3.0 与平台/版权限制。
- `cthulhu-editor`：GPL-2.0。
- `Cocai`：AGPL。
- Roll20 sheets：许可证/平台约束不明确。
- unknown license 项目：只做产品和架构参考。

内容边界：

- 不内置商业模组正文。
- 不随产品分发用户的规则书全文 Markdown。
- 用户本地导入的 PDF/Markdown 只做本地索引与个人使用。
- AI 输出应引用来源路径或片段位置，但避免生成大段规则书或模组原文。

## 7. 最终结论

这个项目不但可行，而且已有开源生态证明各个部件都能单独成立：规则判定、人物卡、AI 记忆、模组结构化、VTT 交互都有现成参考。真正的产品机会不在“再做一个 COC 工具”，而在把这些能力收束成 **KP 临场决策系统**。

推荐路线：

1. 先做本地优先 Web/桌面 Demo。
2. 规则引擎自建，参考骰子项目的透明结果结构。
3. 人物卡 schema 自建，兼容 JSON/Markdown/Dhole's House。
4. 模组使用自制内容验证结构化导入。
5. RAG 接入已整理的高优先级资料和用户本地规则书。
6. AI 输出永远是“建议 + 来源 + 待确认变更”，不越权成为主持人。
