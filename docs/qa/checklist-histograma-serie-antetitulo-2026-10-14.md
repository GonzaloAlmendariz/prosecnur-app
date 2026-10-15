# Checklist · histograma por grupos, serie temporal y antetítulo con colores

Tipo: Checklist de implementación
Estado: Vigente
Fecha: 2026-10-14
Autoridad: Gonzalo (2026-10-14): «2026_PUCP_Acreditacion_Ing_Civil tenía funciones para hacer histogramas mucho más profesionales que creo que podemos integrar al motor y en consecuencia al recetario, de la misma forma con los gráficos de línea temporales, siento que se ve aún bastante mal con la leyenda al lado cuando debería estar abajo de forma elegante, e integrar cosas elegantes como un antetítulo con colores de los actores o perfiles por leyenda». Sólo Gonzalo da por terminado un ítem

## Referencia

`Motor PPT Definitivo/Histogramas_ingenierias_sin_lineas_grises_13_07_26.pptx` (estudio Ing. Civil, fuera del repo). Lo generó el
motor con overrides de `Prueba27_05/ING_ALL/plan DEF 05_07/implementar_plan_ppt_ingenierias_05_07.R` (`ovr_hist_edad_full`): una
barra por valor apilada por sexo, sobre cada barra «H n (%)» y «M n (%)» en dos líneas, la composición del público en el subtítulo
(«Hombre 76% · Mujer 24%»), sin eje Y, sin bins vacíos y leyenda abajo. El motor ya tiene todos esos argumentos; lo que falta es que
sean el dibujo por defecto del histograma por grupos.

## Ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| G1 | Histograma por grupos con el dibujo de Ing. Civil por defecto: cifras en la cima en dos líneas por grupo, composición en el subtítulo, sin eje Y ni bins vacíos, leyenda abajo | `graficos_histograma_grupos.R` (estilo), `p_histograma` lo aplica con grupo; la paleta del estudio gana al preset en `.render_histograma` | hecho, por verificar: sin eje Y ni grilla, cifras «H n(%)» en dos líneas, composición en el subtítulo, colores de la paleta del sexo |
| G2 | El recetario y su catálogo lo muestran (lámina «Histograma por grupos») | `catalogo_recetario_plan.R` | hecho, por verificar: la lámina «Histograma por grupos (p81)» del catálogo ya sale con el dibujo nuevo, sin tocar el plan (el estilo vive en el motor) |
| G3 | Serie temporal: la leyenda va abajo, elegante, en lugar del nombre de cada serie al final de su línea | `graficador_serie_recetario.R` (honra «Posición de la leyenda», que el estilo del recetario ignoraba) | hecho, por verificar: abajo por defecto, línea con punto hueco y sin título; «Derecha» conserva el nombre al final de la línea. De paso: dos cifras del mismo período y casi a la misma altura ya no se tapan («74%» bajo «73%») |
| G4 | Antetítulo con los colores de los públicos o perfiles, que hace de leyenda | `lamina_antetitulo_leyenda.R`; `.lam_titulo(leyenda =)`; radar y brecha entre públicos (pesas) | hecho, por verificar: «COMPARACIONES   ● DOCENTES    ● ESTUDIANTES» con cada público en su color y sin la leyenda repetida abajo; con dos o más series. Una lámina lo apaga con `meta$leyenda_antetitulo = FALSE`. **Pendiente**: el control en el editor para apagarlo, y llevarlo a otras láminas que comparan públicos (puntos comparativos, multiapiladas por público) si Gonzalo lo aprueba |
| M1 | Una multiapilada lleva a lo más seis barras. Decisión de Gonzalo (2026-10-14), ante «seis temas» en tres láminas de dos: «creo que el máximo pueden ser 6 barras para seguir asegurando que se vea bien […] mejor limitamos multiapiladas a 6 barras únicamente» | motor: `graficos_multiapiladas_tope.R` (tope y aviso), `.lam_escala_partir` (hasta seis barras se compactan en vez de partirse), `.PARTICION_MAX_BARRAS` 7 → 6; catálogo; editor: pendiente | motor hecho, por verificar: una multiapilada de más de seis avisa «tiene N barras y el máximo es 6: divídela»; seis barras ya no se parten por el aire entre temas. El catálogo no pasa de seis. **Excepción anotada**: dos bloques con escalas distintas (multilista) llevan cada uno título y leyenda y siguen en una lámina por bloque. **Editor**: pendiente el bloqueo al armar más de seis |
| M2 | Con un solo público, la multiapilada va sin líneas grises entre barras (Gonzalo, 2026-10-14) | `.lam_bloque_escala` (`lamina_escala.R`) | hecho, por verificar: el filete sólo separa temas con actores |
| M3 | «Todo ejemplo debe estar en el recetario»: las seis formas de llegar a 4, 5 y 6 barras van al catálogo | `catalogo_recetario_plan.R`, subcapítulo «Hasta seis barras por lámina» | hecho, por verificar: seis láminas, cada una en una lámina y sin avisos |
