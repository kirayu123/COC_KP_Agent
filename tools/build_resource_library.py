import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from markdownify import markdownify as md
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "resources"
SITE_OUT = OUT / "cthulhuclub"
PDF_OUT = OUT / "rulebooks-md"

BASE = "https://www.cthulhuclub.com"

SEEDS = [
    f"{BASE}/call-of-cthulhu-trpg/",
    f"{BASE}/category/mythos-timeline/",
    f"{BASE}/old_ones_and_outer_gods/",
    f"{BASE}/monsters_and_abominations/",
    f"{BASE}/eldrich_mysteries/",
    f"{BASE}/category/mythos-location/",
    f"{BASE}/mortals/",
]

WP_ENDPOINTS = [
    ("posts", f"{BASE}/wp-json/wp/v2/posts"),
    ("pages", f"{BASE}/wp-json/wp/v2/pages"),
]

EXCLUDE_PREFIXES = [
    f"{BASE}/coc-mod/",
    f"{BASE}/coc-modules/",
    f"{BASE}/wp-login.php",
    f"{BASE}/register/",
    f"{BASE}/contribute/",
    f"{BASE}/login/",
    f"{BASE}/lost-password/",
    f"{BASE}/members/",
    f"{BASE}/activity/",
    f"{BASE}/activate/",
    f"{BASE}/complete-registration",
    f"{BASE}/upload-post/",
    f"{BASE}/upload-mod/",
    f"{BASE}/privacy-policy/",
    f"{BASE}/terms-of-use/",
]

EXCLUDE_EXTENSIONS = (
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".css",
    ".js",
    ".ico",
    ".zip",
)

LOCAL_PDFS = [
    Path(r"C:\Users\15084\Documents\call-of-cthulhu-investigator-handbook-1.2.1.pdf"),
    Path(r"C:\Users\15084\Documents\call-of-cthulhu-keeper-rulebook-cn-Version2002c.pdf"),
]


def ensure_dirs():
    for path in [
        SITE_OUT / "raw_html",
        SITE_OUT / "markdown",
        PDF_OUT,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def clear_generated_files():
    for folder in [SITE_OUT / "raw_html", SITE_OUT / "markdown", PDF_OUT]:
        if not folder.exists():
            continue
        for path in folder.glob("*"):
            if path.is_file():
                path.unlink()


def clean_url(url):
    parsed = urlparse(urljoin(BASE, url))
    if parsed.netloc != "www.cthulhuclub.com":
        return None
    path = parsed.path or "/"
    if not path.endswith("/") and "." not in Path(path).name:
        path += "/"
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def should_visit(url):
    if not url:
        return False
    if any(url.startswith(prefix) for prefix in EXCLUDE_PREFIXES):
        return False
    lower = url.lower()
    if lower.endswith(EXCLUDE_EXTENSIONS):
        return False
    if "/wp-content/uploads/" in lower and not lower.endswith(".pdf"):
        return False
    if lower.endswith(".pdf"):
        return False
    return url.startswith(BASE)


def slugify(text, fallback):
    text = re.sub(r"https?://", "", text)
    text = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "-", text).strip("-")
    text = text[:80].strip("-")
    return text or fallback


def file_key(url):
    parsed = urlparse(url)
    base = slugify(parsed.path.strip("/") or "home", "page")
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    return f"{base}-{digest}"


def main_content(soup):
    for selector in ["article", ".entry-content", "#main-content", "main"]:
        node = soup.select_one(selector)
        if node and len(node.get_text(strip=True)) > 100:
            return node
    return soup.body or soup


def title_for(soup, url):
    if soup.find("h1"):
        return soup.find("h1").get_text(" ", strip=True)
    if soup.title:
        return soup.title.get_text(" ", strip=True)
    return url


def convert_page_to_md(url, html):
    soup = BeautifulSoup(html, "html.parser")
    title = title_for(soup, url)
    content = main_content(soup)

    for tag in content.select("script, style, noscript, form, iframe"):
        tag.decompose()

    body = md(str(content), heading_style="ATX")
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    front = [
        "---",
        f"title: {json.dumps(title, ensure_ascii=False)}",
        f"source_url: {json.dumps(url, ensure_ascii=False)}",
        "source: cthulhuclub",
        "copyright_note: 仅作个人资料整理与研究索引；未下载 /coc-mod/ 与 /coc-modules/ 模组正文。",
        "---",
        "",
        f"# {title}",
        "",
        f"来源：[{url}]({url})",
        "",
    ]
    return title, "\n".join(front) + body + "\n"


