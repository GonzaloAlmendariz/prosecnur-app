# Checklist — Criterios de curso-horario: el nivel global se retira

Tipo: Checklist QA
Estado: En curso
Fecha: 2026-08-25
Autoridad: Documento vivo de la tanda; sólo Gonzalo lo da por cerrado

Pestaña `marco-ch-radiografia` («Cursos-horario: criterios + radiografía»),
sección Marco del desk universitario de `calc-muestra`.
Rama de trabajo: `trabajo/criterios-ch-dos-niveles`, sobre
`rescate/graficos-lote-nueve` (f6c0df52).

## Qué se reportó y qué se midió

Gonzalo, 2026-08-25 sobre `HSVG26DEF.pulso`: la pantalla apila
`CriteriosMarcoTab scope="aula"` (regla común) y `CursosHorarioMarcoTab`
(excepciones por facultad) con dos encabezados del mismo nivel. Esperaba sólo el
bloque por facultad y temió que los criterios hubieran dejado de aplicarse por
facultad.

Medido en pantalla, viewport 1440×1000, proyecto real con marco construido:

| Medida | Valor |
|---|---|
| Alto del bloque global (`calc-muestra/criterios`) | **5.040 px** (~8,4 pantallas de 599 px) |
| Barras de acción idénticas en la misma pantalla | **2** (`.cmv2-crit-apply`, mismo texto y mismo botón) |
| Tarjetas del bloque global que no declaran nada | **6 de 8** («no filtra» / «sin filtro») |
| Controles interactivos dentro del `<button>` de recálculo | **15**, aplastados a 36 px con `overflow:hidden` |
| Scroll total de la pestaña | 17.832 px |

**El hallazgo que decide el rumbo**: el ADR 0057 (aceptada, 2026-08-02), regla 1,
dice literal «**Todos los criterios son por facultad. No existe el criterio
general.**» El bloque global lo reintrodujo el commit `878916dd` — con motivo
legítimo: el preset HST 2025 dejaba cuatro variables de curso pendientes sin
superficie que las confirmara. La reparación correcta no es rotular mejor ese
bloque, sino devolver esa capacidad al bloque por facultad y retirarlo.

Decisión de Gonzalo en esta sesión: **retirar el nivel global**, y reparar los
tres defectos verificados.

## Ítems

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Retirar el montaje `CriteriosMarcoTab scope="aula"` de la pestaña | `UniversidadDesk.tsx:680` | **hecho** — verificado: 1 barra de acción (era 2), scroll 12.783 px (era 17.832) |
| 2 | El preset HST 2025 sigue disponible y confirmable **en esta pestaña** | `CursosHorarioMarcoTab.tsx` barra de acción | **hecho** — visible, 390×28, fuera de todo `<button>` |
| 3 | `enrolled_total` no queda huérfano | — | **cerrado sin tocar código**: G40 ya lo había retirado a propósito («su decisión la toma Mínimo de alumnos elegibles, que sí tiene valor por facultad»). Retirar el bloque global *restaura* esa decisión |
| 4 | `SaludCriteriosCard` viaja a la pestaña de aula | `CursosHorarioMarcoTab.tsx` | **hecho** — no pinta en este proyecto porque devuelve `null` sin filas (C5 categoría 1, vacío legítimo) |
| 5 | `FacultadesExcluidasCard` sale de dentro del `<button>` | `CursosHorarioMarcoTab.tsx` | **hecho** — 0 controles interactivos dentro del botón (eran 15) |
| 6 | La tabla «Por facultad» alinea sus columnas (`subgrid`) | `criterios.css` | **hecho, NO verificable en pantalla** — ver «consecuencia» abajo |
| 7 | El estado de fila deja de imprimir la etiqueta cruda | `TipoSesionPorFacultad.tsx` | **hecho, NO verificable en pantalla** — ver «consecuencia» abajo |
| 8 | La tarjeta de facultades excluidas se veía tosca al quedar a la vista | `criterios.css` | **hecho** — 0 nombres truncados (eran 2), padding propio, casilla fija, pie con filo |

