# Prototipo de gate: texto que se pisa con otro texto, leído del XML (sin rasterizar).
import zipfile, re, sys, itertools
from lxml import etree
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'; P='{http://schemas.openxmlformats.org/presentationml/2006/main}'
EMU=914400
def boxes(root):
    out=[]
    for sp in root.iter(P+'sp'):
        t=''.join(x.text or '' for x in sp.iter(A+'t')).strip()
        if not t: continue
        off=sp.find('.//'+A+'xfrm/'+A+'off'); ext=sp.find('.//'+A+'xfrm/'+A+'ext')
        if off is None: continue
        x,y,w,h=[int(v)/EMU for v in (off.get('x'),off.get('y'),ext.get('cx'),ext.get('cy'))]
        out.append((x,y,w,h,t))
    return out
z=zipfile.ZipFile(sys.argv[1]); tot=0
for n in sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',n)], key=lambda s:int(re.findall(r'\d+',s)[0])):
    b=boxes(etree.fromstring(z.read(n))); hits=[]
    for (x1,y1,w1,h1,t1),(x2,y2,w2,h2,t2) in itertools.combinations(b,2):
        ix=min(x1+w1,x2+w2)-max(x1,x2); iy=min(y1+h1,y2+h2)-max(y1,y2)
        if ix>0.02 and iy>0.4*min(h1,h2) and min(h1,h2)>0.05: hits.append((t1[:28],t2[:28]))
    if hits: tot+=1; print(re.findall(r'\d+',n)[0], len(hits), hits[:2])
print('laminas con texto encimado:', tot)
