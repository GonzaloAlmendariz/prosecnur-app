# Ronda 2b — propuestas SIN letras, sobre las láminas reales 40 (dos grupos) y 74 (cuatro niveles).
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import lam
from lam import *

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
lam.MARCA["pt"] = 11

T40 = "Durante tu carrera universitaria, ¿perteneciste o perteneces a alguna agrupación o colectivo presencial? (según área)"
CATS = ["Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)", "Política universitaria", "Ninguna"]
GR = ["Economía y Finanzas", "Ciencias políticas y sociales"]
V = [[17, 44], [5, 25], [36, 16]]
GAN = [1, 1, 0]                       # grupo mayor en cada fila (todas significativas)
T74 = "Además de tus estudios universitarios, ¿trabajas de forma remunerada? (según nivel curricular)"
NIV = ["Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9"]
SI = [24, 37, 32, 58]
NN = [119, 122, 97, 62]

# geometría de lam.agrupadas / lam.apiladas con estos parámetros
AX0, AANCHO, AY0, AF, ABH = 360, 640, 215, 88, 28
AESC = AANCHO / (44 * 1.12)
PX0, PANCHO, PY0, PF, PBH = 300, 880, 190, 92, 46
PESC = PANCHO / 100
NOTA_Y = 688


def guardar(nombre, svg):
    p = os.path.join(OUT, nombre + ".html")
    open(p, "w").write(f'<html><body style="margin:0;background:#fff">{svg}</body></html>')
    subprocess.run([os.path.join(HERE, "shot.sh"), p, os.path.join(OUT, nombre + ".png"), "1333", "750"])


def base40():
    return agrupadas(CATS, GR, V, None, y0=AY0, base_grupo=[224, 176], x0=AX0, etiqueta_w=320, ancho=AANCHO, letras_leyenda=False)[0]


def base74(**kw):
    return apiladas(NIV, ["Sí", "No"], [[s, 100 - s] for s in SI], [C["azul"], C["celeste"]], base_fila=NN, y0=PY0,
                    alto_fila=PF, x0=PX0, ancho=PANCHO, letras_filas=False, **kw)[0]


def velo(x, y, w, h, op=0.62):
    return rect(x, y, w, h, C["fondo"], extra=f'opacity="{op}"')


def barra40(i, j):
    return AX0, AY0 + i * AF + j * ABH, V[i][j] * AESC, ABH - 2


def nota(s, y=NOTA_Y):
    return txt(49.5, y, s, 9, C["suave"])


# ---------------------------------------------------------------- P0 · referencia con letras (▲A)
c = agrupadas(CATS, GR, V, [["", "A"], ["", "A"], ["B", ""]], y0=AY0, base_grupo=[224, 176], x0=AX0, etiqueta_w=320, ancho=AANCHO)[0]
guardar("p0-letras-40", lamina(T40, c, nota=[nota_rica(49.5, NOTA_Y, [("m", "A", False), ("t", "  Mayor que el grupo A, con diferencia significativa y de al menos 10 puntos.")])]))
c = apiladas(NIV, ["Sí", "No"], [[s, 100 - s] for s in SI], [C["azul"], C["celeste"]], marcas=[["", ""]] * 3 + [["ABC", ""]],
             base_fila=NN, y0=PY0, alto_fila=PF, x0=PX0, ancho=PANCHO)[0]
guardar("p0-letras-74", lamina(T74, c, folio="74", nota=[nota_rica(49.5, NOTA_Y, [("m", "ABC", False), ("t", "  Mayor que los niveles A, B y C, con diferencia significativa y de al menos 10 puntos.")])]))

# ---------------------------------------------------------------- P1 · Énfasis: lo que difiere en color pleno, lo demás se apaga
def p1_40():
    out = [base40()]
    for i in range(3):
        j = 1 - GAN[i]           # el grupo menor queda pleno también: el par es la diferencia; se apagan filas sin diferencia
    # en la 40 todas las filas difieren: se ilustra con una fila sin diferencia añadida
    return "".join(out)
CATS_P1 = CATS + ["Deportiva o artística"]
V_P1 = V + [[21, 24]]
def p1_40b():
    c = agrupadas(CATS_P1, GR, V_P1, None, y0=200, alto_fila=82, base_grupo=[224, 176], x0=AX0, etiqueta_w=320, ancho=AANCHO, letras_leyenda=False)[0]
    y = 200 + 3 * 82
    c += velo(AX0 - 330, y - 6, 1000, 26 * 2 + 10)
    for i in range(3):
        g = GAN[i]
        x = AX0 + V_P1[i][g] * (AANCHO / (44 * 1.12)) + 6 + tw(f"{V_P1[i][g]}%", 14, True) + 8
        c += rect(x, 200 + i * 82 + g * 26 + 3, 4, 20, C["coral"], rx=2)
    return c
