"""Mide la tipografía real de informes entregados (M10): por cada cuadro de texto,
tamaño de letra (sz), negrita, color y posición, y lo clasifica por rol según la
posición y el contenido. Imprime, por rol, el tamaño y el color más frecuentes y el
rango de posiciones. Uso: python3 medir_estilo.py a.pptx b.pptx ...
"""
import zipfile, re, sys, collections
EMU = 914400
def roles(f, acc):
    z = zipfile.ZipFile(f)
    W = int(re.search(r'<p:sldSz[^>]*cx="(\d+)"', z.read("ppt/presentation.xml").decode()).group(1)) / EMU
    for n in [n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)]:
        x = z.read(n).decode("utf8", "ignore")
        for sp in re.findall(r"<p:sp>.*?</p:sp>", x, re.S):
            off = re.search(r'<a:off x="(-?\d+)" y="(-?\d+)"/><a:ext cx="(\d+)" cy="(\d+)"', sp)
            if not off: continue
            X, Y, CX, CY = (int(v) / EMU for v in off.groups())
            for para in re.findall(r"<a:p>.*?</a:p>", sp, re.S):
                runs = re.findall(r"<a:r>(.*?)</a:r>", para, re.S)
                t = "".join(re.findall(r"<a:t>([^<]*)</a:t>", para)).strip()
                if not t: continue
                rp = runs[0] if runs else ""
                sz = re.search(r'sz="(\d+)"', rp); sz = int(sz.group(1)) / 100 if sz else None
                b = ' b="1"' in rp
                col = re.search(r'<a:srgbClr val="([0-9A-Fa-f]{6})"', rp); col = col.group(1).upper() if col else "tema"
                if sz is None: continue
                if Y < 0.95 and sz >= 18: r = "titulo"
                elif Y < 1.3 and sz < 18 and X < W * 0.7: r = "subtitulo"
                elif Y > 6.55 and re.match(r"(Base|Los porcentajes|Nota|Fuente)", t): r = "base y nota al pie"
                elif re.fullmatch(r"\d{1,3}\s?%(\s?\(\d+\))?", t): r = "cifra (porcentaje)"
                elif re.fullmatch(r"TOP TWO BOX|Top Two Box|Top 2 Box", t, re.I): r = "rótulo Top Two Box"
                elif t.upper() in ("TOTALMENTE EN DESACUERDO", "EN DESACUERDO", "DE ACUERDO", "TOTALMENTE DE ACUERDO", "SIN INF", "SÍ", "NO"): r = "leyenda"
                elif len(t) > 160: r = "texto narrativo (párrafo)"
                elif t.endswith("?") or len(t) > 45: r = "pregunta o afirmación"
                else: r = "rótulo corto (actor, categoría)"
                acc[r].append((sz, b, col, round(X, 2), round(Y, 2), round(CX, 2)))
acc = collections.defaultdict(list)
for f in sys.argv[1:]: roles(f, acc)
for r, v in sorted(acc.items(), key=lambda kv: -len(kv[1])):
    sz = collections.Counter(a[0] for a in v).most_common(3); col = collections.Counter(a[2] for a in v).most_common(3)
    b = sum(a[1] for a in v) / len(v)
    xs = sorted(a[3] for a in v); ys = sorted(a[4] for a in v)
    q = lambda s, p: s[int(p * (len(s) - 1))]
    print(f"{r:28s} n={len(v):5d} | tamaño {sz} | negrita {b:.0%} | color {col} | x p10-p90 {q(xs,.1)}-{q(xs,.9)} | y p10-p90 {q(ys,.1)}-{q(ys,.9)}")
