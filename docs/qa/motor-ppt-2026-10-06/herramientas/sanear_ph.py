# Saneo de placeholders para un .pptx hecho con officer (H19 del checklist).
# officer crea toda forma libre (ph_location) con <p:ph/> dentro de <p:nvPr>.
# En la vista de EDICIÓN PowerPoint la trata como placeholder del layout:
# muestra «Click to add text», íconos de imagen y hereda el estilo (texto
# vertical, cuerpo grande). Ni LibreOffice ni el PDF exportado lo muestran.
#   - forma con geometría propia (a:xfrm): se le quita el <p:ph>, queda libre;
#   - placeholder sin geometría ni texto (copia vacía del layout): se borra.
#   - forma liberada sin a:prstGeom: se le da rect (un placeholder hereda la
#     geometría del layout; una forma libre sin ella hace que PowerPoint «repare»);
#   - fuentes en el orden del esquema (latin, ea, cs, sym): officer escribe
#     latin, cs, ea, igual que lo corrige reporte_ppt_saneo_ooxml.R en el motor.
# Uso: python3 sanear_ph.py entrada.pptx salida.pptx
import re, sys, zipfile
from lxml import etree

A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
libres = borrados = titulos = 0
for item in zin.infolist():
    data = zin.read(item.filename)
    if re.match(r'ppt/slides/slide\d+\.xml$', item.filename):
        root = etree.fromstring(data)
        for sp in list(root.iter(P + 'sp', P + 'pic')):
            ph = sp.find('.//' + P + 'nvPr/' + P + 'ph')
            if ph is None:
                continue
            tiene_geo = sp.find('.//' + A + 'xfrm') is not None
            texto = ''.join(t.text or '' for t in sp.iter(A + 't')).strip()
            nv = sp.find('.//' + P + 'cNvPr')
            if tiene_geo and nv is not None and nv.get('name') == 'Titulo lamina':
                # Título de la lámina: queda como marcador de título nativo (PowerPoint lo muestra en el esquema y la
                # navegación), con su geometría y formato propios. Ancla arriba y sin autoajuste para no heredar los del layout.
                for k in list(ph.attrib): del ph.attrib[k]
                ph.set('type', 'title'); nv.set('name', 'Título')
                bp = sp.find('.//' + A + 'bodyPr')
                if bp is not None:
                    bp.set('anchor', 't')
                    if not any(c.tag in (A + 'noAutofit', A + 'normAutofit', A + 'spAutoFit') for c in bp): etree.SubElement(bp, A + 'noAutofit')
                titulos += 1
                continue
            if tiene_geo and nv is not None and nv.get('name', '').startswith('Centro'):
                # Número dentro de un círculo: anclado al centro y sin márgenes internos, para que quede centrado en ambos ejes
                bp = sp.find('.//' + A + 'bodyPr')
                if bp is not None:
                    for k_, v_ in (('anchor', 'ctr'), ('lIns', '0'), ('tIns', '0'), ('rIns', '0'), ('bIns', '0'), ('wrap', 'none')): bp.set(k_, v_)
            if tiene_geo:
                ph.getparent().remove(ph); libres += 1
                sppr = sp.find(P + 'spPr')
                if sppr is not None and sppr.find(A + 'prstGeom') is None and sppr.find(A + 'custGeom') is None:
                    g = etree.SubElement(sppr, A + 'prstGeom', prst='rect'); etree.SubElement(g, A + 'avLst')
                    xf = sppr.find(A + 'xfrm'); sppr.remove(g); sppr.insert(list(sppr).index(xf) + 1, g)
            elif not texto:
                sp.getparent().remove(sp); borrados += 1
        orden = {A + 'latin': 0, A + 'ea': 1, A + 'cs': 2, A + 'sym': 3}
        for rpr in root.iter(A + 'rPr', A + 'defRPr', A + 'endParaRPr'):
            fu = [c for c in rpr if c.tag in orden]
            if fu:
                pos = list(rpr).index(fu[0])
                for c in fu: rpr.remove(c)
                for k, c in enumerate(sorted(fu, key=lambda c: orden[c.tag])): rpr.insert(pos + k, c)
        data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
    zout.writestr(item, data)
zout.close()
print(f'{dst}: {libres} formas liberadas, {titulos} títulos nativos, {borrados} placeholders vacíos borrados')
