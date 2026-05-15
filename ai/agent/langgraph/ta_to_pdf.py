"""
TA Markdown → PDF converter.

Converteert een Technische Analyse in Markdown-formaat naar een volledig
opgemaakte PDF met alle afbeeldingen, tabellen en tekst.

Gebruik:
  python ta_to_pdf.py <feature-id> [opties]

Argumenten:
  feature-id    ID van de feature (bv. feature-011-preworkout-website)

Opties:
  --input-dir   Map waar het .md bestand staat
                (standaard: docs/technical-analysis naast repo root)
  --output-dir  Map waar de PDF wordt opgeslagen
                (standaard: docs/technical-analysis-pdf naast repo root)

Rendering backends (automatisch gedetecteerd, in volgorde van voorkeur):
  1. Google Chrome (headless) — aanbevolen, hoogste kwaliteit
  2. weasyprint               — pip install weasyprint

Output:
  <output-dir>/<feature-id>.pdf
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# ── CSS stijl ─────────────────────────────────────────────────────────────────

_CSS = """
@page {
    size: A4;
    margin: 2cm 2.5cm;
}

body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #1a1a1a;
    max-width: 100%;
}

h1 {
    font-size: 22pt;
    color: #0d1b2a;
    border-bottom: 3px solid #0d1b2a;
    padding-bottom: 8px;
    margin-top: 0;
    page-break-after: avoid;
}

h2 {
    font-size: 15pt;
    color: #1b4f72;
    border-bottom: 1.5px solid #aed6f1;
    padding-bottom: 4px;
    margin-top: 30px;
    page-break-after: avoid;
}

h3 {
    font-size: 12pt;
    color: #1f618d;
    margin-top: 18px;
    page-break-after: avoid;
}

h4 {
    font-size: 11pt;
    color: #2874a6;
    margin-top: 14px;
    page-break-after: avoid;
}

p {
    margin: 6px 0 10px 0;
    orphans: 3;
    widows: 3;
}

ul, ol {
    margin: 6px 0 10px 22px;
    padding: 0;
}

li {
    margin-bottom: 3px;
}

/* Tabellen */
table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0 18px 0;
    font-size: 9.5pt;
    page-break-inside: auto;
}

thead {
    background-color: #1b4f72;
    color: #ffffff;
    display: table-header-group;
}

th {
    padding: 7px 10px;
    text-align: left;
    font-weight: 600;
    border: 1px solid #1b4f72;
}

td {
    padding: 6px 10px;
    border: 1px solid #d0dce8;
    vertical-align: top;
}

tr:nth-child(even) td {
    background-color: #f0f6fb;
}

/* Code */
code {
    font-family: "Courier New", Courier, monospace;
    font-size: 9pt;
    background: #f4f7f9;
    padding: 2px 5px;
    border-radius: 3px;
    color: #c0392b;
}

pre {
    background: #f4f7f9;
    border-left: 4px solid #aed6f1;
    padding: 12px 14px;
    border-radius: 4px;
    font-size: 8.5pt;
    white-space: pre-wrap;
    word-break: break-word;
    page-break-inside: avoid;
}

pre code {
    background: none;
    padding: 0;
    color: #1a1a1a;
}

/* Afbeeldingen */
img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 16px auto;
    border: 1px solid #d0dce8;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.10);
    page-break-inside: avoid;
}

hr {
    border: none;
    border-top: 1px solid #d0dce8;
    margin: 22px 0;
}

blockquote {
    border-left: 4px solid #aed6f1;
    margin: 10px 0;
    padding: 6px 14px;
    background: #f0f6fb;
    color: #555;
}

