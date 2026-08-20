# Checklist — las 19 preguntas que Ulises marcó en el XLSForm de ACNUR V3

**Abierto**: 2026-08-19 · **Cierra**: sólo Gonzalo.
Insumo: `PDM_MedVida2026/Preparaicon del 2do entregable/XLS Forms V3-Resaltado preguntas.xlsx`
y `ACNUR V3 (3).pulso` (guardado 2026-08-14, app **0.6.3**).
Estudio: PDM MedVida 2026 — preparación del **2.º entregable**.

## Por qué existe

Ulises marcó el instrumento en dos colores distintos y la diferencia importa:

- **15 preguntas resaltadas** = «no salen en el PPT».
- **4 preguntas comentadas pero **sin** resaltar** = «sí salen, pero el gráfico
  muestra números en vez de las etiquetas».

Son dos síntomas distintos con dos causas distintas, y ninguna de las dos es
«el analista no las incluyó». El listado se parsea entero antes de tocar código
porque el riesgo aquí no es arreglar mal: es perder un ítem de 19 por el camino.

## Diagnóstico — dónde vive cada causa

Medido corriendo el gate real de graficabilidad
(`prosecnurapp:::.graficos_graphable_reason`) sobre el instrumento adaptado del
proyecto, y comparando las listas `*_recod` del `.pulso` del 14/08 contra las
del `.pulso` regenerado el 15/08.

**Causa A — falso positivo del filtro de identificadores** (defecto vivo hoy).
`.graficos_is_identifier_like()` (`api/R/graficos_plan_coverage.R:887`) aplica
patrones de dato de contacto sobre `name + label` **concatenados**. Como la
etiqueta es prosa, cualquier pregunta cerrada que mencione *WhatsApp*, *empresa*
u *observaciones* queda clasificada como «identificador/contacto/texto
sensible» y no llega al mazo. Son 5 preguntas cerradas con 6 a 87 respuestas.

**Causa B — la lista `*_recod` heredaba el código como etiqueta** (ya reparado).
`.guess_label_col()` elegía la columna de etiqueta por nombre y no por
contenido; en este instrumento `label::Spanish (ES)` viene casi vacía y el texto
está en `label`. La recodificación copiaba etiquetas `NA` y su fallback las
reemplazaba por el propio código. Reparado el 2026-08-15
(`api/R/codificacion_aplicar_instrumento.R:7`, el comentario cita este mismo
estudio). El `.pulso` que usó Ulises es del 14/08 y trae el daño horneado.

**Causa C — el mazo no grafica numéricas ni fechas.** `integer` y `date` caen en
«tipo no graficable». El motor tiene `graficador_barras_numericas.R`, pero el
auto-plan no tiene camino para meter una numérica *cruda*. Es brecha de
capacidad, no defecto — y **la salida ya existe y ya se usó en este estudio**:
tramificar la numérica en Codificación. `MesesReva` tiene su `MesesReva_recod`
(«Hasta 1 mes» / «De 2 a 3 meses» / «4 meses o más», 85 de 101 casos) y el gate
la da como graficable. Lo que falta en los ingresos no es motor: es la misma
recodificación en tramos.

**Causa E — el `.pulso` del 2.º entregable está una generación atrás.** Los dos
instrumentos difieren en exactamente una recodificación:

```
2do entregable   ACNUR V3 (3).pulso   14/08  v0.6.3   13 variables *_recod
1er entregable   ACNUR_V3_final.pulso 15/08  v0.8.0   14 variables *_recod
solo en el 15/08:  MesesReva_recod
```

Es decir: el 2.º entregable no se debe preparar sobre `ACNUR V3 (3).pulso`. El
`.pulso` bueno es `Primer entregable/regenerado-14-08/ACNUR_V3_final.pulso`, que
trae a la vez las etiquetas reparadas del bloque 2 y la tramificación de meses.

**Causa D — abiertas sin codificar o casi sin respuestas.** Comportamiento
correcto; se documenta para poder responderle a Ulises.

