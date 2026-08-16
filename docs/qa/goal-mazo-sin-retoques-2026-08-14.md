# GOAL — el mazo de acreditación sale conforme al recetario, sin retoques

**Abierto**: 2026-08-14 · **Doc vivo**. Sólo Gonzalo lo cierra.
**Recetario**: `cookbook-mazo-acreditacion-2026-08-14.md` ·
**Disposiciones**: artefacto «Disposiciones del Mazo» ·
**Fixture**: `api/inst/reference_projects/acrconta_mazo/`

## Por qué existe

Los 51 comentarios de Gabriela sobre el mazo de Contabilidad no son 51
problemas: son 17 reglas, repetidas lámina tras lámina porque el motor no tiene
un default que las resuelva. Un comentario repetido no es una corrección: es un
default que falta. Este GOAL cierra la distancia entre lo que el motor dibuja y
lo que el cliente aprobó, midiendo las dos cosas sobre el mismo archivo.

## Vara

| | Afirmación | Cómo se mide | Estado |
|---|---|---|---|
| V1 | El título de lámina no va pegado al borde superior | mediana del `y` del título en el .pptx ≥ 0.35 in | **0.370** ✓ |
| V2 | Todo tamaño de letra pertenece al juego de seis (24·14·13·12·11·8) | ningún `sz=` fuera de esa lista | **8.2 % fuera** ◐ (era 82.8 %; aprobado 3.0 %) |
| V3 | El extremo negativo de la escala es naranja, no rojo | `#CA5651` no aparece en segmentos de escala | 97 (títulos) · naranja 173 ✓ |
| V4 | La columna Top Two Box se dibuja en las láminas de escala | nº de láminas con columna T2B | **29 de 67** ◐ (aprobado: 45 de 63) |
| V5 | Ninguna barra por debajo de su piso | ≥ 0.32 in apilada · ≥ 0.20 categórica | 0.280 ✗ |
| V6 | Ninguna lámina supera las 9 **barras** | máx. barras por lámina | **el motor parte**; dispara en 3 ✓ |
| V7 | El grosor de barra cae en su celda de la tabla (gráficos × barras) | contra el recetario | +2 a +20 % ✓ |
| V8 | Existe disposición declarable para 3 gráficos | `p_slide_3_*` en `.slide_names()` | **`p_slide_3_graficos_poblacion`** ✓ |

## Cola

| | Ítem | Dónde vive | Estado |
|---|---|---|---|
| L1 | Bajar la caja del título manteniendo su borde inferior | `plantilla_16_9.pptx`, 11 layouts | ☑ **0.130 → 0.370** en el render |
| L2 | Declarar `top2box_labels` en el preset del proyecto | `multi_apiladas` + `barras_apiladas` | ☑ **1 → 29 láminas**; 0 avisos del motor |
| L3 | Cambiar el extremo de la rampa a `#F4B183` | paletas del proyecto (23 listas) | ☑ **rojo 270→97, naranja 0→173** |
| L4 | Activar `preservar_tamanos_texto` y fijar el juego de seis | preset base | ☑ **82.8 % → 8.2 %** fuera del juego |
| L5 | Piso de grosor declarado por familia | `grosor_modo` + `grosor_barras` | ☐ |
| L6 | Layout `poblacion_3` en la plantilla (2 apilados + 1 alto) | las **dos** plantillas | ☑ officer lo ve, 7 placeholders |
| L7 | Contrato, constructor, render y metadata de `poblacion_3` | 6 archivos R + NAMESPACE | ☑ **lámina generada**, alto 2.08× |
| L8 | Las otras 11 disposiciones del artefacto | ídem | ☑ **11 de 11**; la 11ª no era disposición sino capacidad (L9) |
| L9 | Partir la lámina cuando supera 9 **barras** · incluye `escala_continuada` | `reporte_plan_particion.R` | ☑ **3 láminas del estudio**; 34 asserts |
| L10 | Corregir las dos erratas del plan del proyecto | plan del `.pulso` | ☑ **3 → 0** apariciones |
| L11 | Retirar los cuatro separadores de dimensión | plan del `.pulso` | ☑ **67 → 63 láminas**, las mismas que el aprobado |
| L12 | La guía de canvas pasa a verificar las 9 reglas | `debug_ph` | ☐ |
| L14 | Llevar el arreglo del color al DEFAULT del motor | `.PULSO_PPT_COLORS` / generador de paletas por lista | ☐ |
| L15 | Cerrar la brecha de Top Two Box | ☑ **diagnosticado**: el modo `multilista` no la soporta. Pasa a L18 |
| L16 | Residuo de tamaños: 9 pt×123, 8.5×28, 9.48×20, 31.2×13 | falta ubicar qué elemento los emite | ☐ |
| L17 | Llevar los tamaños calibrados al DEFAULT del motor | `.PRESETS_META$base` | ☐ |
| L18 | Que el modo `multilista` dibuje la columna Top Two Box | `graficador_barras_apiladas.R` — desarrollo | ☐ |

