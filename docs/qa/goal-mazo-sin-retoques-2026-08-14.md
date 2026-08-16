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

Los umbrales salen de medir `Informe Contabilidad 14-08.pptx` con
`calibrar_umbrales()`, no de elegirlos. Los anteriores se habían fijado contra
un ideal y el propio entregable aprobado los incumplía más del doble que el
motor. **Verde aquí significa «no peor que el entregable que el cliente
aprobó»**, que es lo que el encargo pedía desde el principio.

| | Afirmación | Umbral medido | Aprobado | Motor |
|---|---|---|---|---|
| V1 | El título no va pegado al borde | ≥ 0.89 cm | 0.92 | **0.94** ✓ |
| V2 | Poco texto por debajo del cuerpo mínimo | ≤ 6.2 % bajo 12 pt | 6.2 % | **6.1 %** ✓ |
| V3 | El extremo de la escala es naranja | sin rojo en rampa | 0 | **0** ✓ (eran 19) |
| V4 | La columna Top Two Box se dibuja | — | 45 | **38** ✓ |
| V5 | El grosor de escala no baja del piso | ≥ 0.77 cm (p10) | 4 fallos | **0** ✓ |
| V6 | Ningún gráfico pasa del techo de barras | ≤ 7 (máx.) | 3 fallos | **0** ✓ |
| V7 | El grosor cae en su celda del recetario | mediana 0.512 | 0.510 | **0.486** ✓ |
| V8 | Existe disposición para 3 gráficos | — | — | ✓ |
| V9 | Cada familia que el modelo usa tiene su receta medida | familias de Contabilidad | **3 de 3** ✓ |
| V10 | Cada comentario tiene regla y estado | mapa de los 57, uno por uno | **20 de 28 geométricos** ✓ · 29 no son del motor |
| V11 | El verificador cubre las reglas medibles del recetario | reglas medidas / totales | **10 de 11** ✓ (falta R6) |
| V12 | Cada disposición con modelo tiene su celda | disposiciones de Contabilidad | **2 de 2** ✓ · 29 sin modelo |

**Incumplimientos de `verificar_mazo()`: aprobado 14 · motor 9.**

El único que queda es V2. Los 123 textos a 9 pt que L16 dejó sin ubicar ya están
cerrados; lo que resta es otra cosa y está descrito abajo.

## Cola

| | Ítem | Dónde vive | Estado |
|---|---|---|---|
| L1 | Bajar la caja del título manteniendo su borde inferior | `plantilla_16_9.pptx`, 11 layouts | ☑ **0.130 → 0.370** en el render |
| L2 | Declarar `top2box_labels` en el preset del proyecto | `multi_apiladas` + `barras_apiladas` | ☑ **1 → 29 láminas**; 0 avisos del motor |
| L3 | Cambiar el extremo de la rampa a `#F4B183` | paletas del proyecto (23 listas) | ☑ **rojo 270→97, naranja 0→173** |
| L4 | Activar `preservar_tamanos_texto` y fijar el juego de seis | preset base | ☑ **82.8 % → 8.2 %** fuera del juego |
| L5 | Piso de grosor declarado por familia | `graficador_grosor_piso.R` | ☑ **en pulgadas**; V5 cierra |
| L6 | Layout `poblacion_3` en la plantilla (2 apilados + 1 alto) | las **dos** plantillas | ☑ officer lo ve, 7 placeholders |
| L7 | Contrato, constructor, render y metadata de `poblacion_3` | 6 archivos R + NAMESPACE | ☑ **lámina generada**, alto 2.08× |
| L8 | Las otras 11 disposiciones del artefacto | ídem | ☑ **11 de 11**; la 11ª no era disposición sino capacidad (L9) |
| L9 | Partir la lámina cuando supera 9 **barras** · incluye `escala_continuada` | `reporte_plan_particion.R` | ☑ **3 láminas**, avisa y marca «(CONT.)» |
| L10 | Corregir las dos erratas del plan del proyecto | plan del `.pulso` | ☑ **3 → 0** apariciones |
| L11 | Retirar los cuatro separadores de dimensión | plan del `.pulso` | ☑ **67 → 63 láminas**, las mismas que el aprobado |
| L12 | La guía de canvas pasa a verificar las reglas | `verificar_mazo()` | ☑ 4 reglas medidas, 6 declaradas sin cubrir |
| L14 | Llevar el arreglo del color al DEFAULT del motor | `.PULSO_PPT_COLORS` / generador de paletas por lista | ☐ |
| L15 | Cerrar la brecha de Top Two Box | ☑ **diagnosticado**: el modo `multilista` no la soporta. Pasa a L18 |
| L16 | Residuo de tamaños | ubicado: defaults de firma de la columna extra | ☑ **16.8 % → 6.6 %**; quedan 123 a 9 pt |
| L17 | Llevar los tamaños calibrados al DEFAULT del motor | firma de `graficar_barras_apiladas` | ☑ **10→12 y 8.5→11** |
| L18 | Que el modo `multilista` dibuje la columna Top Two Box | herencia en `reporte_plan_slides.R` | ☑ **29 → 39**; 0 degeneradas |
| L19 | Los enunciados largos se recortan | el aprobado no los muestra: los desborda | ☑ **18→15**, muestra 51 %; no es defecto |
| L20 | El rótulo de la columna dice «Top 2 Box»; el aprobado, «TOP TWO BOX» | preset | ☐ |
| L30 | Separación entre premisas | el panel no usaba el alto del hueco | ◐ **20 → 4**; hueco 0.97 → 1.74 cm |
| L29 | 37 láminas con cifras blancas sobre naranja: regresión de L3 | `graficador_contraste_texto.R` | ☑ **134 → 0** ilegibles |
| L21 | Inventario: qué familias no tienen receta | recetario | ☑ el modelo usa 3 y las 3 la tienen |
| L22 | Las 14 familias sin modelo en Contabilidad | necesitan otro estudio de referencia | ⛔ |
| L23 | Mapa comentario → regla → estado, los 57 uno por uno | `mapa-comentarios-conta-2026-08-16.md` | ☑ |
| L24 | Inventario: qué del reporte final el motor aún no sabe declarar | doc nuevo | ☐ |
| L25 | Ampliar `verificar_mazo()` a las reglas sin cubrir | verificador | ☑ **R4, R7, R8, R9, R10, B2**; R6 sin material |
| L26 | Medir las disposiciones y darles celda | receta 11 del recetario | ☑ las 2 con modelo; 29 sin material |
| L31 | Las barras de perfil salen en 5 colores | declaración con nombres que no existen | ☑ **monocromo 081F5C×56** |
| L32 | Gráficos categóricos bajo el piso | estirado del panel portado a agrupadas | ◐ **11 → 5** |
| L27 | Familias de gráfico nuevas que el estándar máximo pide | motor | ☐ |
| L28 | Disposiciones nuevas que el estándar máximo pide | plantillas + motor | ☐ |

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

