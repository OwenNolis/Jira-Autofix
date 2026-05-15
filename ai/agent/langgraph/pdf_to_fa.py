"""
PDF → FA Markdown converter.

Converteert een Functionele Analyse in PDF-formaat naar een gestructureerde
Markdown FA die vervolgens door fa_to_ta.py kan worden verwerkt.
Diagrammen en UI-designs worden als afbeeldingen geëxtraheerd en inline
in de Markdown opgenomen.

Gebruik:
  python pdf_to_fa.py <pdf-pad> <feature-id> [opties]

Argumenten:
  pdf-pad       Pad naar het PDF-bestand
  feature-id    ID voor het uitvoerbestand (bv. feature-011-order-management)

Opties:
  --output-dir  Map waar het .md bestand wordt opgeslagen
                (standaard: docs/functional-analysis naast repo root)
  --lang        Taal van de output: nl (standaard) of en
  --dpi         Resolutie voor pagina-rendering (standaard: 150)

Omgevingsvariabelen:
  GITHUB_TOKEN   Verplicht (gebruikt voor GitHub Models API)
  CLAUDE_MODEL   Optioneel (standaard: claude-sonnet-4-5)

Output:
  <output-dir>/<feature-id>.md
  <output-dir>/<feature-id>/page-N.png   (één per pagina)
"""

import argparse
import base64
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

# Optional: pymupdf
try:
    import fitz as _fitz
    _PYMUPDF_AVAILABLE = True
except Exception:
    _fitz = None  # type: ignore[assignment]
    _PYMUPDF_AVAILABLE = False

# Optional: pypdf (used only for page count)
try:
    from pypdf import PdfReader as _PdfReader
    _PYPDF_AVAILABLE = True
except Exception:
    _PdfReader = None  # type: ignore[assignment,misc]
    _PYPDF_AVAILABLE = False

# Load .env from repo root (for local use — ignored in GitHub Actions)
load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")


# ── Rendering backend detection ────────────────────────────────────────────────

def _detect_render_backend() -> str | None:
    if _PYMUPDF_AVAILABLE:
        return "pymupdf"
    if shutil.which("pdftoppm"):
        return "pdftoppm"
    if shutil.which("gs"):
        return "ghostscript"
    return None


_RENDER_BACKEND: str | None = _detect_render_backend()


# ── PDF page rendering ─────────────────────────────────────────────────────────

def render_pdf_pages(pdf_path: Path, output_dir: Path, dpi: int = 150) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    if _RENDER_BACKEND == "pymupdf":
        return _render_pymupdf(pdf_path, output_dir, dpi)
    if _RENDER_BACKEND == "pdftoppm":
        return _render_pdftoppm(pdf_path, output_dir, dpi)
    if _RENDER_BACKEND == "ghostscript":
        return _render_ghostscript(pdf_path, output_dir, dpi)
    return []


def _render_pymupdf(pdf_path: Path, output_dir: Path, dpi: int) -> list[Path]:
    doc = _fitz.open(str(pdf_path))
    scale = dpi / 72
    paths: list[Path] = []
    for i, page in enumerate(doc, 1):
        mat = _fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat)
        out = output_dir / f"page-{i}.png"
        pix.save(str(out))
        paths.append(out)
    doc.close()
    return paths


def _render_pdftoppm(pdf_path: Path, output_dir: Path, dpi: int) -> list[Path]:
    prefix = str(output_dir / "page")
    subprocess.run(
        ["pdftoppm", "-r", str(dpi), "-png", str(pdf_path), prefix],
        check=True, capture_output=True,
    )
    raw = sorted(output_dir.glob("page-*.png"), key=lambda p: p.name)
    normalized: list[Path] = []
    for i, src in enumerate(raw, 1):
        dst = output_dir / f"page-{i}.png"
        if src != dst:
            src.rename(dst)
        normalized.append(dst)
    return normalized


def _render_ghostscript(pdf_path: Path, output_dir: Path, dpi: int) -> list[Path]:
    output_pattern = str(output_dir / "page-%d.png")
    subprocess.run(
        ["gs", "-dBATCH", "-dNOPAUSE", "-dQUIET",
         "-sDEVICE=png16m", f"-r{dpi}",
         f"-sOutputFile={output_pattern}", str(pdf_path)],
        check=True, capture_output=True,
    )
    return sorted(output_dir.glob("page-*.png"), key=lambda p: p.name)


