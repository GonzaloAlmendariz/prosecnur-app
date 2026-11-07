# Ronda 2 — cinco direcciones para gráficos sobre el caso real CCSS (láminas 40 y 74 del mazo v4).
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from lam import *

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

T40 = "Durante tu carrera universitaria, ¿perteneciste o perteneces a alguna agrupación o colectivo presencial? (según área)"
CATS = ["Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)", "Política universitaria", "Ninguna"]
GR = ["Economía y Finanzas", "Ciencias políticas y sociales"]
NG = [224, 176]
V = [[17, 44], [5, 25], [36, 16]]
M = [["", "A"], ["", "A"], ["B", ""]]
TOT = [28.9, 13.8, 27.2]

T74 = "Además de tus estudios universitarios, ¿trabajas de forma remunerada? (según nivel curricular)"
NIV = ["Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9"]
NN = [119, 122, 97, 62]
SI = [24, 37, 32, 58]
TOT74 = 35


def guardar(nombre, svg):
    p = os.path.join(OUT, nombre + ".html")
    open(p, "w").write(f'<html><body style="margin:0;background:#fff">{svg}</body></html>')
    subprocess.run([os.path.join(HERE, "shot.sh"), p, os.path.join(OUT, nombre + ".png"), "1333", "750"])


# ---------- G1 · Letras guiadas: letra en la leyenda, letra volada fuera de la cifra, sin complementos
c, _ = agrupadas(CATS, GR, V, M, estilo="sup", y0=230, base_grupo=NG)
guardar("g1-agrupadas", lamina(T40, c, nota=["Una letra junto a la cifra: mayor que el grupo de esa letra (prueba z, Bonferroni, α = 0.05)."]))
c, _ = apiladas(NIV, ["Sí", "No"], [[s, 100 - s] for s in SI], [C["azul"], C["celeste"]],
                marcas=[["", ""], ["", ""], ["", ""], ["ABC", ""]], estilo="sup", base_fila=NN, y0=200, alto_fila=92)
guardar("g1-dicotomica", lamina(T74, c, folio="74", nota=["Una letra junto a la cifra: mayor que el grupo de esa letra (prueba z, Bonferroni, α = 0.05). Sólo se marca «Sí»."]))

# ---------- G2 · Frente al total: ▲▼ cuando el grupo difiere del total de la Facultad; total como trazo coral
def agr_total():
    c, y = agrupadas(CATS, GR, V, None, estilo="capsula", y0=230, total=TOT, base_grupo=NG, letras_leyenda=False)
    flechas = {(0, 1): True, (0, 0): False, (1, 1): True, (1, 0): False, (2, 0): True, (2, 1): False}
    extra = []
    y0, af, bh = 230, 88, 28
    for (i, j), up in flechas.items():
        v = V[i][j]
        x = 330 + v * (560 / (44 * 1.12)) + 6 + tw(f"{v}%", 14, True) + 10
        ym = 230 + i * af + j * bh + 13
        extra.append(tri(x, ym, 11, C["azul"] if up else C["coral"], up=up))
    extra.append(f'<line x1="900" y1="600" x2="916" y2="600" stroke="{C["coral"]}" stroke-width="2"/>' + txt(922, 604, "Total de la Facultad", 11, C["suave"]))
    return c + "".join(extra)
guardar("g2-agrupadas", lamina(T40, agr_total(), nota=["▲ ▼ El grupo está por encima o por debajo del total de la Facultad, con diferencia significativa (grupo frente al resto)."]))

def dic_total():
    c, _ = apiladas(NIV, ["Sí", "No"], [[s, 100 - s] for s in SI], [C["azul"], C["celeste"]], base_fila=NN, y0=200, alto_fila=92, letras_filas=False)
    tx = 250 + TOT74 * 8.2
    extra = [f'<line x1="{tx}" y1="188" x2="{tx}" y2="560" stroke="{C["coral"]}" stroke-width="2" stroke-dasharray="5 3"/>',
             txt(tx, 182, "Total 35%", 10, C["coral"], True, anchor="middle"),
             tri(250 + 58 * 8.2 - 60, 200 + 3 * 92 + 23, 12, "#FFFFFF"), tri(250 + 24 * 8.2 - 22, 200 + 23, 12, "#FFFFFF", up=False)]
    return c + "".join(extra)
guardar("g2-dicotomica", lamina(T74, dic_total(), folio="74", nota=["▲ ▼ El nivel está por encima o por debajo del total de la Facultad, con diferencia significativa (grupo frente al resto)."]))

# ---------- G3 · Columna de brecha: la diferencia en puntos a la derecha, fuerte si es significativa
def agr_brecha():
    c, y = agrupadas(CATS, GR, V, None, y0=230, base_grupo=NG, letras_leyenda=False)
    out = [c, txt(1130, 214, "Diferencia", 10, C["suave"], True, anchor="middle"), txt(1130, 228, "(B − A)", 9, C["suave"], anchor="middle")]
    for i, (a, b) in enumerate(V):
        d = b - a
        ym = 230 + i * 88 + 30
        out.append(rect(1080, ym - 17, 100, 34, C["banda"], rx=17))
        out.append(txt(1130, ym + 7, f"{d:+d} pts", 15, C["azul"], True, anchor="middle"))
    out.append(rect(1080, 230 + 3 * 88 - 10, 100, 1, C["filete"]))
    return "".join(out)
guardar("g3-agrupadas", lamina(T40, agr_brecha(), nota=["Diferencia en puntos entre Ciencias políticas y sociales (B) y Economía y Finanzas (A). En cápsula: significativa (p < 0.05); en gris: no significativa."]))

