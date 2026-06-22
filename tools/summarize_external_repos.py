import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXTERNAL = ROOT / "external"
OUT = ROOT / "documents" / "project" / "external_repo_inventory.json"


README_NAMES = ["README.md", "readme.md", "README", "readme"]
LICENSE_NAMES = ["LICENSE", "LICENSE.md", "License", "license", "COPYING"]


def read_head(path, limit=4000):
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    return text[:limit]


def detect_license(repo):
    for name in LICENSE_NAMES:
        path = repo / name
        if path.exists() and path.is_file():
            text = read_head(path, 1200).lower()
            if "gnu affero general public license" in text or "agpl" in text:
                return "AGPL"
            if "gnu general public license" in text and "version 3" in text:
                return "GPL-3.0"
            if "gnu general public license" in text and "version 2" in text:
                return "GPL-2.0"
            if "mit license" in text or "permission is hereby granted" in text:
                return "MIT"
            if "apache license" in text:
                return "Apache"
            return path.name
    return "unknown"


def detect_stack(repo, files):
    names = {p.name.lower() for p in files}
    suffixes = {p.suffix.lower() for p in files}
    stack = []
    if "package.json" in names:
        stack.append("node/js")
    if "vite.config.ts" in names or "vite.config.js" in names:
        stack.append("vite")
    if "pyproject.toml" in names or "requirements.txt" in names or ".py" in suffixes:
        stack.append("python")
    if "module.json" in names or "system.json" in names:
        stack.append("foundry")
    if ".vue" in suffixes:
        stack.append("vue")
    if ".tsx" in suffixes or ".jsx" in suffixes:
        stack.append("react")
    if ".html" in suffixes and ".css" in suffixes:
        stack.append("html/css")
    if ".rs" in suffixes:
        stack.append("rust")
    return sorted(set(stack))


def repo_summary(repo):
    all_files = [p for p in repo.rglob("*") if p.is_file() and ".git" not in p.parts]
    readme = next((repo / name for name in README_NAMES if (repo / name).exists()), None)
    package = repo / "package.json"
    pyproject = repo / "pyproject.toml"
    requirements = repo / "requirements.txt"
    module_json = repo / "module.json"
    system_json = repo / "system.json"
    src_dirs = []
    for candidate in ["src", "app", "apps", "dm_bot", "scripts", "templates", "module", "packs", "compendiums"]:
        if (repo / candidate).exists():
            src_dirs.append(candidate)
    return {
        "name": repo.name,
        "path": str(repo.relative_to(ROOT)).replace("\\", "/"),
        "file_count": len(all_files),
        "size_bytes": sum(p.stat().st_size for p in all_files),
        "license": detect_license(repo),
        "stack": detect_stack(repo, all_files),
        "source_dirs": src_dirs,
        "has_readme": readme is not None,
        "readme_head": read_head(readme, 2500) if readme else "",
        "has_package_json": package.exists(),
        "package_json": json.loads(read_head(package, 20000)) if package.exists() else None,
        "has_pyproject": pyproject.exists(),
        "pyproject_head": read_head(pyproject, 3000) if pyproject.exists() else "",
        "has_requirements": requirements.exists(),
        "requirements_head": read_head(requirements, 2000) if requirements.exists() else "",
        "has_module_json": module_json.exists(),
        "module_json": json.loads(read_head(module_json, 20000)) if module_json.exists() else None,
        "has_system_json": system_json.exists(),
        "system_json": json.loads(read_head(system_json, 20000)) if system_json.exists() else None,
        "top_level": [p.name for p in repo.iterdir() if p.name != ".git"][:80],
    }


def main():
    repos = [p for p in EXTERNAL.iterdir() if p.is_dir() and (p / ".git").exists()]
    summaries = [repo_summary(repo) for repo in sorted(repos, key=lambda p: p.name.lower())]
    OUT.write_text(json.dumps(summaries, ensure_ascii=False, indent=2), encoding="utf-8")
    for item in summaries:
        print(
            f"{item['name']}\t{item['license']}\t{','.join(item['stack'])}\t"
            f"{item['file_count']} files\t{item['size_bytes']} bytes"
        )


if __name__ == "__main__":
    main()