# ── LLM ───────────────────────────────────────────────────────────────────────

def get_llm() -> ChatOpenAI:
    api_key = os.environ.get("GITHUB_TOKEN")
    if not api_key:
        print("❌ GITHUB_TOKEN not set", file=sys.stderr)
        sys.exit(1)
    return ChatOpenAI(
        model=os.environ.get("CLAUDE_MODEL", "gpt-4o"),
        base_url="https://models.inference.ai.azure.com",
        api_key=api_key,
        temperature=0,
        max_tokens=4096,
    )


# ── Prompts ────────────────────────────────────────────────────────────────────

_CLASSIFY_PROMPT = """\
Je ontvangt {n} afbeeldingen. Elke afbeelding is één pagina van een PDF.
Afbeelding 1 = Pagina 1, Afbeelding 2 = Pagina 2, …, Afbeelding {n} = Pagina {n}.

Geef voor elke pagina aan of ze ECHTE visuele content bevatten.

VISUEEL (telt mee) — de pagina bevat minstens één van:
  • Een diagram met vormen, pijlen of verbindingen (ERD, sequence, component, deployment)
  • Een UI-mockup, wireframe of Figma-schermontwerp met herkenbare interface-elementen
  • Een grafiek of technisch schermontwerp

GEEN VISUEEL (telt NIET mee) — de pagina bestaat uitsluitend uit:
  • Lopende tekst, titels of subtitels
  • Bullet lists, genummerde lijsten of acceptance-criteria opsommingen
  • Tabellen van tekstuele data (ook als ze gekleurde headers hebben)
  • Requirements, business rules, NFR's of AC's als tekstblokken
  • Paginatitels, inhoudsopgave of sectiekoppen

Twijfelregel: als de pagina ALLEEN tekst, lijsten of tekst-tabellen bevat —
ook met opmaak, kleur of kaders — dan is het GEEN visuele pagina.

Geef ALLEEN dit JSON object terug (geen uitleg, geen code block):
{{"visual_pages": [<paginanummers met visuele content>]}}
"""

_CROP_PROMPT = """\
Je ontvangt één afbeelding: pagina {page} van een PDF.

Zoek alle afzonderlijke VISUELE frames op deze pagina.

Een VISUEEL frame IS:
  • Een diagram met vormen, pijlen of verbindingen (ERD, sequence, component, deployment)
  • Een UI-mockup, wireframe of Figma-schermontwerp met interface-elementen (knoppen, velden, menu's)

Een VISUEEL frame is NIET:
  • Een tekstblok, lijst of tabel van tekst — ook niet met gekleurde achtergrond of kaders
  • Acceptance criteria, requirements of business rules als tekst
  • Titels, subtitels of sectiekoppen
  • Tekst-rijen in een tabel

Als de pagina ALLEEN tekst, lijsten of tekst-tabellen bevat, geef dan "designs": [] terug.

Voor elk ECHT visueel frame:
1. Lees de DIRECTE TITEL van dit frame exact — de heading die onmiddellijk boven of
   binnen dit specifieke frame staat. Gebruik NIET een overkoepelende paginakop of
   sectienummer (bv. "3. Uitgebreide UML diagrams") als titel tenzij dat de enige
   heading op de pagina is; gebruik in dat geval de specifieke diagramnaam.
2. Bepaal de crop-box voor ALLEEN dit ene frame:
   - top    = bovenkant van de directe titel van DIT frame (niet eerder op de pagina)
   - bottom = onderkant van het visuele frame zelf (niet verder)
   - left/right = krap om het frame+titel blok, zonder brede marges
   Sluit uit: paginaheader, overkoepelende sectiekoppen boven dit frame,
   paginanummer, beschrijvingstekst van andere frames en omringende witruimte.
   Waarden zijn fracties 0.0–1.0 van de paginagrootte.
   Elk frame krijgt een eigen ONAFHANKELIJKE crop-box — overlap is niet toegestaan.

Geef ALLEEN dit JSON object terug (geen uitleg, geen code block):
{{
  "designs": [
    {{
      "title": "<exacte titel uit de afbeelding>",
      "type": "<erd|deployment|component|sequence|ui-mockup|other>",
      "crop": {{"top": <0.0-1.0>, "left": <0.0-1.0>, "right": <0.0-1.0>, "bottom": <0.0-1.0>}}
    }}
  ]
}}
"""