## Consecuencia que exige decisión de Gonzalo

`TipoSesionPorFacultad` —la tabla de los ítems 6 y 7— **sólo se montaba dentro de
`CriterioCard`, y `CriterioCard` sólo lo renderizaba el bloque global**. Al
retirar el bloque, esa tabla se queda sin punto de montaje: es la vista «las 17
facultades a la vez para el criterio de tipo de sesión».

Las reparaciones 6 y 7 están hechas y son correctas, pero hoy no se ven en
pantalla. Lo que cubre esa lectura ahora:

- `MatrizEmbudoCriterios` («cada criterio, lo que quita en cada facultad»),
- el Panorama por facultad (tabla de 17 filas).

**Decisión pendiente**: o la vista por-criterio×facultad de tipo de sesión se
remonta en la sección por facultad, o se retira el componente con su historia
(precedente: `ExcepcionesFacultad`, conservado sin montaje). No se decide aquí.

## Segunda deuda declarada

Con el bloque global fuera, **el set base (`categories`) deja de ser editable a
mano**: el bloque por facultad sólo escribe `exceptions[fac]` con op `replace`.
Hoy el base se puede fijar por el preset HST 2025 (que sigue en la pestaña) o
viene del proyecto guardado. En HSVG26DEF hay al menos un criterio con base
propia: **Modalidad, «1 de 4 · ~4.630 cursos-horario»**.

Es la cara práctica de lo que el ADR 0057 regla 1 declara: si ningún criterio es
general, el base es vestigial y toda facultad debería declarar el suyo. La
alternativa —una fila «Todas las facultades» encabezando las quince sobre el
mismo eje— era la opción B y no se eligió. Queda como decisión abierta.

## Auditoría de capacidad previa al retiro (gate 3 de la casa)

Qué vivía **sólo** en el bloque global y dónde queda:

| Capacidad | Destino |
|---|---|
| `PresetCanonicoButton` (HST 2025) | ítem 2 — a la barra de acción de esta pestaña |
| Tarjeta `enrolled_total` (kind `numeric`) | ítem 3 — al cierre `CursosHorarioBaseGlobal` |
| `SaludCriteriosCard` | ítem 4 — a esta pestaña, que es donde se deciden los criterios de aula |
| `MinElegiblesCard` global | ya existe por facultad (`minEligible.byFaculty`); G33 lo había retirado por duplicar |
| `CriterioComposicionCard` | ya se renderizaba **dos veces**; queda la del cierre por facultad |
| Confirmar/descartar por variable | `confirmarTodo()` + `confirmadorDe(id)` ya cubren cualquier pendiente |
| `TeacherTypeOrden` («Orden de jerarquía») | **se me pasó en la primera vuelta**; lo encontró el `verificador`. Ver abajo |
| `CondicionCursoAviso` | **se me pasó**; pérdida latente. Ver abajo |

### Lo que esta auditoría NO vio a la primera

Escribí «ninguna capacidad se pierde en silencio» y era **falso**. El gate
independiente lo midió en pantalla:

- **`TeacherTypeOrden`** — su único proveedor de callback era
  `CriteriosMarcoTab:564`, dentro de la rama `showAula`. Al retirar el montaje
  de aula, `.cmv2-crit-ttorden` pasó de 1 a **0** y **ninguna superficie de la
  app escribía ya `aulas_config.teacher_type_orden`**, valor que el motor sí lee
  (`universidad/shared/frame.ts:99-103,180`). No es un criterio —no incluye ni
  excluye a nadie—: es la regla con la que el motor elige el docente de mayor
  rango de cada curso-horario (`teacher_type_top`). **Reparado**: se remonta en
  `CursosHorarioBaseGlobal`, el cierre de reglas que el motor aplica igual a
  todas las facultades. Verificado en pantalla: `.cmv2-crit-ttorden` = **1**.
