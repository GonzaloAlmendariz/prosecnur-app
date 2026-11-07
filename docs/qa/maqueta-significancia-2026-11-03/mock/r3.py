# Ronda 3/4 — sistema «▲A» en todos los tipos de gráfico, Word A4, casos borde y «Cómo leer» (corregido tras la crítica).
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import lam
from lam import *

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
lam.MARCA["pt"] = 11

# ---- textos únicos (los mismos en PPT, Word y «Cómo leer»)
METODO = "Rao-Scott por aula, p < 0.05 con corrección de Benjamini-Hochberg."
TXT_MARCA = "  Mayor que el grupo de esa letra: diferencia significativa y de al menos 10 puntos. "
TXT_FRAGIL = "  Frágil: igual, con p ajustado entre 0.01 y 0.05. "
M_ = lambda l, f=False: ("m", l, f)
T_ = lambda t: ("t", t)


def linea_marcas(con_fragil=False, letra="A"):
    p = [M_(letra), T_(TXT_MARCA)]
    if con_fragil: p += [M_(letra, True), T_(TXT_FRAGIL)]
    return p + [T_(METODO)]


def guardar(nombre, svg, w=1333, h=750):
    p = os.path.join(OUT, nombre + ".html")
    open(p, "w").write(f'<html><body style="margin:0;background:#fff">{svg}</body></html>')
    subprocess.run([os.path.join(HERE, "shot.sh"), p, os.path.join(OUT, nombre + ".png"), str(w), str(h)])


def notas(marcas, contexto=None):
    """Hasta dos líneas: contexto del gráfico (si lo hay) y, siempre en una sola línea, las marcas y el método."""
    out = []
    if contexto: out.append(txt(49.5, 667, contexto, 9, C["suave"]))
    out.append(nota_rica(49.5, 688, marcas))
    return out


def centrado(fn, top_extra=0, top=165, bottom=642):
    """Conserva el grosor de barra y centra el bloque (filas + leyenda) a media altura de la zona de datos (1.65 a 6.42 in)."""
    _, yend = fn(0)
    h = (yend - 30 + 18) + top_extra
    return fn(top + top_extra + (bottom - top - h) / 2)


NIV = ["Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9"]
NNIV = [119, 122, 97, 62]

# ------------------------------------------------ F1 · agrupadas (lámina 40)
CATS40 = ["Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)", "Política universitaria", "Ninguna"]
c, _ = centrado(lambda y0: agrupadas(CATS40, ["Economía y Finanzas", "Ciencias políticas y sociales"], [[17, 44], [5, 25], [36, 16]],
                 [["", "A"], ["", "A"], ["B", ""]], y0=y0, base_grupo=[224, 176], x0=360, etiqueta_w=320, ancho=640), top_extra=0)
guardar("f1-agrupadas", lamina("Durante tu carrera universitaria, ¿perteneciste o perteneces a alguna agrupación o colectivo presencial, sea de la Universidad o externo? (según área)", c,
        nota=notas(linea_marcas())))

# ------------------------------------------------ F2 · apilada dicotómica (lámina 74): sólo se marca «Sí»
c, _ = centrado(lambda y0: apiladas(NIV, ["Sí", "No"], [[24, 76], [37, 63], [32, 68], [58, 42]], [C["azul"], C["celeste"]],
                marcas=[["", ""], ["", ""], ["", ""], ["ABC", ""]], base_fila=NNIV, y0=y0, alto_fila=92, x0=300, ancho=880), top_extra=0)
guardar("f2-dicotomica", lamina("Además de tus estudios universitarios, ¿trabajas de forma remunerada? (según nivel curricular)", c, folio="74",
        nota=notas(linea_marcas())))

# ------------------------------------------------ F3 · escala con top two box, «No sé» y una diferencia frágil
SEG = ["Nada cómodo", "Poco cómodo", "Cómodo", "Muy cómodo", "No sé"]
VAL = [[14, 37, 35, 12, 2], [11, 33, 40, 14, 2], [9, 31, 41, 17, 2], [7, 23, 46, 23, 1]]
c, _ = centrado(lambda y0: apiladas(NIV, SEG, VAL, C["likert"], base_fila=NNIV, ttb=[47, 54, 58, 69], ttb_marcas=["", "", "", "A"],
                fragiles_ttb={3}, ttb_rotulo="Comodidad", y0=y0, alto_fila=88, x0=300, ancho=760), top_extra=16)
