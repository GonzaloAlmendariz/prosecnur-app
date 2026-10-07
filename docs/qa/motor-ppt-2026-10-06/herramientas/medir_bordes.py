# Por lámina: borde izquierdo del contenido (zona 1.4 a 6.8 in): texto visible (x + inserción) y formas sin texto.
import zipfile,re,sys,collections
from lxml import etree
A='{http://schemas.openxmlformats.org/drawingml/2006/main}';P='{http://schemas.openxmlformats.org/presentationml/2006/main}';E=914400
z=zipfile.ZipFile(sys.argv[1]); pres=etree.fromstring(z.read('ppt/presentation.xml'))
rels={r.get('Id'):r.get('Target') for r in etree.fromstring(z.read('ppt/_rels/presentation.xml.rels'))}
orden=[rels[s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')] for s in pres.find(P+'sldIdLst')]
dist=collections.Counter(); filas=[]
for k,t in enumerate(orden,1):
    r=etree.fromstring(z.read('ppt/'+t)); ed=[]
    for sp in list(r.iter(P+'sp'))+list(r.iter(P+'graphicFrame'))+list(r.iter(P+'pic')):
        off=sp.find('.//'+A+'off')
        if off is None: off=sp.find('.//'+P+'xfrm/'+A+'off')
        if off is None: continue
        x=int(off.get('x'))/E; y=int(off.get('y'))/E
        if not (1.4<=y<=6.75): continue
        tx=''.join(q.text or '' for q in sp.iter(A+'t')).strip()
        if tx:
            al=[p.get('algn','l') for p in sp.iter(A+'pPr')]
            if al and al[0]!='l': continue
            b=sp.find('.//'+A+'bodyPr'); l=int(b.get('lIns',91440)) if b is not None else 91440
            ed.append(round(x+l/E,2))
        else: ed.append(round(x,2))
    if ed: m=min(ed); dist[m]+=1; filas.append((k,m))
print("borde mínimo del contenido por lámina (in): ",dict(sorted(dist.items())))
print("láminas por borde:",{b:[k for k,m in filas if m==b][:12] for b in sorted(dist)})
