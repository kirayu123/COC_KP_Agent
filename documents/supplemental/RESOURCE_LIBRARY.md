# COC KP Agent Resource Library

本目录保存 COC KP Agent demo 的本地资料储备。

## 内容

- `cthulhuclub/markdown/`：从 Cthulhu Club 抓取并转换的非模组资料页，共 1268 篇。
- `cthulhuclub/raw_html/`：对应原始 HTML，方便后续重新清洗。
- `rulebooks-md/`：用户本地 PDF 转换出的 Markdown，共 2 份。

## 版权边界

- 抓取脚本明确排除了 `/coc-mod/` 与 `/coc-modules/` 路径，未本地化模组正文。
- 本资料库仅建议用于个人学习、检索、demo 原型验证和 RAG 分片实验。
- 商业产品不应随包分发第三方站点正文、规则书全文或用户未授权上传资料。

## 复跑

```powershell
python tools/build_resource_library.py
```
