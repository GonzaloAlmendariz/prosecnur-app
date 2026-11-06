# Generador de maquetas SVG de láminas Pulso (16:9, 100 px = 1 pulgada) y figuras Word.
# Tokens tomados de api/inst/estandar/estandar_pulso.json.
from html import escape as esc

C = dict(coral="#CA5651", azul="#081F5C", tenue="#8E9DBD", suave="#5A6480", tenue_txt="#8A93A8",
         filete="#D5D9DF", cebra="#E9ECF1", fondo="#F2F2F2", azul_medio="#4F7FAF", fragil="#3A6591", verde_ttb="#3B7A2A", rango="#B9C5DC",
         banda="#E3E7EF", celeste="#9DC3E6", verde="#4E9438", naranja="#B4541F", gris_ns="#BFBFBF",
         fondo_dest="#F8E3E2", likert=["#F4B183", "#FFD965", "#ADD493", "#70AD47", "#BFBFBF"])
PT = 100 / 72  # px por punto a 100 px/in
F = "Arial, Helvetica, sans-serif"


def pt(x):
    return x * PT


def tw(s, size_pt, bold=False):
    """Ancho aproximado de texto Arial en px."""
    w = 0
    for ch in s:
        if ch in "il.,:;|!'’ ": w += 0.28
        elif ch in "mwMW": w += 0.83
        elif ch.isupper() or ch in "%": w += 0.68
        elif ch.isdigit(): w += 0.556
        else: w += 0.52
    return w * pt(size_pt) * (1.06 if bold else 1)


def txt(x, y, s, size, color=C["azul"], bold=False, anchor="start", italic=False, extra=""):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{F}" font-size="{pt(size):.2f}" fill="{color}" '
            f'font-weight="{700 if bold else 400}" text-anchor="{anchor}"{" font-style=\"italic\"" if italic else ""} {extra}>{esc(s)}</text>')


def rect(x, y, w, h, fill, rx=0, stroke=None, sw=1, dash=None, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{max(w,0):.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}"{s}{d} {extra}/>'


def tri(cx, cy, s, fill, stroke=None, up=True, sw=1.2):
    h = s * 0.9
    if up:
        pts = f"{cx-s/2:.1f},{cy+h/2:.1f} {cx+s/2:.1f},{cy+h/2:.1f} {cx:.1f},{cy-h/2:.1f}"
    else:
        pts = f"{cx-s/2:.1f},{cy-h/2:.1f} {cx+s/2:.1f},{cy-h/2:.1f} {cx:.1f},{cy+h/2:.1f}"
    st = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ""
    return f'<polygon points="{pts}" fill="{fill}"{st}/>'


def wrap(s, size, width, bold=False):
    words, lines, cur = s.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if tw(t, size, bold) > width and cur:
            lines.append(cur); cur = w_
        else:
            cur = t
    if cur: lines.append(cur)
    return lines


# ---------------------------------------------------------------- marcas de significancia
# Estilos de marca por dirección:
#  "letra"   : letra pegada a la cifra (hoy)
#  "sup"     : letra volada azul medio, separada (dirección G1)
#  "capsula" : cápsula ▲A (síntesis final). frágil = contorno punteado.
MARCA = {"pt": 10}


def marca(x, y_mid, letras, estilo="capsula", fragil=False, size=None, sobre_oscuro=False):
    """Dibuja la marca a la derecha de x, centrada en y_mid. Devuelve (svg, ancho)."""
    size = size or MARCA["pt"]
    if not letras: return "", 0
    if estilo == "sup":
        col = "#FFFFFF" if sobre_oscuro else C["azul_medio"]
        return txt(x + 3, y_mid - pt(size) * 0.05, letras, size * 0.85, col, bold=True), tw(letras, size * .85, True) + 4
    # cápsula
    h = pt(size) * 1.45
    s_tri = pt(size) * 0.62
    wl = tw(letras, size, True)
    w = 6 + s_tri + 4 + wl + 7
    x0 = x + 5
    if fragil:
        body = rect(x0, y_mid - h / 2, w, h, "#FFFFFF", rx=h / 2, stroke=C["fragil"], sw=1.3, dash="3 2.2")
        body += tri(x0 + 6 + s_tri / 2, y_mid, s_tri, "#FFFFFF", stroke=C["fragil"], sw=1.2)
        body += txt(x0 + 6 + s_tri + 4, y_mid + pt(size) * 0.36, letras, size, C["fragil"], bold=True)
    else:
        body = rect(x0, y_mid - h / 2, w, h, C["banda"], rx=h / 2)
        body += tri(x0 + 6 + s_tri / 2, y_mid, s_tri, C["azul"])
        body += txt(x0 + 6 + s_tri + 4, y_mid + pt(size) * 0.36, letras, size, C["azul"], bold=True)
    return body, w + 5


def chip_letra(x, y_mid, letra, size=10, fill=None, color="#FFFFFF"):
    r = pt(size) * 0.72
    return (f'<circle cx="{x+r:.1f}" cy="{y_mid:.1f}" r="{r:.1f}" fill="{fill or C["azul"]}"/>' +
            txt(x + r, y_mid + pt(size) * 0.35, letra, size * 0.85, color, bold=True, anchor="middle")), 2 * r


# ---------------------------------------------------------------- lámina
def lamina(titulo, cuerpo, base="Base: 400 estudiantes de sexto a noveno nivel curricular. Fuente: PULSO PUCP 2026.",
           nota=None, folio="40", ante=None, W=1333, H=750):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
           DEFS, rect(0, 0, W, H, C["fondo"]), rect(31.5, 22, 5, 70, C["azul"])]
    y = 55
    if ante:
        out.append(txt(49.5, 40, ante.upper(), 10, C["suave"], bold=True, extra='letter-spacing="1"'))
    for ln in wrap(titulo, 24, 1000, True)[:3]:
        out.append(txt(49.5, y + 6, ln, 24, C["coral"], bold=True)); y += 38
    # logo
    out.append(f'<circle cx="1150" cy="56" r="26" fill="{C["azul"]}"/>' + txt(1186, 50, "PULSO", 17, C["azul"], True) +
               txt(1186, 72, "PUCP", 17, C["azul"], True))
    out.append(cuerpo)
    if nota:
        yy = 688 - 16 * (len(nota) - 1)
        for ln in nota:
            out.append(ln if ln.startswith("<") else txt(49.5, yy, ln, 9, C["suave"])); yy += 16
    out.append(txt(49.5, 712, base, 10, C["azul"], bold=True))
    out.append(txt(1300, 712, folio, 10, C["suave"], anchor="end"))
    out.append("</svg>")
    return "\n".join(out)


