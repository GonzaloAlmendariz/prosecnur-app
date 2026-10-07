"""Prueba final (M9b): radiografía de un PPT entregado a mano.

Por lámina: título, gráficos nativos (tipo, agrupación, n.º de series y categorías,
si los rótulos llevan % y n), tablas, imágenes y cuadros de texto largos.
Uso: python3 analizar_ppt_entregado.py <pptx> [--detalle]  (imprime resumen y conteos)
"""
import zipfile, re, sys, collections
def rd(z, n): return z.read(n).decode("utf8", "ignore")
def main(f, detalle=False):
    z = zipfile.ZipFile(f); nm = z.namelist()
    sl = sorted([n for n in nm if re.match(r"ppt/slides/slide\d+\.xml$", n)], key=lambda n: int(re.findall(r"\d+", n)[0]))
    tot = collections.Counter(); filas = []
    for k, n in enumerate(sl, 1):
        x = rd(z, n); relp = n.replace("slides/", "slides/_rels/") + ".rels"
        rel = rd(z, relp) if relp in nm else ""
        txt = re.findall(r"<a:t>([^<]*)</a:t>", x)
        tit = next((t.strip() for t in txt if len(t.strip()) > 4), "")
        graf = []
        for c in re.findall(r'Target="\.\./charts/(chart\d+\.xml)"', rel):
            cx = rd(z, "ppt/charts/" + c)
            for tipo in re.findall(r"<c:(barChart|bar3DChart|pieChart|pie3DChart|doughnutChart|radarChart|lineChart|scatterChart|areaChart|bubbleChart)>", cx):
                grp = (re.findall(r'<c:grouping val="(\w+)"', cx) or [""])[0]
                dirb = (re.findall(r'<c:barDir val="(\w+)"', cx) or [""])[0]
                nser = len(re.findall(r"<c:ser>", cx)); ncat = len(set(re.findall(r"<c:pt idx=\"(\d+)\"", cx.split("<c:val>")[0]))) if "<c:cat>" in cx else 0
                lbl_n = "showVal" in cx and bool(re.search(r"\(\d+\)", cx))
                g = f"{tipo.replace('Chart','')}:{grp or '-'}:{dirb or '-'} s{nser}"
                graf.append(g); tot["graf " + tipo.replace("Chart", "") + ("/" + grp if grp else "")] += 1
        ntab = x.count("<a:tbl>"); nimg = len(re.findall(r"<p:pic>", x))
        largos = sum(1 for t in txt if len(t) > 160)
        tot["tablas"] += ntab; tot["imagenes"] += nimg
        if any(re.search(r"\bOtros?\b", t) for t in txt[:3]): tot["laminas Otros"] += 1
        if re.search(r"\d+\s?%\s*\(\d+\)", " ".join(txt)): tot["laminas con % (n)"] += 1
        if re.search(r"Top\s*(Two|2)\s*Box", " ".join(txt), re.I): tot["laminas Top Two Box"] += 1
        filas.append(f"{k:3d} {tit[:60]:60s} graf={len(graf)} tab={ntab} img={nimg} largos={largos} {' '.join(graf)[:90]}")
    print(f"## {f.split('/')[-1]} | láminas {len(sl)}")
    for kk, v in sorted(tot.items()): print(f"   {kk}: {v}")
    if detalle: print("\n".join(filas))
if __name__ == "__main__":
    main(sys.argv[1], "--detalle" in sys.argv)