- **`CondicionCursoAviso`** (`CriterioCard:252`, único montaje) — aviso de
  cobertura «N de M cursos-horario sin dato de condición». No se observa en
  HSVG26DEF porque no llega al umbral del 30%, así que la pérdida es **latente**.
  **Pendiente de decisión**: remontarlo junto al criterio de condición del curso
  en el bloque por facultad, o retirarlo con su historia.

La lección: una auditoría de capacidad hecha leyendo el componente que se retira
no ve lo que ese componente **pasaba como prop** a sus hijos. Se mide contando
en pantalla antes y después, que es lo que hizo el gate.

## Por qué `enrolled_total` no se borra

El ADR 0057 regla 1 lo nombra explícitamente («el mínimo de matriculados es el
criterio 1»), así que su destino correcto es tener variante **por facultad**. Hoy
no puede tenerla: `exceptions[fac]` sólo transporta `categories`, y el único
umbral por facultad que el contrato admite es `minEligible.byFaculty`. Darle
variante propia exige cambio de contrato React↔R y su ADR. Hasta entonces se
conserva declarado como regla sin variante por facultad, junto a la composición,
que está exactamente en la misma situación.

**Deuda declarada**: `enrolled_total` por facultad, pendiente de ADR.

## Restricciones respetadas

- No se cambió el orden ni la semántica del motor.
- No se pisó el borrador sin commitear de `CriteriosMarcoTab.tsx` (props
  `borradorExterno`/`onBorrador`/`pendientesExternas`/`onPendientes`), que vive
  en el worktree principal. Este trabajo **no toca** ese archivo.
- El QA se hizo con marco construido; sin marco la pantalla cae al fallback.


## Abierto tras el gate (2026-08-25)

| # | Qué | Estado |
|---|---|---|
| 9 | `CondicionCursoAviso` sin punto de montaje (latente) | decisión pendiente |
| 10 | `TipoSesionPorFacultad` sin punto de montaje; los ítems 6-7 arreglan una superficie que hoy no se ve | decisión pendiente |
| 11 | El set base (`categories`) deja de ser editable a mano; en HSVG26DEF **Modalidad** tiene base propia («1 de 4 · ~4.630 CH») | decisión pendiente |
| 12 | El rótulo dice «N variables pendientes» contando las de estudiante, en una pantalla que sólo muestra criterios de curso | por reparar |
| 13 | `SaludCriteriosCard` quedó montada en las dos pestañas; con este proyecto devuelve `null`, así que sólo la respalda el typecheck | por verificar con un proyecto que tenga `salud_criterios` con filas |
| 14 | Ningún test fija el bug de `878916dd` ni detecta superficies muertas: 1514 tests antes y después | por escribir |

### Observado por Gonzalo, fuera de esta tanda

| # | Qué | Estado |
|---|---|---|
| 15 | **«Nivel del curso» enseña otro número**: su tarjeta rotula «Elegibles por curso-horario según nivel del curso» y dibuja la distribución de elegibles, no la de niveles. Con el criterio sin rango sólo hay una categoría («Todos los niveles»), así que el boxplot no reparte por nivel — que es lo que el título promete | **sin diagnosticar** |
| 16 | **Cursos-horario de 1 alumno elegible siguen listados en Ingeniería** pese al mínimo de elegibles. En la captura hay «1 variable pendiente de confirmar», así que la hipótesis primera es que la lista describe el marco construido y no el criterio pendiente — pero **no está verificado** | **sin diagnosticar** |

## Segunda unidad de trabajo — el mínimo por facultad se descartaba (motor R)

Distinta de la de composición; se commitea aparte.