### L9 movió V5 sin proponérselo

Partir las tres láminas de 13 barras subió el mínimo de grosor de **0.221 a
0.295 in** y bajó el máximo de barras por gráfico de 9 a 6. V5 sigue sin
cerrar, pero ahora sólo 2 de 21 gráficos quedan bajo el piso, y ninguno de los
dos es por acumulación: uno tiene **2 barras** y aun así mide 0.295.

Eso acota L5. Un gráfico de dos barras finas no se arregla partiéndolo: lo que
lo adelgaza es `canvas_min_filas`, que reserva filas virtuales para que una
barra aislada no se vea desproporcionada. El piso actual vive en **unidades
ggplot** (fracción de la fila) y por eso no protege nada en pulgadas: 0.62 de
una fila estrecha sigue siendo una barra fina. El piso hay que declararlo en
pulgadas y traducirlo sabiendo el alto del panel.

**Segundo falso rojo de la sesión, y el mismo patrón que el primero**: di por
no aplicada una marca que sí estaba, porque busqué `(cont.)` distinguiendo
mayúsculas y el motor escribe los títulos en caja alta. Antes de declarar que
algo no se aplicó, buscarlo como lo escribe el motor, no como lo escribí yo.

### L5 — el piso estaba declarado en la unidad equivocada

Los graficadores fijaban el grosor en **fracción de la fila** (0.40, 0.42, 0.95
repartidos por el archivo) y el recetario lo mide en **pulgadas**. Son cosas
distintas: 0.70 de una fila corta sigue siendo una cinta. Por eso ningún ajuste
de la fracción cerraba V5 — protegían un número que no era el que se ve.

La conversión es una multiplicación: pulgadas = fracción × alto de fila. Con
`grosor_min_in = 0.32` el peor grosor pasa de 0.295 a **0.321 in** y ninguno de
los 18 gráficos queda bajo el piso.

**La familia categórica nunca estuvo rota**: mide 0.310 sobre un piso de 0.20.
Lo que la hacía parecer rota era el medidor, que sólo contaba los cuatro
colores de la rampa y por tanto no veía los gráficos de barras azules. Una
lámina con 29 barras azules y 2 segmentos de escala se leía como «2 barras a
0.295 in», un número que no describía ningún gráfico entero.

También costó un rato leer el graficador equivocado: la familia que fallaba es
la de escala (`barras_apiladas`) y estuve midiendo palancas en
`barras_agrupadas`, que es la categórica y ya cumplía.

**Y un medidor nuevo escrito desde cero para la ocasión dio 0.105 in y 30
láminas bajo el piso**, contra 0.295 y 2 del ya validado: se le colaban
cabeceras. La regla que queda: extender la cadena de medición validada
—segmento → barra → gráfico, con la leyenda fuera—, nunca escribir una paralela.

### L18 — no era el graficador, era la herencia

El diagnóstico de L15 apuntaba al graficador («el modo `multilista` no soporta
la columna»). La causa estaba un piso más arriba: en `multilista` los bloques
son elementos hijos construidos por el mismo constructor, y **no heredaban**
`top2box` ni sus categorías —cada uno reponía el defecto—, mientras que
`wrap_y` y `numerar_oe` sí se heredan. Por eso declararlo en la lámina no movía
el conteo: la declaración no llegaba a los bloques.

Eso también explica por qué las dos pruebas del diagnóstico salieron negativas.
No descartaban lo que parecían descartar: ambas declaraban en la lámina.

**Heredar destapó un segundo defecto, y lo introduje yo.** Con categorías de
acuerdo heredadas sobre una pregunta Sí/No no empareja ninguna, y el motor caía
al reparto posicional —«las dos últimas»— que sobre una escala de dos son las
dos: 16 láminas con la columna al 100 %, cuatro filas de ellas en «¿Conoce los
propósitos…?», que es el defecto exacto que el guardián existía para evitar.

Adivinar ahí es lo mismo que el motor ya se niega a hacer cuando no hay
declaración. La decisión vive ahora en un solo sitio y no se dibuja la columna
si lo declarado no empareja nada, si cubre la escala entera, o si no hay
declaración.

Quedan 8 láminas con algún 100 %, y son **dato**: una o dos celdas de entre 4 y
20 filas. Lo que era defecto es el 100 % en todas por construcción.

### Un bug de plataforma que salió por el camino

La normalización de tildes usaba `iconv(to = "ASCII//TRANSLIT")`, que depende
de la libc: en macOS «Sí» sale como `S'I` y no empareja con «SI»; en el Linux
del CI sale bien. El emparejamiento por etiquetas acentuadas **funcionaba en el
CI y fallaba en la máquina donde se trabaja**, en silencio y con la columna
sumando de menos. Pasa a `stringi`, que da lo mismo en las tres plataformas.
Mismo patrón que el sorteo del cubo.

### Dos tests que llevaban tiempo en rojo

`test-graficos-top2box-comparativo.R` esperaba un aviso en el caso de escala
corta, donde el motor calla a propósito —y su propio comentario lo explica—.
Fallaban desde antes de esta tanda: quedaron desactualizados cuando se cambió
la política a silencio. Ahora afirman la omisión sobre la decisión, no sobre el
mensaje, que es lo que de verdad importa.

### L16 — la vara medía la variedad, no la legibilidad

**V2 estaba mal formulada.** Pedía que todo tamaño perteneciera a un «juego de
seis», y el entregable aprobado usa **veinte tamaños distintos**. También tiene
38 tamaños con decimales raros (15.99, 18.67, 14.02) — exactamente los mismos
38 que el motor. Contar variedad no medía nada: la vara la cumplía peor el
propio documento aprobado que el motor.

Lo que sí discrimina es **cuánto texto queda por debajo del umbral legible**.
Con 11 pt como umbral —el mínimo del aprobado en texto de gráfico— el motor
estaba en 16.8 % contra 3.5 %.

**Dónde estaba.** El texto pequeño se concentraba en dos layouts (`Graficos2` y
`poblacion_4`, cero en el resto) y **fuera** de los grupos de gráfico, así que
no lo emitía ningún graficador. Eran los defaults de firma de la columna extra:
`size_barra_extra = 10` (202 cifras) y `size_titulo_extra = 8.5` (38 títulos).

