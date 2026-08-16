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

    if not total:
        print(f"  {path.split('/')[-1]}: sin duplicados, no se toca")
        return 0

    if respaldo:
        shutil.copy(path, path + ".pre-layoutids")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as out:
        for info in infos:                       # mismo orden que el original
            out.writestr(info, partes[info.filename])
    print(f"  {path.split('/')[-1]}: {total} id(s) reparados")
    return total


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("uso: plantilla_reparar_layout_ids.py <plantilla.pptx> [...]")
        raise SystemExit(2)
    for p in sys.argv[1:]:
        reparar(p)
