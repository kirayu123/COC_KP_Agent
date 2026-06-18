# COC KP Agent 资源用途说明

本资料库用于 demo 阶段的本地检索、RAG 分片、数据模型验证和主持辅助功能验证。

## 当前规模

- Cthulhu Club 非模组资料 Markdown：1268 篇
- Cthulhu Club 原始 HTML：1268 份
- 用户本地 PDF 转 Markdown：2 份
- 已确认排除：`/coc-mod/` 与 `/coc-modules/` 模组正文，当前索引中模组正文数量为 0

## 主要资源类型

| URL 类别 | 数量 | 对 demo 的用途 |
| --- | ---: | --- |
| `mythos-original` | 665 | 叙事语料、气氛描写参考、KP 即兴桥段生成测试 |
| `mythos-stories` | 132 | 克苏鲁原著/故事知识检索、风格参考、神话实体上下文 |
| `articles` | 101 | 设定考据、主持资料、主题文章检索 |
| `mortals` | 56 | NPC 原型库、人物关系图谱、经典人物识别 |
| `the-great-old-ones` | 54 | 旧日支配者资料库、神话实体标签、遭遇提示 |
| `monsters` | 50 | 怪物资料库、遭遇管理、SAN/战斗提示 |
| `mythos-books` | 36 | 神秘书籍/禁忌知识道具库、图书馆调查线索 |
| `outer-gods` | 28 | 外神资料库、模组主题识别、神话背景检索 |
| `cthulhu-science` | 19 | 科学考据、伪科学线索、调查材料生成 |
| `mythos-timeline` | 17 | 年代表、时代一致性检查、历史背景提示 |

## 推荐接入方式

1. **资料索引**
   - 读取 `resources/cthulhuclub/index.json`。
   - 每条记录包含标题、来源 URL、Markdown 路径、原始 HTML 路径、发布日期和修改时间。

2. **RAG 分片**
   - 对 `resources/cthulhuclub/markdown/` 进行按标题、二级标题、段落长度切分。
   - 对 `resources/rulebooks-md/` 按 `## Page N` 与小节标题切分。
   - 检索结果必须保留 `source_url` 或 `source_file + Page N`，供 KP 回溯来源。

3. **知识图谱**
   - 从人物、怪物、旧日支配者、外神、典籍、地点类文章中抽取实体。
   - 建议实体类型：`deity`、`monster`、`npc`、`book`、`location`、`timeline_event`、`article`。
   - 关系类型：`appears_with`、`serves`、`located_in`、`mentions`、`causes_san_loss`、`related_book`。

4. **规则引擎**
   - 规则书 Markdown 只作为检索和人工核对来源。
   - 技能检定、奖励骰/惩罚骰、困难等级、SAN、战斗等应实现为确定性代码，不应让 LLM 直接计算最终规则结果。

5. **版权边界**
   - 当前资料库适合个人学习、demo 验证和本地检索。
   - 商业版不应内置第三方站点正文、规则书全文或用户未授权资料。
   - 若做云端服务，应改为“用户自行上传、仅用户私有索引、可删除、不可跨用户共享”。

## Demo 功能映射

| Demo 功能 | 可使用的资料 |
| --- | --- |
| 当前场景建议 | 站点文章、故事、地点、怪物资料 + 用户导入模组 |
| NPC 即兴回应 | `mortals` 人物档案、原创故事语料、当前跑团日志 |
| 神话实体识别 | `the-great-old-ones`、`outer-gods`、`monsters` |
| 线索/道具建议 | `mythos-books`、`articles`、规则书页码检索 |
| 时代一致性检查 | `mythos-timeline`、`cthulhu-science`、规则书背景章节 |
| SAN/战斗提示 | 规则书 Markdown + 怪物资料 |
| 模组导入解析测试 | 不使用站点模组正文；使用自制 demo 模组或用户私有导入 |

## 已整理的分类索引

已将非模组资料按 demo 用途重新分类到 `resources/curated/`：

- `resources/curated/README.md`：分类总览与接入建议。
- `resources/curated/high_priority_resources.md`：第一版建议优先进入 RAG/知识库的资料。
- `resources/curated/medium_priority_resources.md`：适合背景扩展和叙事语料的资料。
- `resources/curated/low_priority_resources.md`：默认不进入第一版主索引的资料。
- `resources/curated/useful_resources.json`：机器可读分类清单。

第一版建议只接入高优先级资料：神话实体、怪物、人物、典籍、地点年表、KP 参考，共 283 条。叙事语料数量很大，建议作为单独的“风格库”延后接入，避免压过规则和实体检索结果。
