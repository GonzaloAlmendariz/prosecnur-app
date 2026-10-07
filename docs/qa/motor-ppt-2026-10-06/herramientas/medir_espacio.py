"""Mide el espacio vacío de cada lámina de un recetario (loop M5).

Rasteriza el PDF a 40 dpi y, en la zona útil (y de 1,65 a 6,75 in; x de 0,32 a 13,0 in),
marca como vacía cada fila de píxeles sin tinta (ningún píxel distinto del fondo #F2F2F2
más allá de la tolerancia). Reporta el mayor tramo vacío contiguo en pulgadas y dónde
empieza. Vara: ningún tramo mayor que un tercio del alto útil (1,7 in).
Excluye láminas sin datos (portada, portadillas, índice, objetivo): no tienen «%».

Uso: python3 medir_espacio.py recetario.pdf [--todas]
"""
import re, subprocess, sys, tempfile, os
from PIL import Image

DPI = 40
Y0, Y1, X0, X1 = 1.65, 6.75, 0.32, 13.0
VARA = (Y1 - Y0) / 3          # filas: un tercio del alto útil
VARA_X = (X1 - X0) / 3        # columnas: un tercio del ancho útil
MIN_TINTA = 4                 # una línea fina (separador, eje) no cuenta como contenido
FONDO = (0xF2, 0xF2, 0xF2)
TOL = 18

def con_datos(pdf, n):
    t = subprocess.run(["pdftotext", "-f", str(n), "-l", str(n), pdf, "-"], capture_output=True, text=True).stdout
    return "%" in t

def medir(png):
    im = Image.open(png).convert("RGB"); px = im.load()
    y0, y1, x0, x1 = (int(v * DPI) for v in (Y0, Y1, X0, X1))
    tin = [[max(abs(a - b) for a, b in zip(px[x, y], FONDO)) > TOL for x in range(x0, x1)] for y in range(y0, y1)]
    filas = [sum(r) < MIN_TINTA for r in tin]
    cols = [sum(tin[j][i] for j in range(len(tin))) < MIN_TINTA for i in range(x1 - x0)]
    def tramo(v):
        mejor, inicio, run, ini = 0, None, 0, 0
        for i, e in enumerate(v + [False]):
            if e:
                if run == 0: ini = i
                run += 1
            else:
                if run > mejor: mejor, inicio = run, ini
                run = 0
        return mejor / DPI, inicio
    ty, iy = tramo(filas); tx, ix = tramo(cols)
    return ty, (Y0 + iy / DPI) if iy is not None else None, tx, (X0 + ix / DPI) if ix is not None else None

def main():
    pdf = sys.argv[1]; todas = "--todas" in sys.argv
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout).group(1))
    tmp = tempfile.mkdtemp()
    subprocess.run(["pdftoppm", "-png", "-r", str(DPI), pdf, os.path.join(tmp, "p")], check=True)
    pngs = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
    fallan = []
    for k, f in enumerate(pngs, 1):
        if not todas and not con_datos(pdf, k): continue
        ty, dy, tx, dx = medir(os.path.join(tmp, f))
        motivo = []
        if ty > VARA: motivo.append(f"franja horizontal vacía de {ty:.2f} in desde y={dy:.2f}")
        if tx > VARA_X: motivo.append(f"franja vertical vacía de {tx:.2f} in desde x={dx:.2f}")
        if motivo: fallan.append(k)
        print(f"{k:3d}  filas {ty:4.2f} in  columnas {tx:4.2f} in  {'FALLA: ' + '; '.join(motivo) if motivo else 'ok'}")
    print(f"\nVara: franja vacía <= {VARA:.2f} in de alto y <= {VARA_X:.2f} in de ancho. Fallan: {fallan if fallan else 'ninguna'}")

if __name__ == "__main__":
    main()