c = c.replace(">2%</text>", "></text>").replace(">1%</text>", "></text>")   # «No sé» no se rotula sobre la barra: su valor va en la leyenda
c = c.replace(">No sé</text>", ">No sé (1–2%)</text>")
guardar("f3-escala-ttb", lamina("¿Qué tan cómodo te sientes al hacer preguntas en clase? (según nivel curricular)", c, folio="40",
        nota=notas(linea_marcas(con_fragil=True), "Comodidad: Cómodo + Muy cómodo; la marca la compara. «No sé» se muestra y cuenta en la base, pero no se compara.")))

# ------------------------------------------------ F4 · apilada nominal (lámina 60)
SEG4 = ["Me esfuerzo en todos mis cursos", "Me involucro en los que me gustan", "Dependo de presiones externas", "Me motiva avanzar rápido y graduarme"]
c, _ = centrado(lambda y0: apiladas(["Mujer", "Hombre"], SEG4, [[58, 27, 9, 6], [44, 47, 6, 3]], [C["azul"], C["coral"], "#2A9D8F", "#E9C46A"],
                marcas=[["B", "", "", ""], ["", "A", "", ""]], base_fila=[216, 184], y0=y0, alto_fila=120, bh=56, x0=260, ancho=900), top_extra=0)
guardar("f4-apilada-nominal", lamina("¿Cómo te definirías como estudiante? (según sexo)", c, folio="60", nota=notas(linea_marcas(letra="B"))))


