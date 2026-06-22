from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader


WORKSPACE = Path(__file__).resolve().parents[1]
SOURCE_DIR = WORKSPACE / "幽暗之门 v1.1"
OUTPUT_DIR = WORKSPACE / "documents" / "runtime" / "liaoque_huanmeng"

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


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = list(SOURCE_DIR.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"No PDF found under {SOURCE_DIR}")
    pdf = pdfs[0]
    reader = PdfReader(str(pdf))
    markdown, page_records = markdown_for_pages(reader)
    (OUTPUT_DIR / "source_text.md").write_text(markdown, encoding="utf-8")
    print(json.dumps({"output_dir": str(OUTPUT_DIR), "pages": len(page_records)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
