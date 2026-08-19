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