def nota_rica(x, y, partes, size=9):
    """partes: lista de ('t', texto) | ('m', letras, fragil) — dibuja una línea con marcas inline."""
    fus = []
    for p in partes:   # textos seguidos van en un solo <text>: así el navegador (o PowerPoint) mide el espacio, no la estimación
        if p[0] == "t" and fus and fus[-1][0] == "t": fus[-1] = ("t", fus[-1][1] + p[1])
        else: fus.append(p)
    partes = fus
    s, cx = [], x
    for p in partes:
        if p[0] == "t":
            s.append(txt(cx, y, p[1], size, C["suave"])); cx += tw(p[1], size) * 1.04 + 3
        else:
            m, w = marca(cx - 5, y - pt(size) * 0.33, p[1], "capsula", p[2], size=size)
            s.append(m); cx += w + 1
    return "".join(s)


# ---------------------------------------------------------------- barras agrupadas horizontales
def agrupadas(cats, grupos, valores, marcas=None, estilo="capsula", x0=330, ancho=560, y0=200, alto_fila=88,
              colores=(C["azul"], C["celeste"]), etiqueta_w=300, size_cifra=14, leyenda=True, ns_mute=None,
              base_grupo=None, letras_leyenda=True, total=None, fragiles=None, pequenos=None, size_cat=12, vmax=None, n_en_barra=False, x_base=None, w_base=56, aire_base=34):
    """La base de cada barra va en la columna «Base» a la derecha (x_base), como la Diferencia de la lámina 94 o el top two box.
    n_en_barra=True la deja tras la cifra (variante descartada).
    valores[i][g] en %, marcas[i][g] = 'A' o ''. ns_mute: set de (i) filas sin diferencia (se atenúan)."""
    marcas = marcas or [["" for _ in grupos] for _ in cats]
    fragiles = fragiles or set()
    pequenos = pequenos or set()
    out = []
    g = len(grupos)
    bh = min(28, (alto_fila - 16) / g)
    vm = vmax or max(max(r) for r in valores) * 1.12
    pend_n, borde_der = [], 0
    escala = ancho / vm
    y = y0
    for i, cat in enumerate(cats):
        bloque = bh * g
        lines = wrap(cat, size_cat, etiqueta_w)
        ly = y + bloque / 2 - (len(lines) - 1) * 9 + 5
        for ln in lines:
            out.append(txt(x0 - 14, ly, ln, size_cat, C["azul"], anchor="end")); ly += 18
        for j in range(g):
            v = valores[i][j]
            col = colores[j % len(colores)]
            muted = ns_mute is not None and i in ns_mute
            if j in pequenos:
                pat = "url(#rayado)"
                out.append(rect(x0, y + j * bh, v * escala, bh - 2, pat))
            else:
                out.append(rect(x0, y + j * bh, v * escala, bh - 2, col, extra='opacity="0.35"' if muted else ""))
            cad = f"{v:.0f}%"
            dark = col in (C["azul"], C["azul_medio"]) and not muted
            wcad = tw(cad, size_cifra, True)
            ym = y + j * bh + (bh - 2) / 2
            dentro = v * escala > wcad + 24 and estilo in ("letra",)
            if dentro:
                lab = cad + (" " + marcas[i][j] if marcas[i][j] else "")
                out.append(txt(x0 + v * escala / 2, ym + pt(size_cifra) * .36, lab, size_cifra,
                               "#FFFFFF" if dark else C["azul"], bold=True, anchor="middle"))
            else:
                xc = x0 + v * escala + 6
                colc = C["tenue_txt"] if muted else (C["suave"] if j in pequenos else C["azul"])
                out.append(txt(xc, ym + pt(size_cifra) * .36, cad, size_cifra, colc, bold=True))
                wm = 0
                if marcas[i][j]:
                    m, wm = marca(xc + wcad, ym, marcas[i][j], estilo, (i, j) in fragiles)
                    out.append(m)
                borde_der = max(borde_der, xc + wcad + wm)
                if base_grupo and n_en_barra:
                    nb = base_grupo[j][i] if isinstance(base_grupo[j], (list, tuple)) else base_grupo[j]
                    out.append(txt(xc + wcad + (wm + 3 if wm else 7), ym + pt(10) * .36, f"n = {nb}", 10, C["suave"]))
        if base_grupo and not n_en_barra:
            for j in range(g):
                nb = base_grupo[j][i] if isinstance(base_grupo[j], (list, tuple)) else base_grupo[j]
                pend_n.append((y + j * bh + (bh - 2) / 2, nb, j))
        if total is not None:
            tx = x0 + total[i] * escala
            out.append(f'<line x1="{tx:.1f}" y1="{y-4:.1f}" x2="{tx:.1f}" y2="{y+bloque+2:.1f}" stroke="{C["coral"]}" stroke-width="2"/>')
        y += alto_fila
    if base_grupo and not n_en_barra:
        # la columna va a un aire fijo del borde derecho más lejano (cifra + cápsula), sin separador
        xb = x_base if x_base is not None else borde_der + aire_base
        out.append(txt(xb + w_base / 2, y0 - 14, "Base (n)", 10, C["suave"], True, anchor="middle"))
        for ym, nb, j in pend_n:
            out.append(txt(xb + w_base / 2, ym + pt(11) * .36, f"{nb:,}", 11, C["suave"] if j in pequenos else C["azul"], anchor="middle"))
    if leyenda:
        ly = y + 14
        partes, cx = [], 0
        items = []
        for j, gname in enumerate(grupos):
            lab = gname
            items.append((j, lab))
        total_w = sum(27 + tw(l, 12) + 34 for _, l in items)
        cx = x0 + ancho / 2 - total_w / 2
        for j, lab in items:
            col = colores[j % len(colores)]
            if j in pequenos:
                partes.append(rect(cx, ly - 14, 19, 19, "url(#rayado)", rx=4, stroke=C["tenue"], sw=.8))
            else:
                partes.append(rect(cx, ly - 14, 19, 19, col, rx=4))
            if letras_leyenda:
                claro = col not in (C["azul"], C["azul_medio"], "#2F4B7C", "#0B4F8C")
                partes.append(txt(cx + 9.5, ly + 0.5, chr(65 + j), 11, C["azul"] if (claro or j in pequenos) else "#FFFFFF", True, anchor="middle"))
            cx += 27
            partes.append(txt(cx, ly, lab, 12, C["azul"] if j not in pequenos else C["suave"])); cx += tw(lab, 12) + 34
        out += partes
    return "\n".join(out), y + 30