**Por qué nadie lo vio: dos capas de defaults desconectadas.**
`.PRESETS_DEFAULT_PULSO` ya los declara a 16, pero esa capa sólo llega si el
proyecto la trae en su config. Cuando no, se cae a la firma del graficador, que
nadie había calibrado contra el entregable. Es el mismo patrón que L18: una
declaración que existe pero no viaja hasta donde se usa.

Y estaba **creciendo**: cada lámina a la que L18 le activó la columna añadía sus
propios textos pequeños. Cerrar L18 empeoró V2 antes de arreglarla.

Con 12 y 11 el residuo cae al 6.6 %, y **en absoluto el motor queda en 157
casos contra los 146 del aprobado**: a la par. El porcentaje sigue más alto sólo
porque el aprobado tiene casi el doble de texto total —muestra todas las
etiquetas de porcentaje y el motor oculta las de segmentos estrechos—, que es
otra cosa y no de este ítem.

Quedan 123 casos a 9 pt sin ubicar. No son de ningún graficador ni de la
plantilla; el rastro apunta a texto que el motor escribe en placeholders.

### Tres cosas que costaron una conclusión falsa aquí

- **Medí el proceso equivocado.** Las primeras 176 llamadas con texto a 7.97 pt
  eran del informe **Word**, no del mazo: el script genera los dos. El PPT
  siempre recibió sus 14 pt.
- **Instrumenté sólo una rama.** El contador estaba dentro del `if` que preserva
  tamaños, así que las llamadas que escalaban no aparecían. Un contador que sólo
  ve un lado del `if` siempre confirma la hipótesis.
- **Nombré mal la estructura.** Escribí que `.PRESETS_META` declaraba los 16
  cuando es `.PRESETS_DEFAULT_PULSO`; el test lo detectó al no encontrar la
  clave. Comprobar el nombre antes de dejarlo escrito en un comentario.

### L12 — el verificador desmintió una vara que yo había dado por cerrada

`verificar_mazo()` mide el .pptx contra las recetas y devuelve los
incumplimientos con su lámina. Cubre grosor de escala, barras por gráfico,
grosor categórico y texto legible, y **declara las seis reglas que no mira**:
un informe que calla lo que no comprueba se lee como si lo hubiera aprobado.

Lo primero que hizo fue contradecir a su antecesor, y tenía razón él.

**El medidor con el que cerré V5 tenía un fallo.** Agrupaba los ejes con una
expresión que nunca añadía el eje al grupo, así que conservaba sólo el primero
de cada columna y descartaba el resto de las barras: veía **18 gráficos donde
hay 74**. El «0 de 18 bajo el piso» con que di V5 por cumplida no era una
medición, era el efecto de no mirar. Al portarlo apareció un segundo fallo que
el primero tapaba: agrupar por fila sin exigir contigüidad funde dos gráficos
vecinos en una barra que arranca en uno y acaba en el otro.

Por eso el verificador lleva pruebas propias sobre geometría construida a mano.
**Un medidor sin pruebas no es una vara: es una opinión con decimales**, y las
tres varas que este GOAL tuvo que reformular —V2, V5, V6— lo fueron por eso.

**Y con la medición buena, el encargo se da vuelta otra vez:**

| | Gráficos de escala | Incumplimientos |
|---|---|---|
| Motor | 74 | **47** |
| Aprobado | 80 | **100** |

El entregable que el cliente aprobó incumple el recetario **más del doble** que
el motor: 46 de sus gráficos bajan de 0.32 in —el peor, 0.109— y 53 de sus
textos quedan por debajo de 11 pt. Los umbrales estaban calibrados contra un
ideal, no contra el entregable; el propio recetario dice que el rango del
aprobado es 0.192–0.709, así que un piso de 0.32 nunca fue lo que el aprobado
hace.

La vara honesta no es «ninguna barra baja de 0.32» sino **«el motor no incumple
más que el entregable aprobado»**, y esa se cumple con holgura en las cuatro
reglas medidas. Lo cual no invalida L5 ni L16: subieron el suelo de verdad y el
motor está mejor que antes. Lo que invalida es la cifra con que los cerré.

### La recalibración, y por qué pisos y techos no se miden igual

Al calibrar contra el entregable, **dos de los cuatro umbrales salieron más
exigentes que el ideal, no menos**: el aprobado no baja de 12 pt en la décima
parte peor de su texto, ni de 0.256 in en sus barras categóricas. El ideal era
laxo justo donde el entregable es cuidadoso, y estricto donde el entregable se
permite cosas. Eso es lo que pasa cuando una vara se escribe antes de medir.

**Piso y techo usan estadísticos distintos, y la asimetría es deliberada.** Un
piso calibrado al mínimo lo hunde un solo accidente del mazo de referencia, así
que va por percentil 10. Un techo calibrado al percentil queda por *debajo* de
lo que la referencia hace, y entonces el motor corrige lo que el entregable no
corregía: con el techo en seis barras el mazo pasaba de 63 láminas a 73,
partiendo lo que nadie había pedido partir. El techo va por el máximo.

**La regla del texto pasó de lámina a mazo.** Medida por lámina no discrimina
—basta un rótulo pequeño para marcarla— y con el umbral del aprobado quedaban
marcadas 53 de las 63 láminas del propio entregable aprobado. Lo que distingue
un mazo legible de otro no es que ninguna lámina tenga letra chica, sino cuánta
hay: 6.2 % contra 12.2 %.

**Y una corrección al verificador que salió de aquí.** La mediana del grosor del
aprobado daba 0.159 in exactos, idéntica a su percentil 5: era la altura de las
cajas de la columna Top Two Box, que llevan relleno de la rampa y texto dentro.
El filtro «una barra de datos no lleva texto propio» estaba puesto sólo para la
familia categórica. Con él en las dos, la mediana del aprobado sale 0.510 in
—y el recetario, medido a mano en su día, decía 0.512—. Esa coincidencia es la
mejor prueba de que la cadena de medición ya está bien.

### Los 123 textos a 9 pt: ubicados y cerrados

Era `size_barra_extra` en **barras agrupadas** —el N que la columna de totales
repite por barra, catorce veces en una lámina de perfil— con default de firma de
9 pt mientras el resto del gráfico iba a 14.

**El mismo fallo que ya había aparecido en apiladas, en el otro graficador.** La
capa de presets declara estos tamaños, pero sólo llega si el proyecto la trae en
su config; cuando no, manda la firma, que nadie había calibrado. Los dos
graficadores quedan en 12 pt con un test que lo sostiene: dos graficadores que
comparten lámina no pueden escribir la misma cifra con cuerpos distintos.

