# Ronda 3 — UI final: política del informe, inspector con resumen y estados, explicación en la vista previa, revisión en lote.
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import lam
from lam import *
from ui import shell, CSS
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
lam.MARCA["pt"] = 11


def shot(nombre, html, w=1440, h=900):
    p = os.path.join(OUT, nombre + ".html"); open(p, "w").write(html)
    subprocess.run([os.path.join(HERE, "shot.sh"), p, os.path.join(OUT, nombre + ".png"), str(w), str(h)])


CATS = ["Académica (grupos de lectura, seminarios temáticos, grupos de estudio, entre otros)", "Política universitaria", "Ninguna"]
c, _ = agrupadas(CATS, ["Economía y Finanzas", "Ciencias políticas y sociales"], [[17, 44], [5, 25], [36, 16]],
                 [["", "A"], ["", "A"], ["B", ""]], y0=215, base_grupo=[224, 176], x0=360, etiqueta_w=320, ancho=640)
SL = lamina("Durante tu carrera universitaria, ¿perteneciste o perteneces a alguna agrupación o colectivo presencial, sea de la Universidad o externo? (según área)", c,
            nota=[nota_rica(49.5, 688, [("m", "A", False), ("t", "  Mayor que el grupo A, con diferencia significativa y de al menos 10 puntos. Rao-Scott por aula, p < 0.05, corrección de Benjamini-Hochberg.")])])
W = 960; H = round(W * 750 / 1333)
def slide(extra=""):
    # la capa flotante vive FUERA del .slide (que recorta con overflow:hidden), en un envoltorio de su mismo tamaño
    return (f'<div style="position:relative;width:{W}px;height:{H}px"><div class="slide" style="width:{W}px;height:{H}px">'
            + SL.replace('width="1333" height="750"', f'width="{W}" height="{H}"', 1) + "</div>" + extra + "</div>")
CAP = '<span class="chip m"><span class="tri"></span>{}</span>'
CAPF = '<span class="chip f"><span class="tri o"></span>{}</span>'
k = W / 1333  # escala lámina → pantalla

# ======================================================== U1 · Ajustes del informe › Diferencias entre grupos
dlg = f"""<div style="position:absolute;inset:0;background:rgba(15,23,42,.34);display:flex;align-items:center;justify-content:center;z-index:5">
<div class="card" style="width:820px;padding:0;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.25)">
<div style="padding:18px 22px 14px;border-bottom:1px solid var(--pulso-border)"><div class="sec-t">Ajustes del informe</div>
<div class="row"><b style="font-size:18px">Diferencias entre grupos</b><span class="sp"></span><span class="btn ghost">Restablecer a la recomendada</span></div>
<div class="help">Una sola regla para todo el estudio: láminas, figuras del Word y tablas de cruces dicen lo mismo.</div></div>
<div style="margin:14px 22px 0" class="note"><b style="color:var(--warn-fg)">Hoy hay dos reglas.</b> Las tablas de cruces usan z con Bonferroni y el plan de análisis pide Rao-Scott con Benjamini-Hochberg. Al aplicar, las tablas adoptan esta regla y sus letras pueden cambiar en 6 celdas. <a style="color:var(--mod)">Ver cuáles</a></div>
<div style="padding:16px 22px;display:grid;grid-template-columns:1fr 1fr;gap:16px 20px">
<div><div class="sec-t" style="margin-bottom:8px">Prueba</div>
<div class="radio on"><span class="dot"></span><div><b>Rao-Scott por aula</b><span class="rec">Recomendada</span><div class="help">El marco muestreó cursos-horario (conglomerados). Efecto de diseño mediano: 1.12.</div></div></div>
<div class="radio" style="margin-top:8px"><span class="dot"></span><div><b>z de diferencia de proporciones</b><div class="help">Supone muestreo aleatorio simple.</div></div></div></div>
<div><div class="sec-t" style="margin-bottom:8px">Comparaciones múltiples</div>
<div class="radio on"><span class="dot"></span><div><b>Benjamini-Hochberg en todo el informe</b><div class="help">Controla la proporción de falsos hallazgos entre las 412 comparaciones del informe.</div></div></div>
<div class="radio" style="margin-top:8px"><span class="dot"></span><div><b>Bonferroni dentro de cada fila</b><div class="help">Más estricta con muchos grupos; ignora el resto del informe.</div></div></div></div>
<div><div class="sec-t" style="margin-bottom:8px">Qué se marca</div>
<div class="kv" style="grid-template-columns:170px 1fr;align-items:center">
<span class="help">Significancia</span><span class="seg"><span class="on">p &lt; 0.05</span><span>p &lt; 0.01</span></span>
<span class="help">Magnitud mínima</span><span class="seg"><span>5</span><span class="on">10 puntos</span><span>15</span></span>
<span class="help">Base mínima por grupo</span><span class="seg"><span>20</span><span class="on">30 casos</span><span>50</span></span>
<span class="help">Diferencias frágiles</span><span class="seg"><span class="on">Contorno</span><span>No marcar</span></span></div></div>
<div><div class="sec-t" style="margin-bottom:8px">Así lo leerá el cliente</div>
<div class="note" style="line-height:1.6">{CAP.format('A')} Mayor que el grupo A, con diferencia significativa y de al menos 10 puntos. Rao-Scott por aula, p &lt; 0.05, corrección de Benjamini-Hochberg.<br>{CAPF.format('A')} Diferencia frágil (p ajustado entre 0.01 y 0.05).</div>
<div class="help" style="margin-top:8px">La lámina «Cómo leer las diferencias» se actualiza con esta regla.</div></div>
</div><div style="padding:14px 22px;border-top:1px solid var(--pulso-border);display:flex;gap:10px;align-items:center"><span class="help">Afecta a 33 gráficos con cruce y a las tablas de cruces. Se guarda en el proyecto.</span><span class="sp"></span><span class="btn">Cancelar</span><span class="btn acc">Aplicar al informe</span></div></div></div>"""

