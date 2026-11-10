# Checklist — revisión de Gabriela Palacios al PPT de Arte (2026-10-28)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-28
Autoridad: Encargo de Gonzalo del 2026-10-28 a partir de los 34 comentarios de Gabriela Palacios al PPT de Arte

Fuente: `Informe PPT Arte 2026_REV.pptx` (61 láminas, 34 comentarios de Gabriela Palacios Rojo), que Gonzalo dejó en
la carpeta `repos/Pulso` de su usuario. Encargo de Gonzalo: «hay varias cosas que no están saliendo bien que en conta sí
lo hacían». Referencia del motor antiguo: `Informe_Contabilidad_Comparativo_Cuantitativo_03.09.2026.pptx` y el VF del
02.09. El `_REV` se generó CON el ensanche global de +1,2 in del enunciado (N10), que se retiró hoy en `ae4552c26`
(copia del proyecto: `Arte_v1-9_sin_ensanche.pulso`, 57 láminas, barras de 15,3 cm).

Dónde vive: **motor** (cambio en `api/R`, vale para todo informe), **proyecto** (config o datos del `.pulso` de Arte),
**plan** (composición de láminas del proyecto), **decisión** (necesita criterio de Gonzalo/Gabriela).

| # | Lám. REV | Comentario (textual, resumido) | Dónde vive | Estado |
|---|---|---|---|---|
| G1 | 1 | «informe consolidado en letra 20» | motor (portada: rótulo bajo el título) | **hecho**: el rótulo de la portada por plantilla sale a 20 pt (`.lam_portada_rotulo_plantilla_pt`); ya no hereda el 16 de las láminas de texto, el `size_subtitulo_portada` de un perfil sigue mandando |
| G2 | 4 | «entre población y universo, solo dejar población, se ve muy repetitivo» | proyecto (ficha técnica) o motor (filas de la ficha) | fuera del motor: lo corrige Renzo en su proyecto (Gonzalo, 2026-10-28: «eso lo tiene que arreglar él») |
| G3 | 6 | agregar la lámina de redondeo y la del número de respuestas, «que se coloca arribita, al lado derecho» | plan + motor (lámina de N como en Conta) | motor **listo**, falta el plan: `p_slide_top_two_box`, `p_slide_redondeo` y un `p_slide_texto` titulado «NÚMERO DE RESPUESTAS» (dibuja el ejemplo de Conta, N arriba a la derecha) existen y salen bien en Arte (probado en memoria, 60 láminas); el plan de Arte v1-9 no las trae. Corregidos el Sí/No invertido del ejemplo y el rótulo TOP TWO BOX. Abierto: el ejemplo trae datos de Conta («Base: 12 egresados») |
| G4 | 8, 9, 10 | «mejor colocar aquí género, en vez de sexo» | proyecto (título del gráfico) | no se reproduce; fuera del motor: lo corrige Renzo en su proyecto (Gonzalo, 2026-10-28: «eso lo tiene que arreglar él») |
| G5 | 8 | «no binario, género fluido y agénero van juntos, todo como "No binario"» | proyecto (recodificación) — decisión metodológica | fuera del motor: lo corrige Renzo en su proyecto (Gonzalo, 2026-10-28: «eso lo tiene que arreglar él») — decisión de recodificación |
| G6 | 9 | «hay un número por aquí abajo, suelto» (un «2» sobre la barra de Magíster) | motor (rótulo de perfil) | no se reproduce; fuera del motor: lo corrige Renzo en su proyecto (Gonzalo, 2026-10-28: «eso lo tiene que arreglar él») |
| G7 | 10 | «dice Ciencias Contables» (Años trabajando en la Unidad de Ciencias Contables) | proyecto (título heredado de Conta) | fuera del motor: lo corrige Renzo en su proyecto (Gonzalo, 2026-10-28: «eso lo tiene que arreglar él») |
| G8 | 12 | dicotómicas: cifras a 14 pt («ya lo subí») y «todo en color blanco» | motor (cifra de la Sí/No: tamaño y color) | **hecho**: cifras de la Sí/No en blanco a 14 pt dentro de cada segmento (la que sale fuera queda azul; SIN INF conserva su color). Revisar contraste del blanco sobre el celeste en PowerPoint |
| G9 | 14, 39 | «muy pequeñas las barras»; «la premisa tiene tanto espacio, y las barras tan pequeñas» | motor | **hecho** `ae4552c26` (sin ensanche: 15,3 cm) |
| G10 | 15, 34, 44, 46, 51, 52 | una lámina con una sola pregunta «¿tiene que estar sola? ¿no puede estar con el slide de arriba?»; juntar con la vecina del mismo tema | plan del proyecto Arte | decidido por Gonzalo (2026-10-28): «Las junto en el plan» — se juntan a mano en el plan; el motor no fusiona láminas |
| G11 | 16, 48 | barras de un mismo tema más juntas y más separación entre preguntas («pareciera que todo pertenece a la misma pregunta») | motor (aire dentro del tema vs entre temas) | **hecho**: aire dentro del tema 0,14 in y lo liberado va a las fronteras entre temas (`.lam_escala_temas_aire`). Lám. 13 no se junta más: todas sus filas llevan cifra chica |
| G12 | 16 | «mucho espacio al texto, más largas las barras» | motor | **hecho** `ae4552c26` |
| G13 | 16 | Top Two Box más pegado a la barra | motor (columna del box) | **hecho**: `ancho_barra` 6,3 y `x_top_two_box` 11,25; hueco barra–cifra 0,29 in (Conta 0,33) |
| G14 | 20, 21 | la segunda barra más arriba y la leyenda un poco más abajo, que no se vean pegadas | motor (reparto vertical y aire de la leyenda) | **hecho**: la leyenda baja en las láminas llenas hasta el tope de `.lam_leyenda` (base − 0,32 in) y en la multilista apretada deja 0,12 in; aire barra→leyenda 13: 0,11→0,25 · 29: 0,11→0,25 · 36: 0,12→0,26 · 34/44: 0,13→0,18 (la leyenda ya toca el piso) |
| G15 | 30 | «no es necesario el corchete, se ve mal» (dicotomía con dependiente) | motor (lámina dicotomía partida) | **hecho**: sin llave en la disposición «abajo» |
| G16 | 30 | «ese n 77 ahí no se lee, mejor como estaba antes, encima de la barra» | motor (N de la base chica) | **hecho**: «N = 77» en cursiva encima del extremo derecho de la barra; el pie conserva la base |
| G17 | 32, 35, 41 | «las barras tienen que tener el mismo largo» (Sí/No y escala en la misma lámina; ver Contabilidad) | motor (ancho de la Sí/No compartida = el de la escala) | **hecho**: la Sí/No que comparte lámina con una escala con Top Two Box mide el ancho de la escala (láms. 28, 31, 37) |
| G18 | 42 | competencias de salida: «así como la he puesto aquí se ve mejor, por favor editar la de abajo» | motor (radar/lollipop con tabla) — ver su edición | **hecho** en el motor: la tabla al costado ya existía (`tabla = "si"`, Word `word_tabla`); con seis criterios largos se omitía y ahora la primera columna se ensancha lo justo (`.lam_pesas_tabla_plan`). Sin rótulo genérico sobre el eje (ni «% indicador» ni «· Eje desde N %»). El encabezado de la tabla lo escribe el analista (`tabla_titulo`), sin valor de fábrica; vacío avisa. Falta en el plan de Renzo: `tabla = "si"`, `word_tabla`, `tabla_titulo = "TOP TWO BOX"` en las láminas de competencias |
| G19 | 49, 59 | «aquí está muy abajo»; «mucho hueco arriba, que los gráficos estén centrados, a la altura del logo» | motor (centrado vertical del bloque) | **hecho** (lectura vertical): el bloque arranca arriba, rótulo del box a 1,30 in como Conta. Por confirmar con Gabriela si «a la altura del logo» era el borde derecho |
| G20 | 59 | «el top two box en mayúscula, como siempre lo hemos colocado» | motor (rótulo «TOP TWO BOX», como Conta) | **hecho**: «TOP TWO BOX» / «BOTTOM TWO BOX» en mayúsculas en la lámina (escala, multilista y filtro); la espec y el Word conservan «Top Two Box» |

