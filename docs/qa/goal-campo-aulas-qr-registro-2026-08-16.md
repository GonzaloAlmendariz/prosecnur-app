# GOAL — el aula se recoge sola: del sorteo al dato, sin planilla paralela

**Abierto**: 2026-08-16 · **Doc vivo** · Sólo Gonzalo lo cierra.

La calidad que persigue este loop: que un estudio de aulas por Kobo con id de
colector **no necesite una planilla paralela**. Que del sorteo salgan enlaces y
fichas listos para imprimir, y que lo que pasa dentro del aula —quién entró,
quién no dejó entrar, qué reemplazo se activó, cuántos respondieron— se registre
**en la app, mientras ocurre**, y no en un WhatsApp que después alguien transcribe.

Son dos motores y el GOAL los mide juntos porque el hueco está en la costura:
Recopiladores produce los materiales, Monitoreo lee el resultado, y en el medio
—el campo— hoy no hay nadie.

> **Reencuadre del 2026-08-16, tras leer el estudio real** (`Hostigamiento PUCP
> 2025_BD Aulas Agendadas`, anatomía completa en
> [`anatomia-excels-aulas-2026-08-16.md`](anatomia-excels-aulas-2026-08-16.md)):
> el operativo se gobierna con **tres Excel que el equipo llena a mano y que la
> app debe LEER, no sustituir** — «Aulas Agendadas» (agendamiento y cadena),
> «Base de control» (control de calidad) y «Aulas Aplicadas (Campo)» (parte de
> campo). «Sin planilla paralela» **no significa eliminar el Excel**: significa
> que el Excel y la app dejen de contar cosas distintas.

## Vara

| # | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | De una selección de aulas (titulares + reemplazos) **sin enlaces**, el motor produce un enlace personalizado por unidad sin que nadie pegue links a mano. | La simulación `sim_qr_aulas.R` da cobertura `prepared` con `units_missing_access = 0`. |
| **V2** | El QR codifica el enlace **mínimo**: base + un parámetro, una sola vez. | El `qr_payload` compilado no repite ningún nombre de parámetro. |
| **V3** | El identificador que viaja en el QR es el **código operativo** del equipo (`CH 1`, `R 1.2`), no un slug interno con hash. | El `d[collectorID]` de la ficha de `CH 1` es literalmente `CH 1` (o su forma URL-safe estable), y la data que vuelve de Kobo se reconcilia sin tabla de traducción. |
| **V4** | La ficha dice **sin interpretación** si el aula es titular o reemplazo, y de quién es reemplazo. | Dos páginas del mismo PDF (una titular, una reserva) difieren en una marca legible; alguien que no conoce la nomenclatura acierta el rol. |
| **V5** | El coordinador registra desde la app el **estado real** de cada aula (agendada · en aplicación · aplicada · parcial · sin acceso · cancelada) con su motivo, y eso queda en el `.pulso`. | Existe una superficie que llama a `/api/monitoreo/aulas/agenda`. **Cumplida (2026-08-16)**: `RegistroDeCampo` en Monitoreo > Agenda. |
| **V6** | **Activar un reemplazo es un gesto de la app**, no una decisión en un chat. | Desde el aula caída se activa su cadena `R n.k`; el motivo queda registrado y el avance recalcula denominadores solo. **Cumplida (2026-08-16)**: botón en Registro de campo, verificado end-to-end en el navegador. |
| **V7** | Lo que pasa en el aula se ve **contra la meta de esa aula, mientras ocurre**. | El avance por aula cruza respuestas de Kobo por `collectorID` contra `expected_valid` sin que nadie re-sincronice a mano. **Parcial (2026-08-16)**: el cruce por `collectorID` ya funciona sin configurar nada (L8); falta el «mientras ocurre», que depende de L4. |
| **V8** | Nada de lo anterior exige una planilla paralela. | Ningún campo del registro de campo vive sólo en papel o en Excel. **Comprobada a medias (2026-08-16)**: los tres campos que faltaban ya están en la app; queda el desglose hombres/mujeres, que vive sólo en la ficha impresa. |
| **V9** | La app **lee** las tres hojas del estudio sin que nadie retranscriba. | Los totales del lector cuadran con un conteo independiente del Excel real. **Comprobada (2026-08-16)**: 1012 unidades, 766 enlaces, 230 estados y 190 observaciones, todos coincidentes celda a celda. |
| **V10** | El **agendamiento** y la **aplicación** se miden por separado. | `STATUS MUESTRA` (AGENDADA · REAGENDADA · EN RESERVA n · REEMPLAZADA) y `STATUS DE APLICACIÓN` (APLICADA · NO APLICADA) viven en campos distintos; hoy la app los mezcla en un solo `operational_status`. |
| **V11** | Se sabe **por qué** un aula no está agendada todavía. | El ciclo de contacto —medio, fecha de llamada y **número de intentos**— llega al modelo y se ve por aula. |
| **V12** | La app **produce** el libro que el equipo llena, y lo **vuelve a leer**. | Generar y reimportar cierra el círculo sin perder la cadena ni los enlaces **ni el trabajo ya hecho**: estados de agendamiento, ciclo de contacto y partes de campo. **Comprobada (2026-08-16)** con round-trip sobre un `.pulso` real. |
| **V13** | El avance de aulas **se ve**, no sólo se lee en tablas. | Hay gráficos propios del contexto de aulas —no copiados de telefónico— y usan el mismo lenguaje visual que los otros perfiles: `PlotlyChart`, `coloresDeResultado`, `MarcoDeEjesSiHaceFalta`. |
| **V14** | El monitoreo aguanta **3700 registros** de Kobo. | Sincronizar, graficar, mostrar y gestionar esa cantidad sin degradarse: medido en tiempo de sincronización, de tablero y de render. |

---

## Medición de partida (2026-08-16)

Simulación end-to-end sobre el motor real: 7 unidades (4 titulares M1 + 3
reservas encadenadas R1), sin enlaces en la selección, con un solo formulario
Kobo (`ee.kobotoolbox.org/x/aB3xY9kQ`, `prefill_field=collectorID`).

```
[2] Plan: 7 units · adapter=aulas_v1 · deployment=NULL (correcto: la selección no trae enlaces)
[3] preview kobo_existing_v1: status=prepared · cobertura 7/7
[5] instancia: 7 unidades · 7 accesos · warnings=0
[6] compilado: 7 páginas · payloads únicos 7/7
    PDF: 244.981 bytes, 7 páginas
[7] handoff: 7/7 filas del plan de Monitoreo con enlace
```

**La cadena completa existe y corre.** V1 se cumple hoy. Lo que falla es lo que
va dentro del QR y todo lo que viene después del handoff.

Payload real de la ficha 1:

```
https://ee.kobotoolbox.org/x/aB3xY9kQ
  ?d%5BcollectorID%5D=unit-aulas-aula-01-fd6e0ab1ee
  &d%5BcollectorID%5D=unit-aulas-aula-01-fd6e0ab1ee
```

Dos defectos en una sola línea: el parámetro va **duplicado**, y su valor es un
**slug interno** en vez de `CH 1`. El enlace impreso ocupa dos renglones.

> **Corrección (2026-08-16, al hacer L10):** aquí se dijo además que el QR salía
> «al doble de denso, que es lo que se paga en un aula con mala luz». Medido:
> con el parámetro duplicado el módulo impreso mide **1,25 mm** y sin él
> **1,46 mm**, contra un umbral cómodo de 0,6 mm. **El QR nunca estuvo en riesgo
> de no escanearse.** Lo que L1 arregló de verdad fue el enlace impreso en una
> línea y la higiene del payload, no la legibilidad.

---