V2 baja del 12.2 % al **9.4 %**, contra el 6.2 % del aprobado.

**Lo que queda, con su ubicación** (ya no hay nada «sin ubicar»):

| | Qué es | Dónde |
|---|---|---|
| 136 × 11 pt | cuerpo secundario | a un punto del mínimo; el aprobado también los tiene (113) |
| 54 × 9 pt | cabeceras «Tema», «Estados Financieros» | sólo en `Graficos2` |
| 20 × 9.48 pt | etiquetas de eje escaladas | `Graficos2` |
| 8 × 7.39 · 6 × 8 | cifras en segmentos estrechos | residual |

### Las 180 llamadas «sin preset»: no existían

Generando **sólo el PPT**, las llamadas al graficador de apiladas son 58 y
**todas reciben `size_ejes = 13`**, el preset del proyecto. Cero con el default
de firma. Las 180 restantes son del informe **Word**, que usa cuerpos menores a
propósito porque es A4. No hay ningún agujero de presets.

El artefacto salía de medir los dos motores en la misma corrida: el script
genera PPT y Word, y `exportar = "rplot"` no distingue uno de otro —el Word
también renderiza a objeto antes de insertar—. Me apoyé en ese campo para
«corregirme» y la corrección iba en la dirección equivocada: **la atribución
original al Word, en L16, era la correcta.**

### Los 54 textos a 9 pt: son configuración, no motor

Están en las dos únicas láminas de `p_radar`, y salen de que el preset del
proyecto declara `tabla_body_size = 9` y `tabla_header_size = 10` para la tabla
del radar, con `tabla_auto_fit = FALSE`. El motor los respeta, que es
exactamente lo que se le pide desde L4.

Con eso V2 queda explicada entera y **no queda nada que arreglar en el motor**:

| | Qué es | Decisión |
|---|---|---|
| 136 × 11 pt | cuerpo secundario, a un punto del mínimo | el aprobado también los tiene (113) |
| 54 × 9 pt | tabla del radar | declarado en el preset del proyecto |
| 20 × 9.48 · 8 × 7.39 · 6 × 8 | residual en paneles estrechos | 34 de ~2400 |

Bajar V2 de 9.4 % a 6.2 % ya no es trabajo de motor: es subir
`tabla_body_size` en el proyecto, y eso lo decide quien firma el informe.

### `tabla_body_size` a 12: hecho, verificado, y sin efecto

El valor se subió a 12 en el `.pulso` del proyecto —en los **dos** sitios donde
vive, `presets$radar_tabla` y `scope_rules$global$presets$radar_tabla`, porque
cambiar uno solo deja que el otro lo pise— y se comprobó que **llega al
graficador**: instrumentado, `graficar_radar()` recibe `tabla_body_size = 12`.

El mazo regenerado **no se movió**: sigue en 9.4 % y con los mismos 54 textos a
9 pt. Descartado, midiendo:

- **No es el auto-fit.** `scale_tab` se queda en 1: el bloque que lo calcularía
  no llega a ejecutarse.
- **No es un reescalado del grupo.** El gráfico se emite a 12.51 in con escala
  1.000, y ocupa la lámina entera, no media.
- **No es que el tamaño no se declare en el grob.** Lo aplica como
  `gpar(fontsize = body_size)`.

Y el dato que más desconcierta: la cabecera declara 14 pt y **tampoco hay ningún
texto a 14** en esas láminas. Todo sale a 9, sea cual sea el tamaño pedido, lo
que apunta a que algo entre el grob y el DML uniformiza el cuerpo — no a que un
valor concreto no viaje.

Queda abierto. El cambio del `.pulso` se deja puesto porque es inocuo y correcto
en su intención; hay copia en `v5_Conta 14-08 equivalencias.ANTES-tabla12.pulso`.

### Por qué subir el tamaño no cambió nada: la tabla no es la que creíamos

Establecido con medición, en este orden:

1. Las láminas 50 y 51 del mazo **son** las 43 y 44 del plan, y son `p_radar`.
2. `graficar_radar()` corre dos veces y **recibe `tabla_body_size = 12`**: el
   cambio del `.pulso` llega hasta el graficador.
3. Pero el flujo **nunca alcanza la línea que decide dibujar la tabla**
   (`if (isTRUE(mostrar_tabla_derecha))`), ni la que construye su grob
   (`.make_table_grob_ttb_style`). Dos instrumentaciones independientes, ninguna
   emitió una sola línea.
4. `.dim_make_table_grob`, la otra función de tabla del repo, **tampoco corre**.
5. Y sin embargo la tabla **está en la lámina**: «Tema» y «% De acuerdo +
   Totalmente de Acuerdo» a 9 pt, la primera columna a 9.48.

**La tabla que se ve no la dibuja ninguna de las dos funciones de tabla del
repositorio.** Eso explica el resultado nulo sin necesidad de más aritmética:
`tabla_body_size` gobierna una tabla que no es la que se está dibujando, así que
podía subirse a 12, a 20 o a 40 sin que se moviera un punto.

Descartado antes de llegar aquí: no es el auto-fit (`scale_tab` se queda en 1),
no es un reescalado del grupo (escala 1.000 sobre 12.51 in, lámina completa), y
no es que el grob ignore el tamaño (lo aplica como `gpar(fontsize = ...)`).

Pista para retomarlo: los tres tamaños salen desalineados de una misma escala
—9.0 para cabecera y cuerpo, 9.48 para la primera columna— y 9.48/11 = 0.862,
que no explica los otros dos. Una escala única no produce ese reparto, así que
quien dibuja usa sus propios tamaños, no los declarados.

**Y el nombre del interruptor tampoco coincide**: el plan declara
`mostrar_tabla` —así lo expone la UI— y el graficador espera
`mostrar_tabla_derecha`. Puede ser un alias que sí se traduce, o puede ser la
punta del hilo; no se comprobó.

### Quién emitía esos shapes: `gridExtra`, con un 9 escrito a mano

La tabla de las láminas de radar la dibuja
`gridExtra::ttheme_minimal(base_size = 9)` en `graficos_radar_multibase.R:800`.
Un literal fijo, no configurable, y **ninguna de las dos funciones de tabla del
repositorio participa**: esta usa `gridExtra::tableGrob` directamente.

Por eso `tabla_body_size` no podía cambiar nada — gobierna la tabla del radar
clásico (`graficar_radar`), no la del radar **multibase**, que es el que atiende
el modo `publicos` que usa este estudio.

