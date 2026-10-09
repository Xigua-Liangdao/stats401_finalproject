"""Resolve isolated league/year artifacts while retaining the legacy entry point."""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]


def league_slug(league):
    """Keep simple league codes readable; disambiguate punctuation/spacing."""
    label = str(league).strip()
    if not label:
        raise ValueError("League must not be empty")
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or "league"
    if not re.fullmatch(r"[A-Za-z0-9]+", label):
        slug += "-" + hashlib.sha256(label.encode()).hexdigest()[:8]
    return slug


def dataset_paths(league, year, slug=None, *, root=ROOT, legacy=False, raw_path=None):
    year = int(year)
    if not 2000 <= year <= 2100:
        raise ValueError("Dataset year must be between 2000 and 2100.")
    slug = slug or league_slug(league)
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError("Dataset slug must contain lowercase letters, digits and separating hyphens.")
    if legacy and (league != "LPL" or year != 2025):
        raise ValueError("Legacy output paths are reserved for LPL 2025.")
    root = Path(root).resolve()
    suffix = Path() if legacy else Path(slug) / str(year)
    return {"id": f"{slug}-{year}", "path": f"{slug}/{year}",
            "raw": Path(raw_path).resolve() if raw_path else
                   root / ("data/raw/lpl_2025.csv.gz" if legacy else f"data/raw/{slug}/{year}/matches.csv.gz"),
            "processed": root / "data/processed" / suffix,
            "test": root / "data/test" / suffix,
            "reports": root / "model/reports" / suffix,
            "figures": root / "model/figures" / suffix}