`.cm_criterios_normalize_seleccion()` se reparó **hoy** para conservar
`minEligible = {byFaculty: {...}}` sin `threshold` (la app manda el general sólo
cuando el usuario lo cambia). Sus **tres** consumidores repetían la guarda vieja
`!is.finite(threshold)` y reemplazaban el objeto entero por uno con
`byFaculty = list()`: la normalización salvaba los mínimos propios y el
evaluador los tiraba tres líneas después, **sin aviso**.

| Sitio | Efecto |
|---|---|
| `calc_muestra_aulas_criterios.R:1561` | la construcción del marco ignora los mínimos por facultad |
| `calc_muestra_aulas_criterios_cascada.R:648` | el embudo vivo evalúa otro umbral que el marco |
| `calc_muestra_aulas_criterio_radiografia.R:896` | las cifras de la tarjeta («quedan fuera») ídem |

**Reparado** con un helper único, `.cm_criterios_min_elig_con_fallback()`, y la
razón de exclusión (`min_eligible`) pasa a atribuirse también cuando el criterio
del usuario es un mínimo por facultad sin umbral general.

Regresión: `api/tests/testthat/test-calc-muestra-min-elegibles-por-facultad.R`
(9 asserts). **Calibrada contra el artefacto roto**: con la lógica vieja pasan
5 de 5 aulas —incluida una de 1 elegible frente a un mínimo de 20— en vez de 2.

### Precisión sobre las 333 aulas de Ingeniería

Medí 333 aulas incluidas con <20 elegibles y dije que **no** era marco viejo.
Era una afirmación de más: lo que probé es que el defecto de código existe, no
que causara ese estado. El marco de HSVG26DEF está construido **antes** de
declararse los criterios de curso-horario —la propia cabecera dice «criterios
cambiados · reconstruye»—, así que esas 333 se explican por el marco desfasado.

Lo que sí sostiene la medición: `minEligible` está guardado como
`{threshold: NA, byFaculty: {ciencias_e_ingenieria: 20}}`, y **con el código
anterior una reconstrucción habría vuelto a dejarlas dentro**, porque `byFaculty`
se descartaba y el umbral efectivo caía a 1. El arreglo es lo que hace que la
próxima reconstrucción respete el mínimo de 20.

### Gate de esta unidad

- Suites R de criterios: de 10 fallos a 5; los 5 restantes
  (`test-http-contract-calc-muestra-criterios-preview.R`, un `500` del que
  cuelgan los otros 4) son **idénticos en el commit base f6c0df52**, verificado
  en un worktree desechable.

## Abierto, reportado por Gonzalo

| # | Qué | Estado |
|---|---|---|
| 15 | «Nivel del curso» rotula «Elegibles por curso-horario según nivel del curso» y dibuja elegibles, no niveles | **reparado** |
| 16 | `AulasFinalesCard` lista lo que el marco **construido** marcó `included`, no lo que dicen los criterios pendientes: se excluye a mano sobre una lista que va a cambiar. Gonzalo: «de todas formas no debería pasar» | **reparado** |


## Tercera unidad — el rótulo que prometía otro desglose y la lista sin fecha

- **«Nivel del curso» enseñaba otra cosa.** `CriterioFacultadRadiografia.tsx`
  rotulaba siempre «Elegibles por curso-horario según X», incluso cuando X no
  reparte: con el criterio sin rango declarado la única fila es «Todos los
  niveles» y el boxplot no separa por nivel ninguno. Ahora el «según X» sale
  sólo cuando hay más de una categoría. Verificado en pantalla: las dos tarjetas
  visibles de Ingeniería (`minEligible` y `course_level`) tienen **1 segmento**,
  así que ninguna promete desglose.
- **La lista final no decía de cuándo era.** `AulasFinalesCard` sale del
  `aula_frame` construido; con criterios cambiados enseñaba cursos que esos
  criterios ya descartan y dejaba apagarlos a mano. Declara ahora que es la foto
  del último marco y avisa de que el recálculo va a cambiarla.

