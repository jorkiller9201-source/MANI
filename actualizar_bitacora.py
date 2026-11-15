# -*- coding: utf-8 -*-
"""Bitácora Nova 3 — MANI, NASA Space Apps 2026."""

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
        add_text(rp, "Resultado: ", size=11, bold=True, color=NAVY)
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
        "Bitácora Nova 3  ·  MANI  ·  Lunar Landing Site Navigator  ·  NASA Space Apps 2026",
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

    # Banner
    banner = doc.add_table(rows=1, cols=1)
    cell = banner.cell(0, 0)
    set_cell_shading(cell, "0B1F3A")
    set_cell_margins(cell, top=130, bottom=130, left=160, right=160)
    cell.paragraphs[0].clear()
    t = cell.paragraphs[0]
    add_text(t, "BITÁCORA DEL PROYECTO MANI", size=22, bold=True, color=WHITE)
    sub = cell.add_paragraph()
    sub.paragraph_format.space_before = Pt(4)
    sub.paragraph_format.space_after = Pt(0)
    add_text(sub, "Equipo Nova 3  ·  NASA Space Apps Challenge 2026", size=12, color=RGBColor(0xF2, 0xD2, 0x7A))
    meta = cell.add_paragraph()
    meta.paragraph_format.space_before = Pt(2)
    meta.paragraph_format.space_after = Pt(0)
    add_text(
        meta,
        "Sede: Chiminike, Tegucigalpa  ·  Patrocinio: Fundación Próspera  ·  14–15 de noviembre de 2026",
        size=10,
        color=RGBColor(0xD6, 0xE2, 0xF0),
    )

    # Nota aclaratoria
    heading(doc, "Nota aclaratoria")
    callout(
        doc,
        [
            (
                "Esta bitácora documenta, hora por hora, cómo el equipo Nova 3 construye MANI durante el NASA Space Apps Challenge 2026.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Herramienta principal de trabajo. Usamos Cursor como entorno de desarrollo asistido. La Super Inteligencia (SI) es solo una herramienta de apoyo: nos ayuda a organizar, consultar datos, escribir código y documentar más rápido. Las decisiones técnicas, la revisión de resultados, la validez científica y la responsabilidad del proyecto son del equipo humano. En Space Apps 2026 y en este proyecto se usa el término SI, no “IA”.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Líder del equipo. Jorge Alberto Gutiérrez Canales, Ingeniero Militar en Mecatrónica, Capitán de la Fuerza Aérea Hondureña, pasante de la Maestría en Inteligencia Artificial y Analítica de Datos (formación en SI) en la Universidad Internacional de La Rioja (UNIR, España), con formación complementaria en análisis de datos (PSU en Data Analytics). Dirige el cálculo, los datos citados de la NASA y la construcción de la aplicación.",
                {"size": 11, "color": NAVY},
            ),
            (
                "André Enoc Mejía. Hijo putativo de Jorge. Tiene trayectoria propia en el NASA Space Apps Challenge (Participación en varias ediciones; People’s Choice Award en 2023 y 2024), fundó Exoplanets Lab, es embajador de Próspera y ha representado a Honduras en espacios STEM vinculados a la NASA. En Nova 3 es responsable del video en inglés, del texto de la ficha del proyecto y de la apertura del pitch. La misión de Jorge con André es que siga aprendiendo: que cada reto le enseñe a explicar una decisión técnica con claridad y a trabajar en equipo.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Lissa Paola Mejía Romero. Mamá de André Enoc Mejía e Ingeniera Industrial. En Nova 3 brinda apoyo y dirección a André, y se encarga del manejo de redes sociales y de la divulgación de los avances del proyecto durante el hackathon.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Jorge Alberto Gutiérrez Mejía. Hijo de Jorge, de 7 años. Se integra al equipo para que, desde su corta edad, vea cómo un proyecto se desarrolla desde cero: el problema, el plan, el trabajo por horas, el ensayo y la entrega. No se le pide producir código; se le invita a observar, preguntar y entender el proceso.",
                {"size": 11, "color": NAVY},
            ),
            (
                "Desafío oficial: Lunar Landing Site Navigator (programa CLPS). Producto: MANI, comparador de sitios y fechas de alunizaje en el polo sur lunar.",
                {"size": 11, "bold": True, "color": NAVY},
            ),
        ],
        fill="FFF8E7",
    )

    heading(doc, "Cómo se actualiza esta bitácora")
    body(
        doc,
        "Se escribe en paralelo al desarrollo, por franjas horarias (hora de Tegucigalpa). Solo se registra lo relevante del proyecto: qué avanzó el equipo, qué quedó listo y qué decisión importa. No se documentan instrucciones internas a herramientas de software ni detalles sin valor para el relato del hackathon.",
    )

    # Sábado
    heading(doc, "Sábado 14 de noviembre de 2026 — Chiminike, Tegucigalpa")
    body(
        doc,
        "Inicio del hackathon. Sede local con apoyo de Fundación Próspera.",
        italic=True,
        color=MUTED,
        space_after=10,
    )

    entry_table(
        doc,
        "09:00",
        "Lectura del reto y recursos",
        [
            "Se revisa el desafío Lunar Landing Site Navigator y sus recursos oficiales.",
            "Se confirma el uso de JPL Horizons para el cálculo de Sol y Tierra; Quickmap y Moon Trek para el terreno.",
            "Se valida que la red del venue permite consultar Horizons.",
        ],
        resultado="Alcance del sábado: comparar seis sitios del polo sur con números reales de energía y comunicación.",
    )

    entry_table(
        doc,
        "09:25",
        "Apertura de la bitácora",
        [
            "Se abre esta bitácora para documentar el proceso del equipo durante el hackathon.",
            "Se deja la nota aclaratoria sobre el equipo, el rol de la Super Inteligencia (SI) como apoyo y el uso de Cursor.",
        ],
        resultado="Bitácora en marcha, en paralelo al desarrollo de MANI.",
    )

    entry_table(
        doc,
        "09:31",
        "Incorporación de Lissa Paola Mejía Romero",
        [
            "Se agrega a Lissa Paola Mejía Romero, mamá de André e Ingeniera Industrial.",
            "Su rol: apoyo y dirección de André, redes sociales y divulgación de avances.",
        ],
        resultado="Equipo: Jorge (líder técnico), André (video y pitch), Lissa (apoyo, redes y divulgación) y Jorge Alberto Gutiérrez Mejía (7 años, aprendizaje del proceso).",
    )

    entry_table(
        doc,
        "09:53",
        "Ajuste del tono de la bitácora",
        [
            "Se acuerda escribir de forma más general: avances y decisiones del proyecto, sin detalle interno innecesario.",
        ],
        resultado="La bitácora queda como relato del equipo, no como diario técnico de herramientas.",
    )

    entry_table(
        doc,
        "09:56",
        "Criterios de evaluación y uso de SI",
        [
            "Se incorporan al proyecto los criterios locales: impacto, creatividad, validez, relevancia y presentación.",
            "Se fijan las reglas de uso de SI: acelerar trabajo (código, documentación, prototipos), no reemplazar la idea ni presentar resultados sin verificar datos.",
            "Entrega: página en inglés, demo breve y declaración del uso de SI.",
        ],
        resultado="MANI se construye con datos NASA como núcleo y con SI solo como apoyo declarado.",
    )

    entry_table(
        doc,
        "09:59",
        "Terminología: Super Inteligencia (SI)",
        [
            "Se acuerda referirse siempre a la Super Inteligencia (SI), no como “IA”, en bitácora, reglas, ficha y presentación.",
        ],
        resultado="El lenguaje del proyecto queda alineado con Space Apps 2026.",
    )

    entry_table(
        doc,
        "10:07",
        "Plan actualizado con recursos oficiales",
        [
            "Se incorporan al plan los recursos del reto: Horizons (núcleo del cálculo), Quickmap, Moon Trek y el portal lunar de la CSA.",
            "Queda claro qué recurso da números y cuál solo aporta contexto o terreno.",
        ],
        resultado="El plan del equipo y el plan para André ya citan las fuentes oficiales de Space Apps.",
    )

    entry_table(
        doc,
        "10:12 – 10:25",
        "Arquitectura web MANI",
        [
            "Se define la app web con registro mundial, seguridad al estilo Heimdall y dominio Oracle.",
            "Puertos: frontend 3100, API 8100, HTTPS público 9543.",
            "Mapa 3D lunar (Cesium + Moon Trek) en lugar del mapa terrestre de SKADI.",
        ],
        resultado="Plan de arquitectura listo para construir.",
    )

    entry_table(
        doc,
        "10:25 – 11:00",
        "Construcción de la aplicación",
        [
            "Backend FastAPI con registro, login, sitios y comparación Horizons.",
            "Datos de Sol y Tierra precargados para los seis sitios del polo sur.",
            "Frontend Next.js con mapa 3D lunar, comparación e informe en inglés.",
            "Configuración Caddy :9543 y declaración de uso de SI.",
        ],
        resultado="MANI operable en local (:3100 / :8100) con datos NASA como núcleo.",
    )

    entry_table(
        doc,
        "10:49",
        "Corrección del mapa 3D lunar",
        [
            "Se corrige el elipsoide lunar al crear el globo Cesium (ya no se asigna después).",
            "Las tiles de Moon Trek pasan por proxy local para cargar en el navegador.",
        ],
        resultado="El visor lunar deja de fallar y muestra el polo sur con marcadores.",
    )

    entry_table(
        doc,
        "10:58",
        "Mapa 3D lunar visible",
        [
            "Cesium se carga desde archivos locales; tiles LRO WAC de Moon Trek por proxy.",
            "Se ajusta la cámara para mostrar el disco lunar y acercarse al polo sur.",
        ],
        resultado="El globo lunar se ve en la app; se puede orbitar con el mouse.",
    )

    entry_table(
        doc,
        "11:17",
        "Selector de idioma (12 idiomas)",
        [
            "Se coloca un selector de idioma a la izquierda de Cerrar sesión.",
            "Quedan disponibles los doce idiomas principales; la interfaz y el informe de una página se traducen según la elección.",
            "El idioma se recuerda en el navegador para la siguiente visita.",
        ],
        resultado="MANI puede presentarse en varios idiomas, incluido el informe de comparación.",
    )

    entry_table(
        doc,
        "13:05",
        "Ubicación geográfica en el cruce y Acerca de",
        [
            "La latitud y longitud selenográfica de cada sitio seleccionado pasan a formar parte de la comparación y del informe.",
            "Se cruza el punto geográfico con la efeméride de Horizons usada para Sol y Tierra.",
            "Se agrega el botón Acerca de junto al idioma: explica los cálculos, el propósito CLPS y al equipo Nova 3.",
        ],
        resultado="La decisión A/B queda anclada a coordenadas reales; el público puede leer cómo y por qué se calcula.",
    )

    entry_table(
        doc,
        "13:12",
        "Referencias oficiales en Acerca de",
        [
            "Se documentan en la app los enlaces oficiales de Horizons (SSD), la API HTTP, Moon Trek, CLPS y Space Apps.",
            "Se listan las APIs usadas y Cursor como herramienta de Super Inteligencia (SI) del proyecto.",
            "Se aclara que la puntuación 0–100 es heurística del equipo; las elevaciones vienen de Horizons.",
        ],
        resultado="Cualquier jurado o visitante puede verificar método, fuentes y uso de SI desde el botón Acerca de.",
    )

    entry_table(
        doc,
        "13:21",
        "Horizonte topográfico LOLA en el cruce",
        [
            "Se incorporan máscaras de horizonte 360° a partir del DEM polar LOLA LDEM_75S_240M (PDS) para los seis sitios.",
            "La comparación cuenta horas de Sol y Tierra que despejan el relieve, no solo el horizonte plano de Horizons.",
            "La puntuación principal usa el despeje topográfico; las horas geométricas quedan visibles para contrastar.",
        ],
        resultado="MANI responde la pregunta CLPS con relieve real en los sitios curados; el punto arbitrario sigue fuera de alcance.",
    )

    entry_table(
        doc,
        "13:30",
        "Puntos arbitrarios con dos clics",
        [
            "En el globo, el primer clic fija el punto A y el segundo el B (también se pueden usar marcadores del catálogo).",
            "Para puntos libres se consulta Horizons en vivo y se calcula la máscara LOLA al vuelo (cobertura ~75°S–90°S).",
            "La comparación y el informe incluyen lat/lon del punto elegido y horas geométricas vs topográficas.",
        ],
        resultado="El planificador puede contrastar cualquier par de lugares del polo sur dentro de la cobertura LOLA del DEM.",
    )

    entry_table(
        doc,
        "14:28",
        "Exportación de informe e historial por cuenta",
        [
            "Se agrega exportación gráfica del informe con logo MANI, hora de consulta y hora de impresión.",
            "Cada exportación se guarda en el historial de la cuenta del usuario para reabrir o reimprimir.",
        ],
        resultado="La entrega deja evidencia trazable de cada comparación realizada en la sesión.",
    )

    entry_table(
        doc,
        "14:41",
        "Informe imprimible y Anexo A con mapa",
        [
            "La impresión del informe pasa a fondo blanco, pensada para papel.",
            "La ventana de análisis se etiqueta con Desde y Hasta en UTC.",
            "Al final del informe se agrega el Anexo A: captura del globo Moon Trek con los puntos A y B marcados, guardada también en el historial.",
        ],
        resultado="El informe exportado queda listo para imprimir o PDF con mapa de sitios incluido.",
    )

    entry_table(
        doc,
        "14:55",
        "Sol y Tierra en el globo con hora UTC",
        [
            "En la pantalla principal se muestran Sol y Tierra según Horizons (acimut/elevación) desde el sitio activo A o B.",
            "Hay un control de fecha y hora UTC para ver cómo quedan respecto al horizonte en ese instante.",
        ],
        resultado="El planificador puede visualizar energía solar y visibilidad de Tierra en el mapa, no solo en el informe.",
    )

    entry_table(
        doc,
        "15:11",
        "Cielo nativo Cesium (Sol, Tierra, estrellas)",
        [
            "Se deja el enfoque de discos improvisados y se usa la API de Cesium: SkyBox, Sun y EllipsoidPrimitive.",
            "Las posiciones salen de Simon1994PlanetaryPositions transformadas al marco lunar (mismo criterio que el Moon nativo de Cesium).",
            "Horizons sigue alimentando el panel de elevación del sitio; el fondo espacial queda a cargo de Cesium.",
        ],
        resultado="Sol, Tierra y estrellas se ven con el pipeline gráfico de Cesium, alineado a la hora UTC del cielo.",
    )

    entry_table(
        doc,
        "16:45",
        "Líneas de tiempo diarias en el informe",
        [
            "El informe exportable incluye dos gráficas (opción A y B) entre Desde y Hasta.",
            "Cada día en UTC: raya amarilla = horas de Sol con despeje topográfico LOLA; azul = horas de Tierra con el mismo criterio que la puntuación.",
            "Los datos agregan muestras Horizons (paso 1 h) filtradas a la ventana de análisis.",
        ],
        resultado="La comparación se lee día a día en pantalla e impresión, con números verificables contra Horizons.",
    )

    entry_table(
        doc,
        "16:50",
        "Líneas de tiempo en la pantalla principal",
        [
            "Tras comparar, las mismas gráficas A/B (Sol amarillo, Tierra azul) aparecen junto a las métricas, no solo al exportar.",
            "Usan daily_timeline de la respuesta /compare y la ventana Desde–Hasta visible bajo el título.",
        ],
        resultado="El flujo principal de MANI muestra la evolución diaria sin abrir el informe.",
    )

    entry_table(
        doc,
        "22:25",
        "Compare sin resultados fuera de Horizons",
        [
            "La ventana pedida (p. ej. diciembre 2026–noviembre 2027) no coincidía con el cache embebido (15–29 nov 2026) y /compare devolvía cero muestras sin aviso.",
            "El backend recorta la ventana al rango Horizons offline de sitios curados o devuelve error bilingüe con el Desde–Hasta válido.",
            "En la UI se muestra el rango embebido y un aviso si la ventana se ajusta automáticamente.",
        ],
        resultado="Shackleton vs Malapert con fechas dentro de nov 2026 entrega horas, puntuación y líneas de tiempo sin depender de internet.",
    )

    entry_table(
        doc,
        "22:32",
        "Horizons en vivo con internet",
        [
            "Con red, /compare pide JPL Horizons para cualquier ventana (p. ej. 15–20 dic 2026); sin red, solo la caché embebida o error bilingüe pidiendo conexión.",
            "La caché de catálogo se usa solo si cubre por completo las fechas pedidas; ya no se fuerza noviembre 2026 cuando hay internet.",
            "La UI distingue hint offline vs online y muestra el mensaje de conexión de forma visible.",
        ],
        resultado="Demo offline intacta en nov 2026; con internet el equipo ya no queda limitado al JSON embebido.",
    )

    entry_table(
        doc,
        "22:52",
        "Agregar sitio (coordenadas A/B)",
        [
            "Panel «Agregar sitio» en la barra lateral, debajo de Ir a sitio A/B: entradas lat/lon y botón para usar el último clic en el globo.",
            "El nombre mostrado del punto personalizado es la coordenada con cuatro decimales (p. ej. −89.5000°, 12.3000°) en selector, compare, informe y marcador.",
        ],
        resultado="Se puede comparar un sitio curado contra coordenadas arbitrarias sin romper Horizons en vivo ni el flujo de clic en el mapa.",
    )

    entry_table(
        doc,
        "23:10",
        "Clic simple en el globo (ranura A/B)",
        [
            "El clic en superficie esperaba 280 ms y un segundo toque en esa ventana cancelaba la asignación y solo precargaba «Agregar sitio».",
            "Clic simple actualiza de inmediato la ranura activa; doble clic sigue rellenando lat/lon en el panel.",
            "Respaldo pickEllipsoid si el rayo no intersecta el terreno; pickTarget estable con ref en la página.",
        ],
        resultado="Un solo clic en la Luna mueve el pin A o B al instante sin depender del debounce.",
    )

    entry_table(
        doc,
        "23:25",
        "Globo lunar estable en Cesium",
        [
            "A veces la Luna desaparecía del mapa: el zoom con rueda podía alejar la cámara cientos de megámetros y el disco quedaba fuera de escena.",
            "Se limita el zoom máximo al mismo rango que la órbita manual y se reajusta la cámara en cada cuadro si se sale de banda.",
            "Recuperación ante error de render y contexto WebGL: globo e imágenes visibles, Sol nativo apagado, resize del contenedor.",
        ],
        resultado="El globo lunar se mantiene visible al navegar, hacer zoom y recuperarse de fallos puntuales del visor.",
    )

    entry_table(
        doc,
        "23:53",
        "Reimprimir informes en otro idioma",
        [
            "En «Mis informes», al reabrir un export guardado aparece el selector «Idioma del informe» (mismos idiomas de la app).",
            "La vista previa y el PDF usan textos i18n del idioma elegido; los números siguen siendo los de la comparación guardada.",
            "El botón pasa a «Imprimir / PDF» sin duplicar entradas en el historial.",
        ],
        resultado="El equipo puede reimprimir un informe en inglés o español (u otro idioma) sin volver a comparar sitios.",
    )

    entry_table(
        doc,
        "23:57",
        "Anexo A: imagen del globo en el informe",
        [
            "El Anexo A mostraba un rectángulo negro con solo las etiquetas A/B: al copiar el canvas WebGL de Cesium el búfer ya estaba borrado.",
            "Se activa preserveDrawingBuffer en el visor, se esperan teselas y cuadros postRender, y se reintenta si el recorte sale vacío.",
            "Desde historial: si la imagen guardada está en negro, se vuelve a capturar del mapa vivo; el idioma del informe ya no fuerza una nueva captura.",
        ],
        resultado="La vista previa y el PDF muestran el globo Moon Trek con los puntos A y B enmarcados.",
    )

    entry_table(
        doc,
        "00:20",
        "Recuperación de contraseña",
        [
            "En login: enlace «¿Olvidaste tu contraseña?» hacia formulario de correo (ES/EN).",
            "API POST /auth/forgot-password con límite 3/min; correo no registrado devuelve mensaje claro.",
            "Si el usuario existe: contraseña temporal por bcrypt, envío SMTP o log en desarrollo sin SMTP.",
        ],
        resultado="Planners pueden restablecer acceso sin soporte manual cuando el correo y SMTP están listos.",
    )

    entry_table(
        doc,
        "00:05",
        "Anexo A fijo en Mis informes",
        [
            "Al guardar el informe se valida el JPEG del globo y se persiste en el historial; al reimprimir o cambiar idioma solo se reutiliza esa imagen.",
            "Informes viejos sin foto o en negro: un solo intento de captura con el mapa vivo, actualización del registro y mensaje claro si el globo no está abierto.",
        ],
        resultado="El Anexo A no depende del idioma y deja de verse en negro en informes ya guardados.",
    )

    heading(doc, "Pendiente del resto del sábado")
    bullet(doc, "Ensayo de la demo y guion del video (André).")
    bullet(doc, "Prueba de acceso Oracle :9543 cuando el puente esté disponible.")
    bullet(doc, "Ajuste fino de UI y pitch.")

    heading(doc, "Criterio de cierre del sábado")
    callout(
        doc,
        [
            (
                "El sábado sale bien si se pueden señalar dos lugares, se ven las horas de Sol y de Tierra, André puede decir en inglés cuál gana y por qué, y la aplicación abre sin internet.",
                {"size": 11, "bold": True, "color": NAVY},
            ),
        ],
        fill="E7F6EE",
    )

    body(
        doc,
        "— Continúa.",
        italic=True,
        color=MUTED,
        space_before=8,
    )

    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
