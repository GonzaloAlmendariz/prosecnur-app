# Ilustraciones de índice con personalidad (pedidos de Gonzalo, 2026-10-07: «los focos tenían su toque», «hasta ahora todo
# está muy plano y aburrido», «los libros y los lápices pueden tener íconos, los focos estar mejor definidos, parecen peras»
# y «lo normal es tener sólo 5 capítulos»). Una pieza por capítulo: foco, libro, lápiz o pin. Cada dibujo sale en SVG
# (620 x 750, 1 unidad = 0.01 in, el panel izquierdo de la lámina) con un JSON que dice dónde va el ícono de cada pieza.
# Uso: python3 ilustraciones_indice.py <carpeta_salida>
import sys, os, json, math, random
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
PAL = ["#EFD25E", "#E4A34C", "#9688D3", "#7594CC", "#85BB85", "#081F5C"]
NAVY, DARK, FONDO, CORAL = "#081F5C", "#061B2A", "#F2F2F2", "#CA5651"
def claro(hexc):   # True si el ícono debe ir en azul oscuro (fondo claro)
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 1.05 / (0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) + 0.05) < 3.0
def color(k, n): return PAL[k % (5 if n <= 5 else 6)]
def guardar(nombre, cuerpo, anclas):
    open(os.path.join(out, nombre + ".svg"), "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" width="620" height="750" viewBox="0 0 620 750"><rect width="620" height="750" fill="{FONDO}"/>{cuerpo}</svg>')
    json.dump(anclas, open(os.path.join(out, nombre + ".json"), "w"))
def ancla(x, y, d, fill, k): return {"k": k + 1, "x": round(x / 100, 3), "y": round(y / 100, 3), "d": round(d / 100, 3), "claro": claro(fill)}

# --- Focos: tapa con rosca arriba, cuello que se abre y globo redondo; halo de luz y brillo
def foco(cx, top, R, fill, estilo='color'):
    cap_w, cap_h, cuello = 0.78 * R, 0.5 * R, 0.55 * R
    cy = top + cap_h + cuello + 0.82 * R
    halo = "" if estilo != 'color' else "".join(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{R * m:.1f}" fill="{fill}" opacity="{o}"/>' for m, o in ((1.75, .08), (1.42, .14)))
    y1 = top + cap_h
    cuello_p = (f'<path d="M {cx - 0.38 * R:.1f} {y1:.1f} L {cx + 0.38 * R:.1f} {y1:.1f} C {cx + 0.38 * R:.1f} {y1 + 0.3 * R:.1f} {cx + 0.72 * R:.1f} {y1 + 0.38 * R:.1f} {cx + 0.78 * R:.1f} {y1 + cuello + 0.2 * R:.1f} '
                f'L {cx - 0.78 * R:.1f} {y1 + cuello + 0.2 * R:.1f} C {cx - 0.72 * R:.1f} {y1 + 0.38 * R:.1f} {cx - 0.38 * R:.1f} {y1 + 0.3 * R:.1f} {cx - 0.38 * R:.1f} {y1:.1f} Z" fill="{fill}"/>')
    globo = f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{R:.1f}" fill="{fill}"/>'
    brillo = f'<path d="M {cx - 0.62 * R:.1f} {cy - 0.12 * R:.1f} A {0.66 * R:.1f} {0.66 * R:.1f} 0 0 1 {cx - 0.12 * R:.1f} {cy - 0.64 * R:.1f}" fill="none" stroke="#FFFFFF" stroke-width="{0.09 * R:.1f}" stroke-linecap="round" opacity=".55"/>'
    tapa = f'<rect x="{cx - cap_w / 2:.1f}" y="{top:.1f}" width="{cap_w:.1f}" height="{cap_h:.1f}" rx="{0.08 * R:.1f}" fill="{DARK}"/>'
    rosca = "".join(f'<rect x="{cx - cap_w / 2 - 0.04 * R:.1f}" y="{top + (0.12 + 0.13 * j) * R:.1f}" width="{cap_w + 0.08 * R:.1f}" height="{0.05 * R:.1f}" rx="{0.02 * R:.1f}" fill="#2B4157"/>' for j in range(3))
    if estilo == 'linea':   # sólo trazo: globo y cuello en línea azul oscuro, sin relleno ni brillo
        st = f'fill="{FONDO}" stroke="{NAVY}" stroke-width="{0.055 * R:.1f}" stroke-linejoin="round"'
        cuello_p = cuello_p.replace(f'fill="{fill}"', st); globo = globo.replace(f'fill="{fill}"', st); brillo = ""
        tapa = tapa.replace(f'fill="{DARK}"', f'fill="{NAVY}"'); rosca = rosca.replace('fill="#2B4157"', f'fill="{FONDO}"')
        # el cuello se dibuja encima del globo para que la unión no muestre la línea del círculo
        return halo + globo + cuello_p.replace(st, f'fill="{FONDO}" stroke="none"') + cuello_p + tapa + rosca, cy
    if estilo in ('mono', 'duo'): brillo = brillo.replace('opacity=".55"', 'opacity=".35"')
    return halo + cuello_p + globo + brillo + tapa + rosca, cy
def focos(n, estilo='color'):
    # 5 capítulos: un foco por capítulo, colgados a distintas alturas como en la plantilla. Hasta 8: dos niveles.
    # Más de 8: vuelven los 5 focos decorativos y la lista lleva los capítulos (así lo hace el motor).
    if n <= 5 or n > 8:
        pos = [(120, 175, 66), (295, 150, 66), (205, 420, 62), (395, 450, 62), (520, 220, 58)][:min(n, 5) if n <= 5 else 5]
    else:
        pc = math.ceil(n / 2); paso = 560 / pc
        pos = [(30 + paso * (k % pc + 0.5) + (paso / 2 if k >= pc else 0), (90 if k % 2 == 0 else 150) + (290 if k >= pc else 0), 48) for k in range(n)]
        pos = [(min(x, 585 - R), t, R) for x, t, R in pos]
    c = ""; an = []
    for k, (cx, top, R) in enumerate(pos):
        c += f'<line x1="{cx:.1f}" y1="-10" x2="{cx:.1f}" y2="{top + 2:.1f}" stroke="{DARK if estilo == "color" else NAVY}" stroke-width="{5 if estilo == "color" else 3}" stroke-linecap="round"/>'
    for k, (cx, top, R) in enumerate(pos):
        col = {'mono': ["#081F5C", "#2F4B7C", "#4F6A9A", "#7387B0", "#9AA9C8"][k % 5], 'duo': ["#081F5C", "#9DC3E6"][k % 2], 'linea': FONDO}.get(estilo, color(k, len(pos)))
        p_, cy = foco(cx, top, R, col, estilo); c += p_; an.append(ancla(cx, cy, R * (0.95 if estilo == 'linea' else 1.05), col, k))
    return c, an
# --- Libros: un lomo por capítulo, con su ícono y su número
def libros(n):
    random.seed(7); base = 600; c = ""; an = []
    anchos = [random.choice([0.9, 1.0, 1.1]) for _ in range(n)]; gap = 6; wtot = 540 - gap * (n - 1); u = wtot / sum(anchos)
    altos = [random.choice([340, 380, 410, 360, 430]) for _ in range(n)]; x = 40
    for k in range(n):
        w = anchos[k] * u; h = altos[k]; col = color(k, n)
        c += f'<rect x="{x:.1f}" y="{base - h}" width="{w:.1f}" height="{h}" rx="4" fill="{col}"/>'
        c += f'<rect x="{x:.1f}" y="{base - h + 22}" width="{w:.1f}" height="7" fill="#FFFFFF" opacity=".5"/><rect x="{x:.1f}" y="{base - 46}" width="{w:.1f}" height="7" fill="#FFFFFF" opacity=".5"/>'
        c += f'<rect x="{x + w * 0.66:.1f}" y="{base - h}" width="{w * 0.34:.1f}" height="{h}" rx="4" fill="#000000" opacity=".07"/>'
        d = min(w * 0.62, 56); an.append(ancla(x + w / 2, base - h + 46 + d / 2 + 6, d, col, k))
        c += f'<text x="{x + w / 2:.1f}" y="{base - 62}" font-family="Arial" font-weight="700" font-size="{min(26, w * 0.45):.0f}" fill="{NAVY if claro(col) else "#FFFFFF"}" text-anchor="middle">{k + 1}</text>'
        x += w + gap
    c += f'<rect x="20" y="{base}" width="580" height="18" rx="3" fill="{DARK}"/><rect x="44" y="{base + 18}" width="14" height="70" fill="{DARK}"/><rect x="562" y="{base + 18}" width="14" height="70" fill="{DARK}"/>'
    return c, an
# --- Lápices: uno por capítulo, con su ícono en el cuerpo
def lapices(n):
    c = ""; an = []; gap = 10 if n <= 8 else 7; w = min(84, (560 - gap * (n - 1)) / n); x0 = (620 - n * w - (n - 1) * gap) / 2; base = 690
    largos = [460, 400, 500, 380, 440, 480, 360, 450, 410, 490, 370, 430, 420]
    for k in range(n):
        x = x0 + k * (w + gap); L = largos[k % len(largos)]; col = color(k, n); top = base - L; pt = w * 1.25
        c += f'<polygon points="{x:.1f},{top + pt:.1f} {x + w / 2:.1f},{top:.1f} {x + w:.1f},{top + pt:.1f}" fill="#F1D5AF"/>'
        c += f'<polygon points="{x + w * 0.32:.1f},{top + pt * 0.36:.1f} {x + w / 2:.1f},{top:.1f} {x + w * 0.68:.1f},{top + pt * 0.36:.1f}" fill="{DARK if col == "#EFD25E" else col}"/>'
        c += f'<rect x="{x:.1f}" y="{top + pt:.1f}" width="{w:.1f}" height="{L - pt:.1f}" fill="{col}"/><rect x="{x + w * 0.64:.1f}" y="{top + pt:.1f}" width="{w * 0.36:.1f}" height="{L - pt:.1f}" fill="#000000" opacity=".08"/>'
        d = w * 0.62; an.append(ancla(x + w / 2, top + pt + 18 + d / 2, d, col, k))
        c += f'<text x="{x + w / 2:.1f}" y="{base - 22}" font-family="Arial" font-weight="700" font-size="{min(26, w * 0.42):.0f}" fill="{NAVY if claro(col) else "#FFFFFF"}" text-anchor="middle">{k + 1}</text>'
    return c, an
# --- Camino: ruta curva con un pin por capítulo (ícono dentro) y bandera de llegada
def camino(n):
    d = "M 70 710 C 70 570, 540 610, 540 480 S 80 410, 90 290 S 520 230, 540 120"
    c = f'<path d="{d}" fill="none" stroke="#D3D8E0" stroke-width="34" stroke-linecap="round"/><path d="{d}" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="12 12" stroke-linecap="round"/>'
    segs = [((70, 710), (70, 570), (540, 610), (540, 480)), ((540, 480), (540, 350), (80, 410), (90, 290)), ((90, 290), (100, 170), (520, 230), (540, 120))]
    def bez(p, t): return tuple((1 - t) ** 3 * p[0][i] + 3 * (1 - t) ** 2 * t * p[1][i] + 3 * (1 - t) * t ** 2 * p[2][i] + t ** 3 * p[3][i] for i in (0, 1))
    us = [0.06 + 0.86 * k / max(1, n - 1) for k in range(n)]; an = []; r = 40 if n <= 5 else 32 if n <= 8 else 25
    for k, u in enumerate(us):
        s = min(int(u * 3), 2); x, y = bez(segs[s], u * 3 - s); col = color(k, n)
        c += f'<path d="M {x:.1f} {y:.1f} C {x - r * .25:.1f} {y - r * .6:.1f} {x - r:.1f} {y - r * 1.1:.1f} {x - r:.1f} {y - r * 1.85:.1f} A {r} {r} 0 1 1 {x + r:.1f} {y - r * 1.85:.1f} C {x + r:.1f} {y - r * 1.1:.1f} {x + r * .25:.1f} {y - r * .6:.1f} {x:.1f} {y:.1f} Z" fill="{col}"/>'
        an.append(ancla(x, y - r * 1.85, r * 1.15, col, k))
    c += f'<circle cx="540" cy="120" r="10" fill="{CORAL}"/>'
    return c, an
for nombre, f in (("focos", focos), ("libros", libros), ("lapices", lapices), ("camino", camino)):
    for n in (5, 8, 13):
        cuerpo, an = f(n); guardar(f"{nombre}_{n}", cuerpo, an)
for est in ("linea", "mono", "duo"):
    cuerpo, an = focos(5, est); guardar(f"focos{est}_5", cuerpo, an)
print("ok ilustraciones de 5, 8 y 13 piezas en", out)

# --- Geometría abstracta (Gonzalo eligió «geometría abstracta»: sin objetos dibujados, estilo informe corporativo).
# Paleta de la marca: azul oscuro, azules intermedios, celeste y gris azulado, con un único acento coral.
AZ = {"navy": "#081F5C", "mid": "#2F4B7C", "med": "#4F6A9A", "tenue": "#8E9DBD", "cel": "#9DC3E6", "claro": "#C9D3E6"}
def geo_bloques():
    c = ""
    for x, y, w, h, col, o in ((0, 0, 420, 750, "navy", 1), (300, 120, 220, 380, "mid", 1), (160, 330, 300, 300, "cel", .85),
                               (0, 520, 260, 230, "med", 1), (420, 40, 120, 160, "claro", 1), (260, 600, 280, 90, "tenue", .9)):
        c += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{AZ[col]}" opacity="{o}"/>'
    c += f'<rect x="300" y="500" width="160" height="6" fill="{CORAL}"/>'
    return c
def geo_circulos():
    c = ""
    for cx, cy, r, col, o in ((60, 160, 300, "navy", 1), (330, 470, 260, "cel", .75), (110, 650, 210, "mid", .9), (460, 140, 150, "claro", .9), (520, 640, 90, "tenue", .9)):
        c += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{AZ[col]}" opacity="{o}"/>'
    c += f'<circle cx="455" cy="330" r="16" fill="{CORAL}"/>'
    return c
def geo_facetas():
    pts = {"a": (0, 0), "b": (310, 0), "c": (560, 0), "d": (0, 260), "e": (250, 210), "f": (520, 300), "g": (0, 520), "h": (330, 480), "i": (560, 560), "j": (0, 750), "k": (220, 750), "l": (470, 750)}
    tri = [("a", "b", "e", "navy"), ("a", "e", "d", "mid"), ("b", "c", "f", "med"), ("b", "f", "e", "navy"), ("d", "e", "h", "cel"), ("d", "h", "g", "mid"),
           ("e", "f", "h", "tenue"), ("f", "i", "h", "claro"), ("g", "h", "k", "navy"), ("g", "k", "j", "med"), ("h", "i", "l", "mid"), ("h", "l", "k", "cel")]
    c = "".join(f'<polygon points="{pts[p][0]},{pts[p][1]} {pts[q][0]},{pts[q][1]} {pts[r][0]},{pts[r][1]}" fill="{AZ[col]}" stroke="{AZ[col]}" stroke-width="1"/>' for p, q, r, col in tri)
    c += f'<polygon points="330,480 370,520 330,540" fill="{CORAL}"/>'
    return c
def geo_arcos():
    c = ""
    cols = ["navy", "cel", "mid", "claro", "med", "tenue", "navy"]
    for i, r in enumerate(range(620, 60, -80)):
        c += f'<circle cx="0" cy="750" r="{r}" fill="{AZ[cols[i % len(cols)]]}"/>'
    for i in range(7):
        for j in range(7):
            c += f'<circle cx="{420 + i * 22}" cy="{70 + j * 22}" r="3.2" fill="{AZ["tenue"]}"/>'
    c += f'<circle cx="0" cy="750" r="60" fill="{CORAL}"/>'
    return c
for nombre, f in (("geobloques", geo_bloques), ("geocirculos", geo_circulos), ("geofacetas", geo_facetas), ("geoarcos", geo_arcos)):
    guardar(f"{nombre}_5", f(), [])
print("ok geometrías")

# --- Geometría con un ícono por capítulo (pedido de Gonzalo: «¿se pueden integrar íconos de Lucide de forma orgánica en
# cada capítulo?»). Cada capítulo es una pieza de la composición con su ícono; el ancla guarda su color para que el número
# de la lista use el mismo. Las piezas que no son capítulo van en tonos neutros.
CAP = ["#081F5C", "#2F4B7C", "#4F6A9A", "#7FA9D6", "#8E9DBD"]
def anc(x, y, d, fill, k): a = ancla(x, y, d, fill, k); a["fill"] = fill; return a
def gi_circulos():
    c = ""; an = []
    for cx, cy, r, col, o in ((540, 90, 120, AZ["claro"], .9), (40, 760, 150, AZ["claro"], .7)): c += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}" opacity="{o}"/>'
    piezas = [(180, 230, 155), (420, 330, 112), (240, 505, 120), (450, 575, 80), (95, 640, 70)]
    for k, (cx, cy, r) in enumerate(piezas):
        c += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{CAP[k]}" opacity=".94"/>'; an.append(anc(cx, cy, min(78, r * 0.62), CAP[k], k))
    c += f'<circle cx="545" cy="420" r="13" fill="{CORAL}"/>'
    return c, an
def gi_facetas():
    pts = {"a": (0, 0), "b": (310, 0), "c": (560, 0), "d": (0, 260), "e": (250, 210), "f": (520, 300), "g": (0, 520), "h": (330, 480), "i": (560, 560), "j": (0, 750), "k": (220, 750), "l": (470, 750)}
    tri = [("a", "b", "e"), ("a", "e", "d"), ("b", "c", "f"), ("b", "f", "e"), ("d", "e", "h"), ("d", "h", "g"), ("e", "f", "h"), ("f", "i", "h"), ("g", "h", "k"), ("g", "k", "j"), ("h", "i", "l"), ("h", "l", "k")]
    capitulo = {0: 0, 3: 1, 4: 2, 7: 3, 8: 4}            # facetas que llevan capítulo, en orden de lectura
    neutros = [AZ["claro"], "#B7C3D9", "#DCE3EE"]; c = ""; an = []
    for t, (p, q, r) in enumerate(tri):
        col = CAP[capitulo[t]] if t in capitulo else neutros[t % 3]
        c += f'<polygon points="{pts[p][0]},{pts[p][1]} {pts[q][0]},{pts[q][1]} {pts[r][0]},{pts[r][1]}" fill="{col}" stroke="{FONDO}" stroke-width="3"/>'
        if t in capitulo:
            gx = (pts[p][0] + pts[q][0] + pts[r][0]) / 3; gy = (pts[p][1] + pts[q][1] + pts[r][1]) / 3; an.append(anc(gx, gy, 70, col, capitulo[t]))
    an.sort(key=lambda a: a["k"])
    c += f'<polygon points="330,480 372,522 330,545" fill="{CORAL}"/>'
    return c, an
def gi_arcos():
    c = ""; an = []; anchos = 92; r0 = 640
    for k in range(5):
        r = r0 - k * anchos; c += f'<circle cx="0" cy="750" r="{r}" fill="{CAP[k]}"/>'
    c += f'<circle cx="0" cy="750" r="{r0 - 5 * anchos}" fill="{FONDO}"/><circle cx="0" cy="750" r="60" fill="{CORAL}"/>'
    for k in range(5):
        rm = r0 - k * anchos - anchos / 2; ang = math.radians(78 - k * 12)
        an.append(anc(rm * math.cos(ang), 750 - rm * math.sin(ang), 58, CAP[k], k))
    for i in range(6):
        for j in range(6): c += f'<circle cx="{450 + i * 22}" cy="{60 + j * 22}" r="3.2" fill="{AZ["tenue"]}"/>'
    return c, an
def gi_bloques():
    c = ""; an = []
    for x, y, w, h in ((420, 30, 140, 150), (0, 560, 120, 190)): c += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{AZ["claro"]}"/>'
    piezas = [(0, 0, 380, 330), (250, 190, 300, 250), (60, 360, 270, 230), (330, 470, 230, 190), (150, 600, 220, 150)]
    for k, (x, y, w, h) in enumerate(piezas):
        c += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{CAP[k]}" opacity=".96"/>'; an.append(anc(x + 30 + 33, y + 30 + 33, 66, CAP[k], k))
    c += f'<rect x="330" y="462" width="150" height="7" fill="{CORAL}"/>'
    return c, an
for nombre, f in (("gicirculos", gi_circulos), ("gifacetas", gi_facetas), ("giarcos", gi_arcos), ("gibloques", gi_bloques)):
    cuerpo, an = f(); guardar(f"{nombre}_5", cuerpo, an)
print("ok geometrías con íconos")