guardar("p1-enfasis-40", lamina(T40, p1_40b(), nota=[nota("En color pleno: filas con diferencia significativa entre áreas (10 puntos o más); el trazo coral señala al grupo mayor. Atenuadas: sin diferencia. La fila «Deportiva o artística» es ilustrativa.")]))
def p1_74():
    c = base74()
    for i in range(3):
        c += velo(PX0, PY0 + i * PF, PANCHO, PBH, 0.5)
    c += rect(PX0 - 8, PY0 + 3 * PF - 6, PANCHO + 16, PBH + 12, "none", rx=8, stroke=C["coral"], sw=2)
    return c
guardar("p1-enfasis-74", lamina(T74, p1_74(), folio="74", nota=[nota("Resaltado: el Nivel 9 difiere de los niveles 6, 7 y 8 (diferencia significativa de 10 puntos o más). Los demás no difieren entre sí.")]))

# ---------------------------------------------------------------- P2 · Brecha anotada: corchete entre las dos barras con los puntos
def corchete(x, y1, y2, etiqueta, fuerte=True):
    col = C["azul"] if fuerte else C["tenue_txt"]
    s = f'<path d="M{x-8},{y1} H{x} V{y2} H{x-8}" fill="none" stroke="{col}" stroke-width="1.6"/>'
    w = tw(etiqueta, 12, True) + 18
    s += rect(x + 8, (y1 + y2) / 2 - 12, w, 24, C["banda"] if fuerte else "#FFFFFF", rx=12, stroke=None if fuerte else C["filete"])
    s += txt(x + 8 + w / 2, (y1 + y2) / 2 + 5, etiqueta, 12, col, True, anchor="middle")
    return s
def p2_40():
    c = base40()
    for i in range(3):
        x = AX0 + max(V[i]) * AESC + 62
        c += corchete(x, AY0 + i * AF + 13, AY0 + i * AF + ABH + 13, f"{V[i][1]-V[i][0]:+d} pts")
    return c
guardar("p2-brecha-40", lamina(T40, p2_40(), nota=[nota("Corchete: diferencia significativa entre áreas, en puntos porcentuales (Ciencias políticas y sociales menos Economía y Finanzas). Sin corchete: sin diferencia.")]))
def p2_74():
    global PANCHO
    PANCHO = 760
    c = base74()
    x = PX0 + PANCHO + 30
    c += f'<path d="M{x-8},{PY0+23} H{x} V{PY0+2*PF+23} H{x-8} M{x},{PY0+PF+23} H{x-8}" fill="none" stroke="{C["tenue"]}" stroke-width="1.6"/>'
    c += corchete(x + 14, PY0 + PF + 23, PY0 + 3 * PF + 23, "+21 a +34 pts")
    c += txt(x + 6, PY0 + 2 * PF + 50, "niveles 6–8", 10, C["suave"])
    return c
_p2 = p2_74(); PANCHO = 880
guardar("p2-brecha-74", lamina(T74, _p2, folio="74", nota=[nota("Corchete: el Nivel 9 supera a los niveles 6, 7 y 8 por 21 a 34 puntos (diferencias significativas). Entre los niveles 6 a 8 no hay diferencias.")]))

# ---------------------------------------------------------------- P3 · Punto de hallazgo: ● junto a la cifra del grupo mayor
def punto(x, y, r=6):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{C["coral"]}"/>'
def p3_40():
    c = base40()
    for i in range(3):
        g = GAN[i]; v = V[i][g]
        x = AX0 + v * AESC + 6 + tw(f"{v}%", 14, True) + 12
        c += punto(x, AY0 + i * AF + g * ABH + 13)
    return c
guardar("p3-punto-40", lamina(T40, p3_40(), nota=[punto(56, NOTA_Y - 4, 5), txt(68, NOTA_Y, "Significativamente mayor que el otro grupo (diferencia de 10 puntos o más).", 9, C["suave"])]))
def p3_74():
    c = base74()
    xs = PX0 + 58 * PESC / 2 + tw("58%", 13, True) / 2 + 14
    c += punto(xs, PY0 + 3 * PF + 23).replace(C["coral"], "#FFFFFF")
    c += txt(PX0 + PANCHO + 18, PY0 + 3 * PF + 21, "Mayor que", 10, C["suave"]) + txt(PX0 + PANCHO + 18, PY0 + 3 * PF + 35, "niveles 6, 7 y 8", 10, C["azul"], True)
    return c