## Cola

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| **L1** | El parámetro del enlace va duplicado (`d[collectorID]` dos veces). | `api/R/collection_adapters.R:.ca_binding` dejaba el param dentro de `access_ref`; `api/R/collection_engine.R:.collection_access_url` volvía a colgar el `prefill`. | ☑ **hecho** (2026-08-16) — el adapter ya no arma URL: declara base en `access_ref` y personalización en `prefill`, y el resolvedor compone una sola vez. Payload de 116 → 71 chars, PDF de 244.981 → 234.937 bytes. Regresión en `test-collection-engine.R` («la costura adapter → resolvedor no duplica el parámetro»). |
| **L1b** | SurveyMonkey recibía la sintaxis `d[]` de Kobo. | Hallazgo de propina al hacer L1: `.collection_access_url` hardcodeaba `d[%s]` para todo proveedor, así que al link de SM se le colgaba un parámetro que su formulario ignora. | ☑ **hecho** (2026-08-16) — `.collection_prefill_param()` decide por proveedor; el resolvedor recibe `deployment$target$provider`. |
| **L2** | El valor del `collectorID` es un slug interno con hash, no el código operativo. | `.collection_stable_id()` en `collection_engine.R`; el código operativo canónico lo produce `.cm_aulas_codigo_operativo()`. Decidir cuál viaja a Kobo — afecta la reconciliación de la data que vuelve. | ⛔ bloqueado — ver «Espera al usuario» |
| **L3** | La ficha no declara el rol: titular y reemplazo se ven iguales. | `collection_material_builtin_template()` no usaba `unit.role`; y el binding devolvía la clave cruda del motor. | ☑ **hecho** (2026-08-16) — la ficha imprime «Rol: Titular» / «Rol: Reemplazo de AULA-01». `.crf_role_label()` traduce, `replacement_for` viaja al plan y existe el binding `unit.replacement_for`. Built-in a revisión 2. |
| **L11** | Hay **dos plantillas por defecto que no coinciden**. | `DEFAULT_COLLECTION_TEMPLATE` (`MaterialsSection.tsx`) declaraba otra ficha que la del backend. | ☑ **hecho** (2026-08-16) — borrada. Era **inalcanzable**: el backend siempre responde plantilla y el componente corta el render en `loading`, así que nunca se dibujó ni sirvió de fallback. Queda una semilla vacía explícita y, si el backend respondiera sin plantilla, el editor avisa en vez de inventar una receta. ⚠ verificado con typecheck + 89 tests, **sin chequeo visual**. |
| **L12** | El filtro de «respuesta válida» no conoce los estados de Kobo, y falla abierto. | `.monitoreo_aulas_valid_response()` en `monitoreo_aulas_universitarias.R:434`. Kobo nombra su columna `_validation_status` (guion bajo delante) y la llena con `validation_status_approved`; los candidatos incluyen `validation_status` y `_status` pero **no** `_validation_status`, y `valid_statuses` (`completed`·`complete`·`valid`·`aprobado`·`aplicada`) no incluye ningún valor de Kobo. | ⛔ **bloqueado** — necesita decisión: hoy sin columna reconocible **todo cuenta como válido** (fail-open) y quien configurara el mapeo «bien» se quedaría con **cero válidas** sin aviso. Cambiar fail-open por fail-closed altera lo que cuenta en estudios vivos, así que no se toca sin tu visto bueno. Comportamiento actual **fijado con tests de caracterización** para que cambiarlo sea visible. |
| **L13** | Tras el handoff, abrir Monitoreo **reventaba**. | `.monitoreo_aulas_status()` resolvía el alias con `aliases[[key]]`, que **lanza** `subscript out of bounds` con una clave desconocida en vez de devolver NULL: el `%||%` que hacía de red nunca actuaba. Y el handoff escribía `operational_status = "pendiente"`, palabra fuera de `monitoreo_aulas_estados()`. | ☑ **hecho** (2026-08-16) — el handoff escribe `planificada`, `pendiente` entra como alias, y ambos normalizadores caen al default con `[` en vez de romper. |
| **L14** | El plan entregado se **multiplicaba n²**: 7 aulas salían como 49. | `.monitoreo_aulas_values()` / `.monitoreo_aulas_num_values()` hacían `rep(default, nrow(df))`, y `orden = getn(c("orden","order"), seq_len(n))` pasa un default **vectorial**. Al asignar esa columna de n² valores, el data.frame reciclaba todas las demás. Se disparaba sólo cuando faltaba la columna `orden` — el caso exacto de las filas que crea el handoff. | ☑ **hecho** (2026-08-16) — `rep_len` en vez de `rep`, en los dos helpers. Verificado de 1 a 20 filas. |
| **L15** | El avance por aula era **siempre cero**. | El QR lleva `collection_unit_id`; las respuestas vuelven con ese id y `.monitoreo_aulas_course_status()` emparejaba sólo por `classroom_id`. Además la normalización **tiraba** `collection_unit_id`, así que el vínculo se perdía. El KPI global sí contaba las respuestas: el tablero decía «12 válidas» con las 7 aulas en 0. | ☑ **hecho** (2026-08-16) — el campo sobrevive a la normalización y el emparejamiento cae a él cuando `classroom_id` no casa. |
| **L16** | El handoff no llevaba la **meta** del aula. | Las filas nuevas salían sin `eligible_n`, así que la brecha era 0 y ninguna aula podía llegar a «cerrando». El dato ya viajaba en la unidad del plan. | ☑ **hecho** (2026-08-16) — se copian `eligible_n`, facultad, curso, horario y docente. |
| **L17** | Un aula con 5 de 30 se declaraba **«cerrando»**. | `application_state` comparaba `respuestas_validas >= expected_valid` sin coaccionar, y `.monitoreo_aulas_df()` deja todo como texto: `"5" >= "30"` es TRUE. La línea de `brecha` de al lado sí coaccionaba. Latente hasta ahora porque las válidas siempre eran 0. | ☑ **hecho** (2026-08-16) — comparación numérica. |
| **L18** | Brechas, avance por estrato y reemplazos se calculaban **sobre ceros**. | El emparejamiento respuesta→aula estaba escrito **dos veces**: en `monitoreo_aulas_dashboard()` y en `.monitoreo_aulas_course_status()`. L15 arregló sólo el segundo, así que el desglose por aula quedó bien y todo lo que agrupa siguió ciego. | ☑ **hecho** (2026-08-16) — un solo helper `.monitoreo_aulas_contar_por_fila()` usado por ambos. |
| **L19** | La cadena de reemplazos era **invisible** en Monitoreo. | El handoff no copiaba `replacement_for` a las filas nuevas, y la sección de reemplazos filtra por ese campo: salía vacía aunque el sorteo hubiera encadenado reservas. | ☑ **hecho** (2026-08-16) — el handoff lo arrastra. |
| **L20** | Las cuotas sexo×facultad salen vacías con un plan creado por el handoff. | Los objetivos derivan de `sex_top_1`/`sex_top_2`, composición que produce Cálculo de muestra y que el plan de Recopiladores no transportaba. | ☑ **hecho** (2026-08-16) — el plan y el handoff arrastran `sex_top_*` y `stratum`, igual que ya hacían con `eligible_n`. De **0 celdas a 4**, con objetivos y observados reales. No era decisión de contrato: era el mismo arreglo mecánico ya hecho tres veces. |
| **L24** | La facultad de una respuesta no se resolvía: **tercera copia** del mismo join. | `.monitoreo_aulas_response_faculty_values()` indexaba el plan sólo por `classroom_id`, y las respuestas llegan con `collection_unit_id`. Ninguna encontraba su facultad, y con ella el cruce de cuotas quedaba ciego. | ☑ **hecho** (2026-08-16) — el índice acepta ambos. |
| **L25** | La agenda sólo aceptaba `classroom_id` u `operational_code`. | `monitoreo_aulas_update_agenda()` **lanzaba error** con cualquier otro identificador, incluido el que viaja en el QR. Sin consumidor hoy —la superficie de registro no existe (L4)—, pero es el muro exacto con el que chocaría quien la implemente. | ☑ **hecho** (2026-08-16) — **preparatorio, no un defecto observado**: `.monitoreo_aulas_plan_index()` y la agenda aceptan `collection_unit_id` como tercer identificador. No decide nada sobre L4. |
| **L21** | El aviso «recolectores duplicados» saltaba **siempre**. | En un estudio de aulas el mismo QR lo escanean todos los alumnos: el colector se repite por diseño. El chequeo sólo decía «ok» con una única respuesta, que es el caso anómalo. | ☑ **hecho** (2026-08-16) — pasa a `duplicate_responses`, que mira el id de respuesta (`_uuid`/`_id`/`instanceID`); si la fuente no lo trae, lo dice en vez de callar o alarmar. Etiqueta del frontend actualizada. |
| **L22** | Una respuesta de un aula inexistente pasaba como **buena**. | `unmapped_valid_responses` miraba si la respuesta *tenía* colector, no si ese colector correspondía a un aula del plan. | ☑ **hecho** (2026-08-16) — se compara contra los ids del plan (`classroom_id` + `collection_unit_id`), posible sólo desde que el emparejamiento los conoce. |
| **L23** | Los números de L15–L22 no se han visto en pantalla. | **La premisa era falsa.** La persistencia del `.pulso` es lista **negra**, no whitelist. | ☑ **hecho** (2026-08-16) — `api/scripts/qa_pulso_aulas_campo.R` + pila en 8799/5199. Vistos en pantalla: cadena de reemplazos, brechas por aula, avance por estrato, cuotas y los cuatro controles con su etiqueta en español. |
| **L4** | No existe superficie para registrar el estado operativo de un aula. | Decidido por Gonzalo el 2026-08-16: **vive en Monitoreo**, sección Agenda — el estado operativo mueve los denominadores del avance. | ☑ **hecho** — `RegistroDeCampo.tsx` conecta `/api/monitoreo/aulas/agenda`, que llevaba 0 consumidores. El modelo del plan gana `observed_students`, `applied_surveys`, `refusals`, `applied_by`, `applied_at` y `field_note`. ⚠ **queda un pase de layout**: ver L26. |
| **L26** | El registro queda apretado en Agenda, y duplica la lista de aulas. | Decidido por Gonzalo el 2026-08-16: **Monitoreo de aulas usa sección y pestaña igual que telefónico y acreditación**. El registro tiene pestaña propia. | ☑ **hecho** (2026-08-16) — Agenda › «Agenda» \| «Registro de campo». |
| **L27** | La app no lee «Aulas Agendadas». | 241 columnas: 1 de `ID MATCH` + **12 bloques de 20** (titular y once eslabones, a lo ancho). | ☑ **hecho** (2026-08-16) — lector + endpoint `/api/monitoreo/aulas/importar-libro`. Contra el estudio real: **1012 filas**, 170 titulares, 230 contactadas. |
| **L28** | La app no lee «Aulas Aplicadas (Campo)». | Tres bloques de **ancho distinto** (34/33/33: sólo el principal trae `AULA`) y `FECHA DE APLICACIÓN` duplicada dentro del bloque. | ☑ **hecho** (2026-08-16) — lector + endpoint. **196 partes**, 4269 efectivas. |
| **L33** | Dos partes de 196 **no reconcilian**. | `asistentes − rechazos − duplicados ≠ efectivas` en `1TEA08-0401` (15−0−0, efectivas 14) y `LIN127-0203` (27−1−3, efectivas 27). El Excel no comprueba esa identidad. | ☑ **hecho** (2026-08-16) — control `field_report_reconciliation` en el tablero. Detecta los 2 descuadres del estudio real y **explica la resta**, no sólo el hecho. |
| **L38** | El tablero **reventaba entero** el primer día de campo. | `.monitoreo_aulas_quota_sex_faculty()` construía el caso vacío con la columna `x` y la renombraba a `observed` sólo `if (nrow(observed))` — que nunca se cumple. El merge salía sin la columna y la línea siguiente asignaba `integer(0)` a un data.frame con filas. | ☑ **hecho** (2026-08-16) — hallazgo de propina al sembrar el `.pulso` de L23. |
| **L39** | La sección **Avance** no mostraba el avance. | `AulasMonitoreoPage.tsx:387` hacía `quotaRows.length ? quotaRows : avance_por_estrato`: los dos **competían por un panel**, y como un estudio de cursos-horario siempre trae cuotas, el avance por estrato no se veía nunca. El avance por aula vivía en **Consultas**, concatenado con reemplazos y brechas en una tabla donde 7 aulas salían como 15 filas sin decir de qué lista venía cada una. | ☑ **hecho** (2026-08-16) — Avance tiene tres paneles propios y Consultas dos. |
| **L40** | El alto se repartía al revés del contenido. | El stack es grid y la tabla topa en `min(420px, 100vh−430px)`: dos límites pensados para **una** tabla por vista. Con tres, grid sirve enteras a las que caben y descuenta todo el faltante de la única que excede. A 1024×600 **dos de los tres paneles colapsaban a cero** — regresión que introdujo L39. | ☑ **hecho** (2026-08-16) — paneles que no se encogen; el scroll lo absorbe su dueño ya declarado. Verificado a 1440×1000 y 1024×600. |
| **L41** | Los códigos de la cadena salían de la **posición en la lista**. | `monitoreo_aulas_normalize_plan()` derivaba `titular_operational_code` y `replacement_chain_code` de `slot_number`, que cae a `orden`. Una reserva de `CH 4` en la fila 6 se declaraba titular de `CH 6` y se llamaba `R 6.1`. | ☑ **hecho** (2026-08-16) — tres derivaciones corregidas; verificado en pantalla. |
| **L42** | El **Registro de campo** es inalcanzable a 1024×600. | Competía con la tabla por 325 px, y su panel traía `align-self: start`, así que tomaba su alto de **contenido** en vez del de su pista. | ☑ **hecho** (2026-08-16) — 422 → 219 px, cabe entero y el botón de guardar es alcanzable. |
| **L43** | Dos superficies no declaraban su geometría (C1). | «Operación del plan» en Fuentes y «Aplicación por cursos-horario» en Agenda. La segunda declaraba su grid interior de tarjetas pero no la sección que las contiene: son dos superficies, no una. | ☑ **hecho** (2026-08-16) — cero sin declarar en las cinco secciones. |
| **L44** | Regenerar el libro **borraba el operativo en curso**. | El generador escribía las columnas de la persona siempre en blanco, así que un estudio en marcha perdía los 7 estados de agendamiento, los 7 contadores de intentos y los 3 partes de campo. Además la hoja de campo filtraba por `sample_role == "titular"`, así que el parte de una reserva activada no se escribía. | ☑ **hecho** (2026-08-16) — 3/3 partes y 7/7 estados sobreviven. |
| **L45** | El registro de la app capturaba **menos que el parte**. | Faltaban `duplicates`, `effective_surveys` y `actual_room`. Sin los dos primeros, el cuadre de L33 —asistentes − rechazos − duplicados = efectivas— **no se puede comprobar sobre lo que la app captura**; y «encuestas aplicadas» no es «efectivas», que es el número que manda. | ☑ **hecho** (2026-08-16) — tres campos nuevos; el backend ya los aceptaba. |
| **L46** | El desglose **hombres/mujeres** vive sólo en la ficha impresa. | `collection_material_field_form_rows()` lo pide en papel; no está ni en el registro de la app ni en el Excel. Puede ser deliberado —el sexo se deriva de las respuestas para las cuotas— o una fuga. | ⛔ **bloqueado** — no lo declaro defecto sin saber para qué se usa en campo. |
| **L47** | Las **190 observaciones** del agendamiento se perdían al regenerar. | El lector guarda la columna `OBSERVACIONES` en `replacement_note` y el generador leía `notes`. Round-trip de 40 unidades del estudio real: 11 → 0. | ☑ **hecho** (2026-08-16) — 11 → 11. |
| **L48** | `monitoreo_aulas_estado_muestra()` **no reconocía su propia salida**. | Borraba el guion bajo en vez de convertirlo en espacio, así que `en_reserva` quedaba en `enreserva`, no casaba con `en reserva` y **degradaba a `sin_contactar`** en cada vuelta de normalización. | ☑ **hecho** (2026-08-16) — los tres vocabularios son idempotentes. |
| **L49** | Las marcas de la activación se caían al normalizar. | `monitoreo_aulas_normalize_plan()` reconstruye la fila campo a campo con lista **cerrada**: `replaced_at`, `activated_at` y `activation_reason` no estaban declarados, así que el motor los escribía y el tablero los mostraba vacíos. | ☑ **hecho** (2026-08-16) — **décima** aparición del patrón. |
| **L50** | El **teléfono del docente** se leía del Excel y moría por el camino. | Dos listas cerradas en serie: el registro que arma `aulas_agendadas_a_plan()` no lo emitía, y `monitoreo_aulas_normalize_plan()` no lo declaraba. El correo sí sobrevivía, y por eso la ausencia no saltaba. | ☑ **hecho** (2026-08-16) — **undécima** aparición; ahora hay un control que compara la spec del lector contra el plan. |
| **L51** | Las **7 columnas sin nombre** de la Base de control no se avisaban. | El lector las contaba desde el principio y el dato viajaba en la respuesta del endpoint, donde nadie lo miraba. | ☑ **hecho** (2026-08-16) — control `unnamed_control_columns` en Validación, con qué hacer para arreglarlo. |
| **L52** | Un puntaje de **0 sobre 100** se mostraba como «Correcto». | El estado de `effective_representativity` salía sólo de `warning`, que exige 10 pp de desvío en **una** celda. Y «Score efectivo 0.0» no dice si 0 es bueno o malo. | ☑ **hecho** (2026-08-16) — el estado mira el puntaje y el aviso explica la escala. |
| **L53** | Aulas no usaba pestañas como los otros perfiles. | De las cinco secciones sólo `avance` tenía pestañas; telefónico y acreditación las tienen en todas. Por eso tres tablas competían por un panel (L39, L40) y el registro no cabía (L42). | ☑ **hecho** (2026-08-16) — Agenda, Avance y Consultas con sus pestañas; el mecanismo dejó de estar cableado a `avance`. |
| **L54** | «Cadena agotada: se habían usado **0**» para un aula que **nunca tuvo reserva**. | No es lo mismo una decisión del diseño muestral que un hecho del operativo. | ☑ **hecho** (2026-08-16) — hallazgo de la costura completa. |
| **L55** | Seis fichas de la misma cadena decían **lo mismo**. | Todas: «Reemplazo de AULA-01». Quien las lleva al aula no sabía cuál entra primero. `dimensions` declaraba `replacement_for` pero no `replacement_order` — **duodécima** aparición de la lista cerrada. | ☑ **hecho** (2026-08-16) — «Reemplazo 1 de AULA-01» … «Reemplazo 6 de AULA-01». |
| **L56** | La tabla de reemplazos no decía **cuál sigue ni cuál ya se usó**. | Con seis reservas del mismo titular, «reemplaza a CH 1» y «Reserva encadenada» se repiten en las seis filas. El motor traía `replacement_order` y `sample_status`; la tabla no los pedía. Y el orden **derivado** se quedaba en una variable local, así que el campo mostraba 0. | ☑ **hecho** (2026-08-16) — órdenes 1–4 y estados distintos, verificado en pantalla. |
| **L57** | La **Agenda** no distinguía titular de reserva. | Sus columnas eran código, aula, curso, sección, horario, enlace, estado de ficha, responsable y origen: con una cadena de seis, las siete filas del mismo titular sólo se diferenciaban por su código. | ☑ **hecho** (2026-08-16) — rol y «reemplaza a» delante de sección y responsable. |
| **L58** | A escala real la Agenda **no mostraba ni una reserva**. | La tabla recortaba a 80 filas y el plan ordena las reservas al final: con 196 aulas se veían `CH 1`–`CH 80` y las 26 reservas quedaban fuera. El aviso lo declaraba, pero el trabajo de L57 era invisible en un operativo de verdad. | ☑ **hecho** (2026-08-16) — tope a 400; 196 filas con sus 26 reservas. |
| **L59** | Una pestaña era alcanzable **por clic pero no por dirección**. | Al saltar de otra sección, la sección se aplica primero y la pestaña **recordada** se publica en la URL, pisando la pedida: `?seccion=consultas&pestana=reemplazos` aterrizaba en `brechas`. Lo introdujo la memoria por sección de L53. | ☑ **hecho** (2026-08-16) — la pestaña de la URL se aplica junto con su sección. |
| **L60** | El mismo defecto de dirección estaba en **los cuatro perfiles**. | No lo introdujo L53: es anterior. Medido en `acrconta` y `acnur_acg` — `avance/detalle` desde Consultas aterrizaba en `resumen`; `consultas/gps` desde Avance, en `duracion`. | ☑ **hecho** (2026-08-16) — aulas, acreditación, telefónico y territorial. |
| **L61** | El defecto de dirección no tenía guard. | Cuatro perfiles lo tuvieron a la vez y nadie lo notó: sólo lo cubría una verificación manual. | ☑ **hecho** (2026-08-16) — `MonitoringDireccionPestanaContract.test.ts` sobre los cuatro; el guard encontró un hueco en aulas al escribirlo. |
| **L62** | Los endpoints del libro **no los llamaba nadie**. | `importar-libro` y `generar-libro` existían desde hace ocho ítems con **cero consumidores** en el frontend: el ciclo «la app genera, alguien llena, la app relee» sólo se podía cerrar con `curl`. | ◐ a medias (2026-08-16) — «Generar libro» funciona end-to-end; «Leer libro llenado» queda deshabilitado con su motivo a la vista. |
| **L63** | **Aulas no tenía ni un gráfico.** | Los otros perfiles grafican con `PlotlyChart`; aulas sólo mostraba tablas. | ◐ a medias (2026-08-16) — dibujados **tres de cinco**: estado del circuito, cobertura por aula y brecha por estrato. Faltan cuota sexo×facultad y consumo de cadena. |
| **L64** | Qué gráfico es **propio del contexto de aulas**. | Decidido el catálogo: cinco, cada uno atado a una pregunta del operativo y a un dato que el tablero ya produce. | ☑ **hecho** (2026-08-16) — catálogo abajo; queda dibujarlos (L63). |
| **L65** | El circuito no se ha probado con **3700 registros**. | Medido: el motor aguanta —tablero 0,71 s, `.pulso` 0,29 s para guardar y 0,62 s para abrir— porque el trabajo escala con las **aulas**, no con las respuestas. Lo que no aguanta es el **payload**: 1,3 MB y 2,9 s por petición de estado. | ◐ a medias (2026-08-16) — motor medido y holgado; el transporte es el cuello. |
| **L66** | El **plan viajaba tres veces** en cada petición de estado. | `config.aulas_universitarias.plan` 366 KB · `aulas_universitarias.plan` 356 KB —idénticos byte a byte— y `dashboard.agenda` 337 KB. | ◐ a medias (2026-08-16) — quitada la copia idéntica: **1377 → 1045 KB**. Las otras dos tienen consumidores distintos. |
| **L29** | La app no lee «Base de control». | Seis grupos de control por aula. | ☑ **hecho** (2026-08-16) — lector + endpoint. **194 filas, 36 campos**; las 7 columnas sin nombre de la cabecera se reportan. |
| **L34** | `VALIDO TOTAL` dice **NO CUMPLE en 149 de 194 aulas**. | Lo calcula el propio Excel contra los umbrales 70T/70P. | ⛔ **bloqueado** — hay que entender si es el criterio o el operativo antes de llevarlo a ningún tablero. |
| **L35** | La app no **generaba** el libro, sólo lo leía. | Sin generarlo, cada estudio arranca copiando el del anterior y los encabezados derivan hasta que dejan de leerse. | ☑ **hecho** (2026-08-16) — `aulas_libro_generar()` + `POST /api/monitoreo/aulas/generar-libro`. Round-trip probado: lo que escribe lo vuelve a leer. |
| **L36** | El libro generado no se registra como **fuente** de Monitoreo. | En telefónico el Excel de barrido es una fuente que el motor consulta. | ☑ **hecho** (2026-08-16) — `kind = aulas_libro` y los roles `agendamiento` · `parte_campo` · `control`. El mismo libro en Drive entra como `google_sheets` con esos roles. Los otros tres modos no cambian. |
| **L37** | Un rol llamado `campo` es **indistinguible de la ausencia de rol**. | `.monitoreo_safe_name("")` devuelve literalmente `"campo"` como relleno. Declararlo rol válido convertía en «campo» a **toda fuente sin rol de todos los modos**. | ☑ **hecho** (2026-08-16) — el rol se llama `parte_campo`; hay test que fija por qué no puede llamarse `campo`. |
| **L30** | El modelo mezcla **dos ejes de estado** en uno. | `operational_status` junta agendamiento y aplicación. En el estudio real son columnas distintas y una fila puede estar `REEMPLAZADA` en muestra y `APLICADA` en campo. | ☑ **hecho** (2026-08-16) — `sample_status` y `application_status` son campos propios, cada uno con su vocabulario. `operational_status` se queda como estaba. |
| **L31** | Falta el **ciclo de contacto**. | `MEDIO DE CONTACTO`, `FECHA DE LLAMADA` y `NÚMERO DE INTENTOS` no existen en el modelo. Sin ellos no se explica por qué un aula sigue sin agendar. | ☑ **hecho** (2026-08-16) — `contact_medium`, `contact_date` y `contact_attempts` llegan al plan. En el estudio real: **232 aulas con intentos, hasta 7 llamadas**. |
| **L32** | El parte de campo está **incompleto**. | Faltan `DUPLICADOS (YA RESPONDIERON)`, `CANTIDAD DE EFECTIVAS` —que es el número que manda, no «encuestas aplicadas»— y el **aula real** donde se aplicó, que puede no ser la planificada. | ☑ **hecho** (2026-08-16) — `duplicates`, `effective_surveys` y `actual_room` completan el parte. |
| **L5** | Activar un reemplazo no es un gesto de la app. | El modelo tenía el vocabulario; faltaba la acción. | ☑ **hecho** (2026-08-16) — motor, endpoint y botón. Verificado en el navegador: `CH 4` → `R 4.1` → `R 4.2` → cadena agotada. |
| **L6** | El registro de campo no existe como concepto. | **Premisa corregida (2026-08-16): sí existe.** `collection_material_field_form_rows()` lo define entero. Pero pedía asistentes y rechazos y **no duplicados ni efectivas**, que son los dos números que el cuadre comprueba: quien aplica en el aula no anotaba lo que después hay que meter en el Excel y en la app. | ☑ **hecho** (2026-08-16) — los cuatro números en la fila de aplicadas. |
| **L7** | La ficha desperdicia alto en blanco y el enlace impreso corta a media palabra. | `collection_render_ficha.R`, layout `single_sheet`. | ☑ **hecho** (2026-08-16) — hueco interior mayor de 206 px a 124 px (11,7% → 7,1% del alto). El grid reparte su banda en vez de amontonarse; capacidad 6 → 8 filas (7 con careta). El corte del enlace ya lo había resuelto L1. |
| **L7b** | El lector de QR asumía la geometría de la ficha **sin** careta. | `collection_qr_matrix_from_png()` pedía `.crf_layout()` sin `branded`; funcionaba solo porque ambas variantes coincidían en `qr_y`. Hallazgo de propina al hacer L7. | ☑ **hecho** (2026-08-16) — el lector recibe `branded`. |
| **L8** | `apiMonitoreoAulasConfig` tiene 0 consumidores. | `frontend/src/api/monitoreo.ts`. | ☑ **hecho** (2026-08-16) — **no era limpieza: era el eslabón roto del circuito.** Su `source_mapping` es lo único que dice qué columna de Kobo lleva el id de colector, y sin UI nadie podía fijarlo. El fallback por nombres convencionales no incluía `collectorID`, que es justo el nombre que produce nuestro propio QR. Añadido a las dos listas de candidatos; el endpoint sigue sin superficie pero ya no hace falta para el caso normal. |
| **L9** | No hay test que ate la costura completa (selección → enlaces → fichas → handoff). | `api/tests/testthat/test-collection-costura-aulas.R`. | ☑ **hecho** (2026-08-16) — 41 asertos. Controles verificados revirtiendo L1, L3 y la geometría de L7: los tres lo ponen rojo. |
| **L10** | El QR no se decodifica a texto. | `collection_qr_matrix()` usa el paquete `qrcode`; `collection_qr_matrix_from_png()` relee la matriz del PNG y la compara módulo a módulo. | ◐ a medias — **la parte medible está hecha**: el fixture ya usa el enlace real (86 chars, 49 módulos) en vez del juguete de 18, y hay guardia de legibilidad física (mm por módulo). **Decodificar a texto queda ⛔ bloqueado**: no hay decodificador en R ni en Python en esta máquina, y añadirlo es una dependencia nueva en `DESCRIPTION` que el CI tendría que instalar. |