def _build_prompt_pages(
    feature_id: str,
    lang: str,
    num_pages: int,
    img_dir_name: str,
    entries: "list[_VisualEntry]",
) -> str:
    lang_instruction = (
        "Schrijf de output in het Nederlands."
        if lang == "nl"
        else "Write the output in English."
    )

    design_lines = "\n".join(
        f'  "{e.title}" → {img_dir_name}/{e.out_name}  (pagina {e.page})'
        for e in entries
    ) or "  (geen visuele designs gedetecteerd)"

    visual_pages = {e.page for e in entries}
    text_pages = [p for p in range(1, num_pages + 1) if p not in visual_pages]
    text_pages_str = (
        ", ".join(f"pagina {p}" for p in text_pages)
        if text_pages else "geen"
    )

    return f"""Je bent een SDLC-documentatie assistent.
Jouw taak: converteer ALLE inhoud van deze PDF naar een gestructureerde Markdown FA.
{lang_instruction}

Je ontvangt {num_pages} afbeeldingen (één per pagina).

── VISUELE DESIGNS (afbeeldingen al opgeslagen) ────────────────────────────────
{design_lines}

── TEKSTPAGINA'S (VERPLICHT volledig uitschrijven) ─────────────────────────────
De volgende pagina's bevatten ALLEEN tekst en moeten VOLLEDIG worden uitgeschreven:
{text_pages_str}

Sla GEEN van deze pagina's over. Extraheer van elke tekstpagina de volledige inhoud:
requirements, business rules, API contracten, acceptance criteria, non-functional
requirements, data, scope, UX notes — alles wat op die pagina staat.
Behoud alle technische details exact: veldnamen, types, constraints, HTTP-methodes,
paden, statuscodes, enum-waarden, REQ-/BR-/NFR-/AC-nummering.

── REGELS VOOR VISUELE DESIGNS ────────────────────────────────────────────────
De lijsttitels hoeven NIET exact overeen te komen met PDF-sectietitels —
match op de eerste betekenisvolle woorden of pagina-positie.

VERPLICHTE regels:
1. Elke entry krijgt een EIGEN ## sectie + afbeelding. Combineer nooit twee entries.
2. Gebruik UITSLUITEND het EXACTE pad uit de lijst:
   ![sectietitel](pad/zoals/in/de/lijst.png)
3. Gebruik de sectietitel uit de PDF als ## heading (niet de lijsttitel).
4. GEEN beschrijvingstekst — alleen ## sectietitel + afbeelding.

── STRUCTUUR ───────────────────────────────────────────────────────────────────
- Begin met: # Feature-{feature_id}: {{exacte titel uit de PDF}}
- Gebruik de EXACTE sectietitels uit de PDF als ## headings
- Plaatst visuele design-secties op de positie waar ze in de PDF staan
- Standaardsecties (als aanwezig): ## Doel, ## Scope, ## Requirements,
  ## Business rules, ## Non-functional, ## Data, ## API notes,
  ## Acceptance Criteria, ## UX notes
- Verzin NIETS — laat weg wat niet in de PDF staat
- Geef de output als RAW Markdown — geen code block omheen

Het feature-id voor dit document is: {feature_id}
"""


# ── Conversion ─────────────────────────────────────────────────────────────────

def _build_image_content(page_images: list[Path], detail: str = "low") -> list[dict]:
    content: list[dict] = []
    for img_path in page_images:
        b64 = base64.standard_b64encode(img_path.read_bytes()).decode()
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}", "detail": detail},
        })
    return content


class _VisualEntry:
    __slots__ = ("page", "title", "crop", "out_name")

    def __init__(self, page: int, title: str, crop: dict, out_name: str):
        self.page = page
        self.title = title
        self.crop = crop
        self.out_name = out_name


def _classify_visual_pages(page_images: list[Path]) -> list[int]:
    import json as _json
    n = len(page_images)
    print(f"  🔍 Step 1a — classifying visual pages ({n} pages)...")
    content = _build_image_content(page_images)
    content.append({"type": "text", "text": _CLASSIFY_PROMPT.format(n=n)})
    response = get_llm().invoke([HumanMessage(content=content)])
    raw = response.content.strip()
    if "```" in raw:
        raw = raw[raw.find("{"):raw.rfind("}") + 1]
    try:
        data = _json.loads(raw)
        visual = sorted(int(p) for p in data.get("visual_pages", []))
        print(f"  ✅ Visual page(s): {visual}")
        return visual
    except Exception as e:
        print(f"  ⚠️  Classification failed ({e}) — treating all pages as visual")
        return list(range(1, n + 1))


