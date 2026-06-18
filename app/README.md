# COC KP Agent Demo

第一版 demo 是一个本地优先的 KP 跑团控制台，用来验证最小闭环：

- 查看当前场景、调查员状态、线索状态和进度钟。
- 创建真实调查员人物卡：购点、随机、职业模板、技能分配、AI/模板背景生成。
- 记录玩家行动，并生成结构化 KP 建议。
- 从建议中发起 COC7 百分骰检定。
- 透明展示奖励/惩罚骰候选值、成功等级和日志。
- 由 KP 手动采纳 AI 提出的状态变更。
- 使用 localStorage 保存 demo 状态。

## 启动

```bash
npm install
```

启动 API 代理：

```bash
DEEPSEEK_API_KEY=your_key npm run dev:api
```

PowerShell：

```powershell
$env:DEEPSEEK_API_KEY="your_key"
npm run dev:api
```

另开一个终端启动前端：

```bash
npm run dev -- --host 127.0.0.1
```

打开：

```text
http://127.0.0.1:5173
```

## 验证

```bash
npm run build
npm run lint
```

## 当前边界

- 规则引擎已实现 COC7 基础百分骰、奖励/惩罚骰和成功等级。
- 人物卡创建支持：
  - 购点模式：设置属性点池，手动分配 STR/CON/SIZ/DEX/APP/INT/POW/EDU。
  - 随机模式：按 COC7 常见公式生成属性，STR/CON/DEX/APP/POW 为 `3D6×5`，SIZ/INT/EDU 为 `(2D6+6)×5`。
  - 派生值：自动计算 HP、SAN、MP、MOV、体格、伤害加值、职业技能点、兴趣技能点。
  - 职业模板：参考 Excel 职业表和 Foundry Investigator Wizard 的职业点/推荐技能思路。
  - 技能分配：独立弹窗的人物卡工作台展示身份、属性、技能、资产装备；技能以双列紧凑卡片呈现，区分基础值、职业加点、兴趣加点和最终值。
  - 职业技能：按职业模板强制勾选必选技能，并限制可选职业技能数量。
  - 创建校验：参考本地 Excel 人物卡结构检查身份、职业、属性、技能、背景和扩展栏位遗漏。
  - 背景生成：优先请求 DeepSeek，不可用时使用本地模板生成。
- AI 建议优先走本地 API 代理调用 DeepSeek；不可用时自动回退到本地启发式 mock。
- 数据层目前使用 localStorage；后续应替换为 SQLite/API。
- 示例模组为自制内容，不包含商业模组正文。
- API key 只应通过 `DEEPSEEK_API_KEY` 环境变量提供，不要写入前端代码或提交到仓库。

## 下一步

1. 接入 SQLite 数据层。
2. 加入 Markdown 模组导入与结构化解析。
3. 接入本地资料库检索。
4. 将 mock 建议服务替换为可配置 LLM provider。
5. 增加人物卡 JSON/Dhole's House 导入。