### Espera al usuario

Cuatro decisiones. Ninguna es de implementación: cada una cambia lo que el
estudio *significa*, y elegir por ti sería decidir metodología.

(El quinto ⛔ del documento, dentro de **L10**, es de otra naturaleza: lo bloquea
una dependencia que el CI tendría que instalar, no un juicio tuyo.)

| Ítem | Qué hay que decidir | Lo aprendido sin tocarlo |
|---|---|---|
| **L2** | Cuál es el identificador de campo que viaja a Kobo | **No es un solo productor.** El adapter usa `.ca_unit_value()`, que prefiere `link_key` → `prefill_value` → `logical_collector_id` → `unit_id`: **el plan ya puede decidirlo** poniendo `link_key`, sin tocar `.collection_stable_id()`. Pero la ruta legacy fuerza `prefill = list(collectorID = unit_id)` con el slug interno **aunque el enlace pegado ya traiga `OP-01`**. Hay dos caminos que eligen distinto y el legacy pisa al operador. Cerrar L2 es unificarlos. |
| **L12** | Qué cuenta como respuesta válida | Falla **abierto** cuando no hay columna de estado —todo cuenta— y **cerrado y en silencio** cuando la hay: declarar `status_var = "_validation_status"` descarta **todas** las respuestas de Kobo, porque Kobo deja esa columna vacía mientras nadie las revisa y `""` no está entre los estados válidos. |
| **L34** | Si `VALIDO TOTAL = NO CUMPLE` en **149 de 194 aulas** (77%) es el criterio o el operativo | Lo calcula el propio Excel contra los umbrales 70T/70P. Llevarlo a la app sin saber cuál de los dos falla convertiría un criterio discutible en una alerta permanente. |
| **L46** | Para qué se usa el conteo **hombres/mujeres** en el aula | Se pide **en papel** (`collection_material_field_form_rows()`) y no está ni en la app ni en el Excel. Puede ser deliberado —el sexo se deriva de las respuestas para las cuotas— o una fuga real. |