## Cuarta unidad — un rango de nivel por facultad con clave legada borraba la facultad

Auditando «¿puedo aplicar criterios específicos por facultad sin problema?»
apareció el mismo patrón que el mínimo, en el tercer sitio que el ADR 0080
nombra pero nadie cubría: `crit$exceptions` y `minEligible$byFaculty` pasan por
`.cm_aulas_canonizar_claves()`; **`courseLevelRanges` no**.

El efecto no era «el rango se ignora». Como el mapa NO está vacío el criterio sí
se aplica, el bucle no encuentra ningún par que decida y devuelve `FALSE`: la
facultad entera sale del marco, **incluidas las aulas cuyo nivel está dentro del
rango declarado**. Medido con el motor: `ARTE Y DISEÑO` con rango 1–5 y clave
`arte_y_dise_no` dejaba fuera un aula de nivel 3.

Reparado dentro de `.cm_criterios_eval_course_ranges()`, que es por donde pasan
los tres consumidores. Regresión en el mismo archivo de tests (17 asserts).

## Los dos relojes de la pantalla

El embudo por facultad **sí** es vivo cuando hay preview: `useCascadePreview`
publica `cascadaViva` y los «llegan a este criterio» cuentan el borrador antes de
recalcular. La lista de cursos-horario **nunca** lo es: sale del `aula_frame`
ejecutado y siempre va un recálculo por detrás. Con preview vivo, la misma
pantalla enseña una barra con el criterio nuevo y, a tres centímetros, una lista
que ese criterio ya descartó.

El aviso de la lista distingue ahora los dos casos: con preview vivo dice que el
embudo va adelantado y la lista no; sin él, que ambos son del último marco.

### Verificado sobre HSVG26DEF abierto desde disco

El preview **no está vivo**: el motor exige que el marco se haya construido en
la sesión y el contexto transitorio se borra al guardar
(`router_calc_muestra_criterios.R:107`). Medido en pantalla: el aviso sale con la
redacción de «sin preview».

**Hueco que queda abierto**: en ese estado no aparece ningún «preview bloqueado».
`previewBloqueado` sólo se puebla con `status === "stale"`, y aquí el estado
nunca llega a stale, así que el embudo cae a la cascada ejecutada **en silencio**
y la barra muestra el aviso genérico de `marcoDesactualizado`. Mientras eso siga
así, la regla fiable es la de Gonzalo: **confirmar → recalcular → mirar →
decidir**.

### Los tres canales por facultad, probados contra el motor

| Canal | Estado |
|---|---|
| `exceptions[fac]` con base vacía y op `replace` | ✅ recorta sólo en su facultad; las demás pasan |
| `exceptions[fac]` con op `exenta` | ✅ exime a su facultad, no libra a las demás |
| `minEligible.byFaculty` sin umbral general | ✅ **reparado en esta tanda** |
| `courseLevelRanges[fac]` con clave legada | ✅ **reparado en esta tanda** |

## Quinta unidad — la cascada vuelve a ser viva desde un `.pulso` guardado

Pedido de Gonzalo: «la idea es que la cascada siempre sea en vivo y dinámica, no
que el preview no funcione».

Resultaron ser **dos** bloqueos encadenados, no uno.

### 1. El contexto transitorio no se podía rehidratar

`calc_muestra_aulas_criterios_contexto` es `cache_stripped` porque lleva la tabla
atómica estudiante × CH: se borra al guardar y no vuelve. Medido: los pasos de
**curso-horario no la necesitan** —`preview_aula_flag` lee `aula_frame`, `values`
y `composition`— y las tres cifras que sí venían de ella (`eligible_n` y las
señales de composición) el marco las publica como columnas.

