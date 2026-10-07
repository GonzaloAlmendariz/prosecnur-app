# Posproceso del recetario en Word: da separación (w:space, en puntos) al filete izquierdo del estilo «Lectura».
# officer escribe w:space="0" y el texto queda pegado a la barra. Uso: python3 word_nativo.py archivo.docx
import sys, zipfile, shutil, re, tempfile
src = sys.argv[1]; tmp = tempfile.mktemp(suffix=".docx")
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    d = zin.read(it.filename)
    if it.filename == "word/styles.xml":
        x = d.decode()
        def fix(m): return re.sub(r'(<w:left w:val="single"[^>]*w:space=")0(")', r'\g<1>9\2', m.group(0))
        x = re.sub(r'<w:style [^>]*w:styleId="Lectura".*?</w:style>', fix, x, flags=re.S)
        d = x.encode()
    zout.writestr(it, d)
zout.close(); zin.close(); shutil.move(tmp, src)