INSP_HEAD = """<div class="insp-h"><b>Lámina 40: Un gráfico</b><span class="sp"></span><span class="btn">Cambiar</span><span class="btn">✕</span></div>
<div class="tabs"><span>Lámina</span><span class="on">Gráfico</span></div>"""
def bloque(cuerpo):
    return f"""<div class="insp-b"><div class="help">… Datos · Destacar · Orden</div><div class="sec-t">Diferencias entre grupos</div>{cuerpo}</div>"""
NORMAL = f"""<div class="row"><b>Marcar en este gráfico</b><span class="sp"></span><span class="sw"></span></div>
<div class="card" style="padding:10px 12px"><div class="stat"><span class="chip m"><span class="tri"></span>3 marcadas</span><span class="chip f">0 frágiles</span><span class="chip u">0 bajo 10 pts</span></div>
<div class="help" style="margin-top:8px">Compara los 2 grupos de <b>Área</b> entre sí · bases 224 y 176.</div>
<div class="row" style="margin-top:8px"><span class="btn ghost" style="padding-left:0">Ver por qué ›</span><span class="sp"></span><span class="btn ghost">Copiar redacción</span></div></div>
<div class="help">Regla del informe: Rao-Scott por aula · BH · p &lt; 0.05 · 10 pts · n ≥ 30 · <a style="color:var(--mod)">Cambiar…</a></div>"""
shot("u1-politica", shell('<div style="position:relative">' + slide() + "</div>", INSP_HEAD + bloque(NORMAL)).replace('<div class="app">', '<div class="app" style="position:relative">').replace("</div></body>", dlg + "</div></body>"))