## Las 19, una por una

### Bloque 1 — resaltadas: «no salen en el PPT» (15)

| | Fila / variable | Tipo | Casos | Causa | Estado |
|---|---|---|---|---|---|
| 1.1 | 31 · `Ocupation` — ocupación previa | text | 4 | D — abierta cruda, no codificada | ☐ pendiente · decisión de Ulises (4 casos) |
| 1.2 | 32 · `PastSalary` — ingreso previo | integer | 4 | C — tipo no graficable | ☐ **bloqueado** · exige decisión de producto |
| 1.3 | 50 · `WhatsAppGroup` | select_one | 16 | **A** — «whatsapp» en la etiqueta | ☑ **reparado** |
| 1.4 | 51 · `UtilityWhatsAppGroup` | select_one | 15 | **A** — «whatsapp» en la etiqueta | ☑ **reparado** |
| 1.5 | 80 · `ProcessSatisfaction` | select_one | 16 | **A** — «empresa» en la etiqueta | ☑ **reparado** |
| 1.6 | 87 · `NowSalary` — ingreso actual | integer | 16 | C — tipo no graficable | ☐ **bloqueado** |
| 1.7 | 104 · `ExpSatisfaction_why` | text | 0 | D — sin respuestas | ☑ correcto que no salga |
| 1.8 | 113 · `GeneralSatisfaction_why` | text | 1 | D — 1 respuesta | ☑ correcto que no salga |
| 1.9 | 115 · `RecomendSatisfaction_text` | text | 0 | D — sin respuestas | ☑ correcto que no salga |
| 1.10 | 133 · `date_reva_sit` — fecha de resultado | date | 69 | C — tipo no graficable | ☐ **bloqueado** |
| 1.11 | 134 · `MesesReva` — duración del trámite | integer | 87 | C — tramificada en el `.pulso` del 1.º | ☑ **en el mazo del 19/08** (lám. 90) |
| 1.12 | 136 · `revaDificults_other` | text | 5 | D — integrada en `revaDificults_recod` | ☑ correcto que no salga |
| 1.13 | 137 · `reva_Tram_obs` | select_one | 6 | **A** — «observaciones» en la etiqueta | ☑ **reparado** |
| 1.14 | 166 · `Equi_barrera_other` | text | 3 | D — integrada en `Equi_barrera_recod` | ☑ correcto que no salga |
| 1.15 | 174 · `Sos_empresa` | select_one | **87** | **A** — «empresa» en la etiqueta | ☑ **reparado** |

### Bloque 2 — sin resaltar: «salen, pero sin etiquetas» (4)

| | Fila / variable | Tipo | Casos | Causa | Estado |
|---|---|---|---|---|---|
| 2.1 | 135 · `revaDificults` → `revaDificults_recod` | select_multiple | 87 | B | ☑ **en el mazo del 19/08** (lám. 91) |
| 2.2 | 165 · `Equi_barrera` → `Equi_barrera_recod` | select_multiple | 83 | B | ☑ **en el mazo del 19/08** |
| 2.3 | 170 · `Sos_desarrollo` → `Sos_desarrollo_recod` | select_multiple | 87 | B | ☑ **en el mazo del 19/08** |
| 2.4 | 178 · `RevB_barriers` → `RevB_barriers_recod` | select_multiple | 42 | B | ☑ **en el mazo del 19/08** |

Evidencia del bloque 2 — `revaDificults_recod` en los dos `.pulso`:

```
14/08 (0.6.3)   1→"1"  2→"2"  3→"3"  4→"4"  5→"5"  6→"6"  96→"96"  97→"97"
15/08 (0.8.0)   1→"Tiempos largos de espera"  2→"Observaciones al expediente" ...
```

El `.pulso` regenerado que ya tiene las etiquetas buenas es
`Primer entregable/regenerado-14-08/ACNUR_V3_final.pulso`.

## Medición del arreglo de la causa A

