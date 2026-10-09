#!/usr/bin/env python3
"""Reordena el recetario moderno según recetario_estructura.json (propuesta de diseño, 2026-10-08).

Uso: reordenar.py MAZO.pptx REGISTRO.tsv ESTRUCTURA.json
REGISTRO trae una clave «sección:posición» por lámina, en el orden en que se crearon (el mismo de sldIdLst).
Falla si una lámina registrada no está en la estructura, si una clave de la estructura no existe o si se repite.
Después renumera el folio («Folio lamina») de cada lámina con su posición nueva."""
import json, re, sys, zipfile, shutil, tempfile, os

mazo, registro, estructura = sys.argv[1:4]
claves = [l.strip() for l in open(registro, encoding="utf-8") if l.strip()]
est = json.load(open(estructura, encoding="utf-8"))

def expandir(item):
    sec, pos = item.rsplit(":", 1)
    if "-" in pos:
        a, b = map(int, pos.split("-")); return [f"{sec}:{k}" for k in range(a, b + 1)]
    return [item]

orden = []
for it in est["apertura"]: orden += expandir(it)
for cap in est["capitulos"]:
    orden.append(f"cap_{cap['n']}:1")
    for sec in cap["secciones"]:
        orden.append(f"cap_{sec['n']}:1")
        for it in sec["laminas"]: orden += expandir(it)
for it in est.get("final", []): orden += expandir(it)

err = []
rep = sorted({k for k in orden if orden.count(k) > 1})
if rep: err.append("claves repetidas en la estructura: " + ", ".join(rep))
falta = [k for k in orden if k not in claves]
if falta: err.append("claves de la estructura que no se crearon: " + ", ".join(falta))
sobra = [k for k in claves if k not in orden]
if sobra: err.append("láminas creadas sin lugar en la estructura: " + ", ".join(sobra))
if err:
    print("\n".join(err), file=sys.stderr); sys.exit(1)

z = zipfile.ZipFile(mazo)
pres = z.read("ppt/presentation.xml").decode("utf-8")
lst = re.search(r"<p:sldIdLst>(.*?)</p:sldIdLst>", pres, re.S)
ids = re.findall(r"<p:sldId [^>]*/>", lst.group(1))
if len(ids) != len(claves):
    print(f"el mazo tiene {len(ids)} láminas y el registro {len(claves)}", file=sys.stderr); sys.exit(1)
por_clave = dict(zip(claves, ids))
nuevo = [por_clave[k] for k in orden]
pres2 = pres[:lst.start(1)] + "".join(nuevo) + pres[lst.end(1):]

rels = z.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
rid2t = {}
for m in re.finditer(r"<Relationship [^>]*>", rels):
    t = m.group(0); i = re.search(r'Id="([^"]+)"', t).group(1); g = re.search(r'Target="([^"]+)"', t).group(1); rid2t[i] = g
folio = {}
for k, sid in enumerate(nuevo, 1):
    rid = re.search(r'r:id="([^"]+)"', sid).group(1); folio["ppt/" + rid2t[rid].lstrip("/").replace("ppt/", "")] = k

def renumerar(xml, n):
    def sp(m):
        bloque = m.group(0)
        if 'name="Folio lamina"' not in bloque: return bloque
        return re.sub(r"(<a:t>)[^<]*(</a:t>)", lambda t: f"{t.group(1)}{n}{t.group(2)}", bloque, count=1)
    return re.sub(r"<p:sp>.*?</p:sp>", sp, xml, flags=re.S)

tmp = tempfile.mktemp(suffix=".pptx")
with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
    for it in z.infolist():
        data = z.read(it.filename)
        if it.filename == "ppt/presentation.xml": data = pres2.encode("utf-8")
        elif it.filename in folio: data = renumerar(data.decode("utf-8"), folio[it.filename]).encode("utf-8")
        out.writestr(it, data)
z.close(); shutil.move(tmp, mazo)
print(f"reordenadas {len(orden)} láminas")
