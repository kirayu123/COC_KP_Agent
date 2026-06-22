import json
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "documents" / "supplemental" / "cthulhuclub" / "index.json"
OUT = ROOT / "documents" / "supplemental" / "curated"
CATEGORY_OUT = OUT / "categories"


CATEGORIES = {
    "mythos_entities": {
        "name": "神话实体与神格",
        "priority": "high",
        "use": "旧日支配者、外神、重要神话存在；用于实体识别、主题判断、遭遇提示和背景检索。",
    },
    "creatures_encounters": {
        "name": "怪物与遭遇",
        "priority": "high",
        "use": "神话生物、怪物、异常存在；用于遭遇管理、SAN/战斗提示、调查线索补充。",
    },
    "npc_persons": {
        "name": "人物与 NPC 原型",
        "priority": "high",
        "use": "经典人物、作者人物、可转化为 NPC 的档案；用于 NPC 卡、关系图谱和人物识别。",
    },
    "tomes_artifacts": {
        "name": "典籍、道具与禁忌知识",
        "priority": "high",
        "use": "神秘书籍、禁忌知识、奇物；用于线索卡、图书馆调查、阅读代价和道具库。",
    },
    "locations_timeline": {
        "name": "地点、年代与世界观",
        "priority": "high",
        "use": "地点、年表、地理、历史背景；用于时代一致性检查、场景生成和地点索引。",
    },
    "rules_kp_reference": {
        "name": "跑团与 KP 参考",
        "priority": "high",
        "use": "跑团介绍、主持资料、规则相关入口、推荐书目；用于 demo 文档、帮助系统和规则检索入口。",
    },
    "research_articles": {
        "name": "设定考据与主题文章",
        "priority": "medium",
        "use": "考据、科学、创作、主题解读；用于补充线索、生成调查材料和扩展背景。",
    },
    "narrative_corpus": {
        "name": "叙事语料与风格参考",
        "priority": "medium",
        "use": "原创故事、原著译文、漫画、诗歌；用于语气/氛围参考、场景描写和少量示例检索。",
    },
    "media_misc": {
        "name": "媒体、社区与低优先级资料",
        "priority": "low",
        "use": "视频、社群、站点介绍、周边和其他不稳定资料；默认不进入第一版 RAG 主索引。",
    },
}


HIGH_SIGNAL_PATHS = {
    "outer-gods": "mythos_entities",
    "the-great-old-ones": "mythos_entities",
    "old_ones_and_outer_gods": "mythos_entities",
    "monsters": "creatures_encounters",
    "monsters_and_abominations": "creatures_encounters",
    "mortals": "npc_persons",
    "mythos-books": "tomes_artifacts",
    "eldrich_mysteries": "tomes_artifacts",
    "mythos-timeline": "locations_timeline",
    "mythos-location": "locations_timeline",
    "call-of-cthulhu-trpg": "rules_kp_reference",
    "recommended-books": "rules_kp_reference",
}


MEDIUM_SIGNAL_PATHS = {
    "cthulhu-science": "research_articles",
    "article-creation": "research_articles",
    "articles": "research_articles",
    "mythos-original": "narrative_corpus",
    "mythos-stories": "narrative_corpus",
    "cthulhu-fiction": "narrative_corpus",
    "cthulhu-comic": "narrative_corpus",
    "cthulhu-poems": "narrative_corpus",
    "a-bite-of-cthulhu": "narrative_corpus",
}


LOW_SIGNAL_PATHS = {
    "videos",
    "fantasy-creatures-daily",
    "san-lost-gallery",
    "starrywisdom",
    "brown-bag",
    "san-lost-stuff",
    "source",
    "all-articles",
    "starrywisdom-goods",
    "wis-battle",
    "about-us",
    "cthulhu-article",
}


LOCATION_KEYWORDS = [
    "阿卡姆",
    "密斯卡托尼克",
    "敦威治",
    "金斯波特",
    "印斯茅斯",
    "拉莱耶",
    "幻梦境",
    "冷原",
    "无名之城",
    "Hyperborea",
    "Yuggoth",
    "R'lyeh",
    "Dunwich",
    "Arkham",
    "Innsmouth",
    "Kingsport",
]


def first_path(url):
    parts = [p for p in urlparse(url).path.split("/") if p]
    return parts[0] if parts else ""


def classify(record):
    path = first_path(record["url"])
    title = record.get("title") or ""
    title_lower = title.lower()
    url_lower = record["url"].lower()

    if path in HIGH_SIGNAL_PATHS:
        return HIGH_SIGNAL_PATHS[path]
    if any(keyword.lower() in title_lower or keyword.lower() in url_lower for keyword in LOCATION_KEYWORDS):
        return "locations_timeline"
    if path in MEDIUM_SIGNAL_PATHS:
        return MEDIUM_SIGNAL_PATHS[path]
    if path in LOW_SIGNAL_PATHS:
        return "media_misc"
    return "research_articles"


def markdown_link(record):
    return record.get("markdown", "")