def _identify_designs_on_page(page_img: Path, page_num: int) -> list[tuple[str, dict]]:
    import json as _json
    b64 = base64.standard_b64encode(page_img.read_bytes()).decode()
    content = [
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        {"type": "text", "text": _CROP_PROMPT.format(page=page_num)},
    ]
    response = get_llm().invoke([HumanMessage(content=content)])
    raw = response.content.strip()
    if "```" in raw:
        raw = raw[raw.find("{"):raw.rfind("}") + 1]
    try:
        data = _json.loads(raw)
        return [
            (d["title"], d.get("crop", {}))
            for d in data.get("designs", [])
            if d.get("title")
        ]
    except Exception as e:
        print(f"  ⚠️  Crop analysis failed for page {page_num} ({e})")
        return [(f"Page {page_num}", {})]


def _identify_visual_pages(page_images: list[Path]) -> list[_VisualEntry]:
    visual_page_nums = _classify_visual_pages(page_images)
    entries: list[_VisualEntry] = []
    for page_num in visual_page_nums:
        page_img = page_images[page_num - 1]
        print(f"  ✂️  Step 1b — analysing designs on page {page_num}...")
        designs = _identify_designs_on_page(page_img, page_num)
        count = len(designs)
        for i, (title, crop) in enumerate(designs, 1):
            out_name = f"page-{page_num}.png" if count == 1 else f"page-{page_num}-{i}.png"
            entries.append(_VisualEntry(page_num, title, crop, out_name))
            print(f"    → {out_name}: {title}")
    return entries


def _crop_and_save(src: Path, out: Path, crop: dict, padding: int = 8) -> None:
    try:
        from PIL import Image as _Image
        img = _Image.open(src).convert("RGB")
        w, h = img.size

        if crop:
            left   = int(max(0.0, crop.get("left",   0.0)) * w)
            top    = int(max(0.0, crop.get("top",    0.0)) * h)
            right  = int(min(1.0, crop.get("right",  1.0)) * w)
            bottom = int(min(1.0, crop.get("bottom", 1.0)) * h)
            if right > left and bottom > top:
                img = img.crop((left, top, right, bottom))

        gray = img.convert("L")
        content_mask = gray.point(lambda p: 255 if p < 240 else 0)
        bbox = content_mask.getbbox()
        if bbox:
            cl, ct, cr, cb = bbox
            iw, ih = img.size
            cl = max(0, cl - padding)
            ct = max(0, ct - padding)
            cr = min(iw, cr + padding)
            cb = min(ih, cb + padding)
            img = img.crop((cl, ct, cr, cb))

        img.save(out)
    except Exception as e:
        print(f"  ⚠️  Crop failed for {out.name}: {e}")


def convert_with_page_images(
    page_images: list[Path],
    feature_id: str,
    lang: str,
    img_dir_name: str,
) -> str:
    entries = _identify_visual_pages(page_images)

    print(f"  ✂️  Cropping and saving images ({len(entries)} design(s))...")
    img_dir = page_images[0].parent

    processed_pages = {e.page for e in entries}
    for page_num in processed_pages:
        for stale in img_dir.glob(f"page-{page_num}-*.png"):
            stale.unlink(missing_ok=True)

    for entry in entries:
        src = page_images[entry.page - 1]
        out = img_dir / entry.out_name
        _crop_and_save(src, out, entry.crop)
    print("  ✅ Cropping done")

    print(f"  📤 Pass 2 — generating FA ({len(page_images)} pages)...")
    content = _build_image_content(page_images)
    content.append({
        "type": "text",
        "text": _build_prompt_pages(feature_id, lang, len(page_images), img_dir_name, entries),
    })
    response = get_llm().invoke([HumanMessage(content=content)])
    return response.content.strip()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```markdown"):
        text = text[len("```markdown"):].lstrip()
    elif text.startswith("```"):
        text = text[3:].lstrip()
    if text.endswith("```"):
        text = text[:-3].rstrip()
    return text.strip()


