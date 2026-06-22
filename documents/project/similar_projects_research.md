# 类似项目调研：COC KP Agent

调研日期：2026-06-16

## 1. 调研目的

本调研用于避免 COC KP Agent 重复造轮子，并从现有开源项目、VTT 平台、角色卡工具、骰子机器人、AI GM 工具和通用跑团管理平台中提炼可借鉴能力。

结论先行：

- **不要重做 VTT**：Foundry、Roll20 已经覆盖地图、token、光照、线上桌面等能力。
- **不要重做纯人物卡工具**：已有 Arkham Registry、Dhole's House、Roll20/Foundry sheet。
- **要做差异化的 KP Copilot**：聚焦“模组理解 + 跑团状态记忆 + 线索追踪 + 规则判定 + 可追溯 AI 建议”。
- **规则引擎可借鉴骰子机器人和 VTT 系统设计，但不要直接复制受限代码或版权内容**。
- **AI 层应学习现有 AI GM 项目的多层记忆和 co-DM 设计，但保持 KP 最终裁决。**

## 2. 项目分类总览

| 类别 | 代表项目 | 对本项目价值 | 是否建议复用 |
| --- | --- | --- | --- |
| COC VTT 系统 | CoC7 FoundryVTT、Roll20 CoC sheet | 角色卡、规则、roll request、compendium、VTT 交互 | 借鉴模型与交互，不直接复制受限代码 |
| COC 人物卡工具 | Arkham Registry、Dhole's House、PrismCthulhu | 人物卡字段、导入导出、自动计算、打印 | 借鉴字段和 UX，优先自建兼容 schema |
| COC 骰子/规则机器人 | coc-dice-bot、Dorian、Cthulhu Roller、cthulhu_bot | 检定、奖励骰/惩罚骰、成功等级、透明展示 | 可借鉴设计；MIT 项目可谨慎参考 |
| AI GM / AI Keeper | CoCai、coc-keeper-runtime、Chronicle Keeper、GameMasterAI | 多层记忆、局势总结、AI narration、RAG | 借鉴架构，避免“自动主持”定位 |
| 通用跑团管理 | Kanka、LegendKeeper、World Anvil、Obsidian TTRPG 插件 | wiki、地图、时间线、NPC、线索、关系图 | 借鉴信息架构和资料组织 |

## 3. COC 专用 VTT 与规则系统

### 3.1 CoC7 FoundryVTT

地址：https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT

定位：Foundry VTT 的非官方 COC 7th 系统实现。

值得借鉴：

- 角色卡、NPC、Creature 的 actor 数据模型。
- Skills、Weapons、Roll Requests compendium 的组织方式。
- Roll Requests 作为“KP 发起检定请求”的交互模式。
- Foundry 世界中 actor、item、journal、compendium 的分层。
- 对版权边界的处理：项目声明不包含官方书籍内容，用户需手动输入武器、技能、物品等。

风险与限制：

- GPL-3.0。
- README 中明确有 Chaosium/Foundry 平台相关授权边界：允许在 Foundry VTT 平台上派生使用，不授予商业使用权，不允许脱离 Foundry 平台复制分发。
- 不适合直接把代码或内容搬进独立 App。

对 COC KP Agent 的启发：

- 设计 `Actor` 抽象：Investigator / NPC / Creature 统一建模。
- 设计 `RollRequest`：KP 可以一键要求玩家做某技能检定。
- 设计 `Compendium`：技能、武器、怪物、典籍、人物等统一归档。
- 未来可以做 Foundry 导入/导出或模块联动，而不是替代 Foundry。

来源：GitHub README 显示其提供 examples、skills、weapons、roll requests compendium，并声明不包含官方书籍材料；许可证和 Chaosium 权限限制见仓库 README。

### 3.2 Foundry Investigator Wizard

地址：https://github.com/Miskatonic-Investigative-Society/call-of-cthulhu-foundryvtt-investigator-wizard

定位：Foundry CoC7 系统的人物创建辅助包，提供 archetypes、occupations、setups、skills。

值得借鉴：

- 人物创建流程可拆成 archetype、occupation、setup、skill allocation。
- 新手创建人物卡时需要“向导式流程”，而不是直接丢一整张表。
- 可作为后续 Character Wizard 的参考。

风险与限制：

- 明确受 Foundry VTT 模块开发协议和 Chaosium Fan Material Policy 约束。
- 声明禁止收费访问相关内容。