Gate corrido sobre las 125 preguntas cerradas del instrumento adaptado:

```
cerradas totales                                125
descartadas hoy por «identificador»               5   ← las cinco de Ulises, ni una más
abiertas que seguirían descartadas                3   telephone, empresa_ppl, note_vinculacion
```

Eximir a las preguntas cerradas del filtro de identificadores recupera
exactamente las cinco marcadas y no deja entrar ninguna otra. Los tres campos de
contacto reales son `text` y siguen fuera.

**Reparado** en `.graficos_graphable_reason()`
(`api/R/graficos_plan_coverage.R`): el filtro de identificadores ya no alcanza a
`select_one` / `select_multiple` ni a una recodificada con catálogo. El control
operativo (`.graficos_is_operational_metadata()`) sigue mandando sobre las
cerradas, así que `Consent` y `testreal` continúan fuera.

Evidencia:

```
gate sobre el instrumento real   5 cerradas descartadas  →  0
test-graficos-plan-coverage.R    148 pass / 0 fail  (rojo al revertir: 10 fallos)
11 suites vecinas de plan/ACNUR  400 pass / 0 fail
```

## Que el motor no las vuelva a cometer

Reparar las causas no bastaba: la falla de fondo era que **el motor descartaba
con datos en la mano y no lo decía**. El popover de cobertura agrupaba todo bajo
«No graficables», truncado a ocho filas, así que `Sos_empresa` con 87 respuestas
y un campo `telephone` vacío caían en la misma bolsa gris. Nadie se enteró hasta
que un analista comparó el XLSForm con el PPT a mano.

`api/R/graficos_descartes_avisados.R` agrega dos detecciones al canal de avisos
de cobertura, que el popover ya pinta:

**D1 · descartes que no deberían haber pasado en silencio.** Sin umbral de
casos —el umbral era justo lo que dejaba fuera a `reva_Tram_obs`, con 6
respuestas, mientras avisaba de `Sos_empresa`, con 87. Dos familias
deterministas: una **pregunta cerrada** descartada por algo que no es control
operativo (nunca es correcto: su respuesta es la lista de opciones), y una
**numérica con datos** (descarte legítimo, pero con salida conocida). El aviso
dice la causa y qué hacer: «tramifícala en Codificación —crea `X_recod`—».

**D2 · catálogos que saldrían numerados.** Una lista cuyas etiquetas son sus
propios códigos produce el eje «1, 2, 3, 96, 97». Criterio: al menos **dos**
opciones con etiqueta igual al código y al menos la mitad de la lista. Los dos
filtros hacen falta —sin el de dos, `Yes_no` dispara porque «No» se etiqueta
«No»; sin el de la mitad, una categoría suelta bastaría.

Medido contra los dos instrumentos reales del estudio:

```
instrumento 14/08 (roto)       8 avisos   3 numéricas sin tramificar
                                          5 catálogos numerados
instrumento 15/08 (reparado)   2 avisos   PastSalary y NowSalary
ruido en ambos                 0
```

Los 5 catálogos incluyen `UNCHR_improving_recod`, que **no está en la lista de
Ulises**: la revisión a mano encontró 4 de 5. Ese quinto es la medida de para
qué sirve la detección.

La primera versión de D1 traía una tercera familia («motivo no previsto») como
red de seguridad: producía 20 avisos, 11 de ellos metadata del formulario
—`start`, `end`, campos `calculate`, los identificadores reales—. Se retiró. Las
fechas también quedan fuera del aviso a propósito: `date` cubre por igual la
fecha del resultado de un trámite y `mand_Date`, la marca de tiempo de la
entrevista, y avisar de una obligaba a avisar de la otra. Un aviso que hay que
aprender a ignorar deja de ser un aviso; `date_reva_sit` queda en la cola, abajo.

Evidencia: `test-graficos-descartes-avisados.R` (18 asserts) · 16 suites de
gráficos y codificación, **707 pass / 0 fail**.

## El mazo regenerado — 2026-08-19