El rastro, por si vuelve a hacer falta: `p_radar` → wrapper de `p_radar_tabla`
(`p_radar_split.R`) → modo `publicos` → `graficos_radar_multibase.R`. Ni
`.render_radar_tabla` ni `.make_table_grob_ttb_style` ni `.dim_make_table_grob`
llegan a ejecutarse; las tres se descartaron instrumentándolas una por una.

**Dos coincidencias me hicieron perder tiempo, y las dos eran numéricas:**

- El default de firma de `graficar_radar` es `tabla_body_size = 12`, que es
  exactamente el valor que yo había puesto. Al instrumentar leí 12 y lo di por
  «mi cambio llegó», cuando era el defecto. Lo que delataba el error estaba en
  la misma línea: `header` salía 14 y yo había declarado 12.
- Probé mover los campos a `$args` con un valor inconfundible —26 pt— y no
  apareció. Esa prueba es la que descartó la hipótesis en un intento; hacerla
  antes habría ahorrado los dos anteriores. **Un valor de prueba imposible de
  confundir vale más que tres mediciones del valor real.**

El arreglo, cuando toque, es que `base_size` salga del preset en vez de estar
escrito. El `.pulso` quedó restaurado a su estado previo: el cambio a 12 se
revirtió porque era inerte y el de 26 era una sonda.

### V2 cerrada: el preset del radar llegaba vacío y el error era invisible

Dos fallos encadenados, y el segundo tapaba al primero:

1. **`radar_publicos` no estaba en el mapa de presets por tipo.** El modo
   `publicos` tiene su propio `etype` y recibía la lista vacía.
2. **`do.call(graficar_radar, args)` abortaba con «unused arguments».** El
   preset llega con el estilo base ya fusionado —`preservar_tamanos_texto`,
   `size_texto_barras`, `size_titulo_slide`, `size_cuerpo_slide`—, que son de
   los graficadores de barras. Una sola clave ajena mata la llamada entera.

Y lo que lo volvía indetectable: **el despachador reintenta sin `preset_args`
cuando el renderer falla**. La lámina salía igual, con los defectos del
graficador y sin ninguna de las catorce claves `tabla_*` del proyecto. No había
error que mirar, sólo una tabla que no obedecía. Un fallback silencioso convierte
un fallo de configuración en un misterio de render.

Con las dos cosas arregladas, el texto bajo el cuerpo mínimo cae del **9.4 % al
6.1 %** —el aprobado está en 6.2 %— y el verificador pasa a **0
incumplimientos**, contra los 6 del entregable aprobado.

### Todo en centímetros

Guía y verificador pasan a cm. El motor calcula en pulgadas —es la unidad de
`officer` y del OOXML— pero quien lee un plano compara contra una regla, y
obligarle a convertir cada cifra es justo el trabajo que la guía existe para
ahorrar. La conversión se hace una vez, en el borde.

El cuerpo del texto se queda en **puntos**: es como se declara en todas partes y
como lo escribe el .pptx (`sz` en centésimas). Pasarlo a cm no lo haría más
comparable con nada. La geometría se mide con regla; la tipografía, no.

### La guía ahora acota lo que el recetario pide

Cada caja del plano lleva su tamaño en cm, el **cuerpo del texto en pt** y, en
el área de barras, el **grosor de la barra en cm**. Eran las tres medidas que
había que sacar del XML con el archivo ya exportado —`sz=` en centésimas de
punto, alturas en EMU— y ahora las dice la propia lámina.

## Revisión del mazo completo (2026-08-16)

Regenerado PPT + Word de punta a punta. **El verificador da 0 incumplimientos
contra los 6 del entregable aprobado**, y las medidas de fondo coinciden o
mejoran:

| | Aprobado | Motor |
|---|---|---|
| Incumplimientos | 6 | **0** |
| Grosor de escala, mediana | 1.30 cm | **1.30 cm** |
| Grosor de escala, mínimo | 0.49 cm | **0.82 cm** |
| Máximo de barras por gráfico | 7 | **7** |
| Texto bajo 12 pt | 6.2 % | **6.1 %** |
| Láminas con Top Two Box | 40 | **39** |
| Naranja en la rampa | 213 | 180 |

Las 7 láminas de más son las continuaciones, todas marcadas «(CONT.)».

### L19 — lo que la vara no miraba: los enunciados se recortan

**18 enunciados salen recortados y 11 pierden más de la mitad; de media se
muestra el 42 %.** El peor caso enseña **1 de 9 líneas**. El entregable
aprobado muestra ese mismo enunciado **entero**, así que no es una limitación
del formato.

Y no es falta de ancho: el proyecto declara `canvas_w_grupo = 0.22` y el
aprobado usa el 19 % para esa columna —el motor tiene *más* sitio—. Es falta de
**alto**: el aviso lo dice literalmente, «el bloque tiene 1 fila y el texto
necesita 9 líneas». El motor ata el alto del enunciado al número de públicos de
esa premisa, así que una premisa preguntada a un solo público dispone del alto
de una barra para un texto de nueve líneas. El aprobado le da al enunciado un
alto propio.

Esto **no lo veía ninguna vara**: V1–V8 miden geometría, tipografía y color, y
un texto truncado pasa todas. Es el recordatorio de que el verificador declara
seis reglas sin cubrir, y «0 incumplimientos» significa «cumple lo que se mide».

### Otros dos, menores

- **7 láminas se generan sin su ícono**: el `.pulso` no trae el PNG de
  `318ecf24`. Es dato del proyecto, no del motor.
- **El rótulo de la columna difiere**: el motor escribe «Top 2 Box» y el
  aprobado «TOP TWO BOX». Cosmético, pero es lo que hizo que una medición mía
  contara 0 columnas en el aprobado cuando tiene 40.

### L19, primera pasada: el diagnóstico era medio equivocado

Escribí que el alto del enunciado estaba «atado al nº de públicos». Medido, la
mitad de eso es falso: **`alto_rel = 1.000` en 22 de los 25 recortes**, o sea
que casi ninguno comparte lámina con otro bloque. El reparto de altura entre
bloques no es la causa.

La causa es más simple: **el cupo era la constante `3` líneas por fila**,
calibrada contra el alto por defecto (0.42 in). Y el motor **ya ensancha la
fila** cuando las etiquetas de eje lo piden —hasta 1.06 in, vía
`needs_tall_label_slot`— sin que el cupo se entere.

Cerrado en esta pasada: el cupo se deriva del alto real, con el cuerpo y el
interlineado que de verdad se dibujan. Con 0.42 in da exactamente 3 —el mismo
número que la constante, así que no hay regresión encubierta— y con 1.06 in da 6.