`.cm_criterios_contexto_desde_marco()` reconstruye el contexto sin la tabla; el
router lo usa cuando el contexto falta. Los pasos de alumno se declaran
`sin_recuento` y la raíz publica `alumnos_vivos = FALSE`, en vez de correr sobre
`eligible_n = NA` —donde el mínimo habría dejado pasar a todos en silencio—.

### 2. Un rótulo vacío apagaba el recorrido entero

Con el contexto ya rehidratable, el front **seguía sin pedir el preview**. La
causa estaba mucho antes: `normalizeCalcMuestraCriteriosI18bBundle` devolvía
`invalid: ["anchors"]`, y como el bundle es todo-o-nada caían con las anclas los
totales y la cascada, dejando `previewRequest` nulo.

Medido sobre HSVG26DEF: `periodo` llegaba **vacío en la raíz y en las 260 filas**
—la referencia de asistencia está cargada sin etiqueta de periodo— y `text()`
trata la cadena vacía como INVALID. Todos los demás campos exigidos estaban
completos en las 260 filas.

`periodo` es un rótulo, no una identidad: la identidad es `reference_hash`. Pasa
a leerse con `optionalLabel()`, que admite vacío.

### Verificado en la app, con el `.pulso` guardado

| | Antes | Después |
|---|---|---|
| bundle I18b | `invalid: ["anchors"]` | `complete` |
| `previewRequest` | nulo | emitido |
| barra de estado | «Los criterios cambiaron — el marco vigente ya no los refleja» | «El recorrido de cursos-horario ya refleja tus criterios. Los criterios de estudiante son los del último marco construido» |
| aviso de la lista | «Esta lista es la del último marco construido» | «El embudo de arriba ya refleja tus criterios; esta lista todavía no» |

Y contra el motor, desde el `.pulso` guardado: `solo TEÓRICO → 3.448`,
`solo TALLER → 258`, `solo SEMINARIO → 121`, contra 4.095 de la config guardada.
La cascada rehidratada reproduce exactamente el total del marco construido
(4.095), que es la comprobación de que no inventa cifras.

## Ruta 2 (releer la base para el recuento de estudiantes) — IMPLEMENTADA

Pedido: recuperar también el recuento de estudiantes releyendo la base.
**Es viable y está medido**; lo que la desaconseja hoy no es la técnica sino el
balance.

### Lo que sí funciona

El marco guardado firma sus fuentes (`sources_used`) y los archivos siguen
resolviendo tras abrir el `.pulso`:

| rol | archivo | resuelve |
|---|---|---|
| `base_madre` | 137.919 filas, hoja `Data` | sí |
| `catalogo_curso_horario` | 22.058 filas, hoja `Data` | sí |

Y la reconstrucción es **exacta**: `calc_muestra_aulas_construir()` con esas
fuentes y la config guardada devuelve `frame_hash` **idéntico** al del `.pulso`
(`e432bc731dad9890`), con las 137.919 filas atómicas. O sea, el contexto
rehidratado sería válido para el marco que la pantalla enseña.

### El costo, por etapa

| paso | s | acum |
|---|---|---|
| 1 Leyendo la base | 0,0 | 0,0 |
| 2 Depurando elegibles | 32,2 | 32,2 |
| 3 Agrupando cursos-horario | 22,6 | 54,7 |
| **4 Aplicando criterios del marco** | 2,2 | **57,0** ← aquí ya existe la tabla atómica |
| 5 Perfilando el marco | 6,9 | 63,9 |
| 6 Radiografía del marco | 2,7 | 66,5 |
| 7 Radiografía por criterio y facultad | 67,2 | 133,7 |
| 8 Impacto del tipo de sesión | 51,4 | 185,1 |

Los pasos 5-8 (128 s, el 69%) producen agregados que el marco guardado **ya
trae**, así que rehidratar sólo necesita llegar al paso 4: **~57 s**, no 185.
Bloquear plumber 57 s no es opción, así que iría como job `callr`.

### Por qué no se implementó en esta tanda