**Fuera de la cola, pero es tuyo**: la Base de control del estudio de 2025 trae
**7 columnas con datos y la cabecera vacía** — tres conteos enteros y tres
proporciones que suman exactamente 1, más la facultad. Ponerles nombre en la
hoja basta para que la app las lea.

---

## Trampas

- **El `access_ref` del deployment está bien; el que sale mal es el payload.**
  Mirar solo el deployment persistido da un falso verde: ahí el parámetro
  aparece una sola vez. La duplicación la produce `.collection_access_url()`
  **al resolver**, así que sólo se ve en el `qr_payload` compilado y en el
  `link` del handoff.
- **`AulasApplicationFlow` parece la superficie de campo y no lo es.** Son 157
  líneas sin una sola llamada a la API: es un stepper de navegación
  (muestra → QR → fichas → monitoreo). Se renderiza en cuatro sitios distintos,
  lo que refuerza la ilusión de que el flujo está implementado.
- **Un endpoint que existe + un cliente de API que existe + tests que pasan ≠
  capacidad que existe.** `apiMonitoreoAulasAgenda` está escrita, tipada y no la
  llama nadie. Buscar el endpoint en el backend habría dado un verde falso;
  la pregunta correcta es quién lo consume.
- **Que la selección llegue sin `deployment` es correcto, no un bug.**
  `collection_state_seed()` deja `deployment = NULL` cuando las filas no traen
  `link`. El deployment lo produce el adapter contra un formulario Kobo real.