# ------------------------------------------------ F5 · serie por niveles: el rótulo del punto mayor va arriba y el del menor abajo
def serie(series, niveles, marcas, x0=200, x1=1060, y0=200, y1=560, vmax=80):
    out = []
    for k in range(0, vmax + 1, 20):
        y = y1 - (y1 - y0) * k / vmax
        out.append(rect(x0, y, x1 - x0, 1, C["filete"])); out.append(txt(x0 - 12, y + 4, f"{k}%", 10, C["suave"], anchor="end"))
    xs = [x0 + 60 + i * (x1 - x0 - 120) / (len(niveles) - 1) for i in range(len(niveles))]
    for i, n in enumerate(niveles):
        ch, w = chip_letra(xs[i] - 46, y1 + 28, chr(65 + i), 11); out.append(ch)
        out.append(txt(xs[i] - 46 + w + 6, y1 + 32, n, 12, C["azul"], True))
        out.append(txt(xs[i] - 46 + w + 6, y1 + 48, f"n = {NNIV[i]}", 10, C["suave"]))
    cols = [C["azul"], C["azul_medio"]]
    for s, (nombre, vals) in enumerate(series):
        pts = [(xs[i], y1 - (y1 - y0) * v / vmax) for i, v in enumerate(vals)]
        out.append(f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="none" stroke="{cols[s]}" stroke-width="3"/>')
        for i, (x, y) in enumerate(pts):
            otro = series[1 - s][1][i]
            arriba = vals[i] >= otro
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="{cols[s]}" stroke="#fff" stroke-width="2"/>')
            cad = f"{vals[i]}%"; yy = y - 14 if arriba else y + 27
            ancho = tw(cad, 13, True) + (tw(marcas[s][i], 11, True) + 30 if marcas[s][i] else 0)
            xi = x - ancho / 2
            out.append(txt(xi, yy, cad, 13, cols[s], True))
            if marcas[s][i]:
                m, _ = marca(xi + tw(cad, 13, True), yy - 5, marcas[s][i]); out.append(m)
    # leyenda a la derecha: cuadrados del color de cada serie, el bloque centrado a media altura de la zona de datos
    lx = x1 + 56
    ancho_txt = 1290 - lx - 30
    entradas = [(cols[s], wrap(nombre, 12, ancho_txt)) for s, (nombre, _) in enumerate(series)]
    alto = sum(17 * len(l) for _, l in entradas) + 20 * (len(entradas) - 1)
    ly = (y0 + y1) / 2 - alto / 2
    for col, lineas in entradas:
        h = 17 * len(lineas)
        out.append(rect(lx, ly + h / 2 - 7, 14, 14, col, rx=2))
        for k, ln in enumerate(lineas):
            out.append(txt(lx + 24, ly + 12.5 + k * 17, ln, 12, C["azul"]))
        ly += h + 20
    return "".join(out)
c = serie([("Trabaja de forma remunerada", [24, 37, 32, 58]), ("Experiencia vinculada a la carrera", [17, 27, 38, 48])], NIV,
          [["", "", "", "ABC"], ["", "", "A", "AB"]], x1=900, y0=180, y1=585)
guardar("f5-serie-niveles", lamina("Trabajo remunerado y experiencia vinculada a la carrera (según nivel curricular)", c, folio="51",
        nota=notas(linea_marcas())))

# ------------------------------------------------ F6 · respuesta múltiple (lámina 91)
c, _ = centrado(lambda y0: agrupadas(["Trabajaré en una empresa privada", "Trabajaré en el sector público", "Trabajaré en una ONG u organismo internacional"],
                 ["Economía y Finanzas", "Ciencias políticas y sociales"], [[52, 13], [7, 34], [15, 34]], [["B", ""], ["", "A"], ["", "A"]],
                 y0=y0, base_grupo=[224, 176], x0=380, etiqueta_w=330, ancho=620), top_extra=0)
guardar("f6-multiple", lamina("¿Cuáles de las siguientes opciones esperas que describan tu situación profesional dentro de cinco años? (según área)", c, folio="91",
        nota=notas(linea_marcas(), "Respuesta múltiple: cada opción se compara por separado y los porcentajes no suman 100%. Se omiten 4 opciones sin diferencias (ver tablas de cruces).")))

# ------------------------------------------------ E1 · muchas categorías: orden de mayor a menor, cifra de 12 pt y cápsula proporcional
CAT10 = ["Transporte público", "Taxi o aplicativo", "Colectivo", "Auto propio", "Tren o Metropolitano", "Auto compartido", "Caminata", "Bicicleta o patineta", "Moto", "Otro"]
V10 = [[81, 68], [22, 34], [18, 15], [9, 21], [12, 10], [8, 10], [7, 9], [3, 5], [2, 3], [2, 1]]
M10 = [["B", ""], ["", "A"], ["", ""], ["", "A"]] + [["", ""]] * 6
orden = sorted(range(10), key=lambda i: -sum(V10[i]))
lam.MARCA["pt"] = 10
c, _ = centrado(lambda y0: agrupadas([CAT10[i] for i in orden], ["Mujer", "Hombre"], [V10[i] for i in orden], [M10[i] for i in orden], y0=y0, alto_fila=46,
                 base_grupo=[216, 184], x0=330, ancho=700, size_cifra=12, size_cat=11.5), top_extra=0)
lam.MARCA["pt"] = 11
guardar("e1-muchas-categorias", lamina("En el último mes, ¿qué medios de transporte utilizas con mayor frecuencia para llegar a la universidad? (según sexo)", c, folio="36",
        nota=notas(linea_marcas())))


# ------------------------------------------------ E2 · base pequeña: cada carrera es una fila con su letra; las chicas, con trama
def por_carrera():
    CAR = ["Economía", "Relaciones Internacionales", "Ciencia Política y Gobierno", "Finanzas", "Antropología", "Sociología"]
    NB = [182, 90, 69, 42, 11, 6]; V_ = [31, 19, 12, 48, 18, 17]; MK = ["C", "", "", "BC", "", ""]
    x0, esc_, paso = 470, 11, 62
    y = 165 + (477 - (20 + 6 * paso)) / 2 + 20
    xb = x0 + max(V_) * esc_ + 7 + tw("48%", 14, True) + 70 + 34 + 28     # aire fijo tras la barra más larga, su cifra y su cápsula
    out = [txt(x0, y - 14, "De acuerdo + Muy de acuerdo", 10, C["suave"], True), txt(xb, y - 14, "Base (n)", 10, C["suave"], True, anchor="middle")]
    for j, n in enumerate(CAR):
        pe = NB[j] < 30
        ch, w = chip_letra(x0 - 34, y + 17, chr(65 + j), 11, fill=C["tenue"] if pe else C["azul"]); out.append(ch)
        out.append(txt(x0 - 44, y + (15 if pe else 22), n, 12, C["suave"] if pe else C["azul"], True, anchor="end"))
        if pe: out.append(txt(x0 - 44, y + 30, "no se compara", 9.5, C["coral"], anchor="end"))
        out.append(rect(x0, y + 4, V_[j] * esc_, 28, "url(#rayado)" if pe else C["azul"]))
        cad = f"{V_[j]}%"; out.append(txt(x0 + V_[j] * esc_ + 7, y + 24, cad, 14, C["suave"] if pe else C["azul"], True))
        if MK[j]:
            m, _ = marca(x0 + V_[j] * esc_ + 7 + tw(cad, 14, True), y + 18, MK[j]); out.append(m)
        out.append(txt(xb, y + 23, f"{NB[j]}", 11, C["coral"] if pe else C["azul"], anchor="middle"))
        y += paso
    return "".join(out)
guardar("e2-base-pequena", lamina("«El esfuerzo basta para salir de la pobreza» (según carrera)", por_carrera(), folio="61",
        nota=notas(linea_marcas(letra="BC"), "Con trama: carreras con menos de 30 casos. Se muestran como referencia y no se comparan.")))

# ------------------------------------------------ E3 · ninguna diferencia: la nota lo dice, sin piezas extra
c, _ = centrado(lambda y0: apiladas(NIV, ["Regular o mala", "Buena", "Muy buena", "Excelente"], [[12, 37, 38, 13], [14, 40, 35, 11], [15, 41, 33, 11], [16, 45, 31, 8]],
                ["#F4B183", "#ADD493", "#70AD47", "#4E7A2F"], base_fila=NNIV, ttb=[51, 46, 44, 39], ttb_marcas=["", "", "", ""],
                ttb_rotulo="Calidad alta", y0=y0, x0=300, ancho=760), top_extra=16)
guardar("e3-ninguna", lamina("¿Cómo calificarías la calidad de la educación que recibes en tu carrera? (según nivel curricular)", c, folio="57",
        nota=notas([T_("Ninguna diferencia entre niveles es significativa: el 51% del Nivel 6 y el 39% del Nivel 9 no se distinguen con esta muestra. " + METODO)], "Calidad alta: Muy buena + Excelente.")))

# ------------------------------------------------ E4 · todas significativas
c, _ = centrado(lambda y0: apiladas(NIV, ["Sí", "No"], [[17, 83], [29, 71], [40, 60], [52, 48]], [C["azul"], C["celeste"]],
                marcas=[["", ""], ["A", ""], ["AB", ""], ["ABC", ""]], base_fila=NNIV, y0=y0, alto_fila=92, x0=300, ancho=880), top_extra=0)
guardar("e4-todas", lamina("¿Has tenido alguna experiencia laboral vinculada a tu carrera? (según nivel curricular)", c, folio="52", nota=notas(linea_marcas())))


# ------------------------------------------------ L · Cómo leer las diferencias entre grupos
def como_leer():
    out = [rect(40, 165, 650, 420, "#FFFFFF", rx=12, stroke=C["filete"])]
    c, _ = agrupadas(["Académica", "Política universitaria", "Ninguna"], ["Economía y Finanzas", "Ciencias políticas y sociales"],
                     [[17, 44], [5, 25], [36, 16]], [["", "A"], ["", "A"], ["B", ""]], y0=215, alto_fila=82, x0=230, ancho=280,
                     etiqueta_w=170, base_grupo=[224, 176])
    out.append(c.replace("  ·  n = ", " · n = "))
    def call(n, x, y):
        return f'<circle cx="{x}" cy="{y}" r="12" fill="{C["coral"]}"/>' + txt(x, y + 5, str(n), 11, "#FFFFFF", True, anchor="middle")
    out += [call(1, 64, 470), call(2, 546, 226), call(3, 290, 448)]
    pasos = [
        (1, "Cada grupo tiene una letra.", "Va en la leyenda, junto al nombre. La base de cada grupo (n) va en la columna «Base», a la derecha."),
        (2, "▲A quiere decir «mayor que A».", "El 44% de Ciencias políticas y sociales es mayor que el 17% de Economía y Finanzas (grupo A). La marca la lleva siempre el grupo mayor."),
        (3, "Sin marca, no hay diferencia que destacar.", "Puede haber distancia, pero la muestra no permite afirmarla o es menor de 10 puntos."),
        (4, "Contorno punteado: diferencia frágil.", "Existe, pero conviene leerla como «algo mayor»."),
        (5, "Grupos con trama: base pequeña.", "Con menos de 30 casos se muestran como referencia y no se comparan."),
    ]
    y = 190
    for n, t1, t2 in pasos:
        out.append(call(n, 735, y - 5))
        out.append(txt(762, y, t1, 14, C["azul"], True))
        if n == 4:
            m, _ = marca(762 + tw(t1, 14, True) + 6, y - 5, "A", fragil=True); out.append(m)
        if n == 5:
            out.append(rect(762 + tw(t1, 14, True) + 14, y - 15, 22, 16, "url(#rayado)", stroke=C["tenue"], sw=.8))
        yy = y + 22
        for ln in wrap(t2, 12, 500):
            out.append(txt(762, yy, ln, 12, C["suave"])); yy += 18
        y = yy + 18
    out.append(rect(40, 600, 1250, 70, "#FFFFFF", rx=10, stroke=C["filete"]))
    out.append(txt(60, 624, "Cómo se decide", 11, C["azul"], True))
    out.append(txt(60, 643, "Cada par de grupos se compara con la prueba de Rao-Scott, que considera que las y los estudiantes de una misma aula se parecen entre sí.", 11, C["suave"]))
    out.append(txt(60, 660, "Se marca una diferencia si es significativa (p < 0.05, con corrección de Benjamini-Hochberg por el número de comparaciones) y de al menos 10 puntos.", 11, C["suave"]))
    return "".join(out)
guardar("l-como-leer", lamina("Cómo leer las diferencias entre grupos", como_leer(), folio="5", base="Fuente: PULSO PUCP 2026."))


# ------------------------------------------------ W · página Word A4 (827 × 1169 a 100 px/in), mismos textos que la lámina
def nota_word(partes, y, ancho=627, size=8):
    """La nota del Word se envuelve al ancho del texto (627 px) y se centra, como la base."""
    lineas, cur, wcur = [], [], 0
    for p in partes:
        if p[0] == "m":
            w = 34
            if wcur + w > ancho and cur: lineas.append(cur); cur, wcur = [], 0
            cur.append(p); wcur += w
        else:
            for palabra in p[1].split(" "):
                w = tw(palabra + " ", size)
                if wcur + w > ancho and cur: lineas.append(cur); cur, wcur = [], 0
                cur.append(("t", palabra + " ")); wcur += w
    if cur: lineas.append(cur)
    out = []
    for ln in lineas:
        wl = sum(34 if p[0] == "m" else tw(p[1], size) for p in ln)
        out.append(f'<g transform="translate({413 - wl/2:.1f},{y})">{nota_rica(0, 0, ln, size=size)}</g>'); y += 17
    return "".join(out), y


def figura_word(n, titulo, cuerpo_svg, alto_ppt, partes, y, base="Base: 400", dx=-200):
    out = []
    lines = wrap(f"Gráfico N° {n}: {titulo}", 10, 600, True)
    for k, ln in enumerate(lines):
        out.append(txt(413, y + k * 15, ln, 10, "#002060", True, anchor="middle", italic=True))
    y += 15 * len(lines) + 8
    out.append(f'<g transform="translate(100,{y}) scale(0.68) translate({dx},-170)">{cuerpo_svg}</g>')
    y += alto_ppt * 0.68 + 6
    out.append(txt(413, y, base, 8.5, C["suave"], anchor="middle")); y += 15
    s, y = nota_word(partes, y)
    out.append(s)
    return "".join(out), y + 26


def pagina_word():
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="827" height="1169">', DEFS, rect(0, 0, 827, 1169, "#FFFFFF"),
           txt(100, 70, "Perfil del estudiante de la Facultad de Ciencias Sociales", 8, C["suave"]), txt(727, 70, "Vida universitaria", 8, "#002060", True, anchor="end"),
           rect(100, 78, 627, 0.8, C["filete"])]
    lam.MARCA["pt"] = 12
    c1, _ = agrupadas(CATS40, ["Economía y Finanzas", "Ciencias políticas y sociales"], [[17, 44], [5, 25], [36, 16]],
                      [["", "A"], ["", "A"], ["B", ""]], y0=180, base_grupo=[224, 176], x0=470, etiqueta_w=250, ancho=470, alto_fila=80)
    f1, y = figura_word(45, "Durante tu carrera universitaria, ¿perteneciste o perteneces a alguna agrupación o colectivo presencial, sea de la Universidad o externo? (según área)",
                        c1, 330, linea_marcas(), 108, dx=-220)
    out.append(f1)
    c2, _ = apiladas(NIV, SEG, VAL, C["likert"], base_fila=NNIV, ttb=[47, 54, 58, 69], ttb_marcas=["", "", "", "A"], fragiles_ttb={3},
                     ttb_rotulo="Comodidad", y0=200, alto_fila=74, x0=330, ancho=640)
    c2 = c2.replace(">2%</text>", "></text>").replace(">1%</text>", "></text>").replace(">No sé</text>", ">No sé (1–2%)</text>")
    f2, y = figura_word(46, "¿Qué tan cómodo te sientes al hacer preguntas en clase? (según nivel curricular)", c2, 400,
                        [T_("Comodidad: Cómodo + Muy cómodo; la marca la compara. «No sé» cuenta en la base, pero no se compara. ")] + linea_marcas(con_fragil=True), y + 20)
    out.append(f2)
    lam.MARCA["pt"] = 11
    out.append(txt(727, 1110, "32", 9, "#002060", True, anchor="end"))
    out.append("</svg>")
    return "".join(out)
guardar("w-pagina-a4", pagina_word(), 827, 1169)
print("ok")