def convert_wp_item_to_md(kind, item):
    url = clean_url(item.get("link", ""))
    title = BeautifulSoup(item.get("title", {}).get("rendered", ""), "html.parser").get_text(
        " ", strip=True
    )
    html = item.get("content", {}).get("rendered", "") or item.get("excerpt", {}).get(
        "rendered", ""
    )
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.select("script, style, noscript, form, iframe"):
        tag.decompose()
    body = md(str(soup), heading_style="ATX")
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    front = [
        "---",
        f"title: {json.dumps(title, ensure_ascii=False)}",
        f"source_url: {json.dumps(url, ensure_ascii=False)}",
        f"wp_id: {item.get('id')}",
        f"wp_type: {kind}",
        f"date: {json.dumps(item.get('date'), ensure_ascii=False)}",
        f"modified: {json.dumps(item.get('modified'), ensure_ascii=False)}",
        "source: cthulhuclub",
        "copyright_note: 仅作个人资料整理与研究索引；未下载 /coc-mod/ 与 /coc-modules/ 模组正文。",
        "---",
        "",
        f"# {title}",
        "",
        f"来源：[{url}]({url})",
        "",
    ]
    return title, "\n".join(front) + body + "\n"


def fetch_wp_content():
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "COC-KP-Agent resource archiver (personal research; excludes modules)"
        }
    )
    records = []

    for kind, endpoint in WP_ENDPOINTS:
        page = 1
        while True:
            params = {
                "per_page": 50,
                "page": page,
                "context": "view",
            }
            print(f"[wp] {kind} page {page}")
            response = None
            last_error = None
            for attempt in range(1, 4):
                try:
                    response = session.get(endpoint, params=params, timeout=60)
                    break
                except Exception as exc:
                    last_error = exc
                    print(f"[retry] {kind} page {page} attempt {attempt}: {exc}")
                    time.sleep(attempt)
            if response is None:
                records.append(
                    {"url": endpoint, "wp_type": kind, "status": "error", "error": str(last_error)}
                )
                break
            if response.status_code == 400 and "rest_post_invalid_page_number" in response.text:
                break
            response.raise_for_status()
            response.encoding = "utf-8"
            try:
                items = response.json()
            except json.JSONDecodeError:
                json_start_candidates = [
                    pos for pos in [response.text.find("["), response.text.find("{")] if pos >= 0
                ]
                if not json_start_candidates:
                    records.append(
                        {
                            "url": response.url,
                            "wp_type": kind,
                            "status": "error",
                            "error": "response did not contain JSON",
                        }
                    )
                    break
                items = json.loads(response.text[min(json_start_candidates) :])
            if not items:
                break

            for item in items:
                url = clean_url(item.get("link", ""))
                if not should_visit(url):
                    continue
                key = file_key(url)
                raw_path = SITE_OUT / "raw_html" / f"{key}.html"
                md_path = SITE_OUT / "markdown" / f"{key}.md"
                raw_html = item.get("content", {}).get("rendered", "")
                raw_path.write_text(raw_html, encoding="utf-8")
                title, markdown = convert_wp_item_to_md(kind, item)
                md_path.write_text(markdown, encoding="utf-8")
                records.append(
                    {
                        "title": title,
                        "url": url,
                        "wp_id": item.get("id"),
                        "wp_type": kind,
                        "date": item.get("date"),
                        "modified": item.get("modified"),
                        "markdown": str(md_path.relative_to(ROOT)).replace("\\", "/"),
                        "raw_html": str(raw_path.relative_to(ROOT)).replace("\\", "/"),
                    }
                )

            total_pages = int(response.headers.get("X-WP-TotalPages", page))
            if page >= total_pages:
                break
            page += 1
            time.sleep(0.15)

    index_path = SITE_OUT / "index.json"
    index_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    return records


def extract_links(url, html):
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for a in soup.find_all("a", href=True):
        href = clean_url(a["href"])
        if should_visit(href):
            links.append(href)
    return links