**Lo que falta, y por qué no cierra todavía**: los 18 recortes del estudio no se
mueven, porque en sus láminas la fila no crece. Ninguna activa
`needs_tall_label_slot`, que hoy sólo mira las etiquetas del eje Y. Falta que el
**enunciado** también pueda pedir fila alta. Eso ya cambia la composición de
todas las láminas de escala, así que se mide aparte antes de tocarlo.

### L19, segunda pasada: el redondeo se comía una línea de cada cuatro

Medido con el cupo ya derivado: la fila del mazo mide **0.62 in** y a 13 pt
caben **3.99 líneas**. `floor` devolvía 3. Se perdía una línea entera por un
0.25 % de diferencia, con el interlineado siendo una estimación y no una medida
—y eran **25 de los 33 recortes**, todos en ese mismo caso.

Con un margen de 0.05 al contar: recortados **18 → 15**, los que pierden más de
la mitad **11 → 7**, y el texto mostrado sube del 42 % al **51 %**. El margen no
regala nada: a 16 pt esa misma fila sigue dando 3. Ninguna vara se mueve y el
texto bajo el cuerpo mínimo incluso baja al 6.0 %.

**Lo que falta para cerrar, ya medido**: los 15 que quedan necesitan hasta 9
líneas —1.40 in— y su fila da 0.62. La salida es **alto variable por premisa**, y
hay sitio: cuatro premisas de una fila ocupan 2.48 in de las 3.62 del panel, así
que sobra un 31 %. Repartir ese sobrante entre las premisas que lo piden es un
cambio en el reparto vertical, y toca medirlo aparte antes de tocarlo.

### L19 cerrado: el aprobado no los muestra enteros, los desborda

Tres mediciones, cada una desmintiendo la anterior:

1. **«El alto está atado al nº de públicos.»** Falso: `alto_rel = 1.000` en 25 de
   33 recortes.
2. **«El aprobado usa alto variable por premisa.»** También falso, y el error
   fue mío: medí el coeficiente de variación de los huecos entre barras, que
   mezcla el salto *entre* grupos con el de *dentro*. Un grupo de cuatro
   públicos junto a uno de un público ya produce huecos desiguales sin que haya
   alto variable. Midiendo lo que importa —la dispersión del grosor dentro de
   cada lámina— salen **0 de 38 en el aprobado y 0 de 37 en el motor**: ninguno
   lo usa.
3. **Lo que sí hace el aprobado**: su caja de enunciado mide **6.48 × 0.35 cm**
   y contiene 160 caracteres a 12 pt. En 0.35 cm cabe **una línea** y el texto
   necesita cinco. **No los ajusta: los deja desbordar la caja.**

Y el motor recorta precisamente porque eso ya falló: el comentario de
`.barras_acotar_titulo_grupo()` lo documenta —«los títulos de tres bloques
seguidos se escribían unos encima de otros y quedaban ilegibles»—. Desbordar
funciona cuando debajo hay hueco y produce texto encimado cuando no.

**Así que no es un defecto del motor, y la premisa con la que abrí L19 era
equivocada.** El motor elige recortar y avisar —con el enunciado completo en el
aviso— en vez de arriesgar superposición. Lo que sí se pudo mejorar, y se hizo,
es cuánto muestra antes de cortar: del 42 % al 51 %.

Queda como decisión del analista, no del motor: acortar los enunciados —el plan
promedia 103 caracteres contra los 90 del aprobado, y el 51 % pasa de 90— o
aceptar el recorte, que va avisado.

### V9 cerrada, y el denominador estaba inventado

«10 recetas de 18 familias» mezclaba dos cosas. **Siete de las diez recetas son
transversales** —tipografía, color de escala, posición del título, arranque
vertical, color del texto, interlineado, y el criterio de partir la lámina—: se
aplican a cualquier familia. Sólo tres hablan de una familia concreta.

Y el denominador tampoco eran 18. **Contabilidad usa tres familias**:
multiapiladas (42 láminas), agrupadas (20) y circulares (4). Las tres tienen su
receta. **V9 cierra en 3 de 3.**

El motor dibuja además un **radar** en dos láminas, y ahí no hay nada que medir:
el entregable aprobado **no tiene ninguna** —2 láminas suyas llevan `custGeom`,
pero de 4 y 2 geometrías, contra las 16-17 de un radar—. El radar lo añade el
plan actual, no el modelo.

**Las otras catorce familias del motor no aparecen en Contabilidad.** Su receta
no puede salir de este estudio: hace falta otro entregable aprobado que las use,
o se escriben por criterio y entonces no son medición. Queda como **L22
bloqueado**, no como pendiente: pendiente sugiere que basta con ponerse, y aquí
falta el modelo.

### V11 avanza: dos reglas más medidas, y una destapa un incumplimiento

De las seis que el verificador declaraba sin cubrir, dos eran perfectamente
medibles y ya lo están:

- **R4, rojo en la rampa.** Umbral cero, porque el aprobado tiene cero. El rojo
  institucional no está prohibido —pinta 67 títulos suyos— pero no puede ser el
  extremo negativo de una escala, y el criterio que los separa es la vecindad:
  es rampa cuando el color siguiente es el amarillo.
- **R7, posición del título.** Umbral 0.78 cm, el percentil 10 del aprobado
  (mediana 0.90).

**Y R4 destapa un incumplimiento que nadie veía: el motor deja 4 láminas con
rojo en la rampa.** L3 lo bajó de 270 a 97 y los 97 restantes se dieron por
títulos sin comprobarlo uno a uno; cuatro no lo eran.

El aprobado, en cambio, falla **R7 cuatro veces** —láminas cuyo título arranca
por encima de su propio percentil 10—. Eso es exactamente lo que hace útil medir
contra el entregable y no contra un ideal: el modelo tampoco es homogéneo, y
saber dónde no lo es evita perseguir una uniformidad que nadie pidió.

Quedan sin cubrir R6 (circulares), R8 (arranque vertical), R9 (color del texto)
y R10 (interlineado).

### Las 4 láminas de rojo: L3 dejó 14 paletas sin corregir

Medido: **14 de las 34 paletas del proyecto** seguían con `#CA5651` en su
extremo negativo, y **las 14 son rampas de escala** —lo confirma que todas
llevan también el amarillo—. L3 corrigió 23 listas y estas quedaron fuera.