Generado con `ACNUR_V3_final.pulso` (15/08, v0.8.0), que es el `.pulso`
consistente: trae las etiquetas reparadas y `MesesReva_recod`. Perfil
`acnur_kobo_cruncher_plus`, plantilla `acnur_16_9`.

```
láminas                134
tamaño                 668 KB
avisos del render      0
paquete OOXML          zip íntegro · 0 <a:cs> mal ordenados · 0 content-types de más
```

Las once preguntas del checklist están en el plan y en el mazo. Verificadas
leyendo el texto real del XML de las láminas —los gráficos son formas OOXML
nativas, no imágenes, así que las etiquetas se leen directamente:

| Lámina | Contenido leído del XML |
|---|---|
| 91 | «Tiempos largos de espera», «Observaciones al expediente», «Costos del proceso»… — **texto, no códigos** |
| 90 | «Hasta 1 mes» 51% · «De 2 a 3 meses» 40% · «4 meses o más» 9% · N = 85 de 101 |
| 123 | `Sos_empresa`: Sí 69% · No 28% · No sabe 2% · N = 85 de 101 |

Entregado en `Preparaicon del 2do entregable/ACNUR_V3_mazo_regenerado_2026-08-19.pptx`.

**Aviso preexistente que el motor levantó y no se tocó**: «La recodificación
aplicada de "¿Por qué motivo no participó en el Censo Nacional 2025 del INEI?"
difiere del catálogo actual (categorías cambiadas); vuelve a aplicarla».
Es el recod gate sobre `WhyNoCenso`, ajeno a este lote.

## El título de lámina volvía en terracota Pulso — 2026-08-20

Al comparar contra el mazo de referencia de Ulises (plantilla anterior) aparecen
**112 títulos en `#CA5651`**, el terracota de Pulso, donde el formato ACNUR pide
el negro institucional `#1A1A1A`.

**Causa.** `color_titulo_slide` (título de lámina, separadores de sección y
portada) se separó en algún momento de `color_titulo` (título del gráfico) para
poder moverlos por separado — el comentario en `graficos_metadata.R:2044` lo
documenta. La clave nueva **no se propagó al perfil ACNUR**, que declara
`color_titulo` y no `color_titulo_slide`, así que el motor caía a su default
Pulso (`reporte_plan_ppt.R:7955`). El perfil de acreditación sí la tenía.

Es exactamente el mecanismo que se sospechaba: una mejora del mazo general que
no se separó del formato independiente. Pero **no** es una degradación amplia
del preset ACNUR: el resto de su identidad —azul `#0072BC`, sentence case,
elemento gráfico por lámina— estaba intacta.

**Reparado** añadiendo `color_titulo_slide = .ACNUR_PPT_COLORS$text` al preset
`base` del perfil. Dos tests en `test-graficos-metadata.R`: uno estructural
—todo perfil que declare `color_titulo` debe declarar `color_titulo_slide`, para
que el próximo perfil no repita el hueco— y uno que fija la paleta del perfil
ACNUR y prohíbe que sus `color_*` sean de la paleta Pulso.

**Además**, defensa en profundidad: la plantilla `plantilla_acnur_16_9.pptx`
declaraba `#CA5651` en el placeholder de título de 31 de sus 35 layouts (241
sustituciones a `#1A1A1A`). No era la causa —el motor escribe el color en la
lámina y pisa al layout, verificado regenerando— pero una plantilla ACNUR que
lleva pintado el color de Pulso es una trampa para el siguiente cambio.

```
                        CA5651   1A1A1A   0072BC   18375F   títulos 24pt
referencia (Ulises)          0     2344      598      258   1A1A1A ×1718
antes                      112      640      539      266   CA5651 ×112
después                      0      752      539      266   1A1A1A ×112
```

### Cobertura de variables del mazo final