def _validate_fa_output(text: str) -> list[str]:
    warnings = []
    for section in ("## Doel", "## Scope", "## Requirements"):
        if section not in text:
            warnings.append(f"Section '{section}' missing from generated FA")
    if not re.search(r"- REQ-\d{3}:", text):
        warnings.append("No requirements found (REQ-NNN format)")
    return warnings


def _count_pdf_pages(pdf_path: Path) -> int | None:
    if _PYPDF_AVAILABLE:
        try:
            return len(_PdfReader(pdf_path).pages)
        except Exception:
            pass
    if shutil.which("pdfinfo"):
        try:
            result = subprocess.run(
                ["pdfinfo", str(pdf_path)], capture_output=True, text=True
            )
            for line in result.stdout.splitlines():
                if line.lower().startswith("pages:"):
                    return int(line.split(":")[-1].strip())
        except Exception:
            pass
    return None


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Convert a PDF Functional Analysis to Markdown with inline images"
    )
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument("feature_id", help="Feature ID (e.g. feature-011-order-management)")
    parser.add_argument(
        "--output-dir", default="",
        help="Output directory for the .md file (default: docs/functional-analysis)",
    )
    parser.add_argument(
        "--lang", choices=["nl", "en"], default="nl",
        help="Language of the generated FA (default: nl)",
    )
    parser.add_argument(
        "--dpi", type=int, default=150,
        help="Resolution for page rendering in DPI (default: 150)",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path).resolve()
    if not pdf_path.exists():
        print(f"❌ PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    if pdf_path.suffix.lower() != ".pdf":
        print(f"❌ File is not a PDF: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        if os.environ.get("AISDLC_REPO_ROOT"):
            base = Path(os.environ["AISDLC_REPO_ROOT"])
        else:
            base = Path(__file__).parent.parent.parent.parent
        output_dir = base / "docs" / "functional-analysis"

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{args.feature_id}.md"
    img_dir = output_dir / args.feature_id
    img_dir_name = args.feature_id

    print("==============================================")
    print("AI-SDLC — PDF → FA Markdown converter")
    print(f"PDF    : {pdf_path.name}")
    print(f"Output : {output_path}")
    print(f"Images : {img_dir}/")
    print(f"Render : {_RENDER_BACKEND or 'none (no rendering available)'}")
    print(f"Model  : {os.environ.get('CLAUDE_MODEL', 'gpt-4o')}")
    print("==============================================\n")

    pdf_bytes = pdf_path.read_bytes()
    pdf_size = len(pdf_bytes)
    num_pages = _count_pdf_pages(pdf_path)
    page_label = f", {num_pages} page(s)" if num_pages else ""
    print(f"📂 PDF loaded: {pdf_size / 1024:.1f} KB{page_label}")

    # Step 1: render pages
    page_images: list[Path] = []
    if _RENDER_BACKEND:
        print(f"\n🖼️  Rendering pages as PNG ({args.dpi} DPI)...")
        try:
            page_images = render_pdf_pages(pdf_path, img_dir, dpi=args.dpi)
            print(f"  ✅ {len(page_images)} page images saved in {img_dir.name}/")
        except Exception as e:
            print(f"  ⚠️  Rendering failed ({e})", file=sys.stderr)
            page_images = []
    else:
        print(
            "\n❌ No rendering tool available (pymupdf/pdftoppm/gs).\n"
            "   Install poppler: apt-get install poppler-utils\n"
            "   Or: pip install pymupdf",
            file=sys.stderr,
        )
        sys.exit(1)

    if not page_images:
        print("❌ No pages rendered — cannot continue.", file=sys.stderr)
        sys.exit(1)

    # Step 2: generate FA
    print("\n🤖 Generating FA Markdown...")
    fa_markdown = convert_with_page_images(page_images, args.feature_id, args.lang, img_dir_name)
    fa_markdown = _strip_code_fence(fa_markdown)

    # Step 3: validate and write
    warnings = _validate_fa_output(fa_markdown)
    if warnings:
        print("\n⚠️  Warnings:")
        for w in warnings:
            print(f"   - {w}")

    output_path.write_text(fa_markdown, encoding="utf-8")

    print(f"\n✅ FA Markdown saved : {output_path}")
    print(f"✅ Page images       : {img_dir}/ ({len(page_images)} files)")
    print("\nNext step:")
    print(f"  python fa_to_ta.py {args.feature_id}")


if __name__ == "__main__":
    main()