Corregidas sólo esas 14, y verificando que los `color_titulo` de los presets no
se tocan: siguen los mismos 5 antes y después. El rojo en título es correcto
—el entregable aprobado lo usa en 67— y el criterio que los separa es el mismo
que ya se usó: es rampa cuando en la lista hay un amarillo.

**Rojo en rampa: 19 → 0. El motor queda en 0 incumplimientos contra los 10 del
aprobado.**

**Y una comprobación mía estuvo mal antes de llegar aquí**: busqué `"CA5651"` en
las paletas y me dio 0, porque el `.pulso` las guarda como `"#CA5651"` con
almohadilla mientras el XML las escribe sin ella. Di por limpio lo que no lo
estaba y estuve a punto de buscar la causa en el default del motor. Es el mismo
error que el `(cont.)` en minúscula: **comparar contra la forma en que yo lo
escribo, no contra la forma en que lo guarda quien lo guarda.**

### R9 destapa una regresión que introduje yo en L3

El recetario había dejado R9 abierto por no poder medirlo: «el método por forma
devuelve el color de relleno de la propia caja, no el del segmento que hay
debajo». Se resuelve **cruzando por posición** —qué segmento contiene el centro
de la caja de texto—, que es la única forma de saber sobre qué fondo cae.

Y lo que aparece es una regresión de la receta 4, que es mía: **al cambiar el
extremo negativo de rojo oscuro a naranja claro, las cifras blancas que se leían
sobre el rojo dejaron de leerse sobre el naranja**. Son **37 láminas**, y el
entregable aprobado tiene **cero**.

Es el peor tipo de defecto de los que llevamos: no lo veía ninguna vara, lo
introdujo un arreglo anterior que se dio por cerrado con evidencia —«rojo 270 →
97, naranja 0 → 173»—, y la evidencia era cierta. Cambiar un color de fondo
cambia qué color de texto encima se lee, y esa segunda mitad no se comprobó.

Queda como **L29**: el color del texto de barra tiene que salir del contraste
con su segmento, no ser blanco fijo.

**R10 sale de pendientes con su medición hecha**, no ignorada: los tres mazos
usan 100 % de interlineado y el recetario ya había concluido que no es la causa
de lo que se comentó. Se declara medido.

### L29 cerrado: el color de la cifra sale de su segmento

La decisión va por **luminancia**, no contra una lista de hexes claros: una
lista hay que mantenerla cada vez que alguien añade un color a una paleta, y el
día que se olvide vuelven las cifras invisibles sin que nada avise.

**Cifras ilegibles 134 → 0. Incumplimientos del verificador 37 → 0**, sin mover
ninguna otra vara.

Dos cosas costaron el intento, y las dos son del mismo tipo —código que parece
aplicado y no lo está:

1. **`colores_grupos` llega vacío.** El proyecto declara los colores por paleta
   de lista, no por ese parámetro. Hay que usar la paleta EFECTIVA, la misma que
   acaba en `scale_fill_manual`.
2. **Cinco pasos de acomodo posteriores reasignan `.col_label` al color fijo**
   cuando meten una etiqueta dentro de su barra. La primera versión recibía la
   paleta correcta, calculaba bien el contraste, y no cambiaba nada: se pisaba
   más adelante. Por eso el recoloreado va **al final** del pipeline.

Y hubo un susto por el camino que conviene anotar: al añadir el parámetro se
rompió el render entero —`object 'colores_grupos' not found`— y **las 63 láminas
salieron degradadas a «Sin datos»**. No se vio en el archivo: se vio porque el
mazo bajó de 931 KB a 816 y de 42 s a 24, y porque el verificador devolvió
`grosor_med = NA`. **Un mazo roto pesa menos y se genera antes**; esas dos
cifras valen como alarma antes de abrir nada.

### V10: el mapa de los 57, y dos cosas que el resumen escondía

Mapa completo en `mapa-comentarios-conta-2026-08-16.md`: cada comentario con su
regla y su evidencia medida.

**No son 57 de Gabriela.** Son **52 suyos, 4 de Renzo y 1 de Alice**. La
diferencia importa porque los de Renzo son de datos —variables que existen en
base pero no se preguntaron, una discrepancia con SPSS— y ninguno es de formato.

**Y la mitad no los resuelve ningún preset:**

| | Comentarios |
|---|---|
| Geométricos — los resuelve el motor | **28**, de ellos **20 cerrados** |
| No geométricos — contenido, datos o método | **29** |

Los 29 piden retirar láminas, añadir variables que no se preguntaron, corregir
un dato contra SPSS o reescribir un título. **Contarlos dentro del avance del
motor infla el porcentaje**: el motor puede quedar impecable y el informe seguir
teniendo la mitad de los comentarios abiertos. Son trabajo de analista, no de
graficador, y el mapa los marca ⛔ para que no se confundan con deuda técnica.

De los 8 geométricos sin cerrar: 2 son circulares (R6), 2 el arranque vertical
(R8) y 3 la separación entre premisas (B2) —las tres reglas que el verificador
aún no mide— y 1 es la variante de Top Two Box que suma 100 %, que es capacidad
nueva del motor.

### L30: el trade-off no existe, y las dos hipótesis eran falsas

Subir el aire entre premisas bajó B2 de 20 a 9 pero encogió el grosor de 1.30 a
1.22 cm, lo que parecía un canje inevitable: los dos se reparten el alto del
panel. Se probaron dos explicaciones y **ninguna se sostuvo al medirla**:

1. **«El aprobado tiene menos premisas por lámina.»** Falso: las distribuciones
   son casi idénticas —mediana 4 barras por gráfico, máximo 7, en los dos—. La
   carga es la misma, así que bajar `.PARTICION_MAX_BARRAS` no era la salida.
2. **«Hay que elegir entre grosor y separación.»** Tampoco:

| | Alto del bloque | Barras | cm por barra | Margen inferior |
|---|---|---|---|---|
| Aprobado | 10.26 cm | 4 | **2.18** | 3.81 cm |
| Motor | 9.29 cm | 5 | 1.86 | **5.69 cm** |

**El motor deja 1.88 cm de lámina sin usar.** Con 2.18 cm por barra caben los
1.30 de grosor y los 0.88 de hueco a la vez; con 1.86 hay que elegir. El
aprobado no aprieta mejor: **baja más**.

Así que L30 no se cierra subiendo el gap ni partiendo antes, sino **dando al
panel el alto que le sobra**. Es un cambio de geometría de la disposición y toca
medirlo aparte —el margen inferior no es decorativo en todas las láminas: en las
que llevan nota al pie o base, parte de ese espacio está ocupado.

### L30, corrección: el margen no estaba libre, estaba ocupado por la leyenda

