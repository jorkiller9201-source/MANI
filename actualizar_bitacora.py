# -*- coding: utf-8 -*-
"""Project log Nova 3 — MANI, NASA Space Apps 2026 (English)."""

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

NAVY = RGBColor(0x0B, 0x1F, 0x3A)
GOLD = RGBColor(0xB8, 0x86, 0x0B)
INK = RGBColor(0x1C, 0x1C, 0x1C)
MUTED = RGBColor(0x3D, 0x4C, 0x5C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

OUT = r"C:\Users\jorge\NASA_SPACE_APP\Bitacora_Nova3_MANI.docx"


def set_run_font(run, name="Calibri", size=12, bold=False, color=INK, italic=False):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color


def add_text(paragraph, text, size=12, bold=False, color=INK, italic=False):
    run = paragraph.add_run(text)
    set_run_font(run, size=size, bold=bold, color=color, italic=italic)
    return run


def set_cell_shading(cell, hex_color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def set_cell_margins(cell, top=60, bottom=60, left=100, right=100):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = OxmlElement("w:tcMar")
    for m, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement(f"w:{m}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        tcMar.append(node)
    tcPr.append(tcMar)


def prevent_row_split(row):
    tr = row._tr
    trPr = tr.get_or_add_trPr()
    cant = OxmlElement("w:cantSplit")
    trPr.append(cant)


def body(doc, text, size=12, space_after=8, space_before=0, bold=False, color=INK, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing = 1.15
    add_text(p, text, size=size, bold=bold, color=color, italic=italic)
    return p


def heading(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(6)
    add_text(p, text, size=16, bold=True, color=NAVY)
    return p


def bullet(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.7)
    p.paragraph_format.first_line_indent = Cm(-0.35)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.12
    add_text(p, "•  ", size=12, bold=True, color=GOLD)
    add_text(p, text, size=12, color=INK)
    return p


def callout(doc, paragraphs, fill="FFF8E7"):
    table = doc.add_table(rows=1, cols=1)
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    set_cell_margins(cell, top=90, bottom=90, left=140, right=140)
    cell.paragraphs[0].clear()
    first = True
    for block in paragraphs:
        if first:
            p = cell.paragraphs[0]
            first = False
        else:
            p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        if isinstance(block, tuple):
            text, kwargs = block
            add_text(p, text, **kwargs)
        else:
            add_text(p, block, size=11, color=NAVY)
    # last para less spacing
    cell.paragraphs[-1].paragraph_format.space_after = Pt(0)
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(4)


def entry_table(doc, hora, titulo, contenido_bullets, resultado=None):
    table = doc.add_table(rows=1, cols=1)
    cell = table.cell(0, 0)
    set_cell_shading(cell, "F4F7FB")
    set_cell_margins(cell, top=80, bottom=80, left=120, right=120)

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    add_text(p, hora, size=12, bold=True, color=GOLD)
    add_text(p, "  ·  ", size=12, color=MUTED)
    add_text(p, titulo, size=12, bold=True, color=NAVY)

    for item in contenido_bullets:
        bp = cell.add_paragraph()
        bp.paragraph_format.left_indent = Cm(0.35)
        bp.paragraph_format.space_after = Pt(2)
        bp.paragraph_format.space_before = Pt(0)
        bp.paragraph_format.line_spacing = 1.12
        add_text(bp, "•  ", size=11, bold=True, color=GOLD)
        add_text(bp, item, size=11, color=INK)

    if resultado:
        rp = cell.add_paragraph()
        rp.paragraph_format.space_before = Pt(4)
        rp.paragraph_format.space_after = Pt(0)
        add_text(rp, "Result: ", size=11, bold=True, color=NAVY)
        add_text(rp, resultado, size=11, color=INK)

    prevent_row_split(table.rows[0])
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(6)


def footer(section):
    f = section.footer
    f.is_linked_to_previous = False
    p = f.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_text(
        p,
        "Nova 3 Project Log  ·  MANI  ·  Lunar Landing Site Navigator  ·  NASA Space Apps 2026",
        size=9,
        color=MUTED,
    )


def main():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.59)
    section.page_height = Cm(27.94)
    section.top_margin = Cm(1.6)
    section.bottom_margin = Cm(1.6)
    section.left_margin = Cm(1.9)
    section.right_margin = Cm(1.9)
    footer(section)

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(12)
    normal.font.color.rgb = INK

    banner = doc.add_table(rows=1, cols=1)
    cell = banner.cell(0, 0)
    set_cell_shading(cell, "0B1F3A")
    set_cell_margins(cell, top=130, bottom=130, left=160, right=160)
    cell.paragraphs[0].clear()
    t = cell.paragraphs[0]
    add_text(t, "MANI PROJECT LOG", size=22, bold=True, color=WHITE)
    sub = cell.add_paragraph()
    sub.paragraph_format.space_before = Pt(4)
    sub.paragraph_format.space_after = Pt(0)
    add_text(sub, "Team Nova 3  ·  NASA Space Apps Challenge 2026", size=12, color=RGBColor(0xF2, 0xD2, 0x7A))
    meta = cell.add_paragraph()
    meta.paragraph_format.space_before = Pt(2)
    meta.paragraph_format.space_after = Pt(0)
    add_text(
        meta,
        "Venue: Chiminike, Tegucigalpa  ·  Sponsor: Fundación Próspera  ·  14–15 November 2026",
        size=10,
        color=RGBColor(0xD6, 0xE2, 0xF0),
    )

    heading(doc, "Clarifying note")
    callout(
        doc,
        [
            (
                "This log documents, hour by hour, how team Nova 3 builds MANI during the NASA Space Apps Challenge 2026.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Primary work tool. We use Cursor as the assisted development environment. Super Intelligence (SI) is support only: it helps us organize, look up data, write code, and document faster. Technical decisions, review of results, scientific validity, and project responsibility belong to the human team. In Space Apps 2026 and in this project we say SI, not “AI”.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Team leader. Jorge Alberto Gutiérrez Canales, Military Mechatronics Engineer, Captain in the Honduran Air Force, master’s candidate in Artificial Intelligence and Data Analytics (SI-focused graduate study) at Universidad Internacional de La Rioja (UNIR, Spain), with complementary data analytics training (PSU Data Analytics). He leads the calculations, cited NASA data, and building the application.",
                {"size": 11, "color": NAVY},
            ),
            (
                "André Enoc Mejía. Jorge’s putative son. He has his own NASA Space Apps Challenge track record (multi-year participation; People’s Choice Award in 2023 and 2024), founded Exoplanets Lab, is a Próspera ambassador, and has represented Honduras in NASA-linked STEM forums. In Nova 3 he owns the English video, the project-page text, and the pitch opening. Jorge’s mission with André is that he keeps learning: each challenge should teach him to explain a technical decision clearly and to work as a team.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Lissa Paola Mejía Romero. André Enoc Mejía’s mother and Industrial Engineer. In Nova 3 she supports and guides André, and handles social media and outreach for project progress during the hackathon.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Jorge Alberto Gutiérrez Mejía. Jorge’s son, age 7. He joins the team so that, from an early age, he can see how a project is built from scratch: the problem, the plan, hour-by-hour work, rehearsal, and delivery. He is not asked to produce code; he is invited to observe, ask questions, and understand the process.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Official challenge: Lunar Landing Site Navigator (CLPS program). Product: MANI, a south-pole landing-site and date comparator.",
                {"size": 11, "bold": True, "color": NAVY},
            ),
        ],
        fill="FFF8E7",
    )

    heading(doc, "How this log is updated")
    body(
        doc,
        "It is written in parallel with development, by time blocks (Tegucigalpa local time). Only project-relevant progress is recorded: what the team advanced, what is ready, and which decisions matter. Internal tooling instructions and low-value technical noise are omitted.",
    )

    heading(doc, "Saturday 14 November 2026 — Chiminike, Tegucigalpa")
    body(
        doc,
        "Hackathon start. Local venue with support from Fundación Próspera.",
        italic=True,
        color=MUTED,
        space_after=10,
    )

    entry_table(
        doc,
        "09:00",
        "Challenge brief and resources",
        [
            "Review of the Lunar Landing Site Navigator challenge and its official resources.",
            "Confirm JPL Horizons for Sun/Earth calculations; Quickmap and Moon Trek for terrain.",
            "Confirm venue network can reach Horizons.",
        ],
        resultado="Saturday scope: compare six south-pole sites with real power and communications numbers.",
    )

    entry_table(
        doc,
        "09:25",
        "Opening this project log",
        [
            "Open this log to document the team’s process during the hackathon.",
            "Leave the clarifying note on the team, Super Intelligence (SI) as support, and Cursor.",
        ],
        resultado="Project log running in parallel with MANI development.",
    )

    entry_table(
        doc,
        "09:31",
        "Lissa Paola Mejía Romero joins",
        [
            "Add Lissa Paola Mejía Romero, André’s mother and Industrial Engineer.",
            "Her role: support and guidance for André, social media, and outreach.",
        ],
        resultado="Team: Jorge (technical lead), André (video and pitch), Lissa (support, networks, outreach), and Jorge Alberto Gutiérrez Mejía (7, learning the process).",
    )

    entry_table(
        doc,
        "09:53",
        "Tone of the project log",
        [
            "Agree to write more generally: project progress and decisions, without unnecessary internal detail.",
        ],
        resultado="The log stays a team narrative, not a tooling diary.",
    )

    entry_table(
        doc,
        "09:56",
        "Evaluation criteria and SI use",
        [
            "Bring local criteria into the project: impact, creativity, validity, relevance, and presentation.",
            "Set SI use rules: accelerate work (code, docs, prototypes); do not replace the idea or show unverified results.",
            "Delivery: English project page, short demo, and SI-use declaration.",
        ],
        resultado="MANI is built with NASA data as the core and SI only as declared support.",
    )

    entry_table(
        doc,
        "09:59",
        "Terminology: Super Intelligence (SI)",
        [
            "Agree to always say Super Intelligence (SI), not “AI”, in the log, rules, project sheet, and presentation.",
        ],
        resultado="Project language aligned with Space Apps 2026.",
    )

    entry_table(
        doc,
        "10:07",
        "Plan updated with official resources",
        [
            "Add challenge resources to the plan: Horizons (calculation core), Quickmap, Moon Trek, and the CSA lunar portal.",
            "Clear which resource supplies numbers versus terrain or context only.",
        ],
        resultado="Team plan and André’s plan already cite Space Apps official sources.",
    )

    entry_table(
        doc,
        "10:12 – 10:25",
        "MANI web architecture",
        [
            "Define the web app with worldwide registration, Heimdall-style security, and Oracle domain.",
            "Ports: frontend 3100, API 8100, public HTTPS 9543.",
            "3D lunar map (Cesium + Moon Trek) instead of SKADI’s Earth map.",
        ],
        resultado="Architecture plan ready to build.",
    )

    entry_table(
        doc,
        "10:25 – 11:00",
        "Building the application",
        [
            "FastAPI backend with register, login, sites, and Horizons comparison.",
            "Sun and Earth data preloaded for the six south-pole sites.",
            "Next.js frontend with 3D lunar map, comparison, and English report.",
            "Caddy :9543 setup and SI-use declaration.",
        ],
        resultado="MANI operable locally (:3100 / :8100) with NASA data as the core.",
    )

    entry_table(
        doc,
        "10:49",
        "3D lunar map fix",
        [
            "Fix the lunar ellipsoid when creating the Cesium globe (no longer assigned after the fact).",
            "Moon Trek tiles go through a local proxy so the browser can load them.",
        ],
        resultado="Lunar viewer stops failing and shows the south pole with markers.",
    )

    entry_table(
        doc,
        "10:58",
        "3D lunar map visible",
        [
            "Cesium loads from local files; LRO WAC Moon Trek tiles via proxy.",
            "Camera adjusted to show the lunar disk and approach the south pole.",
        ],
        resultado="Lunar globe visible in the app; mouse orbit works.",
    )

    entry_table(
        doc,
        "11:17",
        "Language selector (12 languages)",
        [
            "Place a language selector left of Log out.",
            "Twelve main languages available; UI and one-page report follow the choice.",
            "Language remembered in the browser for the next visit.",
        ],
        resultado="MANI can be presented in several languages, including the comparison report.",
    )

    entry_table(
        doc,
        "13:05",
        "Geographic location in the compare and About",
        [
            "Selenographic lat/lon of each selected site become part of the comparison and report.",
            "Cross the geographic point with the Horizons ephemeris used for Sun and Earth.",
            "Add About next to language: explains calculations, CLPS purpose, and team Nova 3.",
        ],
        resultado="A/B decision anchored to real coordinates; visitors can read how and why it is calculated.",
    )

    entry_table(
        doc,
        "13:12",
        "Official references in About",
        [
            "Document official Horizons (SSD), HTTP API, Moon Trek, CLPS, and Space Apps links in the app.",
            "List APIs used and Cursor as the project’s Super Intelligence (SI) tool.",
            "Clarify that the 0–100 score is a team heuristic; elevations come from Horizons.",
        ],
        resultado="Any judge or visitor can verify method, sources, and SI use from About.",
    )

    entry_table(
        doc,
        "13:21",
        "LOLA topographic horizon in the compare",
        [
            "Add 360° horizon masks from the LOLA polar DEM LDEM_75S_240M (PDS) for the six sites.",
            "Comparison counts Sun and Earth hours that clear the terrain, not only Horizons’ flat horizon.",
            "Primary score uses topographic clearing; geometric hours remain visible for contrast.",
        ],
        resultado="MANI answers the CLPS question with real relief at curated sites; arbitrary points still out of scope.",
    )

    entry_table(
        doc,
        "13:30",
        "Arbitrary points with two clicks",
        [
            "On the globe, first click sets point A and second sets B (catalog markers still work).",
            "Free points query live Horizons and compute the LOLA mask on the fly (~75°S–90°S coverage).",
            "Comparison and report include chosen lat/lon and geometric vs topographic hours.",
        ],
        resultado="Planners can contrast any south-pole pair within the DEM’s LOLA coverage.",
    )

    entry_table(
        doc,
        "14:28",
        "Report export and per-account history",
        [
            "Add graphic report export with MANI logo, query time, and print time.",
            "Each export is saved to the user’s account history to reopen or reprint.",
        ],
        resultado="Delivery leaves a traceable record of each comparison in the session.",
    )

    entry_table(
        doc,
        "14:41",
        "Printable report and Annex A with map",
        [
            "Report print path moves to a white background for paper.",
            "Analysis window labeled From and To in UTC.",
            "Annex A at the end: Moon Trek globe capture with A and B marked, also stored in history.",
        ],
        resultado="Exported report ready to print or PDF with site map included.",
    )

    entry_table(
        doc,
        "14:55",
        "Sun and Earth on the globe with UTC time",
        [
            "Main screen shows Sun and Earth from Horizons (azimuth/elevation) at active site A or B.",
            "UTC date/time control to see how they sit relative to the horizon at that instant.",
        ],
        resultado="Planners can visualize solar power and Earth visibility on the map, not only in the report.",
    )

    entry_table(
        doc,
        "15:11",
        "Native Cesium sky (Sun, Earth, stars)",
        [
            "Drop improvised disks and use Cesium APIs: SkyBox, Sun, and EllipsoidPrimitive.",
            "Positions from Simon1994PlanetaryPositions transformed into the lunar frame (same idea as Cesium’s native Moon).",
            "Horizons still feeds the site elevation panel; the space backdrop is Cesium’s job.",
        ],
        resultado="Sun, Earth, and stars render with Cesium’s graphics pipeline, aligned to UTC sky time.",
    )

    entry_table(
        doc,
        "16:45",
        "Daily timelines in the report",
        [
            "Exportable report includes two charts (option A and B) between From and To.",
            "Each UTC day: yellow bar = Sun hours with LOLA topographic clearing; blue = Earth hours under the same score rule.",
            "Data aggregates Horizons samples (1 h step) filtered to the analysis window.",
        ],
        resultado="Day-by-day comparison readable on screen and in print, with numbers checkable against Horizons.",
    )

    entry_table(
        doc,
        "16:50",
        "Timelines on the main screen",
        [
            "After compare, the same A/B charts (yellow Sun, blue Earth) appear next to metrics, not only on export.",
            "They use daily_timeline from the /compare response and the From–To window under the title.",
        ],
        resultado="MANI’s main flow shows daily evolution without opening the report.",
    )

    entry_table(
        doc,
        "22:25",
        "Compare with no results outside Horizons",
        [
            "Requested window (e.g. Dec 2026–Nov 2027) did not match the embedded cache (15–29 Nov 2026) and /compare returned zero samples silently.",
            "Backend clips the window to the offline Horizons range for curated sites or returns a bilingual error with the valid From–To.",
            "UI shows the embedded range and a notice if the window is adjusted automatically.",
        ],
        resultado="Shackleton vs Malapert with dates inside Nov 2026 returns hours, score, and timelines without internet.",
    )

    entry_table(
        doc,
        "22:32",
        "Live Horizons with internet",
        [
            "With network, /compare asks JPL Horizons for any window (e.g. 15–20 Dec 2026); offline, only the embedded cache or a bilingual error asking for connection.",
            "Catalog cache is used only if it fully covers requested dates; November 2026 is no longer forced when online.",
            "UI distinguishes offline vs online hints and shows the connection message clearly.",
        ],
        resultado="Offline demo intact for Nov 2026; with internet the team is no longer limited to embedded JSON.",
    )

    entry_table(
        doc,
        "22:52",
        "Add site (A/B coordinates)",
        [
            "“Add site” panel in the sidebar under Go to site A/B: lat/lon inputs and a button to use the last globe click.",
            "Custom-point display name is the coordinate to four decimals (e.g. −89.5000°, 12.3000°) in selector, compare, report, and marker.",
        ],
        resultado="Compare a curated site against arbitrary coordinates without breaking live Horizons or map-click flow.",
    )

    entry_table(
        doc,
        "23:10",
        "Single click on the globe (A/B slot)",
        [
            "Surface click waited 280 ms and a second tap in that window cancelled assignment and only prefilled Add site.",
            "Single click updates the active slot immediately; double-click still fills lat/lon in the panel.",
            "pickEllipsoid fallback if the ray misses terrain; stable pickTarget with a page ref.",
        ],
        resultado="One click on the Moon moves pin A or B instantly without debounce delay.",
    )

    entry_table(
        doc,
        "23:25",
        "Stable lunar globe in Cesium",
        [
            "Sometimes the Moon vanished: wheel zoom could push the camera hundreds of megameters and the disk left the scene.",
            "Cap max zoom to the same range as manual orbit and re-clamp the camera each frame if it leaves the band.",
            "Recovery on render/WebGL errors: globe and imagery visible, native Sun off, container resize.",
        ],
        resultado="Lunar globe stays visible while navigating, zooming, and recovering from occasional viewer faults.",
    )

    entry_table(
        doc,
        "23:53",
        "Reprint reports in another language",
        [
            "In My reports, reopening a saved export shows Report language (same languages as the app).",
            "Preview and PDF use i18n strings for the chosen language; numbers stay from the saved comparison.",
            "Button becomes Print / PDF without duplicating history entries.",
        ],
        resultado="Team can reprint a report in English or Spanish (or another language) without re-comparing sites.",
    )

    entry_table(
        doc,
        "23:57",
        "Annex A: globe image in the report",
        [
            "Annex A showed a black rectangle with only A/B labels: copying Cesium’s WebGL canvas after the buffer was cleared.",
            "Enable preserveDrawingBuffer, wait for tiles and postRender frames, and retry if the crop is empty.",
            "From history: if the saved image is black, recapture from the live map; report language no longer forces a new capture.",
        ],
        resultado="Preview and PDF show the Moon Trek globe with A and B framed.",
    )

    heading(doc, "Saturday closing criterion")
    callout(
        doc,
        [
            (
                "Saturday succeeds if two places can be selected, Sun and Earth hours are visible, André can say in English which wins and why, and the app opens without internet for the comparison.",
                {"size": 11, "bold": True, "color": NAVY},
            ),
        ],
        fill="E7F6EE",
    )

    heading(doc, "Sunday 15 November 2026 — Chiminike, Tegucigalpa")
    body(
        doc,
        "Second hackathon day. Overnight and daytime build continues; evening closes presentation deliverables.",
        italic=True,
        color=MUTED,
        space_after=10,
    )

    entry_table(
        doc,
        "00:20",
        "Password recovery",
        [
            "On login: Forgot your password? link to an email form (ES/EN).",
            "API POST /auth/forgot-password rate-limited 3/min; unknown email returns a clear message.",
            "If the user exists: temporary bcrypt password, SMTP send or development log when SMTP is off.",
        ],
        resultado="Planners can reset access without manual support when email and SMTP are ready.",
    )

    entry_table(
        doc,
        "00:05",
        "Annex A fixed in My reports",
        [
            "On save, validate the globe JPEG and persist it in history; reprint or language change only reuses that image.",
            "Older reports without a photo or black: one live-map capture attempt, record update, and a clear message if the globe is not open.",
        ],
        resultado="Annex A no longer depends on language and stops appearing black in already-saved reports.",
    )

    entry_table(
        doc,
        "00:55",
        "MANI public on Azure",
        [
            "Choose Microsoft Azure among Global Offers (Google Cloud trial already used on the team account).",
            "MANI published on Azure Container Apps: frontend, API, and embedded Horizons data on one HTTPS URL.",
            "Health and home respond; API requires login as in local.",
        ],
        resultado="Public demo at https://mani-web.ashysky-26ab9584.eastus.azurecontainerapps.io for judges and the project page.",
    )

    entry_table(
        doc,
        "02:30",
        "Password recovery by email",
        [
            "Forgot-password already creates a temporary password; prepare automatic SMTP send.",
            "Hotmail/Outlook rejects basic SMTP on the team account; leave the Gmail App Password path ready.",
            "If email fails, the account password is no longer changed (avoids locking the user out).",
        ],
        resultado="Gmail SMTP active on Azure; forgot-password emails a temporary password to the registered user.",
    )

    entry_table(
        doc,
        "02:45",
        "Mandatory change after temporary password",
        [
            "After recovery, login with the temporary key opens a screen to set a new password.",
            "Until the new password is saved, the app is blocked; the temporary key is not treated as final.",
        ],
        resultado="Recovery flow: temporary email → login → choose new password → MANI.",
    )

    entry_table(
        doc,
        "03:25",
        "Android APK connected to Azure",
        [
            "Build a WebView APK that opens only MANI’s public Azure URL.",
            "Aggressive cache (largeHeap, DOM storage, HTTP cache; app does not clear cache).",
            "APK download on the home page and in the app.",
        ],
        resultado="Judges and team can install MANI on Android from the website.",
    )

    entry_table(
        doc,
        "10:50",
        "Verify new-password save",
        [
            "Review recover → temporary → login → new password: hash is saved in the local database.",
            "Recovery email pointed at Azure even when reset was local; link now uses the same site that requested it.",
            "After saving the new password, a fresh session is issued and forced change no longer appears.",
        ],
        resultado="Password change verified locally; request reset and sign in on the same site (local or Azure).",
    )

    entry_table(
        doc,
        "11:00",
        "Short domain to Azure (DuckDNS)",
        [
            "GoDaddy/Porkbun could not be claimed (OTP); move to plan B: free DuckDNS pointing at Container Apps.",
            "Jorge creates mani-nova3.duckdns.org by hand; Azure binds hostname, HTTPS certificate, and CORS/PUBLIC_URL.",
        ],
        resultado="MANI public at https://mani-nova3.duckdns.org (long Azure URL still works).",
    )

    entry_table(
        doc,
        "11:15",
        "MANI icon on the Android APK",
        [
            "Use the official patch logo (mani-logo.png) as the launcher icon at all densities.",
            "Regenerate the downloadable APK on the site with the new icon.",
        ],
        resultado="Installing MANI on Android shows the team logo instead of a generic icon.",
    )

    entry_table(
        doc,
        "11:35",
        "Azure redeploy with APK and icon",
        [
            "Republish MANI on Azure Container Apps with a unique image tag (APK with logo, login/password-change fixes, recent UI).",
            "Keep short DuckDNS domain, HTTPS certificate, and SMTP already configured.",
            "Health, home, and APK download respond at https://mani-nova3.duckdns.org.",
        ],
        resultado="Revision mani-web--0000009 live; public demo updated without changing the short domain.",
    )

    entry_table(
        doc,
        "12:45",
        "Continue as guest",
        [
            "On login and home: Continue as guest button (ES/EN).",
            "Short JWT session with no DB account; app shows Guest with local-only note.",
            "Guest reports and preferences stay in browser/WebView; server rejects guest history saves.",
        ],
        resultado="Sites can be compared without registering; guest data does not persist in the cloud.",
    )

    entry_table(
        doc,
        "12:55",
        "Continue with Google",
        [
            "On login: Continue with Google (alongside email and guest).",
            "Google Identity Services (ID token): backend verifies token, creates or links account by email, issues MANI JWT.",
            "Code ready; Web Client ID created next in Google Cloud.",
        ],
        resultado="Google auth integrated; email/password and guest unchanged.",
    )

    entry_table(
        doc,
        "13:00",
        "Google OAuth credentials for MANI",
        [
            "In Google Cloud (AL REVES project): OAuth client “MANI Web”, web application type.",
            "Origins: localhost:3100, mani-nova3.duckdns.org, and Azure Container Apps host.",
            "Client ID in backend/.env and frontend/.env.local; /auth/google/status returns enabled.",
        ],
        resultado="Google Sign-In enabled locally; same Client ID still needs production Azure if used there.",
    )

    entry_table(
        doc,
        "13:25",
        "Own GCP project MANI (OAuth)",
        [
            "Create Google Cloud project “MANI” (id mani-nova3), separate from AL REVES, which stays untouched.",
            "External consent screen named MANI; web client “MANI Web” with localhost, DuckDNS, and Azure.",
            "New Client ID in local .env; /auth/google/status again returns enabled.",
        ],
        resultado="MANI Google login uses its own GCP project; AL REVES game untouched.",
    )

    entry_table(
        doc,
        "14:00",
        "Admin panel (gear)",
        [
            "Admin user sees a gear button in the app bar.",
            "Panel shows summary, registered users, activity (logins and comparisons), and site/date metrics.",
            "Queries and reports are logged for analysis; only the admin role can see them.",
        ],
        resultado="Operational admin ready locally to review usage and top-scoring sites.",
    )

    entry_table(
        doc,
        "14:25",
        "Azure redeploy (admin, Google, guest)",
        [
            "New ACR image with admin panel, guest, Google Sign-In, and APK with MANI logo.",
            "Container App updated; https://mani-nova3.duckdns.org and certificate intact.",
            "GOOGLE_CLIENT_ID and PUBLIC_URL/CORS set in the production environment.",
        ],
        resultado="Public demo current on DuckDNS and the long Azure URL.",
    )

    entry_table(
        doc,
        "15:25",
        "Stable standing view at Malapert",
        [
            "“Standing on the site” view crashed in Cesium (black screen / render error) loading LOLA relief near the eye.",
            "Limit terrain detail and place the camera on the same heightmap elevation that is drawn, with Sun/Earth and time control intact.",
        ],
        resultado="At Malapert (and other sites) a 360° look works without stopping the render.",
    )

    entry_table(
        doc,
        "15:41",
        "Standing view without freezing MANI",
        [
            "Opening “standing on the site” froze the whole app: camera anchoring and DEM fought Cesium every frame.",
            "Anchor the point once, look with the mouse only, and in this view use ellipsoid + Moon Trek imagery (no LOLA tile storm).",
            "Close, time scrubber, and Sun/Earth keep responding.",
        ],
        resultado="Standing modal opens without freezing MANI; 360° look and time control usable.",
    )

    entry_table(
        doc,
        "16:25",
        "0–100% loading bar in standing view",
        [
            "Opening the eye (ground tab) shows a 0→100% bar until lunar terrain is ready.",
            "Progress follows viewer, imagery, camera, height sample, and LOLA tiles; then a single fade reveals the simulation.",
            "Look and Sun/Earth enable on complete; no further block from tile refinement.",
        ],
        resultado="Standing view waits with a clear bar and opens without half-finished flicker.",
    )

    entry_table(
        doc,
        "16:32",
        "Eye load no longer stuck at 55%",
        [
            "Bar froze at 55% and sometimes crashed the tab: LOLA DEM at eye height blocked tiles and could take Cesium down.",
            "First paint with ellipsoid + Moon Trek imagery; bar advances and reveals in ~7 s (stability).",
            "Team asks to restore: stand on LOLA relief, not a flat ellipsoid.",
        ],
        resultado="Bar reaches 100% without crashing the tab; DEM underfoot still to restore.",
    )

    entry_table(
        doc,
        "16:40",
        "Standing again on LOLA terrain",
        [
            "Revert first-paint ellipsoid: LOLA DEM mounts from start (moderate detail).",
            "One height sample places the eye ~120 m above relief; 0–100% bar still completes on a clock (~8 s) without waiting for zero tiles.",
            "If Cesium fails to render, lower detail and exaggeration before dropping DEM; only as last resort warn and use ellipsoid.",
        ],
        resultado="Standing view is back on 3D LOLA terrain, with loading bar and without freeze loops.",
    )

    entry_table(
        doc,
        "18:30",
        "GitHub published, About link, and video done",
        [
            "Public GitHub repository published: https://github.com/jorkiller9201-source/MANI.",
            "About in the app (EN+ES) now links to that repository so visitors can open the source.",
            "André’s English pitch/demo video is completed today, Sunday 15 November 2026, at this hour — no longer pending.",
            "Project log converted to English; SI declaration and README note the repo and completed video.",
        ],
        resultado="Repo public with About link; André’s video marked completed for Sunday evening delivery.",
    )

    entry_table(
        doc,
        "18:40",
        "Azure redeploy with standing (ground) view",
        [
            "New Docker image from the local working tree (ground-view fixes included) pushed to ACR acrmani95190.",
            "Container App mani-web revision updated; production secrets (SECRET_KEY, SMTP, Google) kept intact.",
            "PUBLIC_URL and CORS remain on https://mani-nova3.duckdns.org plus the Azure host.",
        ],
        resultado="Public demo healthy: DuckDNS and Azure /health 200; /app/ground responds.",
    )

    heading(doc, "Sunday evening — completed")
    bullet(doc, "André’s English pitch/demo video: completed Sunday 15 November 2026 (~18:30 Tegucigalpa).")
    bullet(doc, "GitHub repository published and linked from About: https://github.com/jorkiller9201-source/MANI.")
    bullet(doc, "Project log available in English for the submission narrative.")
    bullet(doc, "Azure public demo redeployed with standing/ground view (~18:40).")

    heading(doc, "Sunday closing criterion")
    callout(
        doc,
        [
            (
                "Sunday succeeds if two sites can be selected, Sun and Earth hours are visible, André’s English video explains the winner, the app supports offline comparison (embedded Horizons), and the project page / SI declaration / repo are ready for delivery.",
                {"size": 11, "bold": True, "color": NAVY},
            ),
        ],
        fill="E7F6EE",
    )

    body(
        doc,
        "— End of Sunday evening entry.",
        italic=True,
        color=MUTED,
        space_before=8,
    )

    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
