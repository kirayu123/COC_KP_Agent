# Cthulhu Club 非模组资料分类

本目录把 `resources/cthulhuclub/index.json` 中的非模组资料按 KP Agent demo 的实际用途重新分类。

## 分类总览

| 分类 | 优先级 | 数量 | 用途 |
| --- | --- | ---: | --- |
| [神话实体与神格](categories/mythos_entities.md) | high | 83 | 旧日支配者、外神、重要神话存在；用于实体识别、主题判断、遭遇提示和背景检索。 |
| [怪物与遭遇](categories/creatures_encounters.md) | high | 51 | 神话生物、怪物、异常存在；用于遭遇管理、SAN/战斗提示、调查线索补充。 |
| [人物与 NPC 原型](categories/npc_persons.md) | high | 56 | 经典人物、作者人物、可转化为 NPC 的档案；用于 NPC 卡、关系图谱和人物识别。 |
| [典籍、道具与禁忌知识](categories/tomes_artifacts.md) | high | 37 | 神秘书籍、禁忌知识、奇物；用于线索卡、图书馆调查、阅读代价和道具库。 |
| [地点、年代与世界观](categories/locations_timeline.md) | high | 54 | 地点、年表、地理、历史背景；用于时代一致性检查、场景生成和地点索引。 |
| [跑团与 KP 参考](categories/rules_kp_reference.md) | high | 2 | 跑团介绍、主持资料、规则相关入口、推荐书目；用于 demo 文档、帮助系统和规则检索入口。 |
| [设定考据与主题文章](categories/research_articles.md) | medium | 114 | 考据、科学、创作、主题解读；用于补充线索、生成调查材料和扩展背景。 |
| [叙事语料与风格参考](categories/narrative_corpus.md) | medium | 834 | 原创故事、原著译文、漫画、诗歌；用于语气/氛围参考、场景描写和少量示例检索。 |
| [媒体、社区与低优先级资料](categories/media_misc.md) | low | 37 | 视频、社群、站点介绍、周边和其他不稳定资料；默认不进入第一版 RAG 主索引。 |

## 推荐第一批进入 demo 的资料

1. 神话实体与神格：做实体识别、模组主题判断和遭遇背景检索。
2. 怪物与遭遇：做怪物卡、SAN 提醒、战斗/逃亡辅助。
3. 人物与 NPC 原型：做 NPC 关系图谱和即兴人物库。
4. 典籍、道具与禁忌知识：做线索卡、图书馆调查和阅读代价提示。
5. 地点、年代与世界观：做时代一致性检查和地点背景补全。
6. 跑团与 KP 参考：做帮助系统、规则入口和新手 KP 引导。

## 文件说明

- `high_priority_resources.md`：第一版 RAG/知识库建议优先接入的资料。
- `medium_priority_resources.md`：适合作为背景扩展和叙事语料的资料。
- `low_priority_resources.md`：默认不进第一版主索引，只保留备用。
- `useful_resources.json`：带分类、优先级和文件大小的机器可读清单。
- `categories/*.md`：每个分类的完整资料列表。

## 使用建议

- 高优先级资料可以直接做实体级索引，每篇保留标题、来源 URL、本地 Markdown 路径。
- 中优先级资料适合做语义检索，但不建议让它们压过规则书、人物、怪物和典籍资料。
- 低优先级资料默认不进入 prompt 上下文，除非用户明确搜索视频、社群、周边或站点信息。