- **La suite completa de R tarda ~1 h.** Para este GOAL el gate es
  `testthat::test_file()` sobre `test-collection-*.R` y la simulación, no
  `test_dir`.
- **Un aserto sobre una sola capa no atrapa un defecto de costura.** El primer
  test que escribí para L1 —resolver un binding limpio y contar el parámetro—
  pasaba **igual con el código viejo**, porque la duplicación nacía de que el
  adapter ya traía el parámetro. El test que sirve recorre adapter →
  resolvedor. Si el arreglo no cambiara nada, ¿el aserto seguiría pasando?
- **Un control que no se ejecuta no es un control.** El aserto de desborde del
  grid probaba la plantilla **built-in**, que cabe en cualquier caso; la única
  que llegó a desbordarse fue la de **careta**. Pasaba en verde con el bug
  reintroducido. Verificar el arreglo no basta: hay que revertirlo y comprobar
  que el test se pone rojo — y sobre la variante que de verdad falla.
- **El metro promediado mentía sobre el blanco.** «Bandas horizontales sin
  tinta» en 20 bandas de ~88 px promedia una línea de texto fina hasta cero, así
  que marcaba vacío lo que tenía contenido, y daba 6/20 idéntico antes y después
  de un cambio real. El metro que sirve es **la racha más larga de filas de
  píxeles sin una sola gota**, ignorando los márgenes. Con el metro bueno se ve
  que el paso intermedio (mover anclajes) **empeoró** la hoja: 206 → 268 px.
- **Mover un hueco no es cerrarlo.** Subir los anclajes cerró la franja de la
  cabecera y abrió una igual bajo el grid. El esqueleto de la ficha es fijo
  (cabecera · datos+QR · enlace · indicaciones · registro · pie); la parte
  elástica es el grid, y hasta que no repartió su banda el aire solo cambió de
  sitio.
- **Un verificador que asume dónde está lo que verifica da verde sin mirar.**
  `collection_qr_matrix_from_png()` pedía siempre la geometría de la ficha sin
  careta. Pasaba porque las dos variantes coincidían en `qr_y` por casualidad;
  el día que dejaron de coincidir, el lector leía papel en blanco.
- **`utils::modifyList()` recursa dentro de las listas anidadas.** Un fixture de
  binding con `modifyList(base, list(prefill = ...))` **fusiona** las claves de
  `prefill` en vez de reemplazarlas, y el test emite dos parámetros donde pide
  uno. Costó un rojo que parecía del motor y era del test.

- **Cuando algo se escribe dos veces, se arregla una — y a veces son tres.**
  El emparejamiento respuesta→aula apareció en **tres** sitios (dashboard,
  `course_status` y la resolución de facultad) y el vocabulario de
  identificadores en un cuarto (la agenda). Los otros dos defectos gemelos
  fueron el prefill del enlace (adapter vs resolvedor) y la coerción numérica
  (`brecha` sí, `application_state` no). Al encontrar uno, **barrer el módulo**
  antes de darlo por cerrado: `grep` por la indexación, no por el síntoma. Cuatro sitios de este
  GOAL tenían el mismo defecto corregido en un lado y no en el otro: el prefill
  del enlace (adapter vs resolvedor), la coerción numérica (`brecha` sí,
  `application_state` no), el emparejamiento respuesta→aula (dashboard vs
  `course_status`) y el vocabulario de estados. Al encontrar uno, buscar su
  gemelo antes de dar el arreglo por cerrado.
- **Los fixtures se escribían mirando al consumidor, no al productor.** Tres
  bugs reales vivían escondidos por eso: el cruce buscaba `collector_id` cuando
  el sistema genera `collectorID`; el QR se probaba con un enlace de 18
  caracteres cuando produce 86; el desborde se probaba con la plantilla que sí
  cabe. La suite estaba verde sobre un mundo que la app no genera.
- **Los KPI globales pueden estar bien y los desgloses vacíos.** Sumar sin
  agrupar oculta que el emparejamiento no funciona: el tablero decía «40
  válidas» con las siete aulas en cero. Un panel coherente en los números
  grandes no prueba nada sobre los pequeños, que son donde se decide.
- **Ante un cero inesperado, verificar primero la forma de lo que se está
  leyendo.** Tres veces en esta sesión un diagnóstico propio apuntó a un fallo
  inexistente: «no es data.frame» leído como «vacío», la ruta
  `dashboard.kpis` cuando el tablero de aulas cuelga de otra clave, y un aserto
  inerte. El cero era del lector, no del sistema.

---

---

### El patrón que más caro salió: la lista cerrada de campos

**Once veces** un dato se perdió porque alguna función reconstruye su salida
campo a campo con una lista cerrada, y el campo nuevo no estaba declarado. No
falla ruidosamente: **devuelve vacío**, que es indistinguible de «no hay dato».

Dónde apareció: el prefill del enlace · la coerción numérica · el emparejamiento
respuesta→aula (tres copias) · el vocabulario de estados · los roles de fuente
(switch + allowlist) · `partes_campo` en el normalizador de config · las tres
marcas de la activación · `teacher_phone` (dos listas en serie) · `notes`.

**El control que quedó** (`test-monitoreo-aulas-campos-declarados.R`): compara la
spec de cada lector contra los campos que el plan conserva. Un campo nuevo sin
su declaración pone rojo el test, en vez de descubrirse cuando un estudio real
pierde datos.

### Productor y consumidor que no hablan igual

**Nueve veces**, dos piezas escritas para entenderse usaban nombres distintos:
`collector_id` vs `collectorID` · `applicator`/`applied_at` vs
`applied_by`/`applied_date` · `notes` vs `replacement_note` · un estado
(`sin_acceso`) colado donde iba un motivo (`docente_no_autoriza`).

La forma de detectarlo es el **round-trip**: producir, consumir y comparar. Los
tests por capa pasaban con los dos vocabularios.

### El instrumento produce el hallazgo, no el código

**Tres veces** di por defectuoso lo medido cuando el defectuoso era mi forma de
medir:

- el título real era `"STATUS\nMUESTRA"` con salto de línea —el lector lo
  normaliza y mi `grep` no—, y conté **0** donde había 230;
- el conteo crudo de la hoja de control dio **40 578 filas** porque `read_excel`
  arrastra el rango usado entero;
- un barrido con `sleep` fijo leyó el render anterior y reportó dos vistas rotas
  que estaban bien.

Y en el mismo terreno: **consultar la clave equivocada** devuelve vacío, que
parece un cero real. `application_state` vive en `course_status`, no en `agenda`;
las notas viven en `replacement_note`, no en `notes`.

**La regla**: no aceptar una divergencia sin reproducirla desde el otro lado.

### Un verde vale lo que su fixture

- El estudio real de 2025 deja **vacía** la columna del teléfono en sus 1012
  unidades, así que el round-trip real daba «0 → 0» y parecía correcto. Hizo
  falta un caso **sintético** para probar el mecanismo.
- Los fixtures se escribían mirando al **consumidor**, no al productor. Eso
  escondió tres defectos: un `collector_id` mal nombrado, un QR de 18 caracteres
  donde el real tiene 86, y una plantilla que siempre cabía.
- Un aserto que no distingue el caso bueno del malo no verifica nada. Cada
  reparación de este GOAL lleva su **control invertido**: revertir el arreglo y
  ver el test en rojo.

### Medir en un solo viewport no es medir

La reparación de L39 —tres paneles en vez de uno— se veía bien a 1440×1000 y a
1024×600 **colapsaba dos de los tres a altura cero**. La matriz de QA tiene
cinco viewports por esto exactamente.

En el mismo terreno, dos causas de layout que costaron varios intentos:

- **`align-self: start`** hace que un ítem de grid tome su alto de *contenido* en
  vez del de su pista, así que un `minmax(0, 1fr)` de arriba no puede
  encogerlo. Era la causa de que el registro midiera 422 px donde le tocaban 219.
- **`:has()` anidado es inválido** y descarta la regla entera **en silencio**.
- El **min-height automático** de un contenedor de grid es su contenido: sin
  `min-height: 0` el overflow no llega a activarse nunca.
- Con el panel del navegador **oculto**, el navegador ralentiza los `setTimeout`:
  un bucle de espera de 4 s de reloj excede el timeout de la herramienta.

### La navegación se pide por dirección, no por etiqueta

La sección se llama `modelo` y su etiqueta dice «Agenda». `ir("…/agenda")` no se
queja: se queda donde estaba, y la captura siguiente parece decir que la vista no
cambió.

### Lo que la estructura resolvió sola

De las cinco secciones de aulas **sólo `avance` tenía pestañas**; telefónico y
acreditación las tienen en todas. Esa asimetría estaba detrás de cuatro ítems
que se habían tratado como problemas de CSS: la sección Avance no mostraba el
avance (tres vistas en un panel), el alto se repartía mal entre ellas, el
registro no cabía, y «dónde vive el registro» ya estaba respondido por la
gramática. **Antes de pelear con el alto, comprobar si la superficie está en la
dimensión que le toca.**

### Decisiones de diseño que conviene no revisitar