def enrich(record):
    category = classify(record)
    md_path = ROOT / record["markdown"]
    size = md_path.stat().st_size if md_path.exists() else 0
    path = first_path(record["url"])
    return {
        "title": record.get("title", ""),
        "url": record.get("url", ""),
        "markdown": record.get("markdown", ""),
        "category": category,
        "category_name": CATEGORIES[category]["name"],
        "priority": CATEGORIES[category]["priority"],
        "path_group": path or "(home)",
        "size_bytes": size,
        "date": record.get("date"),
        "modified": record.get("modified"),
    }


def write_category_file(category, records):
    meta = CATEGORIES[category]
    lines = [
        f"# {meta['name']}",
        "",
        f"- 优先级：{meta['priority']}",
        f"- 用途：{meta['use']}",
        f"- 数量：{len(records)}",
        "",
        "| 标题 | 来源 | 本地 Markdown | URL 类别 |",
        "| --- | --- | --- | --- |",
    ]
    for record in sorted(records, key=lambda r: (r["path_group"], r["title"])):
        title = record["title"].replace("|", "\\|")
        lines.append(
            f"| {title} | [source]({record['url']}) | `{record['markdown']}` | `{record['path_group']}` |"
        )
    (CATEGORY_OUT / f"{category}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_priority_file(name, title, records):
    lines = [
        f"# {title}",
        "",
        f"数量：{len(records)}",
        "",
        "| 类别 | 标题 | 来源 | 本地 Markdown |",
        "| --- | --- | --- | --- |",
    ]
    for record in sorted(records, key=lambda r: (r["category"], r["path_group"], r["title"])):
        title_text = record["title"].replace("|", "\\|")
        lines.append(
            f"| {record['category_name']} | {title_text} | [source]({record['url']}) | `{record['markdown']}` |"
        )
    (OUT / name).write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    CATEGORY_OUT.mkdir(parents=True, exist_ok=True)

    records = json.loads(INDEX.read_text(encoding="utf-8"))
    enriched = [enrich(record) for record in records if record.get("markdown")]

    grouped = {key: [] for key in CATEGORIES}
    for record in enriched:
        grouped[record["category"]].append(record)

    for category, items in grouped.items():
        write_category_file(category, items)

    high = [r for r in enriched if r["priority"] == "high"]
    medium = [r for r in enriched if r["priority"] == "medium"]
    low = [r for r in enriched if r["priority"] == "low"]

    write_priority_file("high_priority_resources.md", "高优先级资料清单", high)
    write_priority_file("medium_priority_resources.md", "中优先级资料清单", medium)
    write_priority_file("low_priority_resources.md", "低优先级资料清单", low)

    summary_rows = []
    for category, meta in CATEGORIES.items():
        items = grouped[category]
        summary_rows.append(
            {
                "category": category,
                "name": meta["name"],
                "priority": meta["priority"],
                "count": len(items),
                "use": meta["use"],
            }
        )

    (OUT / "useful_resources.json").write_text(
        json.dumps(enriched, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT / "summary.json").write_text(
        json.dumps(summary_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    readme_lines = [
        "# Cthulhu Club 非模组资料分类",
        "",
        "本目录把 `documents/supplemental/cthulhuclub/index.json` 中的非模组资料按 KP Agent demo 的实际用途重新分类。",
        "",
        "## 分类总览",
        "",
        "| 分类 | 优先级 | 数量 | 用途 |",
        "| --- | --- | ---: | --- |",
    ]
    for row in summary_rows:
        readme_lines.append(
            f"| [{row['name']}](categories/{row['category']}.md) | {row['priority']} | {row['count']} | {row['use']} |"
        )

    readme_lines.extend(
        [
            "",
            "## 推荐第一批进入 demo 的资料",
            "",
            "1. 神话实体与神格：做实体识别、模组主题判断和遭遇背景检索。",
            "2. 怪物与遭遇：做怪物卡、SAN 提醒、战斗/逃亡辅助。",
            "3. 人物与 NPC 原型：做 NPC 关系图谱和即兴人物库。",
            "4. 典籍、道具与禁忌知识：做线索卡、图书馆调查和阅读代价提示。",
            "5. 地点、年代与世界观：做时代一致性检查和地点背景补全。",
            "6. 跑团与 KP 参考：做帮助系统、规则入口和新手 KP 引导。",
            "",
            "## 文件说明",
            "",
            "- `high_priority_resources.md`：第一版 RAG/知识库建议优先接入的资料。",
            "- `medium_priority_resources.md`：适合作为背景扩展和叙事语料的资料。",
            "- `low_priority_resources.md`：默认不进第一版主索引，只保留备用。",
            "- `useful_resources.json`：带分类、优先级和文件大小的机器可读清单。",
            "- `categories/*.md`：每个分类的完整资料列表。",
            "",
            "## 使用建议",
            "",
            "- 高优先级资料可以直接做实体级索引，每篇保留标题、来源 URL、本地 Markdown 路径。",
            "- 中优先级资料适合做语义检索，但不建议让它们压过规则书、人物、怪物和典籍资料。",
            "- 低优先级资料默认不进入 prompt 上下文，除非用户明确搜索视频、社群、周边或站点信息。",
            "",
        ]
    )
    (OUT / "README.md").write_text("\n".join(readme_lines), encoding="utf-8")

    print(f"categorized {len(enriched)} records")
    for row in summary_rows:
        print(f"{row['category']}: {row['count']}")


if __name__ == "__main__":
    main()