对本项目建议：

- demo 阶段先做人物卡导入/编辑，不急着做人设创建向导。
- 后续做向导时，只实现结构和流程，不内置未经授权职业/规则全文。

## 4. 人物卡与调查员管理工具

### 4.1 Arkham Registry / cthulhu-editor

地址：https://github.com/ecyrbe/cthulhu-editor

定位：现代 Web 版 COC 7th 人物卡编辑器。

功能亮点：

- 多调查员 Registry。
- 浏览器本地 IndexedDB 持久化。
- HP / SAN / Luck / MP tracker。
- 武器与战斗管理。
- 多语言。
- JSON 导入导出。
- 打印友好。
- Aide Memoire 快速规则参考。

风险与限制：

- GPL-2.0，不适合直接复制进未来闭源/商业产品。
- 更偏人物卡，不处理模组、跑团历史和 AI 建议。

对本项目建议：

- 人物卡 MVP 可以借鉴它的字段覆盖和 JSON import/export 思路。
- 本项目应避免停留在“更大的角色卡编辑器”，要把人物卡接入控制台、规则判定和局势记忆。

### 4.2 Dhole's House

地址：https://www.dholeshouse.org/  
Chaosium 介绍：https://www.chaosium.com/blog/welcome-to-the-dholes-house-free-online-toolkit-for-call-of-cthulhu/

定位：COC 7th 免费在线工具包。

功能亮点：

- 快速创建 7th edition 调查员。
- 角色控制面板保存并更新调查员。
- 可搜索角色库，可作为 PC 或 NPC 使用。
- Keeper 工具包含 handout generator，例如电报、名片、报纸剪报、日历。

对本项目建议：

- 角色库和 NPC 库是刚需。
- “手牌生成器”很适合本项目第二阶段：报纸、档案、名片、信件、日历。
- demo 阶段可先支持 Markdown handout 和线索卡，不急着做完整视觉生成器。

### 4.3 Roll20 COC Character Sheet

地址：https://pages.roll20.net/call-of-cthulhu-character-sheet  
开源角色卡仓库：https://github.com/Roll20/roll20-character-sheets

功能亮点：

- 自动计算技能和百分比派生值。
- 职业模板。
- SAN / stability tracking。
- 武器装备与 inventory。
- handouts、关系追踪、线索网络、状态 token、progress clocks。

对本项目建议：

- Progress clocks 很适合 COC：警察介入、邪教仪式进度、NPC 怀疑度、倒计时。
- Handouts 是关键功能，不应只做文本日志。
- 本项目不做 VTT，但可以做“调查板”：线索、NPC、地点、关系、进度钟。

## 5. 骰子机器人与规则引擎

### 5.1 coc-dice-bot

地址：https://github.com/Asurazpr/coc-dice-bot

定位：Discord COC 7e 骰子机器人。

功能亮点：

- `/roll` 任意骰表达式。
- `/check` COC 7e 技能/目标检定。
- 奖励骰 / 惩罚骰。
- 透明候选骰展示。
- 成功等级：Fail、Success、Hard、Extreme、Critical、Fumble。
- SQLite schema 管理技能和分类。
- 语言无关 canonical skill keys、i18n 表、alias resolution。
- 设计目标强调规则正确性、透明机制、机制/UI/应用层分离。

对本项目建议：

- 规则引擎要独立成纯函数/服务，不和 UI 或 AI 耦合。
- 检定结果要透明展示，例如奖励/惩罚骰候选值。
- 技能要用 canonical key，不要直接用中文名作为主键。
- 预留 house rules：大成功/大失败范围、幸运消耗等。

### 5.2 Dorian

地址：https://github.com/thomcuddihy/dorian

定位：简单的 Discord COC 7e 骰子机器人。

功能亮点：

- d100 检定。
- 可选奖励骰/惩罚骰。
- 可选 threshold 判定成功等级。
- MIT 许可证。

对本项目建议：

- demo 的检定工具不必复杂，先把 d100、阈值、奖励/惩罚、成功等级做对。
- 复杂规则后续再扩展。

### 5.3 cthulhu_bot

地址：https://github.com/caphosra/cthulhu_bot

定位：非官方 Cthulhu TRPG Discord bot。

功能亮点：

- `/cs` 创建人物卡。
- `/op6`、`/op7` 对抗检定。
- `/sk6`、`/sk7` 技能检定。
- 支持 Delta Green、BRP 2023。
- README 明确提示 Chaosium 拥有版权。

