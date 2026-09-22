"""Pin the complete browser module graph to one release: python model/scripts/version_frontend.py."""
from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
VIEW = ROOT / "view"
START = "    <!-- BEGIN GENERATED MODULE VERSIONS -->"
END = "    <!-- END GENERATED MODULE VERSIONS -->"
IMPORT = re.compile(r'''\b(?:from\s*|import\s*\(?\s*)['"](\.[^'"\n]+\.js(?:\?[^'"\n]*)?)['"]''')


def build_html():
    modules = sorted(path for path in VIEW.rglob("*.js") if "tests" not in path.relative_to(VIEW).parts)
    inputs = sorted(modules + list((VIEW / "styles").rglob("*.css")) + [ROOT / "data/img/manifest.json"])
    digest = hashlib.sha256()
    for path in inputs:
        digest.update(str(path.relative_to(ROOT)).encode() + b"\0" + path.read_bytes() + b"\0")
    version = digest.hexdigest()[:12]
    imports = {}
    for path in modules:
        name = path.relative_to(VIEW).as_posix()
        imports[f"./{name}"] = f"./{name}?v={version}"
        for specifier in IMPORT.findall(path.read_text()):
            parsed = urlsplit(specifier)
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), parsed.path))
            if target.startswith("../") or not (VIEW / target).is_file():
                raise ValueError(f"Unresolved local import in {name}: {specifier}")
            # Existing ?v=scale-zoom / ?v=catalogue-back aliases must converge on
            # the same URL, including stateful modules such as assets.js.
            key = f"./{target}" + (f"?{parsed.query}" if parsed.query else "")
            imports[key] = f"./{target}?v={version}"
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