def crawl_site(max_pages=350):
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "COC-KP-Agent resource archiver (personal research; excludes modules)"
        }
    )

    queue = list(SEEDS)
    seen = set()
    records = []

    while queue and len(seen) < max_pages:
        url = queue.pop(0)
        url = clean_url(url)
        if not should_visit(url) or url in seen:
            continue
        seen.add(url)
        print(f"[fetch] {len(seen):03d} {url}")

        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
        except Exception as exc:
            records.append({"url": url, "status": "error", "error": str(exc)})
            continue

        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type:
            continue

        html = response.text
        key = file_key(url)
        raw_path = SITE_OUT / "raw_html" / f"{key}.html"
        md_path = SITE_OUT / "markdown" / f"{key}.md"
        raw_path.write_text(html, encoding="utf-8")

        title, markdown = convert_page_to_md(url, html)
        md_path.write_text(markdown, encoding="utf-8")

        records.append(
            {
                "title": title,
                "url": url,
                "markdown": str(md_path.relative_to(ROOT)).replace("\\", "/"),
                "raw_html": str(raw_path.relative_to(ROOT)).replace("\\", "/"),
            }
        )

        for link in extract_links(url, html):
            if link not in seen and link not in queue:
                queue.append(link)
        time.sleep(0.25)

    index_path = SITE_OUT / "index.json"
    index_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    return records


def pdf_to_markdown(pdf_path):
    reader = PdfReader(str(pdf_path))
    title = pdf_path.stem
    out_path = PDF_OUT / f"{slugify(title, 'pdf')}.md"
    parts = [
        "---",
        f"title: {json.dumps(title, ensure_ascii=False)}",
        f"source_file: {json.dumps(str(pdf_path), ensure_ascii=False)}",
        "conversion: pypdf text extraction",
        "copyright_note: 用户本地已有 PDF，仅转换为本地 Markdown 便于个人检索。",
        "---",
        "",
        f"# {title}",
        "",
    ]

    for idx, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as exc:
            text = f"[本页抽取失败：{exc}]"
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        parts.extend([f"\n\n## Page {idx}\n", text])

    out_path.write_text("\n".join(parts).strip() + "\n", encoding="utf-8")
    return {
        "title": title,
        "source_file": str(pdf_path),
        "markdown": str(out_path.relative_to(ROOT)).replace("\\", "/"),
        "pages": len(reader.pages),
    }


def convert_pdfs():
    records = []
    for pdf in LOCAL_PDFS:
        if not pdf.exists():
            records.append({"source_file": str(pdf), "status": "missing"})
            continue
        print(f"[pdf] {pdf}")
        records.append(pdf_to_markdown(pdf))
    (PDF_OUT / "index.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return records


def write_readme(site_records, pdf_records):
    readme = OUT / "README.md"
    site_count = len([r for r in site_records if r.get("markdown")])
    pdf_count = len([r for r in pdf_records if r.get("markdown")])
    readme.write_text(
        "\n".join(
            [
                "# COC KP Agent Resource Library",
                "",
                "本目录保存 COC KP Agent demo 的本地资料储备。",
                "",
                "## 内容",
                "",
                f"- `cthulhuclub/markdown/`：从 Cthulhu Club 抓取并转换的非模组资料页，共 {site_count} 篇。",
                f"- `cthulhuclub/raw_html/`：对应原始 HTML，方便后续重新清洗。",
                f"- `rulebooks-md/`：用户本地 PDF 转换出的 Markdown，共 {pdf_count} 份。",
                "",
                "## 版权边界",
                "",
                "- 抓取脚本明确排除了 `/coc-mod/` 与 `/coc-modules/` 路径，未本地化模组正文。",
                "- 本资料库仅建议用于个人学习、检索、demo 原型验证和 RAG 分片实验。",
                "- 商业产品不应随包分发第三方站点正文、规则书全文或用户未授权上传资料。",
                "",
                "## 复跑",
                "",
                "```powershell",
                "python tools/build_resource_library.py",
                "```",
                "",
            ]
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    ensure_dirs()
    clear_generated_files()
    site_records = fetch_wp_content()
    pdf_records = convert_pdfs()
    write_readme(site_records, pdf_records)
    print(f"done: {len(site_records)} site records, {len(pdf_records)} pdf records")
