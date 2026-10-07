# Exporta íconos de Lucide (la librería que ya usa la app, licencia ISC) a SVG
# con el color de la marca. Uso: python3 iconos.py <carpeta_salida> <color> nombre1 nombre2 ...
# Además genera «diana-flecha»: el «target» de Lucide con una flecha clavada,
# dibujada con el mismo trazo (Lucide no trae esa variante).
import re, sys, os
L = "frontend/node_modules/.pnpm/lucide-react@1.17.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons"
out, color, nombres = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(out, exist_ok=True)
CAB = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">'

def nodos(nombre):
    src = open(os.path.join(L, nombre + ".mjs")).read()
    cuerpo = re.search(r"__iconNode = \[(.*?)\];", src, re.S).group(1)
    for tag, attrs in re.findall(r'\[\s*"(\w+)",\s*\{(.*?)\}\s*\]', cuerpo, re.S):
        kv = dict(re.findall(r'(\w+):\s*"([^"]*)"', attrs)); kv.pop("key", None)
        yield tag, kv

def svg(nombre, w=1.75):
    els = "".join('<%s %s/>' % (t, " ".join('%s="%s"' % (k, v) for k, v in kv.items())) for t, kv in nodos(nombre))
    return CAB.format(c=color, w=w) + els + "</svg>"

for n in nombres:
    if n == "diana-flecha":
        s = (CAB.format(c=color, w=1.75) +
             '<circle cx="12" cy="12" r="1"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M13 3.055a9 9 0 1 0 7.941 7.945"/>'
             '<path d="M15 6v3h3l3 -3h-3v-3z"/><path d="M15 9l-3 3"/></svg>')   # geometría tipo «target-arrow» (anillos abiertos, emplumado afuera)
    else:
        s = svg(n)
    open(os.path.join(out, n + ".svg"), "w").write(s)
print("ok", len(nombres), "íconos en", out)