**L13 retirado** (2026-08-15): regenerar los fixtures `hsvg2026` y `acrconta`
con el dominio sintético no le corresponde a este GOAL. El arreglo del
anonimizador ya está hecho y commiteado; regenerar es una tarea de fixtures que
depende de `PROSECNUR_ANON_SALT` y se resuelve donde vivan esos fixtures, no
aquí. Los números de la cola no se recorren: L14–L18 conservan el suyo.

## Dónde está el mazo hoy

Medido sobre el mismo archivo, con la guía apagada:

| | Láminas | Título | Top 2 Box | Naranja | Rojo | Erratas |
|---|---|---|---|---|---|---|
| Partida | 67 | 0.130 | 1 | 0 | 270 | 3 |
| **Ahora** | **63** | **0.370** | **29** | **173** | **84** | **0** |
| Aprobado | 63 | 0.361 | 45 | 213 | 67 | 0 |

Cinco de las seis columnas ya coinciden con el entregable o lo superan. La que
sigue lejos es Top Two Box (29 contra 45), y su causa está en L15: falta
identificar qué familias de gráfico no la dibujan aunque las categorías estén
declaradas.

### L15 — CERRADO: la causa es el modo del graficador, no la configuración

De las 63 láminas, 37 muestran una escala: **28 llevan la columna y 9 no**. La
diferencia no está en los datos ni en los overrides —las nueve no tienen
ninguno— sino en el **modo** de `p_barras_multiapiladas`:

| Modo | Columna Top Two Box |
|---|---|
| `var_cruce` | sí |
| `multilista` (con `bloques`) | **no** |

Descartados por medición, no por razonamiento:

- **No es la escala de satisfacción.** Se añadieron «Satisfecho» y «Muy
  satisfecho» a `top2box_labels`: el conteo no se movió.
- **No es que falte declararlo.** Se puso `top2box = TRUE` explícito en las nueve
  láminas `multilista`: el conteo tampoco se movió.

Con eso queda establecido que **el modo `multilista` no soporta la columna**, y
el arreglo deja de ser configuración para pasar a ser capacidad del graficador.
Sigue como **L18**.

Nota sobre el objetivo: de las nueve, al menos tres son escalas de dos
categorías —«90 % / 10 %»— donde la columna no aplica. El techo realista no es
45 sino ~34.

## Trampas — lo que ya costó una conclusión falsa

- **Medir el grosor sin normalizar por cuántos gráficos comparten la lámina
  inventa un defecto.** Agrupar solo por número de barras mezcla una barra que
  ocupa la lámina entera con una de un panel de cuatro. Produjo un «el motor se
  queda 27 % corto» que no existe. Lo detectó Gonzalo, no la medición.
- **La media del alto de los rectángulos miente.** En una lámina conviven la
  barra, la cabecera y la leyenda, todas con relleno de la rampa: hay que usar
  la **moda** y restringir la paleta a los cuatro colores de la escala.
- **Una barra de datos no lleva texto propio.** Las etiquetas de categoría son
  cajas con el mismo relleno azul y alto 0.159 in; sin filtrar por «sin texto»,
  el medidor devuelve 0.159 en treinta láminas y eso no es ninguna barra.
- **La guía de canvas no es un defecto.** `debug_ph` activo pinta 978 bordes
  magenta en 48 láminas. Cualquier comparación de color debe hacerse con la guía
  apagada, o el ruido tapa los hallazgos reales — tapó el de los tamaños.
- **Lo que vive dentro del gráfico no sube a la lámina.** El multiactor y la
  columna Top Two Box ya los resuelve el preset del graficador, con su propio
  reparto de ancho. Proponerlos como disposición duplicaba un mando existente.
- **Cambiar el `anchor` del layout NO mueve el título.** El motor escribe un
  `xfrm` propio copiando `offy` del layout vía `layout_properties()`, y el
  anclaje no viaja. Para mover el título hay que mover la **caja**, no su
  anclaje. Costó una plantilla rota y una regeneración de 45 s.
- **El rojo institucional NO está prohibido: es el color de los títulos.** El
  entregable aprobado lo usa en 67. Sustituirlo a ciegas rompería los títulos.
  El criterio que lo distingue sin ambigüedad: es rampa de escala cuando el
  color inmediatamente siguiente es el amarillo `#FFD965`. Con ese criterio se
  corrigieron 26 colores en 23 listas sin tocar un solo título.
- **La paleta vive por LISTA de escala en el proyecto, no en el motor.** Son 23
  entradas `lst_p26`, `lst_p29`… en `graficos_config$paletas`. Cambiar el
  default del motor no arregla un proyecto ya guardado, y viceversa: por eso L3
  (proyecto, hecho) y L14 (motor, pendiente) son dos ítems y no uno.
- **La misma categoría se escribe distinto según el público.** «De acuerdo» en
  egresados y docentes, «De Acuerdo» en estudiantes y administrativos. El motor
  exige el nombre EXACTO en `top2box_labels` y no deduce: declarar una sola
  variante deja sin columna a la mitad del mazo. Hay que declarar las cuatro.
