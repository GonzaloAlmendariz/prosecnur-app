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
| G2 | El recetario y su catálogo lo muestran (lámina «Histograma por grupos») | `catalogo_recetario_plan.R` | pendiente |
| G3 | Serie temporal: la leyenda va abajo, elegante, en lugar del nombre de cada serie al final de su línea | `graficador_serie_recetario.R` (honra «Posición de la leyenda», que el estilo del recetario ignoraba) | hecho, por verificar: abajo por defecto, línea con punto hueco y sin título; «Derecha» conserva el nombre al final de la línea. De paso: dos cifras del mismo período y casi a la misma altura ya no se tapan («74%» bajo «73%») |
| G4 | Antetítulo con los colores de los públicos o perfiles, que hace de leyenda | lámina nativa (cabecera) | pendiente |