DEFS = (f'<defs><pattern id="rayado" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
        f'<rect width="6" height="6" fill="#E3E7EF"/><line x1="0" y1="0" x2="0" y2="6" stroke="{C["tenue"]}" stroke-width="2.2"/></pattern></defs>')


def con_defs(svg):
    return svg.replace("viewBox=", "", 0).replace(">", ">" + DEFS, 1)


# ---------------------------------------------------------------- apiladas al 100 %
def apiladas(filas, segmentos, valores, colores, marcas=None, x0=250, ancho=820, y0=190, alto_fila=88, bh=46,
             ttb=None, ttb_marcas=None, ttb_rotulo="Top two box", fragiles_ttb=None, estilo="capsula",
             letras_filas=True, base_fila=None, oscuros=None, pequenos=None, fila_w=200, leyenda=True):
    """valores[i][k]; marcas[i][k] marca dentro del segmento. ttb[i] valor de la columna resumen con su marca."""
    marcas = marcas or [["" for _ in segmentos] for _ in filas]
    oscuros = oscuros or {C["azul"], C["azul_medio"], "#0B4F8C", "#2F6DA8", C["verde"], "#2A9D8F", C["coral"], "#4E7A2F", "#2F4B7C"}
    fragiles_ttb = fragiles_ttb or set()
    pequenos = pequenos or set()
    out, y = [], y0
    esc_ = ancho / 100
    for i, f in enumerate(filas):
        ym = y + bh / 2
        lx = x0 - 16
        if letras_filas:
            ch, wch = chip_letra(x0 - 16 - 22, ym, chr(65 + i), 11, fill=C["azul"] if i not in pequenos else C["tenue"])
            out.append(ch); lx = x0 - 16 - 30
        lines = wrap(f, 12, fila_w, True)
        yy = ym + 5 - (len(lines) - 1) * 8 - (7 if (base_fila and i in pequenos) else 0)
        for ln in lines:
            out.append(txt(lx, yy, ln, 12, C["azul"], bold=True, anchor="end")); yy += 17
        if base_fila:
            out.append(txt(x0 + ancho, y - 6, f"n = {base_fila[i]:,}", 10, C["suave"], anchor="end"))
            if i in pequenos:
                out.append(txt(lx, yy - 1, "no se compara", 9.5, C["coral"], anchor="end"))
        cx = x0
        for k, v in enumerate(valores[i]):
            w = v * esc_
            out.append(rect(cx, y, w, bh, colores[k], extra='opacity="0.55"' if i in pequenos else ""))
            cad = f"{v:.0f}%"
            lab_col = "#FFFFFF" if colores[k] in oscuros else C["azul"]
            if w > tw(cad, 13, True) + 8:
                m = marcas[i][k]
                if m:
                    _, wm = marca(0, 0, m, estilo)
                    tot = tw(cad, 13, True) + wm
                    if w > tot + 10:
                        xs = cx + w / 2 - tot / 2
                        out.append(txt(xs, ym + 6, cad, 13, lab_col, True))
                        mm, _ = marca(xs + tw(cad, 13, True), ym, m, estilo)
                        out.append(mm)
                    else:
                        out.append(txt(cx + w / 2, ym + 6, cad, 13, lab_col, True, anchor="middle"))
                else:
                    out.append(txt(cx + w / 2, ym + 6, cad, 13, lab_col, True, anchor="middle"))
            elif v >= 1:
                esquina = base_fila and cx + w / 2 > x0 + ancho - 80
                out.append(txt(cx + w / 2, y + bh + 14 if esquina else y - 6, cad, 10, C["azul"], True, anchor="middle"))
            cx += w
        if ttb is not None:
            # columna del estándar (`columna_top_two_box` = 1 in): la cifra centrada en su eje, la cápsula a su derecha
            xt = x0 + ancho + 20 + 50
            cad = f"{ttb[i]:.0f}%"
            out.append(txt(xt, ym + 7, cad, 15, C["verde_ttb"] if i not in pequenos else C["suave"], True, anchor="middle"))
            if ttb_marcas and ttb_marcas[i]:
                mm, _ = marca(xt + tw(cad, 15, True) / 2, ym, ttb_marcas[i], estilo, i in fragiles_ttb)
                out.append(mm)
        y += alto_fila
    if ttb is not None:
        out.append(txt(x0 + ancho + 20 + 50, y0 - 16, ttb_rotulo, 10, C["verde_ttb"], True, anchor="middle"))
    if leyenda:
        ly = y + 4
        items = [(colores[k], s) for k, s in enumerate(segmentos)]
        total_w = sum(19 + tw(s, 12) + 26 for _, s in items)
        cx = x0 + ancho / 2 - total_w / 2
        for col, s in items:
            out.append(rect(cx, ly - 11, 13, 13, col)); cx += 19
            out.append(txt(cx, ly, s, 12, C["azul"])); cx += tw(s, 12) + 26
    return "\n".join(out), y + 30


def leyenda_filas(x, y, nombres, size=11, pequenos=()):
    """Mapa compacto «A Nivel 6 · B Nivel 7» para apiladas (cuando las filas ya llevan chip, sirve de recordatorio)."""
    out, cx = [], x
    for j, n in enumerate(nombres):
        ch, w = chip_letra(cx, y - 4, chr(65 + j), size, fill=C["azul"] if j not in pequenos else C["tenue"])
        out.append(ch); cx += w + 5
        out.append(txt(cx, y, n, size, C["azul"])); cx += tw(n, size) + 18
    return "".join(out)
