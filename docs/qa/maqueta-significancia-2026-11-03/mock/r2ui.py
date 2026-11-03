# Ronda 2 — tres direcciones de UI.
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from lam import *
from ui import shell
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))


def shot(nombre, html, w=1440, h=900):
    p = os.path.join(OUT, nombre + ".html"); open(p, "w").write(html)
    subprocess.run([os.path.join(HERE, "shot.sh"), p, os.path.join(OUT, nombre + ".png"), str(w), str(h)])


CATS = ["Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)", "Política universitaria", "Ninguna"]
c, _ = agrupadas(CATS, ["Economía y Finanzas", "Ciencias políticas y sociales"], [[17, 44], [5, 25], [36, 16]],
                 [["", "A"], ["", "A"], ["B", ""]], y0=230, base_grupo=[224, 176])
SL = lamina("Durante tu carrera universitaria, ¿perteneciste o perteneces a alguna agrupación o colectivo presencial? (según área)", c,
            nota=[nota_rica(49.5, 688, [("m", "A", False), ("t", " mayor que el grupo A: diferencia significativa y de 10 puntos o más (Rao-Scott por aula, p < 0.05, Benjamini-Hochberg).")])])
def slide(w=960):
    return f'<div class="slide" style="width:{w}px;height:{w*750/1333:.0f}px">' + SL.replace('width="1333" height="750"', f'width="{w}" height="{w*750/1333:.0f}"', 1) + "</div>"

# ---------- UI-A · Todo en el inspector del gráfico
insA = """<div class="insp-h"><b>Lámina 40: Un gráfico</b><span class="sp"></span><span class="btn">Cambiar</span></div>
<div class="tabs"><span>Lámina</span><span class="on">Gráfico</span></div><div class="insp-b">
<div class="sec-t">Diferencias entre grupos</div>
<div class="row"><b>Marcar diferencias significativas</b><span class="sp"></span><span class="sw"></span></div>
<div><div class="help">Prueba</div><div class="sel-box">Rao-Scott por aula <span>▾</span></div></div>
<div><div class="help">Corrección</div><div class="sel-box">Benjamini-Hochberg <span>▾</span></div></div>
<div class="row"><div><div class="help">Nivel</div><span class="seg"><span>0.10</span><span class="on">0.05</span><span>0.01</span></span></div>
<div><div class="help">Umbral de magnitud</div><div class="sel-box" style="width:110px">10 pts <span>▾</span></div></div></div>
<div><div class="help">Comparar</div><span class="seg"><span class="on">Entre pares</span><span>Frente al total</span></span></div>
<div><div class="help">Diferencias frágiles (0.01 ≤ p &lt; 0.05)</div><span class="seg"><span class="on">Como frágiles</span><span>Ocultar</span><span>Como firmes</span></span></div>
<div class="note">⚠ Estas opciones se guardan sólo en este gráfico. Las otras 32 láminas con cruce conservan su propia configuración.</div>
</div>"""
shot("ui-a-inspector", shell(slide(), insA))