- **La activación no toca `activation_weight_status`**: ese campo dice que el
  peso de una reserva es condicional *por diseño muestral*, y el relato de
  Cálculo de muestra lo explica así.
- **Con la cadena agotada, la caída no se marca reemplazada**: no lo está, y
  decirlo la sacaría del avance sin que nadie cubra su meta.
- **Una reserva sin `replacement_for` deja el titular vacío**: inventar `CH 9`
  desde la posición es peor que no decir nada, porque es *plausible*.
- **El generador devuelve lo ya registrado y deja en blanco lo que no existe**:
  escribir siempre en blanco borraba el operativo en curso; rellenar siempre
  sería inventar campo.
- **El lector no adivina una columna sin nombre**: la declara y dice cuántas
  quedaron fuera.
- **Sin asistentes o sin efectivas no se comprueba el cuadre**; rechazos y
  duplicados ausentes **sí** valen cero, porque son cantidades de eventos.

### Un error de método que costó trabajo

`git checkout` sobre un archivo con ediciones sin stagear, para deshacer **una
línea** de un control invertido, se llevó por delante las dos ediciones del
turno. Para revertir un experimento sobre trabajo vivo: copia y restaura el
archivo.

### Cuando otro trabajo mueve el suelo

Mientras este GOAL avanzaba, otra sesión trabajaba **en el mismo repositorio** y
subió `reserve_depth_target` de 1 a 6, aflojando el candado de celda a facultad.
Las cadenas **planificadas** pasaron de uno o dos eslabones a **once**, y eso
destapó **cuatro defectos** que no existían antes:

| Superficie | Qué se rompía con cadenas largas |
|---|---|
| Handoff | Había que comprobar que propaga la cadena entera, no sólo el primer eslabón |
| Ficha impresa | Las seis decían «Reemplazo de AULA-01»: nadie sabía cuál entra primero |
| Tabla de reemplazos | No mostraba orden ni estado, las seis filas eran iguales |
| Agenda | No distinguía titular de reserva |

El libro Excel aguantó sin tocar nada: 7 bloques y 141 columnas, con los órdenes
intactos al reimportar. Y la lista del registro tampoco necesitó cambio — ya
mostraba código y estado.

**Corrección (2026-08-16)**: escribí que «las cadenas reales pasan a ser de hasta
11–12». Lo medido después por la sesión paralela dice otra cosa —y la distinción
importa—: **planificadas** llegan a once; **consumidas** en 2025 fueron **dos**.
El operativo gastó 26 reemplazos para 170 titulares —0,153 por titular— con 24
aulas en reserva 1 y sólo 2 en reserva 2.

Eso **no invalida las cuatro reparaciones**: la ficha se imprime para toda la
cadena planificada, y la agenda y la tabla la muestran entera. Lo que corrige es
la premisa. Es la misma distinción que este GOAL ya cuidaba entre muestra
planificada y efectiva, aplicada a las cadenas.

**La lección**: un cambio de rango en otra capa no rompe nada por sí mismo, pero
convierte en ambiguo lo que era suficiente. Cuando un parámetro de escala se
mueve, hay que recorrer las superficies que muestran esa escala — y comprobar si
el rango que se mueve es el planificado o el consumido, porque no son el mismo.

**Y sobre trabajar en paralelo**: los commits de ambas sesiones conviven
intercalados y nada se pierde, pero un gate completo desde cualquiera de las dos
mezcla el trabajo a medias de la otra. Nueve fallos que parecían deuda propia
eran suyos.

### Contratos globales que ningún gate parcial mira

El gate escalado al diff es correcto para lo que el área comprueba, pero hay
tests **globales** que ninguna corrida por área ejecuta. `test-errors-registry.R`
es uno: exige que todo código `E_*` del backend tenga su fila en el registro, y
esta sesión introdujo **quince** sin registrar —los lectores del libro, el
generador, la activación y dos rutas— sin que ningún gate lo dijera.

Regla que queda: **un cambio que añade códigos `E_*` corre ese test aunque el
resto se acote.**

### El aviso que culpa a lo que está bien

`make reference-project-seed-aulas REFERENCE_PROJECT=hsvg2026` fallaba con «revisa
`mapping$student_id`». El mapeo era **correcto**: la hoja trae 136 284 filas con
29 083 códigos y la columna existe. Lo que pasa es que en un proyecto de
referencia los ids de alumno **se subrogan** —el hash queda, los ids quedan en
blanco— porque son PII. La siembra no puede correr ahí, y eso no es un defecto
sino la consecuencia de anonimizar.

Cuatro comprobaciones se fueron siguiendo la pista falsa que el propio mensaje
daba. Un aviso que nombra el síntoma manda a buscar donde no es.

### Correcciones a afirmaciones propias
Se dejan explícitas porque afectan a lo que se puede dar por cierto:

- **El QR nunca estuvo en riesgo de no escanearse.** Al abrir el GOAL se dijo que
  el parámetro duplicado lo dejaba «al doble de denso, que es lo que se paga en
  un aula con mala luz». Medido: 1,25 mm contra 1,46 mm por módulo, ambos muy
  por encima del umbral. L1 vale por el enlace impreso y la higiene del payload.
- **L10 partía de una premisa inexacta.** El QR sí se relee del PNG y se compara
  módulo a módulo en cinco archivos de test. Lo que falta es decodificarlo a
  texto, que es más estrecho.
- **L6 partía de una premisa falsa.** El vocabulario del registro de campo ya
  existía completo en `collection_material_field_form_rows()`.
- **L7 no cierra V3.** V3 es el identificador que viaja a Kobo (L2, bloqueado).
  La vara mide capacidad, no compostura de la pieza.
- **La sospecha sobre `monitoreo_normalize_config()` era falsa.** Conserva
  `aulas_universitarias` con su plan. No se tocó — marcarla como sospecha en vez
  de como bug evitó dañar código sano.

### Deuda de verificación
**L23**: los números de L15–L22 están respaldados por tests y por la simulación,
**no por pantalla**. L13 y L14 sí se confirmaron en UI real. Verlos exige montar
un estudio de aulas completo desde la UI —tres intentos por vías sintéticas
fallaron, y el obstáculo era el atajo, no el producto—.


### 2026-08-16 — El circuito contra el operativo real, no contra el extremo

Todo lo anterior se probó con cadenas sueltas: una, dos, seis, once. Faltaba el
estudio **entero**, con la forma que el operativo tuvo de verdad — 170 titulares
y 26 reemplazos consumidos, 24 en reserva 1 y 2 en reserva 2.

| Paso | Tiempo | Resultado |
|---|---:|---|
| Normalizar el plan | 0,2 s | **196 unidades** |
| Tablero | 0,7 s | 6 estratos · 12 cuotas · 26 reemplazos |
| Libro ida y vuelta | 0,9 s | 196 → 196, códigos idénticos |
| Cuadre sobre 170 partes | — | los **2** sembrados, ni uno más |

Las 196 unidades coinciden con los 196 partes que el Excel de 2025 tiene. Buena
señal de que la forma es la correcta.

Dos comprobaciones que sólo tienen sentido a esta escala:

- **Los desgloses no se vacían.** Seis facultades y doce celdas de cuota con
  196 aulas: sumar sin agrupar habría dado KPI correctos y desgloses vacíos, que
  es exactamente como se escondió un defecto antes en este GOAL.
- **El cuadre no genera falsos.** Dos descuadres sembrados entre 170 partes, y
  encuentra dos: ni uno de más por redondeo, ni uno de menos.

Y el caso **dominante**: en 2025, 146 de 170 titulares no consumieron ningún
reemplazo. Que el aviso distinga «nunca tuvo reserva» de «se agotó la cadena»
importa más aquí que en el caso raro — es lo que verá la mayoría de las aulas.


### 2026-08-16 — 196 aulas en pantalla, y lo que sólo se ve ahí

El QA visual había mirado nueve aulas. `--escala 2025` en el sembrador pone las
**196** del operativo real, con sus 26 reservas y 600 respuestas.

Lo primero que apareció: la Agenda mostraba `CH 1` a `CH 80` y **cero reservas**.
La tabla recorta a 80 filas —y lo declara, «Mostrando 80 de 196»— pero el plan
ordena las reservas al final, así que el rol y el «reemplaza a» que L57 añadió
**no se veían nunca** en un estudio de verdad.

El tope existía para no reventar el DOM. Medido: **196 filas con scroll interno
no lo revientan**, la vista responde igual y se llega al final —las últimas son
`R 23.1`, `R 24.1`, `R 1.2`, `R 2.2`, cada una con su titular—. Subido a 400,
que cubre un estudio entero y sigue declarando el recorte si algún día se pasa.

**La lección**: un recorte declarado no es un engaño, pero tampoco es inocuo. Si
lo que queda fuera es sistemáticamente el mismo tipo de fila —aquí, todas las
reservas, porque van al final por construcción— el recorte deja de ser un límite
de tamaño y pasa a ser un filtro que nadie eligió.

Con esto la escala real queda vista en pantalla: 196 cursos-horario, 600
respuestas, representatividad 95%, 12 celdas de cuota y las 26 reservas
alcanzables.


### 2026-08-16 — L59: alcanzable por clic, no por dirección

El barrido a escala 196 lo destapó: `consultas/reemplazos` salía con **0 filas y
sin título**, y `consultas/brechas` bien. No era timing —lo comprobé pidiéndola
sola, tres veces—: **la URL nunca llegaba a `reemplazos`**.

El clic en la pestaña sí funcionaba, y mostraba sus 26 reservas. Eso acota el
defecto: la vista existe y es correcta; **lo que fallaba era llegar a ella por
dirección**, que es exactamente lo que el contrato v3 prohíbe.

La causa la introdujo la memoria por sección de L53. Al pedir
`?seccion=consultas&pestana=reemplazos` estando en `calidad`:

