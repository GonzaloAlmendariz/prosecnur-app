import zipfile,re,sys
def lum(h):
    v=[int(h[i:i+2],16)/255 for i in (0,2,4)]; v=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in v]
    return .2126*v[0]+.7152*v[1]+.0722*v[2]
def cr(a,b): la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+.05)/(lb+.05)
z=zipfile.ZipFile(sys.argv[1]); n_sl=len([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',n)])
tot=0
for i in range(1,n_sl+1):
    x=re.sub(r'>\s+<','><',z.read(f'ppt/slides/slide{i}.xml').decode())
    fills=[];texts=[]
    for sp in re.findall(r'<p:sp>.*?</p:sp>',x,re.S):
        off=re.search(r'<a:off x="(-?\d+)" y="(-?\d+)"/><a:ext cx="(\d+)" cy="(\d+)"',sp)
        if not off: continue
        X,Y,CX,CY=map(int,off.groups())
        sppr=re.search(r'<p:spPr>(.*?)</p:spPr>',sp,re.S); f=None
        if sppr:
            m=re.search(r'^(?:(?!<a:ln).)*?<a:solidFill><a:srgbClr val="(\w{6})"',sppr.group(1),re.S)
            if m: f=m.group(1)
        ts=re.findall(r'<a:rPr[^>]*>(?:(?!</a:rPr>).)*?<a:solidFill><a:srgbClr val="(\w{6})".*?<a:t>([^<]+)</a:t>',sp,re.S)
        if f and CX>0 and CY>0: fills.append((X,Y,CX,CY,f))
        for c,t in ts:
            if t.strip(): texts.append((X+CX/2,Y+CY/2,c,t,f))
    for cx,cy,c,t,own in texts:
        bg=own
        if not bg:
            under=[f for f in fills if f[0]<=cx<=f[0]+f[2] and f[1]<=cy<=f[1]+f[3]]
            if under: bg=under[-1][4]
        if bg and cr(c,bg)<4.5:
            tot+=1; print(i,t[:30],c,'sobre',bg,round(cr(c,bg),2))
print('total',tot)
