"""Pin the complete browser module graph to one release: python model/scripts/version_frontend.py."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
VIEW = ROOT / "view"
START = "    <!-- BEGIN GENERATED MODULE VERSIONS -->"
END = "    <!-- END GENERATED MODULE VERSIONS -->"
IMPORT = re.compile(r'''\b(?:from\s*|import\s*\(?\s*)['"](\.[^'"\n]+\.js(?:\?[^'"\n]*)?)['"]''')
LANG = ROOT / "data" / "lang"


def language_binding(stem, used):
    ident = re.sub(r"[^A-Za-z0-9_]", "_", stem)
    if not ident or not (ident[0].isalpha() or ident[0] == "_"):
        ident = f"_{ident}"
    binding = ident
    suffix = 2
    while binding in used:
        binding = f"{ident}_{suffix}"
        suffix += 1
    used.add(binding)
    return binding


PACK_SKIP = {"index.js", "meta.js", "names.js"}


def pack_dirs():
    folders = sorted(path for path in LANG.iterdir() if path.is_dir() and (path / "meta.js").is_file())
    if not any(path.name == "en" for path in folders):
        raise ValueError("data/lang/en/meta.js is required")
    return folders


def message_files(folder):
    return sorted(path for path in folder.glob("*.js") if path.name not in PACK_SKIP)


def pack_index_source(folder):
    used = set()
    bindings = [(path.stem, language_binding(path.stem, used)) for path in message_files(folder)]
    lines = [
        "/** Generated from the message files in this folder. */",
        "import { locale, name } from './meta.js';",
        "import names from './names.js';",
        *[f"import {binding} from './{stem}.js';" for stem, binding in bindings],
        "",
        "export default {",
        "  name,",
        "  locale,",
        "  messages: {",
        *[f"    ...{binding}," for _, binding in bindings],
        "  },",
        "  names,",
        "};",
        "",
    ]
    return "\n".join(lines)


def language_index_source(folders):
    used = set()
    bindings = [(path.name, language_binding(path.name, used)) for path in folders]
    lines = [
        "/** Generated from the language folders in this directory. */",
        *[f"import {binding} from './{stem}/index.js';" for stem, binding in bindings],
        "",
        "export const languagePacks = {",
        *[f"  {json.dumps(stem)}: {binding}," for stem, binding in bindings],
        "};",
        "",
        "export const defaultLanguage = 'en';",
        "",
    ]
    return "\n".join(lines)


def sync_language_index(check):
    folders = pack_dirs()
    targets = [(folder / "index.js", pack_index_source(folder)) for folder in folders]
    targets.append((LANG / "index.js", language_index_source(folders)))
    stale = []
    for path, source in targets:
        current = path.read_text() if path.is_file() else ""
        if current != source:
            stale.append(path)
            if not check:
                path.write_text(source)
    if check and stale:
        raise SystemExit("Stale language index: run python model/scripts/version_frontend.py")


def frontend_modules():
    view_modules = [path for path in VIEW.rglob("*.js") if "tests" not in path.relative_to(VIEW).parts]
    lang_modules = list(LANG.rglob("*.js")) if LANG.is_dir() else []
    return sorted(view_modules + lang_modules)


def map_key(path):
    relative = Path(os.path.relpath(path.resolve(), VIEW.resolve())).as_posix()
    return relative if relative.startswith("../") else f"./{relative}"


def build_html():
    modules = frontend_modules()
    inputs = sorted(modules + list((VIEW / "styles").rglob("*.css")) + [ROOT / "data/img/manifest.json"])
    digest = hashlib.sha256()
    for path in inputs:
        digest.update(str(path.relative_to(ROOT)).encode() + b"\0" + path.read_bytes() + b"\0")
    version = digest.hexdigest()[:12]
    imports = {}
    for path in modules:
        key = map_key(path)
        imports[key] = f"{key}?v={version}"
        for specifier in IMPORT.findall(path.read_text()):
            parsed = urlsplit(specifier)
            target = (path.parent / parsed.path).resolve()
            if not target.is_file() or not (target.is_relative_to(VIEW) or target.is_relative_to(LANG)):
                raise ValueError(f"Unresolved local import in {path.relative_to(ROOT)}: {specifier}")
            # Existing ?v=scale-zoom / ?v=catalogue-back aliases must converge on
            # the same URL, including stateful modules such as assets.js.
            alias = map_key(target) + (f"?{parsed.query}" if parsed.query else "")
            imports[alias] = f"{map_key(target)}?v={version}"
    block = "\n".join([START, '    <script type="importmap">',
                        json.dumps({"imports": dict(sorted(imports.items()))}, indent=2),
                        "    </script>", END])
    html = (VIEW / "index.html").read_text()
    if START in html:
        html = re.sub(re.escape(START) + r"[\s\S]*?" + re.escape(END), lambda _: block, html)
    else:
        html = html.replace("  </head>", block + "\n  </head>")
    html = re.sub(r'(href="\./styles/[^"?]+\.css)(?:\?[^"\s]*)?("\s*/>)',
                  lambda match: f'{match[1]}?v={version}{match[2]}', html)
    html = re.sub(r'(src="\./app\.js)(?:\?[^"\s]*)?(")',
                  lambda match: f'{match[1]}?v={version}{match[2]}', html)
    return html, version, len(modules)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if index.html has stale asset versions")
    args = parser.parse_args()
    sync_language_index(args.check)
    html, version, count = build_html()
    path = VIEW / "index.html"
    if args.check:
        if path.read_text() != html:
            raise SystemExit("Stale browser release: run python model/scripts/version_frontend.py")
    else:
        path.write_text(html)
    print(f"Browser release {version}: {count} modules share one version; CSS and entry point are pinned.")


if __name__ == "__main__":
    main()