对本项目建议：

- 规则引擎可以预留多规则族：CoC6、CoC7、Delta Green、BRP。
- 对抗检定是第一版后半段或第二版应补的能力。

## 6. AI GM / AI Keeper 项目

### 6.1 CoCai

地址：https://github.com/StarsRail/Cocai

定位：AI 驱动的 COC 聊天机器人。

功能亮点：

- Chainlit chat UI。
- Qdrant + mem0 做短期记忆。
- 可选 Stable Diffusion 生成插图。
- 实验性三栏界面：左侧 history 和 clues，中间插图 + chat，右侧 PC stats 和 skill buttons。
- AI Keeper 可以调用工具更新玩法界面。

风险与限制：

- AGPL-3.0，不适合直接嵌入闭源产品。
- 定位偏“AI 陪你玩 / AI Keeper”，与本项目“KP 副驾驶”不同。

对本项目建议：

- 三栏 UI 非常值得借鉴：历史/线索、主叙事、角色状态/技能按钮。
- Clues accordion 是线索管理的好交互。
- 插图生成可以作为后续增强，不是 MVP。

### 6.2 coc-keeper-runtime

地址：https://github.com/LLLin000/coc-keeper-runtime

定位：Discord-native local AI Keeper runtime。

功能亮点：

- 本地 AI Keeper。
- 结构化模组。
- COC rules。
- 长期调查员档案。
- 多人 campaign play。
- MIT 许可证。

对本项目建议：

- 值得进一步阅读源码，尤其是结构化模组、长期档案和 Discord 交互。
- 如果要做 Discord bot 版，可把它作为架构参考。
- 本项目桌面/网页控制台与 Discord runtime 可以形成互补，不必二选一。

### 6.3 Chronicle Keeper

地址：https://github.com/The-RavenKing/Chronicle-Keeper

定位：Foundry VTT 的 AI co-DM 模块，使用本地 Ollama。

功能亮点：

- AI co-DM，不是完全替代 DM。
- Auto-narration：根据技能检定结果生成叙事。
- Combat narrator：把“命中造成 X 伤害”转成描述。
- 多层记忆：
  - 短期：最近约 50 条消息。
  - 长期：重要剧情节点。
  - 实体：NPC、地点、阵营。
  - 语义搜索：可查询具体记忆。

对本项目建议：

- 本项目的记忆系统也应分层：短期上下文、长期事实、实体状态、语义检索。
- AI 最适合把规则结果转成叙事，而不是直接计算规则结果。
- 本地模型/Ollama 支持可以作为隐私卖点。

### 6.4 GameMasterAI

地址：https://github.com/deckofdmthings/GameMasterAI

定位：开源 AI Dungeon Master，偏单人 TTRPG。

功能亮点：

- AI DM + AI notetaker。
- Web 应用。
- 用 GPT-3.5/GPT-4 生成叙事。

对本项目建议：

- “AI notetaker”比“AI 主持人”更接近真实刚需。
- COC KP Agent 第一版应把日志、摘要、状态更新作为核心，而不是追求完全自动游玩。

### 6.5 Archivist

地址：https://www.myarchivist.ai/ai-dungeon-master

定位：AI campaign assistant。

功能亮点：

- 明确强调 AI 是支持 DM，而不是替代 DM。
- 自动 session recap。
- 搜索 campaign memory。
- 跟踪 characters 和 locations。

对本项目建议：

- 这与本项目定位高度一致。
- 文案上应坚持“辅助、记录、召回、建议”，不要宣传“AI 自动带团”。

## 7. 通用跑团管理和知识组织平台

### 7.1 Kanka

地址：https://kanka.io/

定位：世界观和 RPG campaign manager。

功能亮点：

- 角色、地图、时间线、世界 lore。
- @mentions 互链。
- 日历、组织、家族、互动地图。

对本项目建议：

- 内部数据模型不要只围绕“模组文本”，要有 Characters、Locations、Organizations、Timelines、Items、Notes。
- 支持 `@NPC`、`@地点`、`@线索` 式引用会显著提升日志可用性。

### 7.2 LegendKeeper

地址：https://www.legendkeeper.com/

定位：地图 + wiki + board 的 campaign manager。

功能亮点：

- 嵌套地图。
- 地图 pins 连接 wiki 页面。
- collaborative whiteboards。
- 适合地点、旅程、阵营和关系图。