def dic_brecha():
    c, _ = apiladas(NIV, ["Sí", "No"], [[s, 100 - s] for s in SI], [C["azul"], C["celeste"]], base_fila=NN, y0=200, alto_fila=92, letras_filas=False, ancho=760)
    out = [c, txt(1130, 186, "vs Nivel 6", 10, C["suave"], True, anchor="middle")]
    for i, s in enumerate(SI[1:], start=1):
        d = s - SI[0]; sig = i == 3
        ym = 200 + i * 92 + 23
        if sig: out.append(rect(1080, ym - 17, 100, 34, C["banda"], rx=17))
        out.append(txt(1130, ym + 7, f"{d:+d} pts", 15 if sig else 13, C["azul"] if sig else C["tenue_txt"], sig, anchor="middle"))
    return "".join(out)
guardar("g3-dicotomica", lamina(T74, dic_brecha(), folio="74", nota=["Diferencia de cada nivel frente al Nivel 6, en puntos. En cápsula: significativa; en gris: no significativa. ¿Y Nivel 9 frente a 7 y 8? No cabe en una columna."]))

# ---------- G4 · Franja de diferencias destacadas
def franja(lineas, x=905, y=210, w=380):
    out = [rect(x, y, w, 360, "#FFFFFF", rx=10, stroke=C["filete"]), txt(x + 22, y + 34, "Diferencias destacadas", 13, C["coral"], True)]
    yy = y + 70
    for l in lineas:
        for k, ln in enumerate(wrap(l, 12, w - 60)):
            out.append(txt(x + 40, yy, ln, 12, C["azul"])); yy += 18
        out.append(tri(x + 26, yy - 18 * len(wrap(l, 12, w - 60)) - 4, 10, C["azul"]))
        yy += 16
    return "".join(out)
c, _ = agrupadas(CATS, GR, V, None, y0=230, base_grupo=NG, letras_leyenda=False, x0=300, ancho=480, etiqueta_w=260)
c += franja(["Ciencias políticas y sociales participa más en agrupaciones académicas: 44% frente a 17% (+27 puntos).",
             "También en política universitaria: 25% frente a 5% (+20 puntos).",
             "En Economía y Finanzas es más frecuente no pertenecer a ninguna: 36% frente a 16%."])
guardar("g4-agrupadas", lamina(T40, c, nota=["Diferencias significativas (p < 0.05) y de 10 puntos o más."]))
c, _ = apiladas(NIV, ["Sí", "No"], [[s, 100 - s] for s in SI], [C["azul"], C["celeste"]], base_fila=NN, y0=200, alto_fila=92, letras_filas=False, ancho=560, x0=230)
c += franja(["En el Nivel 9 trabaja el 58%, más que en los niveles 6, 7 y 8 (entre 24% y 37%).", "Entre los niveles 6, 7 y 8 no hay diferencias significativas."])
guardar("g4-dicotomica", lamina(T74, c, folio="74", nota=["Diferencias significativas (p < 0.05) y de 10 puntos o más."]))

# ---------- G5 · Brecha con intervalo (dumbbell): para el anexo técnico
def dumbbell():
    out = []
    x0, w = 420, 640; sc = w / 60
    for k in range(0, 61, 10):
        out.append(rect(x0 + k * sc, 220, 1, 300, C["filete"]))
        out.append(txt(x0 + k * sc, 540, f"{k}%", 10, C["suave"], anchor="middle"))
    ci = [(14, 40), (12, 28), (12, 28)]
    for i, (a, b) in enumerate(V):
        ym = 260 + i * 100
        for ln_i, ln in enumerate(wrap(CATS[i], 12, 330)):
            out.append(txt(x0 - 24, ym + 4 - 8 * (len(wrap(CATS[i], 12, 330)) - 1) + ln_i * 17, ln, 12, C["azul"], anchor="end"))
        out.append(rect(x0 + min(a, b) * sc, ym - 2, abs(b - a) * sc, 4, C["tenue"]))
        out.append(f'<circle cx="{x0+a*sc:.1f}" cy="{ym}" r="9" fill="{C["azul"]}"/><circle cx="{x0+b*sc:.1f}" cy="{ym}" r="9" fill="{C["celeste"]}" stroke="{C["azul"]}" stroke-width="1"/>')
        out.append(txt(x0 + a * sc, ym - 16, f"{a}%", 11, C["azul"], True, anchor="middle"))
        out.append(txt(x0 + b * sc, ym - 16, f"{b}%", 11, C["azul"], True, anchor="middle"))
        out.append(txt(x0 + w + 40, ym + 5, f"{b-a:+d}", 14, C["azul"], True))
        out.append(txt(x0 + w + 80, ym + 5, f"IC [{ci[i][0] if b>a else -ci[i][1]:+d}; {ci[i][1] if b>a else -ci[i][0]:+d}]", 10, C["suave"]))
    out.append(f'<circle cx="560" cy="590" r="7" fill="{C["azul"]}"/>' + txt(574, 594, "Economía y Finanzas", 12, C["azul"]) +
               f'<circle cx="760" cy="590" r="7" fill="{C["celeste"]}" stroke="{C["azul"]}"/>' + txt(774, 594, "Ciencias políticas y sociales", 12, C["azul"]))
    return "".join(out)
guardar("g5-agrupadas", lamina(T40, dumbbell(), nota=["Diferencia en puntos con su intervalo al 95% ajustado (Newcombe). Si el intervalo no cruza el cero, la diferencia es significativa. Intervalos ilustrativos."]))
print("ok")
