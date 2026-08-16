#!/usr/bin/env python3
"""Repara identificadores de layout duplicados en el master de una plantilla.

POR QUE EXISTE: al anadir los diez layouts nuevos a `plantilla_16_9.pptx` y
`plantilla_acnur_16_9.pptx`, dos de ellos heredaron el `sldLayoutId` de un
layout ya existente. PowerPoint abre entonces CUALQUIER mazo hecho con esa
plantilla como «found a problem with content… Repaired and removed it»: repara
y elimina contenido antes de mostrarlo. LibreOffice no se queja, asi que el
defecto sobrevivio a toda la validacion visual del entregable.

Se nota en que la plantilla SOLA —sin una sola lamina— ya se abre reparada.

El id nuevo se toma por encima del maximo en uso, para no chocar con ninguno.
El orden de las entradas del zip se conserva: PowerPoint es sensible a eso.
"""
import collections
import re
import shutil
import sys
import zipfile

MASTER = re.compile(r"ppt/slideMasters/slideMaster\d+\.xml$")
LAYOUT_ID = re.compile(r'(<p:sldLayoutId id=")(\d+)(")')

# Tipo de contenido por extension, para las partes que la plantilla trae sin
# declarar. `plantilla_acnur_16_9` guardaba tres SVG sin `Default`: un paquete
# con una parte sin content-type es corrupto por definicion, y python-pptx se
# niega a abrirlo.
TIPOS = {
    "svg": "image/svg+xml", "png": "image/png", "jpeg": "image/jpeg",
    "jpg": "image/jpeg", "gif": "image/gif", "bmp": "image/bmp",
    "tiff": "image/tiff", "emf": "image/x-emf", "wmf": "image/x-wmf",
}


def content_types_faltantes(partes):
    """Extensiones presentes en el paquete que nadie declara."""
    ct = partes["[Content_Types].xml"].decode("utf8")
    declaradas = {d.lower() for d in re.findall(r'<Default Extension="([^"]+)"', ct)}
    overrides = set(re.findall(r'<Override PartName="/([^"]+)"', ct))
    faltan = set()
    for n in partes:
        if n.endswith("/") or "." not in n or n in overrides:
            continue
        ext = n.rsplit(".", 1)[-1].lower()
        if ext not in declaradas and ext in TIPOS:
            faltan.add(ext)
    return ct, sorted(faltan)


def anadir_content_types(partes):
    ct, faltan = content_types_faltantes(partes)
    if not faltan:
        return 0
    nuevos = "".join(
        f'<Default Extension="{e}" ContentType="{TIPOS[e]}"/>' for e in faltan
    )
    # Se insertan justo despues de la apertura de <Types ...>, que es donde el
    # esquema espera los Default.
    m = re.search(r"<Types[^>]*>", ct)
    partes["[Content_Types].xml"] = (ct[: m.end()] + nuevos + ct[m.end():]).encode("utf8")
    print(f"    [Content_Types].xml: declarados {faltan}")
    return len(faltan)


def ids_duplicados(xml):
    ids = LAYOUT_ID.findall(xml)
    cuenta = collections.Counter(i for _, i, _ in ids)
    return [i for i, c in cuenta.items() if c > 1]


def reparar_master(xml):
    """Deja un id unico por layout. Devuelve (xml_nuevo, cambios)."""
    usados = {int(i) for _, i, _ in LAYOUT_ID.findall(xml)}
    if not usados:
        return xml, 0
    siguiente = max(usados) + 1
    vistos = set()
    cambios = 0

    def sustituye(m):
        nonlocal siguiente, cambios
        valor = int(m.group(2))
        if valor not in vistos:
            vistos.add(valor)
            return m.group(0)
        # Segunda aparicion en adelante: se le da uno libre.
        nuevo = siguiente
        siguiente += 1
        vistos.add(nuevo)
        cambios += 1
        return f"{m.group(1)}{nuevo}{m.group(3)}"

    return LAYOUT_ID.sub(sustituye, xml), cambios


def reparar(path, respaldo=True):
    z = zipfile.ZipFile(path)
    partes = {n: z.read(n) for n in z.namelist()}
    infos = z.infolist()
    z.close()

    tipos = anadir_content_types(partes)
    total = 0
    for nombre in list(partes):
        if not MASTER.match(nombre):
            continue
        xml = partes[nombre].decode("utf8")
        dup = ids_duplicados(xml)
        if not dup:
            continue
        nuevo, cambios = reparar_master(xml)
        partes[nombre] = nuevo.encode("utf8")
        total += cambios
        print(f"    {nombre}: {cambios} id(s) reasignados (duplicados: {dup})")

    if not (total or tipos):
        print(f"  {path.split('/')[-1]}: nada que reparar")
        return 0

    if respaldo:
        shutil.copy(path, path + ".pre-layoutids")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as out:
        for info in infos:                       # mismo orden que el original
            out.writestr(info, partes[info.filename])
    print(f"  {path.split('/')[-1]}: {total} id(s) y {tipos} tipo(s) reparados")
    return total + tipos


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("uso: plantilla_reparar_layout_ids.py <plantilla.pptx> [...]")
        raise SystemExit(2)
    for p in sys.argv[1:]:
        reparar(p)