对本项目建议：

- COC 的“调查板”比传统战斗地图更重要。
- 可设计关系图/线索图：NPC、地点、证物、时间线、神话实体之间的边。

### 7.3 World Anvil

地址：https://blog.worldanvil.com/worldanvil/dev-news/new-call-of-cthulhu-character-sheet/

定位：通用世界观和 campaign manager，支持 COC 角色卡。

功能亮点：

- COC character sheet。
- 数字 Keeper screen。
- 玩家角色卡可和 campaign manager 集成。
- 角色不只是数值，还包含叙事资料和 session 间互动。

对本项目建议：

- “Keeper screen”是本项目核心界面方向。
- 人物卡要连接背景、关系、线索、状态，而不是只做属性表。

### 7.4 Obsidian TTRPG 生态

参考：

- https://publish.obsidian.md/hub/02%2B-%2BCommunity%2BExpansions/02.01%2BPlugins%2Bby%2BCategory/Plugins%2Bfor%2BTTRPG
- https://www.reddit.com/r/worldbuilding/comments/v9uorp/obsidianmd_the_perfect_free_campaign_manager/

功能亮点：

- Markdown 笔记天然适合本地优先。
- 插件支持 dice roller、initiative tracker、calendar、kanban、player-facing monitor。
- 双链/wiki 适合复杂关系。

对本项目建议：

- 本项目本地资料用 Markdown 是正确方向。
- 可以考虑导出 Obsidian vault 兼容格式。
- 不必一开始重做编辑器生态，先保证数据可导出、可链接。

## 8. 可复用精华

### 8.1 信息架构

建议采用这些顶层对象：

- Campaign
- Session
- Scene
- Character
- NPC
- Creature
- Location
- Clue
- Handout
- Item / Tome
- Faction / Organization
- TimelineEvent
- RollRequest
- DiceRoll
- KnowledgeResource

来源启发：Foundry actor/item/journal/compendium，Kanka/LegendKeeper wiki objects，Roll20 handouts/progress clocks。

### 8.2 控制台布局

建议采用三栏：

- 左侧：玩家、NPC、线索、时间线。
- 中间：当前场景、模组原文、日志输入。
- 右侧：AI 建议、检定工具、规则/资料检索。

来源启发：CoCai 三栏 UI、Roll20 command center、World Anvil Keeper screen。

### 8.3 规则引擎

规则层应独立：

- d100 roll
- bonus / penalty dice
- regular / hard / extreme / critical / fumble
- opposed roll
- SAN check
- HP / SAN / MP tracker
- transparent candidate rolls
- canonical skill keys + i18n aliases

来源启发：coc-dice-bot、Dorian、cthulhu_bot、Roll20/Foundry sheets。

### 8.4 记忆系统

建议分层：

- Short-term context：最近若干轮行动。
- Session summary：本场摘要。
- Campaign facts：KP 确认事实。
- Entity state：NPC、地点、线索、角色状态。
- Semantic memory：资料库和历史日志向量检索。
- Source citations：模组、规则书、资料路径。

来源启发：Chronicle Keeper、CoCai、Archivist、GameMasterAI。

### 8.5 资料库策略

本项目已整理：

- Cthulhu Club 非模组资料 1268 篇。
- 高优先级 283 条。
- 规则书 PDF 转 Markdown 2 份。

建议第一版：

- 主知识库只接入高优先级 283 条。
- 规则书单独建索引。
- 模组单独建私有索引。
- 叙事语料单独做风格库，不与规则/实体混检。

## 9. 不建议重复建设的部分

### 9.1 不做完整 VTT

地图、token、fog of war、动态光照、实时联机是 Foundry/Roll20 的强项。本项目第一版不应投入。

可替代方案：

- 后续做 Foundry/Roll20 辅助导出。
- 做轻量“调查板”，而不是战斗地图。

### 9.2 不做纯人物卡 App

Arkham Registry、Dhole's House、Roll20、Foundry 已经覆盖很多人物卡需求。本项目只做与 KP 控制台强相关的人物卡管理。

### 9.3 不做 AI 自动主持

AI 自动主持容易出现：

- 幻觉。
- 剧透。
- 改写模组。
- 规则错误。
- 抢夺 KP 裁决权。

本项目应坚持：

- AI 给建议。
- KP 做确认。
- 规则由引擎计算。
- 状态变更可追溯。

