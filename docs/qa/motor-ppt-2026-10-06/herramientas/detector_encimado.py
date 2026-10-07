# Gate: texto que se pisa con otro texto, leído del XML (sin rasterizar).
# v2 (M10): compara la TINTA estimada y no la caja. Cada párrafo ocupa el ancho que le da su
# tamaño de letra (sz, negrita), envuelto al ancho de la caja, ubicado según su alineación
# (algn) y el anclaje vertical de la caja (anchor). Así no cuentan como choque las cajas
# anchas de las cifras dentro de la barra ni los rótulos centrados en cajas holgadas.
# Uso: python3 detector_encimado.py mazo.pptx [--detalle]
import zipfile, re, sys, itertools, math
from lxml import etree
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'; P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU = 914400

def ancho(t, sz, b):
    return len(t) * sz * (0.56 if b else 0.52) / 72

def tintas(root):
    out = []
    for sp in root.iter(P + 'sp'):
        off = sp.find('.//' + A + 'xfrm/' + A + 'off'); ext = sp.find('.//' + A + 'xfrm/' + A + 'ext')
        if off is None or ext is None: continue
        x, y, w, h = [int(v) / EMU for v in (off.get('x'), off.get('y'), ext.get('cx'), ext.get('cy'))]
        bp = sp.find('.//' + A + 'bodyPr'); anchor = bp.get('anchor', 't') if bp is not None else 't'
        lins = 0.1 if bp is None or bp.get('lIns') is None else int(bp.get('lIns')) / EMU
        wu = max(0.05, w - 2 * lins)
        pars = []
        for p in sp.iter(A + 'p'):
            t = ''.join(r.text or '' for r in p.iter(A + 't')).strip()
            if not t: continue
            rpr = p.find('.//' + A + 'rPr'); sz = int(rpr.get('sz')) / 100 if rpr is not None and rpr.get('sz') else 18
            b = rpr is not None and rpr.get('b') == '1'
            ppr = p.find(A + 'pPr'); al = ppr.get('algn', 'l') if ppr is not None else 'l'
            wt = ancho(t, sz, b); nl = max(1, math.ceil(wt / wu)); wi = min(wt, wu)
            pars.append((t, sz, al, wi, nl * sz * 1.2 / 72))
        if not pars: continue
        hi = sum(p[4] for p in pars)
        yt = y if anchor == 't' else (y + (h - hi) / 2 if anchor == 'ctr' else y + h - hi)
        for t, sz, al, wi, hp in pars:
            xi = x + lins if al == 'l' else (x + (w - wi) / 2 if al == 'ctr' else x + w - lins - wi)
            out.append((xi, yt, wi, hp * 0.82, t))          # 0,82: el alto de línea incluye interlineado
            yt += hp
    return out

z = zipfile.ZipFile(sys.argv[1]); tot = 0; det = '--detalle' in sys.argv
for n in sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)], key=lambda s: int(re.findall(r'\d+', s)[0])):
    b = tintas(etree.fromstring(z.read(n))); hits = []
    for (x1, y1, w1, h1, t1), (x2, y2, w2, h2, t2) in itertools.combinations(b, 2):
        ix = min(x1 + w1, x2 + w2) - max(x1, x2); iy = min(y1 + h1, y2 + h2) - max(y1, y2)
        if ix > 0.03 and iy > 0.03: hits.append((t1[:30], t2[:30], round(ix, 2), round(iy, 2)))
    if hits: tot += 1; print(re.findall(r'\d+', n)[0], len(hits), hits if det else hits[:2])
print('laminas con texto encimado:', tot)