Escribí que el motor «deja 1.88 cm de lámina sin usar». **Medí el espacio hasta
el borde sin comprobar qué había en medio**, que es la misma falla que ya costó
dos iteraciones en este GOAL con otras formas.

Lo que hay debajo de la última barra:

| | Qué ocupa el hueco | Hueco libre |
|---|---|---|
| Aprobado | la **Base** («Base: 52 docentes…») | 1.55 cm |
| Motor | la **leyenda** («Totalmente en desacuerdo»…) | 0.66 cm |

Y la diferencia está en dónde cae la leyenda: el aprobado la empuja hasta
**16.80 cm** del borde superior y el motor la deja en **14.10**. Son los 2.7 cm
que el panel del motor no puede usar —no porque estén ocupados por contenido,
sino porque la composición los reserva antes.

**No es que sobre espacio: es que la leyenda va colocada más arriba.** El
proyecto ya reserva poco para ella (`canvas_h_legend_in = 0.272`), así que el
mando no es esa reserva y bajar el panel sin entender el reparto entero
arriesga pisar la base. Queda para medir aparte.

Con el gap en 0.65, B2 baja de 20 a 9 y el grosor de 1.30 a 1.22 cm: es el
estado actual y no empeora ninguna vara, pero tampoco cierra.

### L30, cuarta pasada: el panel no usaba el alto que tenía

Tres diagnósticos fallidos y el cuarto, medido en el sitio correcto: el canvas
se construía con **filas × alto de fila** e ignoraba el hueco donde iba a caer.
Con un hueco de 6.00 in, una lámina de dos premisas dejaba **3.62 in sin usar**.

Ahí se perdían las dos cosas a la vez —grosor y aire—, que es por lo que
parecían competir entre sí: no competían por el alto del panel, competían por un
alto que el panel no estaba pidiendo.

| | Antes | Ahora | Aprobado |
|---|---|---|---|
| Hueco entre premisas | 0.97 cm | **1.74 cm** | 1.91 cm |
| Grosor de barra | 1.30 cm | 1.22 cm | 1.30 cm |
| Incumplimientos B2 | 20 | **4** | 0 |

Con el panel estirado, subir la separación deja de robar grosor, así que el gap
pasa de 0.65 a 0.85. Subir el tope de estirado de 1.8 a 2.4 **no cambia nada**:
el límite real no es ese sino el hueco menos lo que ya reservan cabecera,
leyenda y pie —el pie se lleva 0.85 in fijos—.

**Lo que costó llegar**: tres iteraciones persiguiendo explicaciones que no se
sostenían, y la última de ellas —«sobran 1.88 cm»— salió de medir el espacio
hasta el borde **sin comprobar qué había en medio**. Había leyenda. La medición
buena fue instrumentar el reparto del canvas y leer sus componentes, no deducirlo
del archivo generado.

### L31: el perfil salía multicolor porque la declaración nombraba lo que no existe

El entregable aprobado lleva **51 de 52** barras de perfil en el azul
institucional. El motor las sacaba con **cinco colores** de la paleta genérica.

La causa no era que faltara declaración: **la que hay no sirve**. El preset del
estudio declara seis colores con nombres genéricos —«Categoria_1», «Categoria_2»…—
que no coinciden con ninguna categoría real del perfil. No emparejan, el motor
cae a la genérica, y el resultado no eran ni los colores declarados ni los de la
casa. Ahora la declaración sólo manda si nombra los niveles que de verdad hay.

**Monocromo: `081F5C` × 56.**

### Y al pintarlas de azul aparece lo que estaba oculto

Los gráficos categóricos que el verificador **ve** pasan de **14 a 28** —el
aprobado tiene 25—, y con ellos **11 incumplimientos de grosor** que ya existían
y no se medían: el medidor reconoce las barras categóricas por su color, y la
mitad estaban pintadas de colores que no eran ninguno de los suyos.

**No es una regresión: es que ahora se ven.** Y es el segundo caso en este GOAL
en que arreglar el color destapa una medición que faltaba —el primero fue R9, con
las cifras blancas—. Queda como **L32**.

Conviene tenerlo presente al leer el marcador: el motor pasa de 4 a 15
incumplimientos sin que el mazo haya empeorado en nada.

### L32: no es el piso de grosor, es el mismo panel corto de L30

Los once gráficos categóricos bajo el piso **ya tienen la barra casi tan gruesa
como su fila permite**: fracciones de 0.75 a 0.93, con 0.93 pegando las barras
unas con otras. Subir el grosor no es una salida —no queda sitio dentro de la
fila—.

Lo que falla es el alto de la fila: **0.60 cm para trece barras**. Y la
comparación lo confirma:

| | Barras por gráfico | Grosor mediano |
|---|---|---|
| Aprobado | mediana **7**, máx 11 | 0.88 cm |
| Motor | mediana 4, máx 13 | 1.07 cm |

**El aprobado mete más barras y las saca más gruesas.** No aprieta mejor: su
panel es más alto, exactamente igual que en L30 —donde el canvas se construía
con filas × alto de fila e ignoraba el hueco—. Ese arreglo se hizo en apiladas y
**falta en agrupadas**, que es donde viven los perfiles.

Se añadió de paso el piso en centímetros a agrupadas (`grosor_min_in = 0.256`,
los 0.65 cm del percentil 10 del aprobado), igual que en apiladas. Hoy no se
activa —la fracción ya está al tope— pero entrará en cuanto el panel se estire y
haya sitio real que repartir.

### L32: el mismo panel corto, ahora en los perfiles

Portado a agrupadas el estirado que ya funcionaba en apiladas. Aquí pesa más:
los perfiles van de a cuatro por lámina y su hueco es un cuarto, así que el alto
natural se queda mucho más corto.

| | Antes | Ahora | Aprobado |
|---|---|---|---|
| Bajo el piso de 0.65 cm | 11 | **5** | 2 |
| Percentil 10 | 0.45 cm | **0.59** | 0.65 |
| Mínimo | 0.40 cm | **0.50** | 0.46 |

**El mínimo del motor ya supera al del aprobado.** El tope de estirado es 2.6 y
no 1.8 como en apiladas, y sale de medir: con 1.8 quedan 9 bajo el piso, con 2.6
quedan 5, y subir a 3.4 **no cambia nada** —a partir de ahí el límite ya no es el
tope sino el hueco disponible—.

Queda una diferencia que no es incumplimiento pero se aparta del modelo: el
máximo del motor es **2.42 cm** contra los 1.80 del aprobado. Sus barras
categóricas más gruesas lo son más de lo que el entregable se permite.