strong {
    color: #0d1b2a;
}
"""


# ── HTML bouwen ────────────────────────────────────────────────────────────────

def _md_to_html(md_text: str) -> str:
    """Converteer Markdown naar een volledige HTML-string met ingebedde CSS."""
    try:
        import markdown as _md
    except ImportError:
        print(
            "❌ 'markdown' pakket niet gevonden.\n"
            "   Installeer via: pip install markdown",
            file=sys.stderr,
        )
        sys.exit(1)

    converter = _md.Markdown(
        extensions=["tables", "fenced_code", "toc", "attr_list", "nl2br"]
    )
    body_html = converter.convert(md_text)

    return (
        '<!DOCTYPE html>\n<html lang="nl">\n<head>\n'
        '  <meta charset="utf-8">\n'
        f"  <style>{_CSS}</style>\n"
        "</head>\n<body>\n"
        f"{body_html}\n"
        "</body>\n</html>"
    )


# ── Rendering backends ─────────────────────────────────────────────────────────

_CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
    "chromium-browser",
]


def _find_chrome() -> str | None:
    for path in _CHROME_PATHS:
        if shutil.which(path) or Path(path).is_file():
            return path
    return None


def _render_chrome(html_path: Path, pdf_path: Path) -> None:
    chrome = _find_chrome()
    if not chrome:
        raise RuntimeError("Chrome niet gevonden")
    subprocess.run(
        [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--run-all-compositor-stages-before-draw",
            f"--print-to-pdf={pdf_path}",
            str(html_path),
        ],
        check=True,
        capture_output=True,
    )


def _render_weasyprint(html_path: Path, pdf_path: Path) -> None:
    try:
        from weasyprint import HTML as _HTML
    except ImportError:
        raise RuntimeError("weasyprint niet geïnstalleerd")
    _HTML(filename=str(html_path)).write_pdf(str(pdf_path))


def _detect_backend() -> str | None:
    if _find_chrome():
        return "chrome"
    try:
        import weasyprint  # noqa: F401
        return "weasyprint"
    except ImportError:
        pass
    return None


# ── Conversie ──────────────────────────────────────────────────────────────────

def convert(md_path: Path, pdf_path: Path) -> None:
    """Converteer een TA Markdown-bestand naar PDF."""
    backend = _detect_backend()
    if not backend:
        print(
            "❌ Geen rendering backend gevonden.\n"
            "   Installeer Google Chrome of: pip install weasyprint",
            file=sys.stderr,
        )
        sys.exit(1)

    md_text = md_path.read_text(encoding="utf-8")
    html = _md_to_html(md_text)

    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    # Schrijf HTML naar tijdelijk bestand naast de MD zodat relatieve
    # afbeeldingspaden correct worden opgelost
    with tempfile.NamedTemporaryFile(
        suffix=".html",
        dir=md_path.parent,
        delete=False,
        mode="w",
        encoding="utf-8",
    ) as tmp:
        tmp.write(html)
        tmp_path = Path(tmp.name)

    try:
        if backend == "chrome":
            print(f"  🖨️  Rendering via Google Chrome headless...")
            _render_chrome(tmp_path, pdf_path)
        else:
            print(f"  🖨️  Rendering via weasyprint...")
            _render_weasyprint(tmp_path, pdf_path)
    finally:
        tmp_path.unlink(missing_ok=True)


# ── CLI ────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="AI-SDLC — TA Markdown naar PDF converter"
    )
    parser.add_argument("feature_id", help="Feature ID (bv. feature-011-preworkout-website)")
    parser.add_argument(
        "--input-dir",
        default=None,
        help="Map met het .md bestand (standaard: docs/technical-analysis)",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Map voor de PDF output (standaard: docs/technical-analysis-pdf)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    feature_id = args.feature_id

    base = Path(__file__).parent.parent.parent.parent

    input_dir  = Path(args.input_dir)  if args.input_dir  else base / "docs" / "technical-analysis"
    output_dir = Path(args.output_dir) if args.output_dir else base / "docs" / "technical-analysis-pdf"

    md_path  = input_dir  / f"{feature_id}.md"
    pdf_path = output_dir / f"{feature_id}.pdf"

    print("==============================================")
    print("AI-SDLC — TA Markdown → PDF converter")
    print(f"Input  : {md_path}")
    print(f"Output : {pdf_path}")
    print("==============================================\n")

    if not md_path.exists():
        print(f"❌ TA Markdown niet gevonden: {md_path}", file=sys.stderr)
        sys.exit(1)

    print("🔄 Converteren...")
    convert(md_path, pdf_path)
    print(f"✅ PDF opgeslagen: {pdf_path}")


if __name__ == "__main__":
    main()