```
cerradas del instrumento                   125
resueltas en el plan                       122
ausentes                                     3   testreal · Registered_person_available · Consent
                                                 (control operativo, correctamente fuera)
pares cruda/_recod                          14
grafican la codificada                   14/14   ninguna lámina usa la variable cruda
```

Entregado en `Preparaicon del 2do entregable/ACNUR_V3_mazo_FINAL_2026-08-20.pptx`
(134 láminas, paquete OOXML sano).

**Fuera de alcance por decisión de Gonzalo — lo revisa Ulises**: las tres láminas
de «Contenido» llevan su título en `#081F5C` (azul Pulso) sobre el layout
`Title and Content`; la portada y la tabla también quedan pendientes. Y 16
`#CA5651` siguen en la plantilla fuera de los títulos (Contraportada, Índice,
Objetivos_Secciones, General Objective), sin efecto en las láminas renderizadas.

## Validación del mazo contra la base — 2026-08-20

### El estudio tiene dos poblaciones, y el pie las denomina sobre una sola

`proyecto_ppl` parte los 101 casos en dos rutas que **responden cuestionarios
distintos**, sin un solo caso en común:

```
Homologación Laboral   85 casos   (SUNEDU 81 · MINEDU 4)
Vinculación Laboral    16 casos   (Independiente 15 · MTPE 1)
cruce con PastWorking  85/0 y 0/16 — reparto perfecto
```

De las 112 variables graficadas, **107 pertenecen a una sola ruta**: 43 solo a
Homologación, 64 solo a Vinculación, 5 a ambas. El pie declara «N = X de 101»
en todas, así que el denominador es el de la muestra entera y no el de la
población que efectivamente respondió esa pregunta.

El caso que lo destapó, `sector`:

```
en el mazo    N = 4 de 101 (4.0%)
lo correcto   4 de 16 de Vinculación Laboral (25.0%)
```

Los 4 son reales —de los 16 de Vinculación, solo 4 trabajaban antes del
programa— y el 50%/50% entre Comercio y Servicios es exacto sobre esos 4. Lo que
engaña es el 4.0%.

Es la veta de [[feedback_una_palabra_para_dos_cosas]]: un mismo rótulo, dos
denominadores. **Queda abierto**: exige decidir si el pie declara la base de la
ruta, si el mazo se parte en dos secciones por `proyecto_ppl`, o ambas.

### La aritmética sí está bien

Recomputadas las 112 láminas desde la base, comparando cada porcentaje del XML
del PPT contra el recuento:

```
láminas comparadas                    112
porcentajes que coinciden             112
discrepancias                           0
```

Las 7 que fallaron en la primera pasada eran multi-respuesta —el comparador
contaba combinaciones («1 96») como categorías en vez de opciones marcadas—.
Recontadas por opción, las 7 coinciden. El error era del comparador.

### El título llevaba la palabra «recodificada»

`.pulso_repair_parent_recod_xlsform()` reconstruye la fila `<var>_recod` cuando
falta y le anexaba « recodificada» a la etiqueta. Ese sufijo viajaba al **título
de la lámina** del PPT —texto de entregable, que va al cliente—. Las 12 `_recod`
que crea la codificación normal copian la etiqueta de la madre tal cual; solo
las 2 que reconstruía este reparador (`sector`, `HelpChannel`) salían marcadas.

Reparado en dos partes: el reparador ya no anexa el sufijo, y **limpia
retroactivamente su propia huella** —solo cuando la etiqueta es exactamente la
de la madre más « recodificada», que es una forma que no escribe un analista—,
para que un `.pulso` guardado antes del arreglo se corrija al reabrirse. Un test
comprueba que una etiqueta escrita a mano que mencione la palabra no se toca.

```
antes    ¿En qué sector trabajaba antes del programa? recodificada
después  ¿En qué sector trabajaba antes del programa?
```

### Estado del mazo entregado

```
láminas                     134
«recodificada» en el mazo     0
títulos en #1A1A1A          112   (0 en terracota Pulso)
porcentajes verificados     112/112
paquete OOXML               zip íntegro · 0 <a:cs> mal ordenados
```