# ======================================================== U2 · Inspector: estados (normal, vacío, cargando, abstención, error, sin diferencias)
estados = [
    ("Con marcas", NORMAL),
    ("Sin cruce (vacío)", """<div class="row"><b>Marcar en este gráfico</b><span class="sp"></span><span class="sw off"></span></div>
<div class="note">Las diferencias se calculan entre los grupos de un cruce, y este gráfico no tiene cruce.<div style="margin-top:8px"><span class="btn soft">＋ Agregar cruce</span></div></div>"""),
    ("Calculando", """<div class="row"><b>Marcar en este gráfico</b><span class="sp"></span><span class="sw"></span></div>
<div class="card" style="padding:10px 12px"><div class="row" style="gap:8px"><span class="skel" style="width:90px;height:22px;border-radius:999px"></span><span class="skel" style="width:70px;height:22px;border-radius:999px"></span><span class="skel" style="width:80px;height:22px;border-radius:999px"></span></div>
<div class="help" style="margin-top:8px">Comparando 2 grupos en 3 filas…</div></div>"""),
    ("Ninguna diferencia", """<div class="row"><b>Marcar en este gráfico</b><span class="sp"></span><span class="sw"></span></div>
<div class="card" style="padding:10px 12px"><div class="stat"><span class="chip u">0 marcadas</span><span class="chip u">1 bajo 10 pts</span></div>
<div class="help" style="margin-top:8px">Ninguna diferencia entre niveles es significativa. La nota lo dice en la lámina.</div>
<div class="note" style="margin-top:8px">Este cruce no muestra diferencias. El plan pide cruces solo donde hay diferencia relevante. <a style="color:var(--mod)">Quitar el cruce</a></div></div>"""),
    ("Abstención", """<div class="row"><b>Marcar en este gráfico</b><span class="sp"></span><span class="sw"></span></div>
<div class="card" style="padding:10px 12px;border-color:var(--warn-border);background:var(--warn-bg)"><b style="color:var(--warn-fg)">No se marcan diferencias</b>
<div class="help" style="color:var(--warn-fg);margin-top:4px">La pregunta está dentro de un grupo repetido: cada estudiante aporta varias respuestas y las observaciones no son independientes. La lámina lo explica en la nota.</div></div>"""),
    ("Error", """<div class="row"><b>Marcar en este gráfico</b><span class="sp"></span><span class="sw"></span></div>
<div class="card" style="padding:10px 12px;border-color:var(--danger-border);background:var(--danger-bg)"><b style="color:var(--danger-fg)">La prueba no pudo ejecutarse</b>
<div class="help" style="color:var(--danger-fg);margin-top:4px">Falta la variable de aula para Rao-Scott. Error E_SIG_SIN_CONGLOMERADO · id 7f3a2c.</div>
<div class="row" style="margin-top:8px"><span class="btn">Reintentar</span><span class="btn ghost">Usar z para este gráfico</span></div></div>"""),
]
cols = "".join(f'<div style="width:400px;background:#fff;border:1px solid var(--pulso-border);border-radius:14px;overflow:hidden"><div style="padding:8px 14px;background:var(--pulso-bg);font-weight:700;font-size:12px">{t}</div>{bloque(b)}</div>' for t, b in estados)
shot("u2-estados-inspector", f'<html><head><style>{CSS}</style></head><body style="padding:20px;height:auto"><div style="display:grid;grid-template-columns:repeat(3,400px);gap:18px">{cols}</div></body></html>', 1280, 760)

# ======================================================== U3 · Explicar por qué (vista previa, popover sobre la marca)
esc40 = 640 / (44 * 1.12)
cap_x = (360 + 44 * esc40 + 6 + tw("44%", 14, True) + 5) * k      # inicio de la cápsula en px de pantalla
cap_w = (6 + pt(11) * 0.62 + 4 + tw("A", 11, True) + 7) * k
cap_y = (215 + 28 + 13) * k
pw = 360
pl = min(W - pw - 8, cap_x + cap_w / 2 - pw / 2)
flecha = cap_x + cap_w / 2 - pl
pop = f"""<div style="position:absolute;left:{cap_x-4:.0f}px;top:{cap_y-12:.0f}px;width:{cap_w+8:.0f}px;height:24px;border:2px solid var(--mod);border-radius:12px"></div>
<div class="pop" style="left:{pl:.0f}px;top:{cap_y+22:.0f}px;width:{pw}px;z-index:3">
<div style="position:absolute;top:-7px;left:{flecha-7:.0f}px;width:12px;height:12px;background:#fff;border-left:1px solid var(--pulso-border-strong);border-top:1px solid var(--pulso-border-strong);transform:rotate(45deg)"></div>
<div class="row">{CAP.format('A')}<b>Académica</b><span class="sp"></span><span class="help">1 de 3</span></div>
<div style="margin:8px 0 10px;font-size:13px">Ciencias políticas y sociales (<b>44%</b>) supera a Economía y Finanzas (<b>17%</b>) por <b>27 puntos</b>.</div>
<dl class="kv"><dt>p ajustado</dt><dd>&lt; 0.001</dd><dt>Prueba</dt><dd>Rao-Scott por aula · BH</dd><dt>Bases</dt><dd>176 y 224 estudiantes</dd><dt>Efecto de diseño</dt><dd>1.14</dd><dt>Intervalo</dt><dd>+18 a +36 puntos</dd></dl>
<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><span class="chip" style="background:var(--ok-bg);color:var(--ok-fg);border-color:transparent">✓ significativa</span><span class="chip" style="background:var(--ok-bg);color:var(--ok-fg);border-color:transparent">✓ 10 pts o más</span><span class="chip" style="background:var(--ok-bg);color:var(--ok-fg);border-color:transparent">✓ bases de 30 o más</span></div>
<div class="row" style="margin-top:10px"><span class="btn ghost" style="padding-left:0">Copiar redacción</span><span class="sp"></span><span class="btn ghost">‹</span><span class="btn ghost">›</span></div></div>"""
INSP3 = """<div class="insp-h"><b>Diferencias de esta lámina</b><span class="sp"></span><span class="btn">✕</span></div><div class="insp-b">
<div class="help">Pasa el cursor sobre una cifra de la vista previa, o elige una fila.</div>
<table><tr><th>Fila</th><th>Par</th><th>Dif.</th><th>p aj.</th><th></th></tr>
<tr class="sel"><td>Académica</td><td>B &gt; A</td><td>+27</td><td>&lt;0.001</td><td>""" + CAP.format("A") + """</td></tr>
<tr><td>Política univ.</td><td>B &gt; A</td><td>+20</td><td>&lt;0.001</td><td>""" + CAP.format("A") + """</td></tr>
<tr><td>Ninguna</td><td>A &gt; B</td><td>+20</td><td>&lt;0.001</td><td>""" + CAP.format("B") + """</td></tr></table>
<div class="help">Las cifras sin marca son el grupo menor de su par: la marca la lleva el mayor.</div>
<div class="note"><b>Redacción sugerida</b><br>Las y los estudiantes de Ciencias políticas y sociales participan con más frecuencia en agrupaciones académicas (44% frente a 17%) y en política universitaria (25% frente a 5%).</div>
<div class="help">Valores p e intervalos de la maqueta: ilustrativos.</div></div>"""
shot("u3-por-que", shell('<div style="position:relative">' + slide(pop) + "</div>", INSP3))