1. **El seam está en un archivo congelado.** Cortar en el paso 4 exige un
   parámetro y un return temprano en `calc_muestra_aulas_construir()`, dentro de
   `api/R/calc_muestra_aulas.R`, que es congelado a crecimiento **y ya está +36
   líneas sobre su línea base** (fallo pre-existente del gate, idéntico en el
   commit base; también `CalcMuestraPage.tsx`, +66). La salida correcta según la
   regla de la casa es extraer la etapa de filas a un archivo propio, que es un
   refactor del núcleo del build y pide la suite R completa.
2. **El balance es débil.** Tras cualquier recálculo el contexto COMPLETO ya
   queda en sesión (`router_calc_muestra_criterios.R:69`), así que los pasos de
   estudiante se vuelven vivos solos. La ruta 2 sólo ahorra **una** recálculo en
   la ventana «acabo de abrir el proyecto y aún no he recalculado» — y el propio
   flujo de trabajo (confirmar → recalcular → mirar → decidir) pasa por ahí.

**Queda como decisión abierta**, con el terreno ya medido: si se hace, el orden
es (a) extraer la etapa de filas a archivo propio y bajar la línea base del
congelado, (b) job `callr` de ~57 s, (c) adoptar el contexto sólo si el
`frame_hash` reconstruido coincide con el guardado.


## Ruta 2, hecha

Lo que la desaconsejaba era el precio (186 s) y que el seam caía en un archivo
congelado. Las dos cosas se resolvieron.

**El seam.** Se extrae la cola del build —pasos 5 a 8, los agregados que un
`.pulso` guardado YA trae— a `calc_muestra_aulas_construir_cola.R`, y
`construir()` gana `solo_criterios = TRUE`, que para en el paso 4, donde la
tabla atómica ya existe. El archivo congelado BAJA (4661 antes de añadir el
corte; 4673 después, contra 4705 de línea base), así que el gate sigue verde sin
subir el techo.

| | s |
|---|---|
| build completo | 186,2 |
| **`solo_criterios = TRUE`** | **59,7** |

**La paridad.** El gate del refactor es que el marco no cambie:
`frame_hash` reconstruido = `e432bc731dad9890…` = el guardado. **Idéntico.**

**La operación.** `.cm_criterios_rehidratar_contexto()` compone los agregados
del marco guardado con la tabla atómica releída, y **rechaza** el resultado si
los `classroom_id` no coinciden con el marco: si la base cambió, no se publica
un contexto que describe otro universo. Va como job `callr` porque plumber es
monohilo.

**Verificado end-to-end**, HTTP y UI, sobre HSVG26DEF:

| | |
|---|---|
| job | `done` en ~70 s, `adoptado: true` |
| segunda llamada | `ya_vivo` |
| preview tras rehidratar | `alumnos_vivos: TRUE`, los cuatro criterios de alumno pasan de `sin_recuento` a `aplicado` |
| total final | 4.095 — el mismo del marco construido |
| UI | el botón «Recuperar el recuento de estudiantes (~1 min)» aparece sólo cuando hace falta, y **desaparece** al terminar |

No se dispara solo: es un minuto de CPU y sólo hace falta al decidir un criterio
de alumno, así que se ofrece y se explica en vez de gastarlo por si acaso.

### Dos trampas que costaron una vuelta

- `roxygen2::roxygenise("api")` creó `api/man/` (992 archivos, no versionados) y
  además dejaba el NAMESPACE con **+339/−34**: el commiteado está
  desincronizado. Se revirtió y se borró el artefacto. Los jobs NO necesitan
  export —`calc_muestra_aulas_construir_job` tampoco lo tiene—, así que el
  `@export` sobraba. **Deuda declarada**: el NAMESPACE del repo no reproduce lo
  que roxygen generaría.
- `job_progress_writer()` no acepta `force`; pasárselo mata el worker de `callr`
  con un error que sólo se ve en el snapshot del job.