# ---------- UI-B · Política del estudio (diálogo) + resumen en el inspector
dlg = """<div style="position:absolute;inset:0;background:rgba(15,23,42,.32);display:flex;align-items:center;justify-content:center">
<div class="card" style="width:760px;padding:0;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.25)">
<div style="padding:18px 22px;border-bottom:1px solid var(--pulso-border)"><div class="sec-t">Ajustes del informe</div><b style="font-size:18px">Diferencias entre grupos</b>
<div class="help">Una sola regla para todo el informe: gráficos del PPT, figuras del Word y tablas de cruces.</div></div>
<div style="padding:18px 22px;display:grid;grid-template-columns:1fr 1fr;gap:18px">
<div><div class="sec-t" style="margin-bottom:8px">Prueba</div>
<div class="radio on"><span class="dot"></span><div><b>Rao-Scott por aula</b><span class="rec">Recomendada</span><div class="help">El estudio muestreó cursos-horario: las respuestas de una misma aula no son independientes.</div></div></div>
<div class="radio" style="margin-top:8px"><span class="dot"></span><div><b>Prueba z de proporciones</b><div class="help">Supone muestreo aleatorio simple.</div></div></div></div>
<div><div class="sec-t" style="margin-bottom:8px">Corrección por comparaciones múltiples</div>
<div class="radio on"><span class="dot"></span><div><b>Benjamini-Hochberg en el informe</b><div class="help">Controla la proporción de falsos hallazgos entre todas las comparaciones.</div></div></div>
<div class="radio" style="margin-top:8px"><span class="dot"></span><div><b>Bonferroni dentro de cada fila</b><div class="help">La de las tablas de cruces de hoy.</div></div></div></div>
<div><div class="sec-t" style="margin-bottom:8px">Qué se marca</div>
<dl class="kv"><dt>Nivel</dt><dd>p &lt; 0.05</dd><dt>Magnitud mínima</dt><dd>10 puntos</dd><dt>Base mínima por grupo</dt><dd>30 casos</dd><dt>Frágiles</dt><dd>0.01 ≤ p &lt; 0.05 · con contorno</dd></dl></div>
<div><div class="sec-t" style="margin-bottom:8px">Así lo leerá el cliente</div><div class="note"><span class="chip m"><span class="tri"></span>A</span> mayor que el grupo A: diferencia significativa y de 10 puntos o más (Rao-Scott por aula, p &lt; 0.05, Benjamini-Hochberg).</div></div>
</div><div style="padding:14px 22px;border-top:1px solid var(--pulso-border);display:flex;gap:10px;align-items:center"><span class="help">Afecta a 33 gráficos y a las tablas de cruces.</span><span class="sp"></span><span class="btn">Cancelar</span><span class="btn acc">Aplicar al informe</span></div></div></div>"""
insB = """<div class="insp-h"><b>Lámina 40: Un gráfico</b><span class="sp"></span><span class="btn">Cambiar</span></div>
<div class="tabs"><span>Lámina</span><span class="on">Gráfico</span></div><div class="insp-b">
<div class="sec-t">Diferencias entre grupos</div><div class="row"><b>Marcar en este gráfico</b><span class="sp"></span><span class="sw"></span></div>
<div class="stat"><span class="chip m"><span class="tri"></span>3 marcadas</span><span class="chip u">0 bajo el umbral</span></div>
<div class="help">Regla del informe: Rao-Scott por aula · BH · 10 pts · <a style="color:var(--mod)">Cambiar</a></div></div>"""
shot("ui-b-politica", shell('<div style="position:relative">' + slide() + "</div>", insB).replace('<div class="app">', '<div class="app" style="position:relative">').replace("</div></body>", dlg + "</div></body>"))

# ---------- UI-C · Lente de significancia sobre la vista previa
lente = """<div style="position:relative">""" + slide() + """
<div style="position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(255,255,255,.55)"></div>
<div class="pop" style="left:560px;top:150px">
<div class="row"><span class="chip m"><span class="tri"></span>A</span><b>Académica</b></div>
<div style="margin:8px 0 10px">Ciencias políticas y sociales <b>44%</b> supera a Economía y Finanzas <b>17%</b> por <b>27 puntos</b>.</div>
<dl class="kv"><dt>p ajustado</dt><dd>&lt; 0.001 (Rao-Scott, BH)</dd><dt>Bases</dt><dd>176 y 224</dd><dt>Efecto de diseño</dt><dd>1.14</dd></dl>
<div class="help" style="margin-top:8px">Se marca: significativa y de 10 puntos o más.</div></div>
<div class="pop" style="left:90px;top:330px;width:290px"><b>Política universitaria · Economía y Finanzas 5%</b><div class="help" style="margin-top:6px">Sin marca: es el grupo menor del par. La marca la lleva el grupo mayor.</div></div>
</div>"""
insC = """<div class="insp-h"><b>Lente de diferencias</b><span class="sp"></span><span class="btn">✕</span></div><div class="insp-b">
<div class="help">Pasa sobre una cifra para ver por qué tiene o no tiene marca.</div>
<table><tr><th>Fila</th><th>Par</th><th>Dif.</th><th>p aj.</th><th></th></tr>
<tr class="sel"><td>Académica</td><td>B vs A</td><td>+27</td><td>&lt;0.001</td><td><span class="chip m"><span class="tri"></span>A</span></td></tr>
<tr><td>Política univ.</td><td>B vs A</td><td>+20</td><td>&lt;0.001</td><td><span class="chip m"><span class="tri"></span>A</span></td></tr>
<tr><td>Ninguna</td><td>A vs B</td><td>+20</td><td>&lt;0.001</td><td><span class="chip m"><span class="tri"></span>B</span></td></tr></table></div>"""
shot("ui-c-lente", shell(lente, insC, extra='<span class="btn acc">◎ Lente</span>'))
print("ok")
