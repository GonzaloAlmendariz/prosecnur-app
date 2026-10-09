#!/usr/bin/env python3
"""Genera api/inst/croquis/campus-pucp-geometria.json (croquis B32).

Descarga de Overpass la geometría del campus PUCP — © OpenStreetMap
contributors (ODbL) —, filtra al perímetro estilizado, asigna letra a la
huella de cada pabellón (marcador oficial dentro del polígono, o centroide
más cercano <= 45 m) y emite el JSON compacto que lee
api/R/collection_render_croquis.R. Las coordenadas de los marcadores por
letra y su procedencia viven en docs/qa/croquis-campus-pucp-fuentes.md.

Uso (desde la raíz del repo, necesita red):
    python3 api/scripts/croquis_geometria_osm.py

Si el perímetro (BORDE) cambia, debe cambiar también .ccx_borde_campus().
"""
import json, math, os, subprocess

AQUI = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.normpath(os.path.join(AQUI, "..", "inst", "croquis"))
OVERPASS = "https://overpass-api.de/api/interpreter"

CONSULTA_WAYS = (
    '[out:json][timeout:120];('
    'way["building"](-12.0750,-77.0845,-12.0643,-77.0768);'
    'way["highway"~"^(footway|pedestrian|path|service|cycleway)$"](-12.0748,-77.0840,-12.0645,-77.0770);'
    'way["leisure"~"^(pitch|park|garden|track)$"](-12.0748,-77.0840,-12.0645,-77.0770);'
    'way["landuse"="grass"](-12.0748,-77.0840,-12.0645,-77.0770);'
    ');out tags geom;'
)
CONSULTA_RELS = (
    '[out:json][timeout:80];'
    'relation["building"](-12.0750,-77.0845,-12.0643,-77.0768);'
    'out geom;'
)

def overpass(consulta):
    out = subprocess.run(
        ["curl", "-s", "--max-time", "150", OVERPASS, "--data-urlencode", f"data={consulta}"],
        capture_output=True, text=True, check=True
    ).stdout
    return json.loads(out)

# Perímetro estilizado (mismo que .ccx_borde_campus en el motor).
BORDE = [(-12.0747, -77.0770), (-12.0650, -77.0781), (-12.0648, -77.0790),
         (-12.0656, -77.0800), (-12.0658, -77.0818), (-12.0688, -77.0824),
         (-12.0746, -77.0838)]

# Marcadores oficiales SIN nudge (el nudge de B es solo del chip, no de la huella).
PABELLONES = {
    "A": (-12.072545, -77.079539), "B": (-12.072739, -77.079625),
    "D": (-12.069849, -77.080512), "E": (-12.070985, -77.079311),
    "F": (-12.071556, -77.080365), "G": (-12.071198, -77.078940),
    "H": (-12.069614, -77.081231), "I": (-12.070515, -77.078737),
    "J": (-12.070352, -77.080311), "L": (-12.067530, -77.080201),
    "M": (-12.071597, -77.081676), "N": (-12.068663, -77.078801),
    "O": (-12.072765, -77.082621), "P": (-12.072239, -77.078092),
    "Q": (-12.071231, -77.078530), "R": (-12.067682, -77.079144),
    "U": (-12.072251, -77.081060), "V": (-12.073125, -77.081880),
    "X": (-12.065333, -77.078511), "Y": (-12.066823, -77.078832),
    "Z": (-12.069115, -77.080909),
}

def dentro(lat, lng, poly):
    n, res = len(poly), False
    j = n - 1
    for i in range(n):
        yi, xi = poly[i]; yj, xj = poly[j]
        if (xi > lng) != (xj > lng) and lat < (yj - yi) * (lng - xi) / (xj - xi) + yi:
            res = not res
        j = i
    return res

def metros(a, b):
    dy = (a[0] - b[0]) * 110574.0
    dx = (a[1] - b[1]) * 111320.0 * math.cos(math.radians(12.07))
    return math.hypot(dx, dy)

def centroide(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))