## El denominador sale del instrumento — 2026-08-20

**Decisión de Gonzalo**: solo el denominador, con mejor redacción; el mazo espera
al arreglo. Público como entidad editorial (secciones, ficha técnica) queda
fuera de esta tanda.

**El instrumento ya declaraba el público.** El `relevant` acumulado —propio más
el de los grupos que la contienen— de cada pregunta lo dice literalmente:

```
MesesReva   ${Consent}='Yes' and ${proyecto_ppl}='Homologación Laboral'
PastWorking ${Consent}='Yes' and ${proyecto_ppl}='Vinculación Laboral'
sector      ${Consent}='Yes' and ${proyecto_ppl}='Vinculación Laboral' AND ${PastWorking}='1' or …
```

151 de 169 preguntas lo traen, y `sector` muestra las dos capas: el público
(Vinculación, 16) y el filtro interno (trabajaba antes, 4).

**Y Prosecnur ya sabía evaluarlo.** No hubo que construir motor:
`build_group_gate_map()` acumula los gates de grupo, `odk_parse_to_ast()` parsea
el `relevant` y `ast_to_r()` lo compila. Validación deriva de ahí sus 265 reglas
`skip`. Gráficos no lo consultaba: ponía `total <- nrow(data)` y calculaba un
`eligible_known` que **no consumía nadie** —variable muerta desde que se
escribió—. `graficos_base_elegible.R` cierra ese hueco.

(`universe_filter` suena a esto por el nombre pero no sirve: separa casos reales
de pruebas para excluirlos, no describe públicos que conviven.)

### La redacción

El porcentaje ahora es **tasa de respuesta entre elegibles**, que informa; el
anterior era la fracción de la muestra total, que engañaba. Cuando todos los
elegibles respondieron no se escribe: un «(100%)» solo agrega ruido.

Formato **único**, sin prefijo: `<n> respuestas de <público> (<pct>%)`. Que unas
láminas traigan porcentaje y otras no obliga al lector a preguntarse por qué.

```
antes    N = 4 de 101 (4.0%).
después  4 respuestas de Vinculación Laboral (100%).

antes    N = 12 de 101 (11.9%).
después  12 respuestas de Vinculación Laboral (75%).

sin público identificado   45 respuestas de la muestra total (44.6%).
sin universo derivable     101 respuestas.
```

`Consent` se descarta al nombrar el público: es un requisito de participación,
no un público. Y si el `relevant` degrada a `odk_raw` —el parser no lo entiende—
no se inventa universo: se conserva el denominador anterior.

### El mazo entregado

```
láminas                      134
pies con «N = … de 101»        0   (antes: 107)
pies con prefijo «Base:»       0
pies en formato estándar     105
«recodificada»                 0
títulos en #1A1A1A           112   (0 terracota)
porcentajes verificados    112/112
paquete OOXML                zip íntegro · 0 <a:cs> mal ordenados
```

Evidencia: `test-graficos-base-elegible.R` (15 asserts) · 9 suites, 1 543 pass /
0 fail.

## Cola — lo que aún no se decide

- **L1 · numéricas y fechas en el mazo (ítems 1.2, 1.6, 1.10).** `MesesReva` ya
  salió de esta cola: se tramificó en Codificación y el gate la acepta. Quedan
  `PastSalary` y `NowSalary` (ingreso previo y actual) y `date_reva_sit` (fecha
  del resultado, 69 casos). Para los ingresos la vía corta es la misma que ya se
  usó con meses —tramos en Codificación— y sólo hace falta decidir el corte. Lo
  que sigue abierto de fondo es si el auto-plan debe **proponer** una lámina para
  una numérica cruda (histograma, media/rango) o seguir exigiendo que el analista
  la tramifique antes.
- **L2 · `Ocupation` (ítem 1.1).** Ulises la dejó sin codificar por tener 4 casos.
  Si el 2.º entregable la necesita, se codifica; si no, se responde eso.