1. la sección pedida difiere → se aplica primero, y la pestaña llega «en el
   siguiente paso»;
2. al activar `consultas`, la pestaña activa pasa a ser la **recordada**
   —`brechas`— y se publica en la URL;
3. el segundo paso no llega: la URL ya dice `brechas` y no hay diferencia que
   seguir.

La memoria por sección es útil —volver a una sección la reencuentra donde se
dejó— pero **no puede ganarle a una dirección explícita**. Ahora `onSeccionPedida`
lee la pestaña de la misma URL y la aplica junto con su sección.

**Y un aserto mío que afirmaba de más**: escribí que el lector canónico resuelve
los alias heredados (`tab`, `step`). No los resuelve — lee sólo `pestana`. El
test lo dice ahora medido en vez de supuesto.


### 2026-08-16 — L60: el defecto no era sólo de aulas

Tras reparar L59 quedaba la pregunta obvia: telefónico y acreditación usan el
mismo hook y también recuerdan pestaña por sección. **No lo di por hecho: lo
medí** levantando `acrconta`, el proyecto de referencia de acreditación.

- Carga directa por URL: **correcta** — `?seccion=avance&pestana=actores`
  aterriza en «actores».
- Salto desde otra sección: **falla** — pedir `avance/detalle` desde Consultas
  aterriza en `resumen`.

Así que el defecto **no lo introdujo la memoria por sección de L53**: es anterior
y afecta a dos perfiles que llevan mucho más tiempo en uso que el de aulas.

La reparación va dentro de `navigateSection`, no en un envoltorio del callback,
porque hay un **test de contrato que analiza el AST** y exige que
`onSeccionPedida` llame directamente a `setActiveView`, `loadView` y mueva
`activeViewRef`. Envolverlo lo puso rojo — el contrato existe para que una
navegación externa cargue el scope, y tenía razón.

Dos detalles que la reparación necesita:

- **La sección de la URL debe coincidir** con la que se activa. Eso distingue
  «vengo de una dirección» de «vengo de un clic», donde la URL todavía trae la
  pestaña de la sección anterior y aplicarla sería incorrecto.
- `changeLocalTab` se declara **después** de `navigateSection`, así que la
  llamada va por una ref que se rellena tras su declaración. Sin eso, TypeScript
  rechaza el uso antes de la declaración.

Verificado en pantalla: `?seccion=avance&pestana=detalle` desde Consultas
selecciona la cuarta pestaña, que es la pedida.


### 2026-08-16 — Los cuatro perfiles, no uno

Territorial cerraba el barrido. Medido sobre `acnur_acg`, con sus 1693
respuestas: pedir `consultas/gps` desde Avance aterrizaba en `duracion` — la
pestaña recordada de Consultas.

| Perfil | Carga directa | Salto entre secciones |
|---|---|---|
| Aulas | ✓ | **fallaba** |
| Acreditación | ✓ | **fallaba** |
| Telefónico | ✓ | **fallaba** |
| Territorial | ✓ | **fallaba** |

Los cuatro comparten la misma forma: memoria de pestaña por sección más un
`onSeccionPedida` que sólo activa la sección. La pestaña activa de la sección
nueva se publica en la URL antes de que llegue el segundo paso, y pisa la
pedida.

**Lo que hace que sea un defecto y no una preferencia**: la carga directa
funcionaba en los cuatro. Un enlace pegado en frío abría la vista correcta; el
mismo enlace seguido desde dentro de la app, no. Esa asimetría es la que
convierte «recordar dónde estabas» en «ignorar lo que te piden».

La condición que evita el falso positivo es la misma en los cuatro: **la sección
de la URL debe coincidir con la que se activa**, porque en un clic de sección la
URL todavía trae la pestaña de la anterior.


### 2026-08-16 — L61: el contrato que faltaba, y el hueco que encontró

Un defecto presente en **los cuatro perfiles a la vez**, que nadie notó y que
sólo cubría mi verificación manual, necesita un guard permanente.
`MonitoringDireccionPestanaContract.test.ts` exige dos propiedades en los
cuatro:

1. **Leer la pestaña de la URL** al cambiar de sección — sin eso, la recordada
   de la sección destino la pisa.
2. **Exigir que la sección de la URL coincida** con la que se activa — sin eso,
   un clic de sección aplicaría la pestaña que la URL todavía trae de la
   anterior: válida por casualidad si comparten nombre, equivocada siempre.

**Y el guard encontró un hueco al escribirlo**: aulas cumplía la primera y no la
segunda. En aulas el clic de sección no pasa por ese callback, así que
*funcionaba*, pero depender de eso es suponer quién dispara qué. Ahora la
condición es explícita y la misma en los cuatro.

Control invertido: quitar las dos lecturas en territorial pone 2 en rojo;
restaurarlas, 8 en verde.

**Por qué este test mira el código y no el comportamiento**: reproducir el
defecto exige montar el perfil, cargar un proyecto real y navegar entre
secciones — lo que hice a mano cuatro veces. El guard comprueba la propiedad que
lo sostiene, que es lo que se puede verificar en cada corrida sin un navegador.


### 2026-08-16 — L62: el ciclo del libro llega a la app, a medias

Ocho ítems construyendo el libro operativo, y **ningún botón lo llamaba**. Los
dos endpoints tenían **cero consumidores** en el frontend: el ciclo que pediste
—la app produce el Excel, alguien lo llena, la app lo relee— sólo se podía
cerrar con `curl`. Es exactamente el patrón que este repo ya tiene anotado: una
capacidad existe sólo si alguien la consume.

**Lo que quedó funcionando**, verificado end-to-end: «Generar libro» en Fuentes
produce el Excel de tres hojas y lo descarga. Con el proyecto de QA:
`qa_aulas_libro_aulas_16_08_26.xlsx`, 9 unidades y 3 partes.

**Y un defecto de propina, reparado**: el botón exigía `aulasPlanImported()`,
que pide `selection_run_id` —presente sólo en planes venidos del cálculo de
muestra—. Un plan que llegó **por el propio libro** no lo tiene, así que el
ciclo quedaba cerrado sobre sí mismo: importas 196 aulas y no puedes regenerar
el libro. Para producir el Excel basta con que haya unidades.

**Lo que no quedó**: la subida directa desde el navegador. Diagnosticado, no
supuesto:

| Parsers | Qué pasa |
|---|---|
| por defecto | `E_BAD_JSON` — intenta parsear el multipart como JSON |
| `multi, json` | el `file` **llega**, pero plumber muere al parsear la parte interna: «No suitable parser found to handle request body type application/vnd.openxmlformats-officedocument…» |
| `multi, octet, json` | el `file` deja de llegar |

La vía del `file_id` sí funciona. El botón «Leer libro llenado» queda visible y
**deshabilitado con su motivo en el tooltip**, no escondido: el ciclo tiene dos
mitades y conviene que se vea cuál falta.


### 2026-08-16 — La vara se amplía: ver el avance, y aguantar 3700 registros

Gonzalo pide dos cosas que el GOAL no cubría:

**1. Gráficos propios del contexto de aulas.** Revisado cómo lo hacen los otros
perfiles, que es el vocabulario disponible:

| Perfil | Qué grafica | Con qué |
|---|---|---|
| Acreditación | Ritmo diario del avance, tendencia telefónica | `PlotlyChart` · `ritmoDiario.ts` (cortes diarios y semanales, calendario expandido, ejes con padding) · `coloresDeResultado` · `MarcoDeEjesSiHaceFalta` |
| Telefónico | Embudo en franja, barras apiladas | mismo lenguaje, CSS propio |
| **Aulas** | **nada** | — |

El lenguaje visual está y es compartido; lo que falta es decidir **qué** graficar
para aulas. La unidad aquí no es la llamada ni el actor: es el curso-horario con
su aforo y su meta. Copiar el ritmo diario de telefónico sería traer una
pregunta que en aulas no se hace igual.

**2. Escala real de 3700 registros.** Lo medido en esta sesión llega a **600
respuestas sobre 196 aulas**. El estudio real sube a 3700 desde Kobo, y hay que
medir la sincronización, el tablero, las tablas y —cuando existan— los gráficos
a esa escala. El recorte de filas ya dio un susto a 196; a 3700 hay que
comprobar qué se recorta y qué se degrada.

Queda anotado como **V13**, **V14** y los ítems **L63–L65**. La cola vuelve a
tener trabajo abierto.


### 2026-08-16 — L65: el motor aguanta 3700; el transporte no

Medido con 3700 respuestas de 43 columnas sobre 196 aulas, que es la escala del
estudio real:

| | Tiempo |
|---|---:|
| Tablero completo | **0,71 s** |
| Guardar el `.pulso` | 0,29 s (0,07 MB) |
| Abrirlo | 0,62 s |

**El motor no se inmuta**, y la razón es estructural: el trabajo escala con el
número de **aulas** (196), no con el de respuestas — éstas se agregan una vez y
se olvidan. Pasar de 600 a 3700 no cambió el tiempo del tablero.

**Lo que sí duele es el payload**: cada petición de estado pesa **1,3 MB** y
tarda **2,9 s** en el navegador. Y la composición dice por qué (L66):

| Parte | KB |
|---|---:|
| `config.aulas_universitarias.plan` | 366 |
| `aulas_universitarias.plan` | 356 |
| `dashboard.agenda` | 337 |
| `dashboard.brechas` | 157 |
| `dashboard.course_status` | 103 |
| `dashboard.reemplazos` | 45 |

Los dos primeros son **idénticos byte a byte** —196 aulas × 80 campos, dos
veces— y el tercero es el mismo plan con dos campos más. **722 KB de 1377 son
el mismo plan repetido**, y el frontend pide estado en cada cambio de sección.

Con nueve aulas esto no se veía: el payload rondaba los 60 KB y la duplicación
era invisible. Es el mismo patrón que el recorte de filas — un problema que sólo
existe a la escala en que el estudio ocurre de verdad.