## 10. 许可证与版权注意

| 项目 | 许可证/边界 | 处理建议 |
| --- | --- | --- |
| CoC7 FoundryVTT | GPL-3.0，且有 Foundry/Chaosium 平台与商业限制声明 | 不复制代码/内容；只借鉴设计 |
| Investigator Wizard | Foundry module license + Chaosium Fan Material Policy | 不复制内容；只参考人物创建流程 |
| Arkham Registry | GPL-2.0 | 不直接嵌入闭源/商业产品 |
| CoCai | AGPL-3.0 | 不直接复用服务端代码；可参考 UI/记忆思路 |
| coc-keeper-runtime | MIT | 可进一步阅读源码，谨慎参考架构 |
| Dice bots | 多数 MIT/开源 | 可参考规则测试思路，但规则代码建议自写 |
| Roll20 / Dhole's House | 平台/站点服务 | 借鉴交互，不抓取或复制其专有内容 |

## 11. 对本项目需求文档的修正建议

基于调研，建议在当前需求中强化以下内容：

1. 增加 `RollRequest` 对象：KP 发起检定请求，而不是只有骰子工具。
2. 增加 `Handout` 对象：报纸、信件、照片、名片、档案等。
3. 增加 `ProgressClock` 对象：仪式倒计时、NPC 怀疑度、警察介入、怪物接近。
4. 增加 `InvestigationBoard`：线索、地点、NPC、证物、事件关系图。
5. 增加 `canonicalSkillKey` 和 i18n alias：避免技能名混乱。
6. 增加 Foundry/Obsidian 兼容导出作为后续里程碑。
7. 明确 AI 建议必须标记来源和置信类型：模组事实、跑团事实、AI 推测、主持建议。

## 12. 推荐下一步

第一优先级：

1. 继续保留当前方向：KP Copilot，而不是 AI Keeper。
2. 设计核心数据模型：Campaign、Scene、Character、Clue、RollRequest、KnowledgeResource。
3. 实现规则引擎最小闭环：d100、奖励/惩罚骰、成功等级、SAN 检定。
4. 实现本地 RAG 最小闭环：高优先级资料 + 规则书 + 自制模组。

第二优先级：

1. 进一步阅读 `coc-keeper-runtime` 和 `coc-dice-bot` 源码。
2. 设计人物卡 JSON schema，参考 Arkham Registry 但不复制。
3. 设计调查板和 ProgressClock。

第三优先级：

1. Foundry 导入/导出。
2. Obsidian vault 导出。
3. Handout generator。
4. Discord bot 版。

## 13. 主要参考来源

- CoC7 FoundryVTT: https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT
- Foundry Investigator Wizard: https://github.com/Miskatonic-Investigative-Society/call-of-cthulhu-foundryvtt-investigator-wizard
- Arkham Registry: https://github.com/ecyrbe/cthulhu-editor
- Roll20 COC Character Sheet: https://pages.roll20.net/call-of-cthulhu-character-sheet
- Roll20 Character Sheets repo: https://github.com/Roll20/roll20-character-sheets
- Dhole's House Chaosium intro: https://www.chaosium.com/blog/welcome-to-the-dholes-house-free-online-toolkit-for-call-of-cthulhu/
- coc-dice-bot: https://github.com/Asurazpr/coc-dice-bot
- Dorian: https://github.com/thomcuddihy/dorian
- cthulhu_bot: https://github.com/caphosra/cthulhu_bot
- Cthulhu Roller: https://gitlab.com/mtczekajlo/cthulhu-roller
- CoCai: https://github.com/StarsRail/Cocai
- coc-keeper-runtime: https://github.com/LLLin000/coc-keeper-runtime
- Chronicle Keeper: https://github.com/The-RavenKing/Chronicle-Keeper
- GameMasterAI: https://github.com/deckofdmthings/GameMasterAI
- Archivist AI DM overview: https://www.myarchivist.ai/ai-dungeon-master
- Kanka: https://kanka.io/
- LegendKeeper: https://www.legendkeeper.com/
- World Anvil COC sheet: https://blog.worldanvil.com/worldanvil/dev-news/new-call-of-cthulhu-character-sheet/
- Obsidian TTRPG plugins: https://publish.obsidian.md/hub/02%2B-%2BCommunity%2BExpansions/02.01%2BPlugins%2Bby%2BCategory/Plugins%2Bfor%2BTTRPG