guardar("p3-punto-74", lamina(T74, p3_74(), folio="74", nota=[punto(56, NOTA_Y - 4, 5), txt(68, NOTA_Y, "Significativamente mayor que los niveles indicados (diferencia de 10 puntos o más).", 9, C["suave"])]))

# ---------------------------------------------------------------- P4 · Frente al promedio: ▲▼ y el total como referencia
TOT = [28.9, 13.8, 27.2]
def p4_40():
    c = base40()
    for i in range(3):
        tx = AX0 + TOT[i] * AESC
        c += f'<line x1="{tx:.1f}" y1="{AY0+i*AF-6}" x2="{tx:.1f}" y2="{AY0+i*AF+2*ABH+2}" stroke="{C["coral"]}" stroke-width="2"/>'
        for j in range(2):
            v = V[i][j]; up = v > TOT[i]
            x = AX0 + v * AESC + 6 + tw(f"{v}%", 14, True) + 12
            c += tri(x, AY0 + i * AF + j * ABH + 13, 11, C["azul"] if up else C["tenue"], up=up)
    c += f'<line x1="980" y1="604" x2="996" y2="604" stroke="{C["coral"]}" stroke-width="2"/>' + txt(1002, 608, "Total de la Facultad", 11, C["suave"])
    return c
guardar("p4-promedio-40", lamina(T40, p4_40(), nota=[nota("▲▼ El área está por encima o por debajo del total de la Facultad con diferencia significativa (área frente al resto de estudiantes).")]))
def p4_74():
    c = base74()
    tx = PX0 + 35 * PESC
    c += f'<line x1="{tx}" y1="{PY0-14}" x2="{tx}" y2="{PY0+3*PF+PBH+6}" stroke="{C["coral"]}" stroke-width="2" stroke-dasharray="5 3"/>' + txt(tx, PY0 - 20, "Total 35%", 10, C["coral"], True, anchor="middle")
    c += tri(PX0 + PANCHO + 22, PY0 + 3 * PF + 23, 13, C["azul"]) + tri(PX0 + PANCHO + 22, PY0 + 23, 13, C["tenue"], up=False)
    return c
guardar("p4-promedio-74", lamina(T74, p4_74(), folio="74", nota=[nota("▲▼ El nivel está por encima o por debajo del total de la Facultad con diferencia significativa (nivel frente al resto).")]))

# ---------------------------------------------------------------- P5 · Anotación directa: una frase junto a la barra, como en un medio
def p5_40():
    c = base40()
    x = AX0 + 44 * AESC + 70; y = AY0 + ABH + 13
    c += f'<line x1="{AX0+44*AESC+62:.1f}" y1="{y}" x2="{x+8:.1f}" y2="{y}" stroke="{C["coral"]}" stroke-width="1.5"/>'
    c += txt(x + 14, y - 6, "Más del doble", 13, C["coral"], True) + txt(x + 14, y + 12, "que en Economía y Finanzas", 11, C["coral"])
    x2 = AX0 + 25 * AESC + 70; y2 = AY0 + AF + ABH + 13
    c += f'<line x1="{AX0+25*AESC+62:.1f}" y1="{y2}" x2="{x2+8:.1f}" y2="{y2}" stroke="{C["coral"]}" stroke-width="1.5"/>'
    c += txt(x2 + 14, y2 + 5, "+20 puntos", 12, C["coral"], True)
    return c
guardar("p5-anotacion-40", lamina(T40, p5_40(), nota=[nota("Anotaciones: diferencias significativas entre áreas de 10 puntos o más. Se anotan hasta dos por gráfico; el resto, en el texto.")]))
def p5_74():
    global PANCHO
    PANCHO = 760
    c = base74()
    y = PY0 + 3 * PF + 23
    c += f'<line x1="{PX0+PANCHO+8}" y1="{y}" x2="{PX0+PANCHO+24}" y2="{y}" stroke="{C["coral"]}" stroke-width="1.5"/>'
    c += txt(PX0 + PANCHO + 28, y - 6, "El Nivel 9 trabaja", 12, C["coral"], True) + txt(PX0 + PANCHO + 28, y + 11, "más que los demás", 11, C["coral"])
    return c
_p5 = p5_74(); PANCHO = 880
guardar("p5-anotacion-74", lamina(T74, _p5, folio="74", nota=[nota("Anotación: diferencia significativa de 10 puntos o más frente a los niveles 6, 7 y 8.")]))
print("ok")