## Notas

- Contabilidad (motor antiguo) mide: Sí/No y escala con el mismo largo (15,6 y 15,7 cm), rótulo «TOP TWO BOX» en
  mayúsculas, la N «N = 75» encima de la barra a la derecha.
- Mazo de hoy sin ensanche (57 láminas, `Arte_v1-9_sin_ensanche.pulso`), medido el 2026-10-28: G17 sigue (la Sí/No de las
  láminas mixtas llega hasta la columna del box y queda más larga que la escala: láms. 28, 31, 37); G11 sigue (láms. 13, 44);
  G15/G16 siguen (lám. 26: corchete y «Sólo los 77…» bajo la premisa); G19 sigue (láms. 55, 56 centradas con hueco arriba);
  G20 sigue («Top Two Box»); G8 sigue (la cifra del «No» en azul).
- Auditoría de geometría contra Contabilidad (2026-10-28, `geom.py`/`comparar.py` del scratchpad), lo que nadie había
  marcado: la Sí/No sola medía 7,52 in frente a 6,3 de la escala (Conta: todas ~6,1) → ahora mide como la escala; el rótulo
  TOP TWO BOX iba a 10 pt (Conta 12) → 12. Abierto, por decidir con Gonzalo: el grosor de la barra no crece con pocas filas
  (Conta 0,70 con 2 filas … 0,47 con 6; Arte 0,44 siempre).
- Segunda corrección contra Contabilidad (2026-10-28, a pedido de Gonzalo: «el título del top two box ahora se está metiendo
  en las barras»; «una separación como de 4 centímetros»; «los gráficos donde solo hay un tema no los centras»), medido lámina
  por lámina en los dos mazos (`conta_audit/temas.py`, `vert.py` del scratchpad):
  - Horizontal: barra hasta 11,4 in (Conta 11,43), cifra del box centrada a 0,85 in del fin de la barra (Conta 0,86), rótulo
    a 0,27 in tras la barra (Conta 0,33) y dentro del margen; toda barra (Sí/No o escala, con o sin box) mide lo mismo.
  - Vertical: grosor que crece con el alto que sobra (Conta 0,71 con 2 barras … 0,51 con 6); aire entre temas a lo más
    1,0 in (Conta 0,6–0,9; 1,1–1,4 con pocas barras); públicos de una sola pregunta a 0,65 in (Conta 0,65–0,84); leyenda a
    0,45 in (Conta 0,3–0,75); lo que sigue sobrando, centrado. La partición no cambia: 57 láminas.
  - Lámina 26 (filtro con su escala) compuesta como la 34 de Conta: Sí/No apilada, «N = 77» sin tocar el rótulo.