# ======================================================== U4 · Revisión en lote (sideover «Diferencias del informe», ?panel=diferencias)
filas = [
    ("40", "Agrupaciones · Área", "3 marcadas", "m", ""), ("74", "Trabajo remunerado · Nivel", "1 marcada", "m", ""),
    ("41", "Comodidad para preguntar · Nivel", "1 frágil", "f", "Título afirma «más cómodos»: moderar"),
    ("54", "Conoce las funciones · Nivel", "1 frágil", "f", "No llevar a conclusiones"),
    ("57", "Calidad de la educación · Nivel", "Ninguna", "u", "El cruce no muestra diferencias: ¿quitar?"),
    ("27", "Crianza · Primera generación", "1 bajo 10 pts", "u", "4% frente a 0%: no se marca"),
    ("61", "Esfuerzo y pobreza · Carrera", "2 grupos sin comparar", "w", "Antropología n = 11, Sociología n = 6"),
    ("88", "Actividades del hogar · Sexo", "No se marca", "e", "Grupo repetido: sin independencia"),
]
trs = "".join(f'<tr class="{"sel" if i==2 else ""}"><td style="font-variant-numeric:tabular-nums">{a}</td><td>{b}</td><td><span class="chip {k_}">{"<span class=\"tri\"></span>" if k_=="m" else ("<span class=\"tri o\"></span>" if k_=="f" else "")}{c_}</span></td><td class="help">{d}</td></tr>'
              for i, (a, b, c_, k_, d) in enumerate(filas))
lote = f"""<div class="insp-h"><b>Diferencias del informe</b><span class="sp"></span><span class="btn">⇩ Exportar revisión</span><span class="btn">✕</span></div>
<div class="insp-b" style="gap:10px"><div class="stat"><span class="chip m">33 cruces</span><span class="chip m"><span class="tri"></span>41 marcadas</span><span class="chip f">5 frágiles</span><span class="chip u">7 sin diferencias</span><span class="chip w">2 bases chicas</span><span class="chip e">1 sin prueba</span></div>
<div class="row"><span class="seg"><span>Todas</span><span class="on">Para revisar</span><span>Marcadas</span></span><span class="sp"></span><span class="help">Rao-Scott · BH · 10 pts</span></div>
<table><tr><th>Lám.</th><th>Cruce</th><th>Estado</th><th>Qué revisar</th></tr>{trs}</table></div>"""
shot("u4-revision-lote", shell(slide(), lote).replace("grid-template-columns:1fr 400px", "grid-template-columns:1fr 560px").replace('style="width:960px', 'style="width:820px').replace(f'width="{W}" height="{H}"', f'width="820" height="{round(820*750/1333)}"'), 1440, 900)
print("ok")