### 2026-08-16 — L66: fuera la copia que no defendía nadie

De las tres copias del plan en el payload, una era **indefendible**:
`aulas_universitarias.plan` en la raíz del estado, idéntica byte a byte a la de
`config` y con **cero consumidores** en el frontend — el único lector es
`state.config.aulas_universitarias`. Comprobado antes de tocarla, y sin tests
que la miraran.

| | Antes | Ahora |
|---|---:|---:|
| Payload total | 1377 KB | **1045 KB** |
| `aulas_universitarias` en raíz | 356 KB | 24 KB |
| Unidades del plan ahí | 196 | **0** |

Se conserva el resto de esa config —`enabled`, mapeos, cuotas— por si algo la
lee; lo único que se quitó es el duplicado grande.

**Las otras dos copias no son duplicación**: `config…plan` (80 campos) alimenta
el registro de campo y `dashboard.agenda` (82) alimenta la tabla. Tienen
consumidores distintos y formas distintas. Unificarlas es una decisión de
diseño —hacer que el registro lea la agenda— y no un arreglo.

**El tiempo no bajó en proporción**: sigue en ~2,8 s. Así que el cuello no es
sólo el tamaño; hay ~500 ms de cálculo en el backend (`derived=miss`) y el resto
se va en serializar y parsear un JSON de 1 MB. Bajar el peso ayuda pero no es la
única palanca.

Verificado tras el cambio: registro con sus 196 aulas, agenda con 196, avance
con 196 y brechas con 91.


### 2026-08-16 — L64: el catálogo, decidido antes de dibujar

Lo que distingue a aulas de telefónico y acreditación: **la unidad tiene aforo y
meta propios**, y su campo es una sesión única, no un flujo de reintentos. Eso
descarta copiar el ritmo diario y habilita preguntas que en los otros perfiles
no existen.

| # | Pregunta del operativo | Gráfico | De dónde sale |
|---|---|---|---|
| 1 | ¿Cuántas aulas están cerradas y cuántas ni se han tocado? | Barra apilada por estado de aplicación | `course_status.application_state` |
| 2 | ¿A qué facultad mando el equipo mañana? | Barras por estrato: válidas y brecha | `avance_por_estrato` |
| 3 | **¿Están muchas aulas a medias o pocas sin tocar?** | Histograma de cobertura por aula (`válidas / meta`) | `course_status.respuestas_validas` ÷ `expected_valid` |
| 4 | ¿La composición por sexo aguanta? | Observado vs meta por celda | `quotas_sex_faculty` |
| 5 | ¿Cuánta reserva llevo gastada? | Conteo de cadena: sin reemplazo · 1 · 2+ | `reemplazos` + `sample_status` |

**El 3 es el que sólo tiene sentido aquí.** En telefónico la unidad es una
llamada y no tiene meta propia; en aulas cada curso-horario tiene la suya, así
que la *distribución* de coberturas dice algo que ningún promedio dice: 60 aulas
al 50% y 60 aulas al 100% dan el mismo avance global que 120 al 75%, y exigen
decisiones opuestas —insistir donde ya hay tracción, o abrir aulas nuevas—.

**Lo que no entra, y por qué**: el ritmo diario tal como lo hace telefónico
—respuestas por día— mide un flujo que en aulas no existe. Si algún día hace
falta un eje temporal, la unidad natural es **aulas cerradas por día**, no
respuestas: es lo que el coordinador planifica.

Los cinco salen de datos que el tablero **ya produce**, así que ninguno exige
tocar el motor. Y el lenguaje visual es el compartido: `PlotlyChart`,
`coloresDeResultado`, `MarcoDeEjesSiHaceFalta`.


### 2026-08-16 — L63: el primer gráfico, y el que sólo existe aquí

Dibujado el #3 del catálogo, que es el que justifica tener gráficos propios: la
**distribución de cobertura por curso-horario**. Sobre las 196 aulas del
operativo con 3700 respuestas:

```
Sin respuestas   ███████████████ 51
1–25 %                            0
26–50 %                           0
51–99 %          ████████ 40
Meta cumplida    ████████████████████████ 105
```

Un promedio diría «avance del 76 %» y escondería que **51 aulas no se han
abierto** mientras 105 ya no necesitan nada. Son dos trabajos distintos y el
gráfico los separa de un vistazo.

Tres decisiones sobre cómo cuenta, cada una con su test:

- **«Sin respuestas» no es «poquísimas»**: el 0 va siempre a su tramo aunque la
  razón lo pusiera en el primero. Es lo que dice si el aula ni se abrió.
- **Pasarse de la meta cuenta como cumplida**: operativamente ya no hay nada que
  hacer ahí.
- **Un aula sin meta se cuenta aparte**, no se fuerza al 0 % ni al 100 % —serían
  dos mentiras distintas— y su número se dice bajo el gráfico.

**Y el mismo tropiezo de layout por tercera vez**: el panel del gráfico medía
**26 px** —sólo su cabecera— y el gráfico se dibujaba encima de la tabla. El
stack de Avance había perdido su clase `aulas-tablas-apiladas` al insertar el
panel nuevo, y sin ella es grid: asigna **0 px** a la fila cuyo contenido no la
empuja. Con la clase pasa a flex con hijos que no se encogen. Ya lo arreglé en
L40 y L42; **conviene recordar que cualquier panel nuevo en ese stack necesita
la clase**.


### 2026-08-16 — L63: la brecha por estrato, o a dónde va el equipo mañana

Dibujado el #2 del catálogo, en Avance › Estratos. Sobre el mismo operativo:

```
                        recogidas          faltan
Gestion                 ████ 100    ████████████████ 665
Estudios Grales Letras  ████ 103    ████████████████ 657
Educacion               ████  99    ███████████████  621
Arquitectura            ████ 100    ███████████████  613
Ciencias e Ingenieria   ████  99    ███████████████  612
Derecho                 ████  99    ███████████████  608
```

Los mismos números ya estaban en la tabla de `avance_por_estrato`, pero
contestaba mal la pregunta del día siguiente: hay que leer seis filas y restar
de cabeza. La decisión de diseño es **ordenar por brecha absoluta**, no por
porcentaje de avance:

> Un estrato al 50 % con 4 pendientes se cierra en una mañana. Uno al 90 % con
> 200 pendientes es la semana entera. Ordenar por avance manda al equipo al sitio
> equivocado —y ése es el control invertido del test: si el criterio fuera el
> porcentaje, `ordena por lo que falta, no por lo que ya se hizo` falla.

Tres decisiones más, cada una con su test:

- **A igualdad de brecha adelanta el que más lleva recogido**: está más cerca de
  cerrar.
- **El recorte se declara con su brecha**: por encima de doce estratos el eje se
  vuelve ilegible, y decir sólo «no se dibujan 3» dejaría leer la última barra
  como «lo demás está cerrado».
- **Un valor no numérico cuenta como cero, no como `NaN`**: sin la coacción la
  barra desaparece sin decir por qué, que es peor que dibujarla en cero — el
  estrato existe y sigue teniendo aulas.

Y **la leyenda hubo que encenderla a mano**: `PlotlyChart` trae
`showlegend: false` por defecto —casi todos sus usos tienen una sola serie— así
que la barra apilada salía sin explicar el verde y se leía como una sola
magnitud. Con `traceorder: normal` además, porque apilado Plotly la invierte y
la dejaba al revés de como se lee la barra.

**Trampa de instrumento (la segunda del mismo tipo)**: la captura inmediata tras
montar o redimensionar coge a Plotly **antes de su relayout**. La primera imagen
mostraba las barras aplastadas en 90 px de un panel de 1208 y las etiquetas del
eje encimadas —parecía un defecto de ancho y no lo era—. Medir el SVG lo
desmintió: 1208 px y las barras al 95 % del área. **Una captura de un Plotly
recién montado no es evidencia**; hay que esperar su segundo pase, igual que ya
pasó con el barrido de 1250 ms.


### 2026-08-16 — L63: el estado del circuito, y el eje que la cobertura no ve

Dibujado el #1 del catálogo, en Avance › Resumen. Sobre las 196 aulas:

```
Sin agendar  Agendada   En aplicación            Meta alcanzada
████████ 51     – 0     ██████████████ 145              – 0
```

Parece redundante con el histograma de cobertura y no lo es: **son los dos ejes
independientes de L30**. La cobertura reparte por `válidas / meta`; ésta por el
punto del circuito. La diferencia que sólo se ve aquí es **«sin agendar» contra
«agendada y aún sin empezar»** —la cobertura mete las dos en «sin respuestas»— y
es la que dice si lo que falta es trabajo de teléfono o trabajo de campo.

Los dos gráficos se **verifican entre sí**: el circuito dice 145 en aplicación y
la cobertura dice 122 + 23 = 145 aulas con al menos una respuesta. Que dos
cálculos distintos del mismo tablero coincidan es más evidencia que cualquiera de
los dos por separado.

Dos decisiones con su test:

- **El azul de «Agendada» no sale de `COLOR_RESULTADO`.** Esa paleta son los
  *desenlaces de una encuesta*, y «agendada, aún sin empezar» no es ninguno: es
  un estado del aula. Pintarla de granate (`rechazo`) diría que alguien declinó,
  que es falso. Se toma el azul de marca, y un test comprueba que no invade la
  lista de exclusivos.
- **Un estado que el motor no declare se cuenta, no se descarta.** Es el control
  invertido del patrón que ya costó doce ítems de esta cola: una lista cerrada
  que se traga en silencio lo que no reconoce. Si el engine añade un quinto
  estado, el gráfico lo dirá en vez de perder aulas.

**Y una corrección de C1 sobre la marcha**: los dos gráficos entraron primero en
el mismo panel, titulado «Cobertura de la meta» —que ya no describía lo que
contenía—. Cada uno tiene su panel y su título, porque una superficie declara qué
es.
