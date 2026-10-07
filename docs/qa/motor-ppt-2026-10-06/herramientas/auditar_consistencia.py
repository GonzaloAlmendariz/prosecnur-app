"""Audita la consistencia entre láminas de un recetario (loop M8a).

Lee el XML del pptx y reporta, por lámina con antetítulo: tamaños de texto fuera de la
escala de tokens, posición del título y del antetítulo frente a la moda del mazo, y
cuántos tamaños distintos usa. Uso: python3 auditar_consistencia.py recetario.pptx
"""
import re, sys, zipfile, collections
from lxml import etree
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'; P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
ESCALA = {72, 34, 32, 30, 28, 26, 24, 22, 20, 18, 17, 16, 15, 14, 13, 12.5, 12, 11.5, 11, 10.5, 10}
EMU = 914400
z = zipfile.ZipFile(sys.argv[1])
pres = etree.fromstring(z.read('ppt/presentation.xml'))
rels = {r.get('Id'): r.get('Target') for r in etree.fromstring(z.read('ppt/_rels/presentation.xml.rels'))}
orden = [rels[s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')] for s in pres.find(P + 'sldIdLst')]
filas = []
for k, t in enumerate(orden, 1):
    r = etree.fromstring(z.read('ppt/' + t)); tit = ante = None; fuera = collections.Counter(); usados = set()
    for sp in r.iter(P + 'sp'):
        tx = ''.join(x.text or '' for x in sp.iter(A + 't')).strip(); off = sp.find('.//' + A + 'off')
        for rp in sp.iter(A + 'rPr'):
            if rp.get('sz') and tx:
                v = int(rp.get('sz')) / 100; usados.add(v)
                if v not in ESCALA: fuera[v] += 1
        szs = [int(rp.get('sz')) / 100 for rp in sp.iter(A + 'rPr') if rp.get('sz')]
        if off is not None and tx and szs:
            y = int(off.get('y')) / EMU; x = int(off.get('x')) / EMU
            if szs[0] == 24 and y < 0.7 and tit is None: tit = (round(x, 2), round(y, 2))
            if szs[0] == 10 and tx.isupper() and y < 0.4 and ante is None: ante = (round(x, 2), round(y, 2))
    filas.append((k, tit, ante, dict(fuera), sorted(usados)))
moda_t = collections.Counter(f[1] for f in filas if f[1]).most_common(1)[0][0]
moda_a = collections.Counter(f[2] for f in filas if f[2]).most_common(1)[0][0]
print(f'moda título {moda_t}, moda antetítulo {moda_a}')
for k, tit, ante, fuera, usados in filas:
    obs = []
    if tit and tit != moda_t: obs.append(f'título en {tit}')
    if ante and ante[1] != moda_a[1]: obs.append(f'antetítulo en {ante}')
    if fuera: obs.append(f'tamaños fuera de escala {fuera}')
    if len(usados) > 7: obs.append(f'{len(usados)} tamaños distintos {usados}')
    if obs: print(k, '; '.join(obs))