def coser_anillos(ways):
    """Une los ways `outer` de un multipolígono en un anillo por endpoints."""
    pendientes = [[(g["lat"], g["lon"]) for g in w["geometry"]] for w in ways]
    if not pendientes:
        return None
    anillo = pendientes.pop(0)
    while pendientes:
        for i, cand in enumerate(pendientes):
            if anillo[-1] == cand[0]:
                anillo += cand[1:]; break
            if anillo[-1] == cand[-1]:
                anillo += list(reversed(cand))[1:]; break
            if anillo[0] == cand[-1]:
                anillo = cand[:-1] + anillo; break
            if anillo[0] == cand[0]:
                anillo = list(reversed(cand))[:-1] + anillo; break
        else:
            # No hay continuación: se queda con el tramo más largo ya cosido.
            break
        pendientes.pop(i)
    if len(anillo) > 1 and anillo[0] == anillo[-1]:
        anillo = anillo[:-1]
    return anillo if len(anillo) >= 3 else None

d = overpass(CONSULTA_WAYS)
edificios, caminos, verdes = [], [], []

# Edificios que en OSM son multipolígonos (EEGGCC, EEGGLL, Idiomas/P, Z...).
rel = overpass(CONSULTA_RELS)
for e in rel["elements"]:
    outers = [m for m in e.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
    anillo = coser_anillos(outers)
    if not anillo:
        continue
    cen = centroide(anillo)
    if not dentro(cen[0], cen[1], BORDE):
        continue
    xy = [[round(p[0], 6), round(p[1], 6)] for p in anillo]
    edificios.append({"letra": None, "xy": xy, "_cen": cen, "_pts": anillo})

for e in d["elements"]:
    if e.get("type") != "way" or "geometry" not in e:
        continue
    t = e.get("tags", {})
    pts = [(g["lat"], g["lon"]) for g in e["geometry"]]
    if len(pts) < 2:
        continue
    cen = centroide(pts)
    if not dentro(cen[0], cen[1], BORDE):
        continue
    xy = [[round(p[0], 6), round(p[1], 6)] for p in pts]
    if "building" in t:
        if xy[0] == xy[-1]:
            xy = xy[:-1]
        if len(xy) >= 3:
            edificios.append({"letra": None, "xy": xy, "_cen": cen, "_pts": pts})
    elif "highway" in t:
        clase = "peatonal" if t["highway"] in ("footway", "pedestrian", "path", "cycleway") else "servicio"
        caminos.append({"clase": clase, "xy": xy})
    else:
        clase = "cancha" if t.get("leisure") == "pitch" else "parque"
        if xy[0] == xy[-1]:
            xy = xy[:-1]
        if len(xy) >= 3:
            verdes.append({"clase": clase, "xy": xy})

# Asignación letra -> huella, en dos pasadas: primero todos los que CAEN
# dentro de una huella (conflicto lo gana el marcador más cercano al
# centroide), luego cercanía <= 45 m entre las huellas libres.
sin_huella, informe = [], []
reclamos = {}
for letra, punto in PABELLONES.items():
    contiene = [b for b in edificios if dentro(punto[0], punto[1], b["_pts"])]
    if contiene:
        b = min(contiene, key=lambda b: metros(punto, b["_cen"]))
        reclamos.setdefault(id(b), []).append((letra, b, metros(punto, b["_cen"])))
asignadas = {}
for _, lista in reclamos.items():
    lista.sort(key=lambda r: r[2])
    letra, b, dist = lista[0]
    b["letra"] = letra
    asignadas[letra] = f"contiene ({dist:.0f}m al centroide)"
for letra, punto in PABELLONES.items():
    if letra in asignadas:
        continue
    libres = [b for b in edificios if b["letra"] is None]
    cerca = min(libres, key=lambda b: metros(punto, b["_cen"]))
    dist = metros(punto, cerca["_cen"])
    if dist <= 45.0:
        cerca["letra"] = letra
        asignadas[letra] = f"cercania {dist:.0f}m"
    else:
        sin_huella.append(letra)
        asignadas[letra] = f"SIN huella (mas cercana a {dist:.0f}m)"
for letra in PABELLONES:
    informe.append(f"{letra}: {asignadas[letra]}")

for b in edificios:
    b.pop("_cen"); b.pop("_pts")

out = {
    "schema": "croquis_campus_pucp/v1",
    "fuente": ("Geometria © OpenStreetMap contributors (ODbL), extracto 2026-09-02; "
               "identidad y posicion de pabellones segun docs/qa/croquis-campus-pucp-fuentes.md"),
    "edificios": edificios,
    "caminos": caminos,
    "verdes": verdes,
}
dest = os.path.join(DESTINO, "campus-pucp-geometria.json")
json.dump(out, open(dest, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"edificios={len(edificios)} caminos={len(caminos)} verdes={len(verdes)} bytes={os.path.getsize(dest)}")
print("\n".join(informe))
print("sin huella:", sin_huella or "ninguno")
