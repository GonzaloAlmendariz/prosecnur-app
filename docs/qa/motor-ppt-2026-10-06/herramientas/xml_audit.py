import zipfile, re, sys, collections
from lxml import etree
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
P='{http://schemas.openxmlformats.org/presentationml/2006/main}'
z=zipfile.ZipFile(sys.argv[1])
pres=etree.fromstring(z.read('ppt/presentation.xml'))
sz=pres.find(P+'sldSz'); W,H=int(sz.get('cx')),int(sz.get('cy'))
print('slide size in', W/914400, H/914400)
slides=sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',n)], key=lambda s:int(re.findall(r'\d+',s)[0]))
R=collections.Counter(); fonts=collections.Counter(); sizes=collections.Counter(); ex=collections.defaultdict(list)
for sn in slides:
    k=int(re.findall(r'\d+',sn)[0]); root=etree.fromstring(z.read(sn))
    for p in root.iter(A+'p'):
        ch=list(p)
        for i,c in enumerate(ch):
            if c.tag==A+'pPr' and i!=0: R['pPr_no_primero']+=1; ex['pPr_no_primero'].append(k)
            if c.tag==A+'endParaRPr' and i!=len(ch)-1: R['run_tras_endParaRPr']+=1; ex['run_tras_endParaRPr'].append(k)
    for rpr in root.iter(A+'rPr',A+'defRPr',A+'endParaRPr'):
        if rpr.get('sz'): sizes[int(rpr.get('sz'))/100]+=1
    for lat in root.iter(A+'latin'): fonts[lat.get('typeface')]+=1
    for off in root.iter(A+'off'):
        ext=off.getnext()
        if ext is None or ext.tag!=A+'ext': continue
        x,y,cx,cy=int(off.get('x')),int(off.get('y')),int(ext.get('cx')),int(ext.get('cy'))
        if x<0 or y<0 or x+cx>W+1000 or y+cy>H+1000:
            R['forma_fuera_lamina']+=1; ex['forma_fuera_lamina'].append((k,round((x+cx)/914400,2),round((y+cy)/914400,2)))
    for bp in root.iter(A+'bodyPr'):
        if bp.find(A+'normAutofit') is not None:
            R['normAutofit']+=1; ex['normAutofit'].append((k,bp.find(A+'normAutofit').get('fontScale')))
        if bp.get('wrap')=='none': R['wrap_none']+=1
    R['pic']+=len(root.findall('.//'+P+'pic'))
    R['graphicFrame']+=len(root.findall('.//'+P+'graphicFrame'))
    R['sp']+=len(root.findall('.//'+P+'sp'))
    R['grpSp']+=len(root.findall('.//'+P+'grpSp'))
    R['tbl']+=len(root.findall('.//'+A+'tbl'))
    for sp in root.findall('.//'+P+'sp'):
        ph=sp.find('.//'+P+'ph'); txb=sp.find(P+'txBody')
        txt=''.join(t.text or '' for t in sp.iter(A+'t'))
        if ph is not None and not txt.strip(): R['ph_vacio']+=1; ex['ph_vacio'].append((k,ph.get('type'),ph.get('idx')))
        if txb is not None and '\n' not in txt and txt.count('  ')>0: pass
    # rvg text boxes count
print(dict(R))
for k,v in ex.items(): print(k, v[:25], '...' if len(v)>25 else '')
print('fonts', fonts.most_common(10))
print('sizes', sorted(sizes.items())[:40])