- **`size_texto_barras` está en unidades de ggplot, no en puntos.** El render lo
  multiplica por **2.845**: el default de fábrica 4.2 rinde ~11.95 pt y para los
  14 pt del recetario hay que declarar 4.921. Se descubrió midiendo: 6.9 salió
  exactamente 19.63 pt en el archivo.
- **`preservar_tamanos_texto` por sí solo EMPEORA el resultado.** Activarlo sin
  recalibrar llevó el texto de barras de 15.93 a 8.53 pt —ilegible—, porque deja
  de escalar y respeta un declarado que estaba pensado para ser escalado. Los dos
  cambios van juntos: preservar + declarar el tamaño real.
- **Las sentinelas del deck se numeran por POSICIÓN, no por orden de escritura.**
  El test compara la lámina N con «L7-SNN-», así que insertar cuatro en medio
  obliga a renumerar todas las que van detrás — no basta con darles el número
  siguiente.
- **Medir el contenido en vez del contenedor da un falso rojo.** `p_numerico`
  centra su canvas dentro del hueco y no lo llena, así que comparar el alto
  dibujado contra el alto del slot marca como fallidos slots correctos. El slot
  se identifica por su ancho y su columna, que el contenido nunca cambia. Es la
  tercera vez en este GOAL que una medición confunde las dos cosas.
- **Un respaldo sin fecha se restaura sobre trabajo más nuevo.** Reutilizar
  `plantilla.pptx.bak` —creado antes de `poblacion_3`— para revertir un intento
  fallido borró el layout ya commiteado. Se recuperó con `git checkout`, pero el
  respaldo tiene que ser de la tanda, no del archivo.
- **Seis disposiciones no son seis renderers.** Todas son N huecos colocados por
  el layout: comparten `.composicion_render` y una sola rama de despacho. La
  diferencia vive en la plantilla, que es donde se define una disposición.
- **Añadir una lámina toca CUATRO sitios que la cuentan a mano**, y ninguno se
  deriva solo: el contador de `render_key` en el contrato, dos listas del test de
  metadata (`.gm_slide_blueprints` y `.gm_slide_slot_specs`, más el vector de
  `kinds`) y el deck de sentinelas, que numera correlativamente y obliga a
  renumerar todo lo que va después. La siguiente lámina volverá a pedirlos.
- **El contrato de la matriz se acredita contra la plantilla de ACNUR**, no
  contra la general. Un layout añadido solo a `plantilla_16_9.pptx` deja la
  disposición existiendo a medias: genera, pero la matriz no le resuelve layout.
- **El export va a mano al NAMESPACE.** Regenerarlo con roxygen quita 19 exports
  —incluidos graficadores— y rompe `R CMD INSTALL`, que es de lo que dependen los
  jobs `callr`.
- **Un regex sobre `<a:bodyPr />` se traga el `/` del autocierre.** `[^>]*` es
  greedy: deja `attrs=" /"` y produce `<a:bodyPr / anchor="ctr">`, XML inválido
  que rompe la generación entera con «error parsing attribute name». Hay que
  excluir `/` de la clase y capturarlo aparte.

### L9 — lo que la vara medía mal

**V6 estaba mal formulada** y por eso parecía imposible de cerrar: decía
«9 premisas» cuando el plan del estudio no tiene ninguna lámina de más de
**cuatro**. La lámina más apretada del mazo —13 barras a 0.221 in, contra un
piso de 0.32— sale de cuatro premisas por cuatro públicos. Lo que adelgaza la
barra es el producto, no el factor.

El umbral no se eligió: sale de la misma medición. Si 13 barras dan 0.221 in,
el alto útil ronda las 2.87 in, y el piso de 0.32 se cruza exactamente en **9**.
El «9» del recetario era de barras desde el principio.

**La 11ª disposición no era una disposición.** `escala_continuada` no necesita
plantilla: la continuación usa el mismo layout con el título marcado. Lo que
faltaba era que el motor generara **una lámina de más**, que es una capacidad.
Por eso L8 cierra en 11 de 11 sin haber tocado ninguna plantilla.

**Un test en verde certificó una función que nunca se activaba.** La primera
versión construyó el fixture leyendo una impresión aplanada de `vars`, y dedujo
una lista plana con nombres compuestos (`tema_11`) que el plan no usa: `vars`
viene **anidada por premisa**. Los 24 asserts pasaron sin tocar el código que
de verdad corre, y medido contra el estudio real el resultado era **0 láminas
partidas** en vez de 3. El fixture ahora afirma su propia forma antes de
afirmar nada más.

Es la cuarta medición de este GOAL que confunde una cosa con su envoltorio
—grosor medio contra moda, cajas de etiqueta contra barras, canvas contra
hueco, y ahora dato aplanado contra estructura—. El patrón: **`print()` y
`unlist()` mienten sobre la forma; `str()` no.**
