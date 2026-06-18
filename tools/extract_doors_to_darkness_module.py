from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from pypdf import PdfReader


WORKSPACE = Path(__file__).resolve().parents[1]
SOURCE_DIR = WORKSPACE / "幽暗之门 v1.1"
OUTPUT_DIR = WORKSPACE / "resources" / "modules" / "doors-to-darkness" / "liao-que-huan-meng"
ASSET_DIR = OUTPUT_DIR / "assets"

# PDF page numbers, not zero-based indexes. The table of contents places Chapter 6 on printed page 87,
# which corresponds to PDF page 88 in this file. Chapter 7 begins on PDF page 104.
MODULE_PDF_PAGE_START = 88
MODULE_PDF_PAGE_END = 103


def strip_page_header(text: str) -> str:
    lines = [line.rstrip() for line in text.splitlines()]
    if len(lines) >= 2 and lines[0].strip() == "幽暗之门" and re.fullmatch(r"\d+", lines[1].strip()):
        lines = lines[2:]
    return "\n".join(lines).strip()


def normalize_pdf_text(text: str) -> str:
    text = strip_page_header(text)
    lines = [line.strip() for line in text.splitlines()]
    blocks: list[str] = []
    current: list[str] = []

    heading_markers = (
        "Chapter ",
        "引言",
        "守秘人信息",
        "调查员导入",
        "调查的几个方向",
        "奖励",
        "结局",
        "表格 ",
        "法术：",
        "给守秘人的建议",
        "附录",
    )

    for line in lines:
        if not line:
            if current:
                blocks.append("".join(current))
                current = []
            continue
        is_heading = line.startswith(heading_markers) or (len(line) <= 18 and not re.search(r"[，。；：,.]", line))
        if is_heading and current:
            blocks.append("".join(current))
            current = []
        if is_heading:
            blocks.append(line)
        else:
            current.append(line)

    if current:
        blocks.append("".join(current))

    return "\n\n".join(blocks)


def markdown_for_pages(reader: PdfReader) -> tuple[str, list[dict[str, object]]]:
    parts = [
        "# 了却幻梦",
        "",
        "> 来源：`幽暗之门 v1.1.pdf`，PDF 页码 88-103。此文件为本地资料抽取结果，仅供当前项目资料库使用。",
        "",
    ]
    page_records: list[dict[str, object]] = []
    for pdf_page in range(MODULE_PDF_PAGE_START, MODULE_PDF_PAGE_END + 1):
        text = reader.pages[pdf_page - 1].extract_text() or ""
        cleaned = normalize_pdf_text(text)
        parts.append(f"## PDF 第 {pdf_page} 页")
        parts.append("")
        parts.append(cleaned)
        parts.append("")
        page_records.append(
            {
                "pdf_page": pdf_page,
                "chars": len(text),
                "head": cleaned[:120],
            }
        )
    return "\n".join(parts).strip() + "\n", page_records


def collect_assets() -> list[dict[str, object]]:
    source_assets = SOURCE_DIR / "展示材料和地图"
    assets: list[dict[str, object]] = []
    if not source_assets.exists():
        return assets

    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for path in source_assets.iterdir():
        if not path.is_file():
            continue
        name = path.name
        if "幻梦" not in name and "了却幻梦" not in name:
            continue
        target = ASSET_DIR / name
        shutil.copy2(path, target)
        assets.append(
            {
                "name": name,
                "source": str(path),
                "local_copy": str(target),
                "bytes": path.stat().st_size,
                "kind": "map" if name.startswith("地图") else "handout",
            }
        )
    return assets


def extract_heading_index(markdown: str) -> list[dict[str, object]]:
    headings: list[dict[str, object]] = []
    for line_no, line in enumerate(markdown.splitlines(), start=1):
        text = line.strip()
        if not text or text.startswith("#") or text.startswith(">"):
            continue
        if (
            text.startswith(("Chapter ", "引言", "守秘人信息", "调查员导入", "调查的几个方向", "奖励", "结局", "表格 ", "法术：", "给守秘人的建议"))
            or (len(text) <= 18 and not re.search(r"[，。；,.]", text) and not text.startswith("PDF 第"))
        ):
            headings.append({"line": line_no, "title": text})
    return headings


def write_materials_index(assets: list[dict[str, object]], page_records: list[dict[str, object]], headings: list[dict[str, object]]) -> str:
    lines = [
        "# 了却幻梦材料索引",
        "",
        "## 来源",
        "",
        "- PDF：`幽暗之门 v1.1/幽暗之门 v1.1.pdf`",
        f"- 页段：PDF 第 {MODULE_PDF_PAGE_START}-{MODULE_PDF_PAGE_END} 页",
        "- 配套材料目录：`幽暗之门 v1.1/展示材料和地图`",
        "",
        "## 配套图片材料",
        "",
    ]
    if assets:
        for asset in assets:
            lines.append(f"- {asset['kind']}: `{asset['name']}` -> `{asset['local_copy']}`")
    else:
        lines.append("- 未发现文件名包含“幻梦”的配套图片。")

    lines.extend(["", "## 页码抽取状态", ""])
    for record in page_records:
        lines.append(f"- PDF 第 {record['pdf_page']} 页：{record['chars']} 字符，开头：{record['head']!r}")

    lines.extend(["", "## 自动识别的段落标题", ""])
    for heading in headings[:120]:
        lines.append(f"- L{heading['line']}: {heading['title']}")

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = list(SOURCE_DIR.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"No PDF found under {SOURCE_DIR}")
    pdf = pdfs[0]
    reader = PdfReader(str(pdf))
    markdown, page_records = markdown_for_pages(reader)
    assets = collect_assets()
    headings = extract_heading_index(markdown)

    (OUTPUT_DIR / "source_text.md").write_text(markdown, encoding="utf-8")
    (OUTPUT_DIR / "materials_index.md").write_text(write_materials_index(assets, page_records, headings), encoding="utf-8")
    (OUTPUT_DIR / "extraction_manifest.json").write_text(
        json.dumps(
            {
                "module": "了却幻梦",
                "source_pdf": str(pdf),
                "output_dir": str(OUTPUT_DIR),
                "pdf_page_start": MODULE_PDF_PAGE_START,
                "pdf_page_end": MODULE_PDF_PAGE_END,
                "page_records": page_records,
                "assets": assets,
                "headings": headings,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"output_dir": str(OUTPUT_DIR), "pages": len(page_records), "assets": len(assets)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
