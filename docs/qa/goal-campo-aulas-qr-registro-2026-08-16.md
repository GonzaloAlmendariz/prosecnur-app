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
| **V1** | De una selección de aulas (titulares + reemplazos) **sin enlaces**, el motor produce un enlace personalizado por unidad sin que nadie pegue links a mano. | La simulación `sim_qr_aulas.R` da cobertura `prepared` con `units_missing_access = 0`. **Cumplida (2026-08-16)**: la simulación de 12 etapas da 7/7 filas con enlace personalizado, sin pegar ninguno a mano. |
| **V2** | El QR codifica el enlace **mínimo**: base + un parámetro, una sola vez. | El `qr_payload` compilado no repite ningún nombre de parámetro. **Cumplida (2026-08-16)**: medido sobre las 7 URLs del simulador, cada una lleva `collectorID` **exactamente una vez**. |
| **V3** | El identificador que viaja en el QR es el **código operativo** del equipo (`CH 1`, `R 1.2`), no un slug interno con hash. | El `d[collectorID]` de la ficha de `CH 1` es literalmente `CH 1` (o su forma URL-safe estable), y la data que vuelve de Kobo se reconcilia sin tabla de traducción. ⛔ **NO cumplida**: lo que viaja sigue siendo `unit-aulas-aula-01-fd6e0ab1ee`, un slug con hash, no `CH 1`. Es el único criterio de la vara que el motor no alcanza, y depende de L2 —tu decisión—. |
| **V4** | La ficha dice **sin interpretación** si el aula es titular o reemplazo, y de quién es reemplazo. | Dos páginas del mismo PDF (una titular, una reserva) difieren en una marca legible; alguien que no conoce la nomenclatura acierta el rol. **Cumplida (2026-08-16)**: el simulador escribe p1 titular y p5 reemplazo distinguibles, y la ficha dice «Reemplazo 3 de AULA-01» (L55). |
| **V5** | El coordinador registra desde la app el **estado real** de cada aula (agendada · en aplicación · aplicada · parcial · sin acceso · cancelada) con su motivo, y eso queda en el `.pulso`. | Existe una superficie que llama a `/api/monitoreo/aulas/agenda`. **Cumplida (2026-08-16)**: `RegistroDeCampo` en Monitoreo > Agenda. **Cumplida (2026-08-16)**: el simulador registra 22 asistentes, 1 rechazo, 1 duplicado, 20 efectivas y aula real H-203, y sobreviven al `.pulso`. |
| **V6** | **Activar un reemplazo es un gesto de la app**, no una decisión en un chat. | Desde el aula caída se activa su cadena `R n.k`; el motivo queda registrado y el avance recalcula denominadores solo. **Cumplida (2026-08-16)**: botón en Registro de campo, verificado end-to-end en el navegador. **Cumplida (2026-08-16)**: el simulador activa la cadena y además distingue el aula que **nunca tuvo reserva** de la que la agotó (L54). |
| **V7** | Lo que pasa en el aula se ve **contra la meta de esa aula, mientras ocurre**. | El avance por aula cruza respuestas de Kobo por `collectorID` contra `expected_valid` sin que nadie re-sincronice a mano. **Parcial (2026-08-16)**: el cruce por `collectorID` ya funciona sin configurar nada (L8); falta el «mientras ocurre», que depende de L4. **Cumplida (2026-08-16)**: el tablero del simulador cruza por `collectorID` contra `expected_valid` sin resincronizar. |
| **V8** | Nada de lo anterior exige una planilla paralela. | Ningún campo del registro de campo vive sólo en papel o en Excel. **Comprobada a medias (2026-08-16)**: los tres campos que faltaban ya están en la app; queda el desglose hombres/mujeres, que vive sólo en la ficha impresa. |
| **V9** | La app **lee** las tres hojas del estudio sin que nadie retranscriba. | Los totales del lector cuadran con un conteo independiente del Excel real. **Comprobada (2026-08-16)**: 1012 unidades, 766 enlaces, 230 estados y 190 observaciones, todos coincidentes celda a celda. |
| **V10** | El **agendamiento** y la **aplicación** se miden por separado. | `STATUS MUESTRA` (AGENDADA · REAGENDADA · EN RESERVA n · REEMPLAZADA) y `STATUS DE APLICACIÓN` (APLICADA · NO APLICADA) viven en campos distintos; hoy la app los mezcla en un solo `operational_status`. **Cumplida (2026-08-16)**: medido contra el motor — la misma aula sale con `operational_status = agendada` y `application_state = lista`. |
| **V11** | Se sabe **por qué** un aula no está agendada todavía. | El ciclo de contacto —medio, fecha de llamada y **número de intentos**— llega al modelo y se ve por aula. **Cumplida (2026-08-16)**: medido contra el motor — medio, fecha e **intentos** llegan a la agenda por aula. |
| **V12** | La app **produce** el libro que el equipo llena, y lo **vuelve a leer**. | Generar y reimportar cierra el círculo sin perder la cadena ni los enlaces **ni el trabajo ya hecho**: estados de agendamiento, ciclo de contacto y partes de campo. **Comprobada (2026-08-16)** con round-trip sobre un `.pulso` real. |
| **V13** | El avance de aulas **se ve**, no sólo se lee en tablas. | Hay gráficos propios del contexto de aulas —no copiados de telefónico— y usan el mismo lenguaje visual que los otros perfiles: `PlotlyChart`, `coloresDeResultado`, `MarcoDeEjesSiHaceFalta`. **Cumplida (2026-08-16)**: cinco gráficos propios verificados en pantalla a 1440×1000 y 1024×600, con `PlotlyChart` y la paleta compartida. |
| **V14** | El monitoreo aguanta **3700 registros** de Kobo. | Sincronizar, graficar, mostrar y gestionar esa cantidad sin degradarse: medido en tiempo de sincronización, de tablero y de render. **Cumplida (2026-08-16)**: motor 0,71 s con 3700 respuestas, y el transporte —que era el cuello— de 1377 a **601 KB** y de 2,9 a **1,6 s**. |
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
| **L12** | El filtro de «respuesta válida» no conocía los estados de Kobo, y fallaba abierto **y cerrado**. | `.monitoreo_aulas_valid_response()`. | ◐ **reparado el defecto** (2026-08-16) — `_status` ya no decide, entra el vocabulario de Kobo y el español, y el tablero **dice qué criterio aplicó**. Sigue siendo tuya la decisión de qué estados cuentan en TU estudio. |
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
| **L62** | Los endpoints del libro **no los llamaba nadie**, y la subida desde el navegador no funcionaba. | La subida multipart al propio endpoint moría en el parser de plumber. | ☑ **hecho** (2026-08-16) — sube por `/api/files/upload`, que ya digiere binarios, y el endpoint recibe el `file_id` que acepta desde el primer día. Verificado end-to-end en el navegador. |
| **L63** | **Aulas no tenía ni un gráfico.** | Los otros perfiles grafican con `PlotlyChart`; aulas sólo mostraba tablas. | ☑ **hecho** (2026-08-16) — los **cinco** del catálogo: estado del circuito, cobertura por aula, brecha por estrato, consumo de cadena y cuota sexo×facultad. |
| **L64** | Qué gráfico es **propio del contexto de aulas**. | Decidido el catálogo: cinco, cada uno atado a una pregunta del operativo y a un dato que el tablero ya produce. | ☑ **hecho** (2026-08-16) — catálogo abajo; queda dibujarlos (L63). |
| **L65** | El circuito no se ha probado con **3700 registros**. | Medido: el motor aguanta —tablero 0,71 s, `.pulso` 0,29 s para guardar y 0,62 s para abrir— porque el trabajo escala con las **aulas**, no con las respuestas. Lo que no aguanta es el **payload**: 1,3 MB y 2,9 s por petición de estado. | ◐ a medias (2026-08-16) — motor medido y holgado; el transporte es el cuello. |
| **L66** | El **plan viajaba tres veces** en cada petición de estado. | Dos copias declaradas y una escondida: `brechas` era un clon completo del plan. | ☑ **hecho** (2026-08-16) — **1377 → 934 → 601 KB** y **2,4 → 1,6 s**. Queda una sola copia, `dashboard.agenda`, que es superconjunto de la que se fue. |
| **L67** | Releer el libro **borraba la composición muestral**. | La importación hacía `session_set("monitoreo_aulas_plan", out$plan)`: el plan del libro **reemplazaba** al de la muestra, y el libro no lleva `sex_top_*` porque es un artefacto de campo. Medido: **12 celdas de cuota antes, 0 después**, y la representatividad saltaba a 100 % por no poder calcular desviación. | ☑ **hecho** (2026-08-16) — fusión por código con lista de campos **propios del libro**. Verificado: 12 celdas antes y 12 después. |
| **L68** | El gate visual del contrato **nunca miró los cinco gráficos**, y al mirarlo apareció que **aulas no importaba `monitoreo.css`**. | 4 `capacity-drift` (C3); el aviso de recorte salía como texto de cuerpo en todo el perfil. | ☑ **hecho** (2026-08-16) — la regla se muda a `profilePage.css`, que sí ven los cuatro perfiles. Queda 3–4 px de `.mon-profile-panel-head`, chrome compartido que este ítem no causó. |
| **L69** | **Materiales se declaraba lista mientras cargaba.** Es la superficie donde se producen las fichas QR del circuito. | `RecopiladoresShell` derivaba `auditReady` de **su** `loading` —el del plan— y `MaterialsSection` tiene el suyo para la plantilla. Todo QA visual de esa vista medía el esqueleto: 124 px de vacío y «Leyendo plantilla semántica…». | ☑ **hecho** (2026-08-16) — la sección avisa su carga al shell. Gate de `ok=false` a **`ok=true`**, verificado invirtiéndolo. |
| **L70** | **El lenguaje no es el del equipo.** | «Estado del circuito», «En aplicación», «Código de ficha» y otros eran míos. | ◐ a medias (2026-08-17) — tres tandas; los rótulos de la agenda ya salen de las columnas reales del Excel. Faltan los títulos de panel de Fuentes/Validación/Consultas. |
| **L71** | **Las pestañas son un rail lateral con íconos, no píldoras arriba.** | Telefónico y acreditación usan `MonitoreoWorkbenchRailTab`; aulas usaba un `GlidingTabList` superior. | ☑ **hecho** (2026-08-17) — rail montado con el chrome compartido; navegación y URL enlazable verificadas. |
| **L72** | **Falta expresividad visual.** Las tablas están bien pero la vista no expresa. | Pedido textual: «tiene que tener mucha mayor expresividad visual, algo que de momento no lo tiene». | ☐ **pedido de Gonzalo (2026-08-17)** |
| **L73** | **El orden de las secciones no sigue la lógica del trabajo.** | Aulas tenía Avance tercero y Consultas al final; telefónico y territorial ya ponen **Avance al final y Consultas antes**. | ☑ **hecho** (2026-08-17) — Fuentes · Agenda · Validación · Consultas · Avance, y aterriza en Fuentes como los otros tres perfiles. |
| **L74** | **Avance tiene que mostrar las cuotas** de forma sencilla y dinámica. | El tablero decía «2/12 celdas». | ☑ **hecho** (2026-08-17) — tres lecturas en personas y el corte elegido **enfoca** el detalle, con el foco en la URL. |
| **L75** | **Consultas tiene que contar la historia de la cadena.** | Había una tabla de 26 filas y un histograma de consumo: dicen cuánta reserva se gastó, no cómo se llegó. | ☑ **hecho** (2026-08-17) — la secuencia por cadena con su desenlace, y el cierre **verificado en pantalla** tras arreglar el fixture que no tenía el caso. |
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
| **L2** | Cuál es el identificador de campo que viaja a Kobo | **Ya está medido** (ver «La decisión de L2»): con el código operativo la URL baja de 86 a 63 caracteres y el QR de 49×49 a 45×45; el emparejamiento **ya funciona** con él sin tocar el motor; las dos generaciones **conviven**, así que no hay que reimprimir nada; y el hash del slug **no da unicidad entre estudios**, que era el único argumento para conservarlo. |
| **L12** | Qué estados cuentan como válida en **tu** estudio | **El defecto que había debajo ya está reparado** (ver «Un export de Kobo ponía el avance en cero»): `_status` ya no decide, entra el vocabulario de Kobo y el español, y el tablero **anuncia qué criterio aplicó y a cuántas afecta**. Lo que queda es tuyo: cuál es el correcto para este estudio. |
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

Ya no queda: los números de L15–L22 nacieron respaldados sólo por tests y por la
simulación, y desde entonces el operativo de **196 aulas** se ha recorrido en
pantalla repetidas veces —avance, cuotas, brechas, reemplazos, registro de campo,
validación y los cinco gráficos, a 1440×1000 y 1024×600—. Lo que sigue sin
comprobarse en pantalla es lo que **espera una decisión tuya**, no lo que está
hecho.

### Lo medido de punta a punta

La costura corre en un simulador de **12 etapas** (`api/scripts/sim_aulas_qr_campo.R`)
que sale con **exit 0 y sus diez veredictos en TRUE**: selección → enlaces →
fichas → handoff → libro → registro → cuadre → activación → tablero.

Sobre el operativo real de **196 aulas y 3700 respuestas**:

| | |
|---|---|
| Motor del tablero | **0,71 s** — escala con las *aulas*, no con las respuestas |
| Payload del estado | 1377 → **579 KB** (58 % menos), medido dos veces a 3700 respuestas |
| Petición de estado | 2,9 → **2,08 s** a 3700 respuestas (el 1,6 s era a 600) |
| `.pulso` | 0,29 s guardar · 0,62 s abrir |

**El cuello nunca fue el cálculo: fue el transporte.** El plan viajaba **tres
veces** —dos copias declaradas y una escondida en `brechas`, que no es una copia
sino un *reporte* que salía con las ~40 columnas del plan porque nadie le puso
límite—. Y con 196 aulas todas con brecha abierta el primer día, «las aulas con
brecha» son *todas*.

Dos aprendizajes que valen más que los números:

- **La premisa que me frenó dos turnos era falsa.** Escribí que las copias
  «tienen consumidores distintos» y que unificarlas exigía decidir cuál manda
  antes del primer sync. Al mirarlo: `dashboard.agenda` es un **superconjunto
  estricto** —mismas 196 filas, mismos 80 campos, más dos— y **no depende de que
  haya snapshot**, porque el tablero se reconstruye en cada petición. Dos
  consultas tiraron la suposición.
- **No era sólo peso.** Entre las columnas que se colaban en `brechas` iban
  `teacher_email` y `teacher_phone`. En un reporte que se **publica a Sheets**
  eso no es tamaño: es exposición.

### Los cinco gráficos, y qué contesta cada uno

Aulas no tenía ninguno. El catálogo se decidió **antes** de dibujar, atando cada
uno a una pregunta del operativo y a un dato que el tablero ya produce.

| Gráfico | La pregunta | Lo que destapó |
|---|---|---|
| Estado del circuito | ¿Cuántas cerradas, cuántas sin tocar? | 51 de 196 sin una sola respuesta |
| Cobertura por aula | ¿Muchas a medias o pocas sin tocar? | El promedio decía 76 % y escondía las dos poblaciones |
| Brecha por estrato | ¿A dónde mando el equipo mañana? | Faltan 3776 respuestas, y dónde |
| Consumo de cadena | ¿Cuánta reserva llevo gastada? | **0 en el banco y 146 titulares sin reserva** |
| Cuota sexo×facultad | ¿Qué celda voy a incumplir? | **Las seis celdas F por debajo de las seis M** |

Los dos hallazgos en negrita son del operativo, no del código, y ninguna tabla
los decía: si una de esas 146 aulas cae, no hay con qué cubrirla; y las mujeres
van más lejos de su cuota **no porque se recojan menos respuestas** —48–53 en las
doce celdas— sino porque **sus metas son mayores**, 444 contra 316.

**Y los gráficos se verifican entre sí.** El circuito dice 145 en aplicación y la
cobertura dice 122 + 23 = 145. La brecha por estrato y las cuotas dan las mismas
3776 respuestas faltantes desde agrupaciones distintas. Que dos cálculos
independientes del mismo tablero coincidan vale más que cualquiera por separado.

**El consumo de cadena reprodujo solo la verdad conocida de 2025**: 22 cadenas
con un reemplazo más 2 con dos son 26 sobre 170 titulares —la cifra real, con las
cadenas planificadas llegando a once y las consumidas quedándose en dos—.

Decisiones de cómo cuentan, cada una con test:

- **Ordenar por lo que falta, no por lo que se hizo** —y en cuotas, por
  *cumplimiento* y no por volumen: 40 de 50 y 4 de 5 son el mismo problema—.
- **El cero tiene tramo propio**: «sin respuestas» no es «poquísimas».
- **Lo que no tiene meta se cuenta aparte**, no se fuerza al 0 % ni al 100 %.
- **«Nunca tuvo reserva» no es «no la ha gastado»** (L54, ahora en el gráfico).
- **El color sale del veredicto del motor**, no de recalcularlo aquí.
- **Ningún recorte en silencio**: se dice cuántos no se dibujan y cuánto suman.

### El ciclo del libro se cierra, y casi borra la muestra

La subida desde el navegador se resolvió **dejando de pelearse con el parser**:
el `.xlsx` sube por `/api/files/upload` —que digiere binarios desde siempre— y al
endpoint le llega el `file_id` que aceptaba desde el primer día.

| Vía | Mismo archivo, mismo navegador |
|---|---|
| El `.xlsx` directo al endpoint | `400` — «El libro subido llego vacio» |
| Subir y pasar `file_id` | `200` · 196 unidades · 170 titulares · 170 partes |

**Y al poder usar el ciclo entero apareció lo grave**: releer el libro dejaba las
cuotas en **0 celdas de 12** y la representatividad en **100 %** —no por mejorar,
sino porque sin composición no hay desviación que calcular—. La importación
**reemplazaba** el plan por el del libro, y el libro no lleva la composición
muestral porque es un artefacto de campo.

Es el reflejo exacto de L44 —donde el *generador* escribía en blanco lo que el
operativo ya tenía— en la dirección contraria: ahora el *lector* borraba lo que no
sabe escribir.

> **La protección es por declaración, no por heurística.** Mi primera fusión decía
> «si el libro trae algo, manda» y falló: el lector emite `sex_top_1_n = 0` porque
> su plantilla **no pregunta** por la composición, no porque el aula tenga cero
> mujeres. La versión buena declara qué campos posee el libro; así
> `effective_surveys = 0` sí sobrescribe, porque el parte sí lo pregunta.

### Un export de Kobo ponía el avance en cero, en silencio

Preparando L12 —medir para que la decisión salga barata— apareció que no todo era
decisión del usuario. Medido sobre 4 respuestas, **antes**:

| Lo que trae la base | Válidas |
|---|---|
| `_status = submitted_via_web` (Kobo lo manda **siempre**) | **0 de 4** |
| `validation_status_approved` (su propio vocabulario) | **0 de 4** |
| `estado = «completa»` (un estudio en español) | **0 de 4** |
| `_validation_status` (el nombre real de Kobo) | 4 de 4 — no lo encontraba |

Bastaba sincronizar un export completo de Kobo para que el avance del estudio
entero cayera a cero sin decir nada. `_status` dice *cómo llegó* el formulario.

Reparado lo que no exige decisión: `_status` fuera, `_validation_status` dentro
con su vocabulario, el español admitido, y **el tablero dice qué criterio
aplicó** —marcando `review` cuando no hay columna y cuenta todo, y cuando el
estudio declara una columna que la base no trae, que pasaba por criterio
deliberado en vez de por error de tipeo—.

**Dos tests existentes tuvieron que invertirse, y es buena señal**: no afirmaban
la conducta deseada sino que **documentaban el defecto** —sus comentarios decían
«fail-open, no fail-closed»—.

### Tres vocabularios cerrados que cruzaban R → UI sin atar

| Vocabulario | Estado al mirarlo |
|---|---|
| Controles de validación (`check`) | Roto: el check nuevo habría salido como clave cruda |
| Estados operativos | Completo **por suerte**, no por construcción |
| Columnas de tabla | **38 de 93 sin etiqueta**, en inglés en pantalla |

Las 38 no son cualquiera: son **justo los campos que L31 y L32 acababan de
añadir**. Cada vez que el motor aprendió algo, la pantalla se quedó atrás sin que
nada fallara. Los tres tienen guard ahora, los tres verificados invirtiéndolos.

**El barrido a los otros perfiles dio cero, y la razón importa más que el cero:**

> **Acreditación declara sus columnas; aulas renderiza lo que llegue.**

Recorridas las 28 direcciones de acreditación: 37 cabeceras, ninguna con jerga.
Sus tablas se construyen con una lista explícita, así que una columna nueva del
motor **no aparece sola**. El `DataTable` de aulas saca las columnas de
`Object.keys(row)`. De ahí la regla: **una tabla que refleja las claves de sus
filas necesita diccionario atado al productor; una que declara sus columnas, no.**
El guard va donde la tabla es genérica; en las otras sería pedir etiqueta para
columnas que nunca se pintan solas.

### La dirección: alcanzable por clic, no por dirección

Cargar la URL directa funcionaba; **saltar entre secciones, no**: la sección se
aplicaba primero y la pestaña **recordada** pisaba la pedida. Estaba en **los
cuatro perfiles** y era anterior a los cambios de aulas — sólo lo cubría una
verificación manual, así que nadie lo notó. Reparado y con contrato que lo fija.

### La decisión de L2, ya medida

| | slug de hoy | código operativo |
|---|---|---|
| Lo que viaja | `unit-aulas-aula-01-fd6e0ab1ee` | `CH 1` |
| URL | 86 caracteres | **63** |
| QR | 49×49 módulos | **45×45** |
| Quien mira una respuesta en Kobo | no reconoce nada | ve el aula |

Tres obstáculos que parecían reales y no lo son: **el emparejamiento ya funciona
con el código** —el conteo prueba `classroom_id` antes que `collection_unit_id`, y
en el plan real son iguales en las 196 filas—; **las dos generaciones conviven por
construcción**, así que no hay que reimprimir ni migrar nada; y **el espacio no
rompe** —los 196 códigos lo llevan, la URL lo codifica, el QR sale bien—.

Y una suposición mía que se cae: `.collection_stable_id(prefix, value)` hashea
**el propio valor** y su firma no recibe corrida ni estudio. Es un dígito de
control, **no un espacio de nombres**: el slug no protege de que dos estudios
reusen un código, que era el único argumento para conservarlo.

### Trampas de instrumento (van doce)

Todas tienen la misma forma: **el instrumento cambia lo medido**.

- **Una captura de un Plotly recién montado no es evidencia.** La primera imagen
  mostraba las barras aplastadas en 90 px de un panel de 1208 y las etiquetas
  encimadas —parecía un defecto de ancho—. Medir el SVG lo desmintió: 1208 px y
  las barras al 95 %. Hay que esperar su segundo pase.
- **Inferir «no hay entrada» de que la etiqueta coincida con el fallback** marcó
  como ausentes los once estados cuya etiqueta correcta *es* la clave
  capitalizada. Se comparan las **listas** leyendo las fuentes, no la salida.
- **El exit code de un pipe no es el del comando.** Reporté un gate en verde
  leyendo el `0` de un `tail`.
- **El `cd` de una llamada persiste en la siguiente.** Reporté un vitest rojo que
  era `frontend/frontend`.


### 2026-08-16 — L68: el gate visual de los gráficos sale rojo (a medias)

Los cinco gráficos entraron sin que ninguna corrida del contrato los mirara.
Pasado `ui-quick-check --require-geometry` sobre las 196 aulas: **`ok=false`, 4
`capacity-drift`** —C3, vacío interior sin dueño— en los dos paneles de Avance y
en los dos viewports.

Medido, no supuesto:

```
envoltorio del gráfico   155 px   contenido  139 px
filas del envoltorio     104px 51px   ← la nota mide 19 y su fila 51
la nota queda centrada: 16 px arriba, 16 abajo
```

Reparado **la mitad**: `.mon-profile-panel` reparte `auto minmax(0,1fr)` porque su
caso normal es una tabla, que sí debe llenar lo que le den. Un gráfico no puede
—Plotly fija su alto por prop— así que el sobrante caía dentro del envoltorio.
Los paneles de gráfico se declaran intrínsecos y los envoltorios
`align-self: start`. **Cobertura pasa a hueco 0** y el gate baja de **4 a 2**.

**El de «Estado del circuito» sigue, y su causa no está encontrada**: con el panel
ya intrínseco, el envoltorio sigue midiendo 155 para 139 de contenido y su segunda
fila resuelve a **51 px para una nota de 19**, que es lo contrario de lo que
`1fr auto` debería dar. Queda abierto con la medición hecha, en vez de forzar un
`min-height` que taparía el síntoma sin explicar la fila.

**Y el gate se ganó su sitio**: estas superficies pasaron por revisión visual a
ojo en cuatro turnos distintos —capturas, comprobación de superposición, dos
viewports— y **ninguna de esas comprobaciones las vio**. Miraban si el gráfico se
dibujaba encima de la tabla; el contrato mide si el vacío tiene dueño.


### 2026-08-16 — L68 cerrado por mi lado: era el margen de la nota, no el grid

Dos turnos teorizando sobre `1fr auto`, y la causa no tenía nada que ver con el
grid. La medición que la encontró fue mirar el **estilo computado de la nota**:

```
declarado en monitoreo.css   margin: 6px 0 0
computado en pantalla        margin: 16px 0
                             16 + 19 (la nota) + 16 = 51  ← la fila exacta
```

Una regla genérica de `p` de una hoja que carga **después** ganaba la cascada —el
orden real de las hojas ya había mordido antes en este repo—. Los 16 px de abajo
eran el `capacity-drift` que vio el gate; los 16 de arriba **despegaban la nota
del gráfico que describe**, un defecto visual que nadie había mirado.

Fijado en la hoja del feature, que va última: **155 → 129 px, hueco 16 → 0**, y la
fila resuelve a `104px 25px` —la nota y su margen, exactamente—.

Del gate quedan 4 hallazgos, pero **ya no son los mismos**: antes cada uno listaba
la cabecera (4 px) *y* el envoltorio del gráfico (16 px); ahora sólo la cabecera.
Esos 3–4 px viven en `.mon-profile-panel-head`, chrome compartido por todo
Monitoreo, y aparecen porque Avance ahora declara tres paneles en un mismo grupo
—los expuse, no los causé—. Tocar el chrome común excede este ítem.

**Y una trampa de instrumento nueva, la trece**: la corrida intermedia informó
`geometryGroups=5` y la final `8`. El runner **captura en estados de render
distintos**, así que el «bajó de 4 a 2» del turno anterior comparaba dos
fotografías que no medían lo mismo. Sus conteos sólo son comparables si el número
de grupos coincide; si no, hay que mirar los **miembros** de cada hallazgo, que es
lo que aquí demostró el avance real.


### 2026-08-16 — el hueco era una hoja que aulas nunca importó

El rastro completo, y cada paso corrigió al anterior:

1. El gate marcó `capacity-drift` de 16 px en los paneles de gráfico.
2. Teoricé dos turnos sobre `grid-template-rows: 1fr auto`. **Falso**: el grid no
   tenía nada que ver.
3. La nota computaba `margin: 16px 0` contra los `6px 0 0` declarados. Lo tapé en
   la hoja de aulas y el hueco se fue.
4. Al buscar quién pisaba el margen: **nadie**. Eran los defaults del navegador
   para un `<p>`. La nota también salía a **16 px y peso 400**, no a 11/600.
5. Un `<p class="mon-profile-table-recorte">` inyectado a mano en esa página
   recibía los mismos defaults. La regla **no aplicaba en absoluto**.
6. La causa: `.mon-profile-table-recorte` vive en `monitoreo.css`, que importan
   telefónico, acreditación y territorial —y **no aulas**, cuya página nació del
   refactor y se quedó sólo con las hojas del perfil—.

Así que no era un defecto de mis gráficos: **todos los avisos de recorte del
perfil de aulas** —los que dicen «se recortaron N filas / N columnas», que
existen justamente para que nada desaparezca en silencio— se venían pintando como
texto de cuerpo en negro. Un aviso que no parece un aviso.

La regla se muda a `profilePage.css`, que sí importan los cuatro. Medido después:
**11 px, peso 600, margen 6**, y el envoltorio del gráfico en **123 px con hueco
0** —de los 155 iniciales—.

**Y una trampa de instrumento más, la catorce.** Para saber si la regla llegaba al
navegador recorrí `document.styleSheets` comparando `selectorText` exacto, y me
dijo que **ninguna** regla de Monitoreo existía —incluidas las que obviamente
aplican—. El fallo: un selector agrupado tiene todo el listado en `selectorText`,
así que la igualdad exacta nunca casa. Estuve a punto de reportar «monitoreo.css
no se carga». Lo que lo resolvió fue **dejar de interrogar a la hoja y preguntarle
al elemento**: inyectar un nodo con la clase y leer su estilo computado.


### 2026-08-16 — el barrido de hojas: cero, y ahora con guard

Si una clase compartida no llegaba a la página de aulas, lo raro sería que fuera
la única. Barrido a **la página y los 24 componentes que importa**: 128 clases
pintadas, y **ninguna otra** vive sólo en el monolito que esa página no importa.

El cero vale porque el barrido está **verificado contra el árbol de antes**: allí
señala exactamente `mon-profile-table-recorte`, la que ya conocíamos. Un
instrumento que no encuentra el defecto conocido no puede afirmar que no hay más.

Convertido en guard permanente (`hojasDeEstiloAlcanzables.test.ts`), y el guard
también verificado al revés —quitar la regla de `profilePage.css` lo pone rojo
nombrando la clase—:

```
clases declaradas sólo en monitoreo.css, que esta página no importa:
  mon-profile-table-recorte
```

Con esto son **cuatro** los contratos que atan producción y consumo en este
perfil: los controles de validación, los estados operativos, las columnas de
tabla y ahora las hojas de estilo. Los cuatro nacieron del mismo patrón —dos
listas que nadie ataba— y ninguno de los cuatro fallaba antes de atarlo.


### 2026-08-16 — las otras cuatro secciones, y qué es realmente el residuo de 3 px

Sólo había medido Avance. Pasadas las cuatro restantes por el contrato:

| Sección | Resultado |
|---|---|
| Agenda (modelo) | ✅ `ok=true` |
| Validación | ✅ `ok=true` |
| Consultas › Reemplazos | ✅ `ok=true` |
| Fuentes | 1 `capacity-drift` — **el mismo `.mon-profile-panel-head`** |

**Y eso zanja la duda que dejé abierta**: el hallazgo de Fuentes es sobre
«Operación del plan», un panel que existía mucho antes de los gráficos. Los 3–4
px de la cabecera **no los causó este ítem**; son chrome compartido por todo
Monitoreo.

Medido en pantalla:

```
cabecera            alto 32 px   ·  min-height 32 px  ·  padding 1/1/6
hijo más alto       20 px, termina en 23
```

O sea: la cabecera declara un **alto mínimo** para que todos los paneles tengan
la misma banda de título, y su contenido —título de 15 px y contador de 20—
nunca lo llena. Los ~3 px que sobran son la holgura de centrar 20 en 25.

**Es una tensión real entre dos cláusulas del propio contrato, no un descuido**:
el `min-height` que hace cumplir **C2** —marcos iguales entre paneles hermanos—
es exactamente lo que produce la holgura interior que **C3** señala, y cae 1 px
por encima de la tolerancia de 2.

Por eso **no lo toco**. Bajarlo desalinearía las cabeceras de los cuatro perfiles,
y subir el contenido para llenarlo sería inflar un título por complacer una
métrica. Queda **declarado y medido**: un residuo de 3 px en `.mon-profile-panel-head`,
de todo Monitoreo, que pide una decisión sobre la tolerancia del contrato o sobre
la métrica de la cabecera —no un parche en aulas—.


### 2026-08-16 — el gate más limpio es el del perfil que no declara nada

Fui a comprobar si el residuo de la cabecera también enrojece a los otros
perfiles. La respuesta es más interesante que un sí o un no.

| Perfil | Grupos de geometría declarados | Cabeceras que usa | Gate |
|---|---|---|---|
| **aulas** | **16** | 13 | 1 hallazgo |
| acreditación | 13 | 26 | ✅ 0 |
| **telefónico** | **0** | **26** | ✅ 0 |
| territorial | 2 | 0 | — |

Telefónico no declara **ni un** grupo en su propio código: el único que el runner
encuentra viene del workbench compartido, sobre el `main`. Sus 26 cabeceras de
panel están dentro de él y ninguna se declara como colección de hermanos, así que
el chequeo **nunca las mira**. Y `geometryCoverageMisses=0` dice que la inferencia
tampoco las propone.

Es decir: **su verde significa «no se declaró nada y no se infirió nada», no
«todo está bien»**. Exactamente el «verde por ausencia» que el Contrato prohíbe,
y aquí medido en números.

Y con eso hay que **corregir lo que escribí el turno anterior**. Dije que los 3 px
de la cabecera eran «chrome compartido por todo Monitoreo». Lo medido dice menos:
sólo **aparecen** en aulas, porque aulas es el único perfil que declara sus
paneles como hermanos. Si telefónico tiene los mismos 3 px no lo sé, y **nadie lo
sabe**, porque nada los mide.

La lección incómoda: **declarar produce hallazgos**. El perfil que hizo el trabajo
de declarar dieciséis grupos sale con un hallazgo, y el que no declaró ninguno
sale impecable. Un ranking por número de hallazgos premiaría exactamente al que
no se dejó medir.


### 2026-08-16 — gate ancho de R, y la memoria puesta al día

Toda la sesión corrí `test_file` sobre archivos sueltos, que es lo que manda el
gate escalado al diff. Con seis commits de R encima —fusión del libro, criterio
de validez, columnas de brechas, payload del estado— tocaba el paso siguiente sin
llegar a la suite entera de una hora:

```
test_dir --filter "^(monitoreo|carga-aulas|collection)"
57 archivos · 0 fallos · 0 errores
```

Y la costura completa, verde de punta a punta.

**La memoria estaba desfasada de una forma que engaña.** Su descripción seguía
diciendo «motor QR OK; el registro en campo NO existe» —cierto el primer día del
GOAL y falso desde hace veinte ítems—. Una memoria que describe el estado inicial
de un trabajo terminado es peor que no tenerla: la sesión siguiente arrancaría
buscando algo que ya está. Reescrita con el estado real, más dos entradas nuevas:
la decisión de L2 con sus costos medidos, y el patrón de la lista cerrada, que es
lo que de verdad se aprendió aquí.


### 2026-08-16 — L69: la vista decía estar lista y no lo estaba

Con la cola sin ítems libres fui a las superficies vecinas del circuito.
**Recopiladores › Materiales es donde se producen las fichas QR**, así que
pertenece a este GOAL aunque viva en otro módulo.

El gate salió rojo, y el hallazgo era un panel de carga:

```
capacity-drift · rec-loading · 124 px sin usar
label: «Leyendo plantilla semántica…»
ready: ['recopiladores/materiales/vista']   ← la vista SÍ se declaraba lista
```

No era el instrumento capturando temprano: **la vista mentía**.
`RecopiladoresShell` deriva `auditReady` de **su** `loading` —el del plan de
recolección— y `MaterialsSection` tiene el suyo, para la plantilla semántica. El
shell decía «lista» en cuanto tenía el plan, con el panel todavía cargando.

La consecuencia va más allá del gate: **todo QA visual de Materiales ha estado
midiendo un esqueleto**. Cualquier verde anterior en esa superficie no medía nada
—es el mismo «verde por ausencia», pero disfrazado de conformidad—.

Reparado con la sección avisando su carga al shell. De `ok=false` a `ok=true`, y
**verificado invirtiéndolo**: al quitar la condición el hallazgo vuelve.

Las otras direcciones de Recopiladores —accesos, vinculación, entrega-campo,
traspaso— salen limpias.

**Y de propina, dos trampas de instrumento propias.** Pedí
`recopiladores/entrega`, que no existe —la dirección es `entrega-campo`— y al
listar las disponibles con un grep me devolví **mi propia cadena de la línea de
error**, así que por un momento creí que sí existía. La lista buena sale de leer
sólo lo que va tras «Disponibles:».


### 2026-08-16 — el barrido de readiness: no se repite

Si una vista mentía al declararse lista, la pregunta es cuántas más. Barridos los
otros declaradores de `auditReady` —Bitácora, Carga, Validación, Cálculo de
muestra— con el proyecto de 196 aulas:

| Vista | Gate | Marca de readiness | ¿Texto de carga en pantalla? |
|---|---|---|---|
| Bitácora | ✅ | `bitacora-bitacora` | no |
| Procesamiento › Carga | ✅ | `carga-plan` | no |
| Procesamiento › Validación | ✅ | `validacion-explorar` | no |
| Cálculo de muestra | ✅ | `calc-muestra` | no |

**El defecto de Materiales no se repite**, y la razón estructural también se
midió: ninguna de esas páginas monta secciones hijas con carga propia. Materiales
era el único caso de un shell que declara por una carga y una sección que tiene
la suya.

**Con una limitación que conviene decir**: aquí el criterio fue buscar palabras de
carga en el `textSample` del reporte, que viene truncado. Es más débil que el caso
de Materiales, donde la etiqueta del propio hallazgo de geometría traía
«Leyendo plantilla semántica…». Un cero por este método significa «no se vio», no
«se comprobó exhaustivamente».

Y una observación sin cerrar, anotada para no perderla: Carga informa su marca
**dos veces** (`['carga-plan', 'carga-plan']`) con un solo `PageFrame` en su
página. No rompe nada y no sé por qué pasa; queda como cosa a mirar, no como
defecto.


### 2026-08-17 — el barrido del turno anterior corrió sin el flag que importa

Fui a cerrar la observación de la marca duplicada de Carga y salió otra cosa.

**La marca duplicada es benigna**, y se puede afirmar leyendo el runner:
`geometryRoots` recoge todos los `[data-audit-ready]`, pero comparte un
`scannedParents` entre raíces, así que el subárbol de una raíz anidada no se
recorre dos veces. Duplicaba el informe, no la medición. Aun así se quitó la de
`CargaPlanOverview` —el `PageFrame` ya la declara— y `ready` pasa de
`['carga-plan','carga-plan']` a `['carga-plan']`.

**Pero al medir después vi `ok=false` y estuve a punto de atribuírmelo.** El
control lo desmintió: con el árbol sin mi cambio, **el mismo número**. La causa
era mía de otra manera: **el barrido del turno anterior corrió sin
`--require-geometry`**, y ese flag es el que comprueba si algo se declaró.

Repetido con el flag:

| Vista | Con el flag |
|---|---|
| Bitácora | ✅ 1 grupo declarado |
| **Procesamiento › Carga** | ❌ **0 grupos** — «sin grupos geométricos medidos» |
| **Procesamiento › Validación** | ❌ **0 grupos** |
| **Cálculo de muestra** | ❌ **0 grupos** |

Así que la tabla del turno anterior —«las cuatro limpias»— **era verde por el
flag que faltaba**, no por conformidad. Tres de los cuatro módulos no declaran ni
un grupo de geometría, igual que telefónico.

Es la tercera vez en esta sesión que el mismo error cambia de disfraz: comparar
dos corridas que no midieron lo mismo. Antes fue `geometryGroups=5` contra `8`;
ahora, un flag de más. **La regla que queda**: dos números del runner sólo se
comparan si la línea de comando es idéntica; si no, no son antes y después,
son dos cosas distintas.

Y de propina, una inconsistencia del contrato sin resolver: **quince sitios
escriben `data-audit-ready="true"`**, un booleano, mientras que el runner trata el
valor como el **nombre** de la superficie. No he demostrado que rompa nada —queda
anotado, no vendido como defecto—.


### 2026-08-17 — corrección: los «cero grupos» eran del proyecto, no del código

Dije el turno anterior que Carga, Validación y Cálculo de muestra **no declaran ni
un grupo de geometría**. Falso, y la comprobación era una línea:

```
carga: 3 de 47 archivos declaran geometría
```

`CargaPlanOverview` declara `carga-base-assets` con su contrato y sus miembros —
completo. Lo que pasa es que la declaración cuelga **dentro de `rows.map(...)`**:

```tsx
{rows.length > 0 ? rows.map((row) => (
  <li data-qa-geometry-group="carga-base-assets" data-qa-geometry-contract="equal">
```

Con `qa_2025.pulso` —un proyecto de aulas, sin bases de datos cargadas— `rows`
viene vacío, así que **no hay grupo que medir**. El `geometryGroups=0` describía mi
fixture, no el código.

Medida la cobertura real por módulo: **87 de 525 archivos** de features declaran
geometría (~17 %), y todos los módulos declaran algo. Aulas es de los más densos.

Es la sexta versión del mismo error en esta sesión, y ya merece enunciarse como
regla: **un veredicto del runner habla del fixture tanto como del código.** Antes
fue un `filter` que daba verde donde `test_file` daba rojo, un fixture sin casos
de los tres estados, y una comparación entre corridas con distinta línea de
comando. Aquí, un proyecto sin las filas que la declaración necesita.

Antes de leer un cero como ausencia hay que preguntarse **si el proyecto tenía de
qué**.


### 2026-08-17 — E1: hsvg2026 no servía, y una cifra mía estaba mal comparada

**E1 no se pudo correr como estaba escrito.** `hsvg2026` es el **marco del
sorteo**, no un proyecto de monitoreo: 0 filas de plan de aulas y 0 respuestas.
Lo elegí porque el mapa del repo lo describe como «marco de aulas a escala» y
supuse que eso incluía el operativo. El sembrador tampoco parte de un marco real:
construye su propio plan.

Así que se midió lo que de verdad faltaba: **el payload después de los ocho
commits**, sembrando el operativo a escala con
`qa_pulso_aulas_campo.R --escala 2025` → 196 aulas y **3700 respuestas**.

Y ahí salió el error. **Las cifras intermedias que vengo repitiendo comparaban
escalas distintas**: el 1377 KB original se midió a 3700 respuestas, pero los
934 y 601 KB se midieron sobre `qa_2025`, que tiene **600**. Comparar 601 contra
1377 mezclaba dos cosas.

Medido ahora, las dos puntas **a la misma escala de 3700**:

| | antes | después |
|---|---|---|
| Payload | 1377 KB | **579 KB** (58 % menos) |
| Petición | 2,9 s | **2,08 s** (28 % menos) |

La conclusión del payload aguanta y mejora; **la del tiempo no**: dije «2,9 →
1,6 s» y el 1,6 era a 600 respuestas. A la escala real la mejora es de 2,9 a
2,08 s. Corregido aquí, en la memoria y en lo que te reporté.

Es la **séptima** vez que este error aparece en la sesión y la primera que
contamina una cifra publicada en un mensaje de commit. La regla ya no basta con
enunciarla: **toda cifra de antes/después lleva su escala escrita al lado**, y
las de este doc ya la llevan.

Lo que sí quedó verificado a 3700: los cinco gráficos dibujan —51 sin agendar,
40 en aplicación, 105 con meta cumplida, y la cobertura da los mismos tres
números desde otro cálculo—, el aviso de recorte sale con su estilo
(«Mostrando 8 de 82 columnas») y el criterio de validez se anuncia solo en el
informe del sembrador.


### 2026-08-17 — Gonzalo redirige el loop: lenguaje, rail, orden y expresividad

Seis ítems nuevos, y **uno es un error mío que él detectó**: las pestañas de
aulas son píldoras arriba (`GlidingTabList`) cuando el patrón de la casa es un
**rail lateral con íconos** (`MonitoreoWorkbenchRailTab`, con `icon`, `detail`,
`badge` y `estado`). Cuando me dijo «funciona con sección y pestaña como los
otros monitoreos» implementé la **gramática** —módulo/modo/sección/pestaña— y no
el **patrón visual** que la acompaña. Verificado en telefónico y acreditación
antes de aceptarlo.

Sus palabras, que son la vara de estos seis:

> «tenemos que mejorar el lenguaje. Ya hay un lenguaje referencial de los Excels,
> entonces puedes utilizar el mismo lenguaje» · «tiene que tener mucha mayor
> expresividad visual» · «el avance es una cuestión que va al final, consultas no
> suele ir al final» · «cómo vamos completando las cuotas por facultad, cómo van
> las cuotas a nivel general, cómo van las cuotas a nivel desagregado por sexo» ·
> «ver si estamos cumpliendo con los titulares y cuál es la cadena… cuál fue la
> cadena que nos permitió llegar a la meta»

El lenguaje del Excel ya está leído y disponible: `STATUS MUESTRA` (AGENDADA ·
REAGENDADA · EN RESERVA n · REEMPLAZADA), `STATUS DE APLICACIÓN` (APLICADA · NO
APLICADA), `VALIDO TOTAL`, `CANTIDAD DE EFECTIVAS`, `DUPLICADOS (YA
RESPONDIERON)`, `MEDIO DE CONTACTO`, `NÚMERO DE INTENTOS`, `OBSERVACIONES`. Mi
«Estado del circuito» no existe en ninguna parte del operativo.

**El loop pasa a iterar sobre esto**, que es trabajo de producto, en vez de
seguir barriendo módulos vecinos.


### 2026-08-17 — L71: el rail, y dos cosas que sólo se ven al montarlo

Las pestañas de aulas ya son el **rail lateral con íconos** de la casa. Tres
piezas, y las dos últimas no estaban previstas:

1. **`railDeAulas.ts`** construye las pestañas desde el catálogo de navegación,
   que ya trae `key`, `label`, `detail` e `icon`. Sólo se añade lo que depende de
   los datos. Duplicar los rótulos habría creado una segunda verdad.
2. **El rail no se coloca solo.** Puesto como hermano dentro del `<main>` propio
   de aulas cayó como columna **encima** del contenido. Quien lo coloca es
   `MonitoreoWorkbenchChrome`, que es lo que usan los otros perfiles. Al adoptarlo
   se hereda además el bloque «Cómo se está trabajando», que aulas no tenía.
3. **El chrome antepone un hijo y el grid contaba filas.** `.mon-profile-content`
   declaraba `auto minmax(0,1fr)`; con el bloque de calidad delante, el banner de
   KPIs perdió su fila y **la cabecera del primer panel quedó solapada sobre los
   KPIs**. Ahora es columna flexible: el número de hijos deja de importar.

**Y el `badge` significaba otra cosa.** Le puse el total de filas y el rail lo
lee como «casos pendientes» —así lo documenta `ContextTabRail` y así lo anuncia:
«196 pendientes» en una pestaña donde no falta nada—. Corregido a lo que de
verdad queda por hacer, que además es el lenguaje correcto:

```
Resumen   · 91 pendientes   (cursos-horario bajo su meta)
Estratos  ·  6 pendientes   (estratos con brecha)
Cuotas    · 10 pendientes   (celdas que no llegaron)
```

Verificado en pantalla a 3700 respuestas: el rail a la izquierda, clic en Cuotas
mueve la dirección a `monitoreo/aulas/avance/cuotas` y la URL sigue siendo
`?modo=aulas&seccion=avance&pestana=cuotas`.

Un test de contrato tuvo que actualizarse: comprobaba **el mecanismo** —la clase
escrita en el `className` de un `<section>`— y ahora la aplica el chrome por
`contentClassName`. La intención que protege —que el modificador sea exclusivo de
Fuentes— sigue comprobada, y se le añadió la protección nueva: que el contenido
**no cuente filas**, que es lo que se acaba de romper.


### 2026-08-17 — L73: el orden ya existía y aulas era la excepción

Gonzalo pidió «el avance es una cuestión que va al final, consultas no suele ir
al final como sección». Al ir a cambiarlo resultó que **no había que decidir
nada**: el orden ya está en los otros perfiles y aulas era el único fuera.

| Perfil | Orden |
|---|---|
| Telefónico | fuentes · modelo · llamadas · **consultas · avance** |
| Territorial | fuentes · modelo · calidad · **consultas · avance** |
| **Aulas (antes)** | fuentes · modelo · **avance** · calidad · **consultas** |
| **Aulas (ahora)** | fuentes · modelo · calidad · **consultas · avance** |

Y una segunda excepción que apareció mirando: **aulas aterrizaba en `avance` y
los otros tres en `fuentes`**. Con Avance al final, aterrizar ahí era además
empezar por el resumen de algo que aún no se ha mirado. Alineado.

**Los tres fallos de contrato que aparecieron no son míos.** `manifiesto.test.ts`
espera 207 nodos y hay 213; `modulesNavigation.test.ts` espera 69 pestañas y hay
75. Comprobado con el cambio guardado y sin él: **idénticos**. Vienen del trabajo
sin commitear de otra sesión que hay en el árbol. Mi área sigue en 782/782.


### 2026-08-17 — L70: cada rótulo, con la columna de la que sale

Regla que me impuse antes de tocar nada: **un rótulo sólo cambia si puedo decir
de qué columna del Excel sale**. Lo demás se queda hasta tener con qué
justificarlo.

| Antes (mío) | Ahora | De dónde sale |
|---|---|---|
| «Estado del circuito» | **Status de aplicación** | la columna `STATUS DE APLICACIÓN` |
| «En aplicación» | **Aplicada** | `APLICADA`, valor de esa columna |
| «Meta alcanzada» | **Cumple** | `CUMPLE`, valor de `VALIDO TOTAL` |
| «Recogidas» | **Efectivas** | `CANTIDAD DE EFECTIVAS`, del parte de campo |

«Sin agendar» y «Agendada» se quedan: la segunda es literal de `STATUS MUESTRA` y
la primera su negación, que es como se dice.

Verificado en pantalla a 3700 respuestas: el panel dice «Status de aplicación» y
la leyenda **Sin agendar · Agendada · Aplicada · Cumple**.

**Queda lo grueso**: `aulasPresentation.ts` tiene ~110 rótulos de campo, control y
estado —ya con guard contra el motor, así que renombrarlos es seguro— y los
títulos de las demás secciones. Se hace por tandas, cada una con su justificación,
en vez de un renombrado masivo que nadie pueda revisar.


### 2026-08-17 — L70, segunda tanda: y lo que NO se traduce

Cuatro rótulos más, cada uno con su columna:

| Antes | Ahora | Columna |
|---|---|---|
| «Estado de muestra» | **Status de muestra** | `STATUS MUESTRA` |
| «Estado de aplicación» | **Status de aplicación** | `STATUS DE APLICACIÓN` |
| «Encuestas efectivas» | **Cantidad de efectivas** | `CANTIDAD DE EFECTIVAS` |
| «Ya habían respondido» | **Duplicados (ya respondieron)** | `DUPLICADOS (YA RESPONDIERON)`, con su paréntesis |

**Y dos que se quedan, anotados en el código con el motivo** —que es la parte que
evita que un turno futuro «termine el trabajo» rompiendo algo—:

- **«Respuestas válidas» NO pasa a «efectivas»** aunque suene igual. Las válidas
  las cuenta el sistema sobre lo que llegó de Kobo; las efectivas las cuenta el
  encuestador en el aula. **Que no cuadren es justo lo que detecta el cuadre del
  parte** (L33): llamarlas igual borraría la comparación.
- **«Estado operativo» se queda**: `operational_status` lo deriva el motor
  —planificada, contactada, en campo— y no hay columna que lo nombre. `STATUS
  MUESTRA` ya lo usa `sample_status`, que es el otro eje de L30.

Verificado en pantalla a 3700: la tabla de Avance dice «Status de aplicación» y
la de Agenda conserva sus columnas.


### 2026-08-17 — L74: la cuota, en personas y no en celdas

Gonzalo pidió ver «cómo vamos completando las cuotas por facultad, cómo van las
cuotas a nivel general, cómo van las cuotas a nivel desagregado por sexo». Las
tres salen del mismo dato que ya viajaba; lo que faltaba era **contarlas en
personas**. El KPI decía `2/12 celdas` y doce celdas pueden estar a una respuesta
o a doscientas.

Medido sobre las 196 aulas con 3700 respuestas:

```
Cuota del estudio   ████████████████████░░  694 por recoger
                    3 700 de 4 376 personas · 2 de 12 celdas cumplidas

POR FACULTAD                        POR SEXO
Gestión                152          F   584
Estudios Grales Letras 131          M   110
Ciencias e Ingeniería  109
Educación              107
Arquitectura           100
Derecho                 95
```

**La lectura por sexo es la que no existía en ninguna parte**: faltan 584 mujeres
y 110 hombres. Repartido por facultad, ninguna pasa de 152 y parecería un
operativo parejo; cruzado por sexo, el 84 % de lo que falta es de un solo grupo.

Una decisión con su test: **pasarse en una celda no cubre lo que falta en otra**.
Restar totales daría 0 donde una facultad va sobrada y otra corta; la cuota se
cumple celda a celda y por eso lo que falta se suma así.

**Y un contraste que conviene tener presente**: al estudio le faltan **3776
respuestas** para llenar las metas por aula y **694 personas** para llenar la
cuota sexo×facultad. No es contradicción —una es restricción de volumen y la otra
de composición— pero explica por qué el equipo puede ir «bien de cuota» y mal de
avance.

Queda la parte **«dinámica»** del pedido, que aún no está: hoy son tres lecturas
fijas y él pidió también poder moverse por ellas.


### 2026-08-17 — L75: la cadena se lee de izquierda a derecha

Cada cadena es ahora una línea con sus eslabones en orden y el desenlace en la
franja izquierda:

```
CH 1   Estudios Generales Letras   sin cerrar
       CH 1  titular  0 de 15 → R 1.1  en reserva 1  0 de 29 → R 1.2  en reserva 2  0 de 28
```

Contesta las tres preguntas en el orden en que se hacen: si cumplimos con el
titular, cómo fue su reemplazo, y cuál cerró. Y encabeza con el recuento:
**0 cerraron con el titular · 0 con un reemplazo · 24 sin cerrar · 146 no
necesitaron reemplazo**.

«en reserva n» sale de `EN RESERVA n`, que es como el Excel numera el eslabón.

Una decisión con su test: **el cierre no se acumula entre eslabones**. 20 + 20
con meta 30 no cierran nada, porque cada aula lleva **su propio** aforo elegible;
sumarlos diría que la cadena cumplió cuando ninguna aula llegó.

**Y un diagnóstico mío que era falso.** Al ver «0 de 15» en los 26 eslabones con
3700 respuestas en la base, di por hecho que `agenda` no traía
`respuestas_validas` y añadí una unión con `course_status`. Comprobado: la agenda
**sí** trae el campo y **coincide** con `course_status`. El cero era el valor
real —las aulas que necesitaron reemplazo son precisamente las que no recogieron
nada—. La unión se revirtió: era complejidad sobre un diagnóstico equivocado.

**Deuda declarada**: en este fixture **ninguna cadena cerró**, así que el caso
«cerró R n.1» —el que Gonzalo pregunta— sólo está verificado por test unitario, no
en pantalla. Es la misma clase de límite que ya costó una conclusión falsa: un
sin-hallazgos vale lo que el fixture.


### 2026-08-17 — el fixture no tenía el caso, y era de construcción

Dejé declarado que «cerró R n.1» sólo estaba probado por test. Al ir a cerrar esa
deuda apareció **por qué** faltaba, y no era casualidad:

```r
collectorID = sprintf("CH %d", 25 + (seq_len(n) %% 145))
```

Las 3700 respuestas iban **todas** a `CH 25`..`CH 169`, y las cadenas son
`CH 1`..`CH 24` con sus reservas. **Por construcción ninguna reserva recibía una
sola respuesta**, así que las 24 cadenas salían «0 de N» y el caso que el
operativo pregunta no existía en el fixture.

Corregido el sembrador: las últimas 92 respuestas se reparten entre tres reservas
activas, con sus metas calculadas para que cierren. Verificado en pantalla:

```
CH 1  Estudios Generales Letras   cerró R 1.2
      CH 1 titular 0 de 15 → R 1.1 en reserva 1 0 de 29 → R 1.2 en reserva 2 29 de 28 ✓cumple
CH 3  Arquitectura                cerró R 3.1
      CH 3 titular 0 de 16 → R 3.1 en reserva 1 31 de 30 ✓cumple
CH 4  Educacion                   cerró R 4.1
      CH 4 titular 0 de 17 → R 4.1 en reserva 1 32 de 31 ✓cumple
```

Recuento: **0 cerraron con el titular · 3 con un reemplazo · 21 sin cerrar · 146
no necesitaron reemplazo**.

`CH 1` es el caso que valía la pena ver: cerró con la **segunda** reserva, que es
justo la profundidad que el operativo real de 2025 llegó a consumir.

**La lección, novena aparición y la más concreta hasta ahora**: el fixture no
«resultó» no tener el caso — lo excluía una línea. Un verde sobre él no decía
nada sobre la pregunta de Gonzalo, y la única forma de saberlo fue mirar cómo se
generan los datos, no cuántos hay.


### 2026-08-17 — L74: la parte «dinámica», con la dirección intacta

Faltaba poder **moverse** por las tres lecturas. Una sola interacción, hecha
entera: **elegir un corte enfoca el detalle de abajo**.

```
sin foco              12 celdas
clic en «F»            6 celdas · ?foco=sexo:F
clic en «Derecho»      2 celdas · ?foco=facultad:Derecho
```

Tres decisiones que valen más que la interacción:

- **El foco vive en la URL, no en un `useState`.** Comprobado en los dos
  sentidos: al elegir, la barra pasa a `?foco=facultad:Derecho`; al **pedir esa
  dirección**, la vista restituye el corte y el detalle baja a sus dos celdas.
  Sin eso, «filtré por Derecho» no se puede pegar en un chat.
- **Se escribe por el router**, no con `replaceState`: `useLocation` se quedaría
  con el `search` viejo y la vista rebotaría —es la trampa que ya está
  documentada en `useMonitoreoDireccion`—.
- **La fila enfocable es un `<button>`, no un `div` con `onClick`.** Así la
  alcanza el teclado y anuncia su estado con `aria-pressed`; un `div` clicable
  deja fuera a quien no usa ratón.

Volver a elegir el mismo corte lo quita: no hace falta un botón «limpiar» que
sólo existe para deshacer.


### 2026-08-17 — L70, tercera tanda: los encabezados reales, y dos cruzados

Esta vez no partí del Excel de memoria sino de **lo que el lector reconoce**, que
es la lista de encabezados de verdad:

```
MUESTRA · CURSO-HORARIO · NOMBRE DE DOCENTE · TELEFONO DE DOCENTE ·
CORREO PUCP DOCENTE · NOMBRE DEL CURSO · FACULTAD · NIVEL DEL CURSO ·
SESIONES Y AULA · MATRICULADOS TOTAL DTI · MATRICULADOS POBLACION ·
MEDIO DE CONTACTO · FECHA DE LLAMADA · NUMERO DE INTENTOS · STATUS MUESTRA ·
FECHA DE APLICACION · DIA · HORA · ENLACE DE LA FICHA · OBSERVACIONES
```

**Y ahí apareció que yo tenía dos cruzados.** El Excel llama `CURSO-HORARIO` al
**código** y `SESIONES Y AULA` al **texto descriptivo**; yo mostraba el código
como «Código de ficha» —que en realidad es el material QR, otra cosa— y el
descriptivo se quedaba con «Curso-horario». Corregido, cada columna dice lo suyo.

Quince rótulos alineados, entre ellos:

| Antes (mío) | Ahora | Columna |
|---|---|---|
| «Código de ficha» | **Curso-horario** | `CURSO-HORARIO` |
| «Curso-horario» | **Sesiones y aula** | `SESIONES Y AULA` |
| «Estudiantes elegibles» | **Matriculados población** | `MATRICULADOS POBLACION` |
| «Matriculados» | **Matriculados total DTI** | `MATRICULADOS TOTAL DTI` |
| «Fecha de contacto» | **Fecha de llamada** | `FECHA DE LLAMADA` |
| «Intentos de contacto» | **Número de intentos** | `NUMERO DE INTENTOS` |
| «Enlace Kobo» | **Enlace de la ficha** | `ENLACE DE LA FICHA` |
| «Ola» | **Muestra** | `MUESTRA` |

Verificado en pantalla: la tabla de Agenda muestra «Curso-horario · Rol de
muestra · Reemplaza a · Sesiones y aula · Nombre del curso · Horario · Enlace de
la ficha · Estado de ficha».

El test que fijaba «Ola» se actualizó —el rótulo cambió a propósito— y de paso
se le añadieron los dos cruzados, para que si alguien los vuelve a intercambiar
el test lo diga.

### 2026-08-17 — L77 a L89, la tanda de las tres hojas

Trece ítems que el doc no recogía. Cada uno vive entero en su commit; aquí queda
el defecto en una frase y el puntero, que es lo que evita reabrirlos por
sospecha.

| Ítem | Commit | El defecto, en una frase |
|---|---|---|
| L77 | `31ef4ebe` | El recibo del libro se escribía en la sesión y no lo leía nadie: 5 de 100 claves de `api/R` estaban así, y una era mía. |
| L78 | `8568aac1` | «Estado de ficha» decía «Por revisar» en las 196 aulas sin existir una sola ficha. |
| L79 | `0fb249cf` · `714751ea` · `e98c9386` | Toda vista tras `{loading ? … : …}` pierde el estado de sus hijos al recargar: el mensaje de una acción moría antes de leerse, en los cuatro perfiles. |
| L80 | `3bef4d99` | La cadena no listaba ni una aula caída: el filtro miraba `operational_status` y el reemplazo vive en `sample_status`. |
| L81 | `8feff91c` | El mismo 146 contado como buena noticia y como riesgo; `sinMovimiento` → `sinReserva`. |
| L82 | `30f844cf` | Ocho aulas con fecha rotuladas «Sin agendar», y las ocho eran reservas del banco: `grepl("^en reserva", …)` no podía casar nunca. |
| L83 | `3f2aa458` | Dos gráficos del mismo cruce sexo × facultad; se queda la pirámide y el foco **se muda** a ella. |
| L84 | `69e83bde` | Dos paneles vecinos casi con el mismo nombre y la unidad escondida en un contador de 11 px. |
| L85 | `d5bcd58e` | La lista de brechas abría por la MENOR: el filtro nunca ordenaba y la mayor —31— estaba en la fila 24. |
| L86 | `8366089f` | «39 cumplen sólo uno de los dos» valía igual para dos diagnósticos opuestos, y la hoja lo sabía por aula. |
| L87 | `73d479eb` | El `% ASISTENCIA` estaba declarado en el lector, con su columna resuelta, y no se escribía en el parte. |
| L88 | `7d0c22a7` | Nueve columnas con rótulo «%» enseñaban proporciones: «0.694» bajo «% Asistencia». |
| L89 | `29aeff93` | Las dos hojas del libro cuentan la misma aula y nunca se comparaban entre sí. |
| L90 | `ef1b8d0e` | La evidencia de Validación salía en prosa corrida: los casos que el motor ya enumera —«CH 71: … CH 85: …»— aplastados en un párrafo, y la cola del conjunto pegada al último caso, diciendo que esa aula tenía una discrepancia más. |
| L91 | `d398abca` | Una columna vacía en las 50 filas —«Corrida de selección»— gastaba ancho y desplazaba a «Cadena de reemplazo», que sí lleva dato. `compactColumns` descartaba la clave inexistente pero no la que existe vacía. |
| L92 | `9c9e56ed` | Cada burbuja de eslabón medía según su texto —129, 166, 222 px—, así que el tercer eslabón de una cadena caía donde el segundo de otra y comparar profundidades exigía contarlas una por una. |
| L93 | `94dca941` | Cuatro barras de Plotly en 200 px con DOS en cero: media lámina en blanco, y lo que esas barras vacías decían —que ninguna cadena pasó del primer reemplazo— no se leía en ninguna parte. Franja repartida + los cuatro tramos con sus ceros; el bloque baja a 80 px. |
| L94 | `6fa3a28e` | El plural iba fijo en once rótulos: «1 fuentes activas», y «1 pestañas» seguro —el rótulo usa `length \|\| 1`, así que una sección sin pestañas lo mostraba siempre—. Todos pasan ya por `contar()`, que existía. Tres de ellos los ven los cuatro perfiles. |
| L95 | `f86ceb7a` | En la agenda por día, el total y los que no empezaron iban pegados en el texto: «19» y «3» daban «193 sin empezar». El `gap` del flex los separaba a la vista pero no en el texto, que es lo que lee un lector de pantalla. |
| L96 | `fe834c8e` | La cadena se agrupaba por `replacement_for`, que guarda el `classroom_id` del titular y no su código operativo: sobre HSVG2026, 0 de 202 apuntaban a un titular y el libro escribía 1 043 filas para 202 cadenas. |
| L97 | `8202f724` · `81f11eb0` | El libro salía sin formato ninguno: 0 validaciones, 0 paneles, 0 anchos, 0 protección. Ahora 36 desplegables con el vocabulario medido de 2025, cabecera, panel congelado y las columnas de la app teñidas. |
| L98 | `95623b38` · `68d87931` | El libro sólo entraba por `.xlsx`. Ahora también por una pestaña de Sheets, con el rol de la fuente decidiendo qué hoja es. La API devuelve filas dentadas y sin rectangularizar el lector leía `HORA` donde hay `DÍA`. |
| L99 | `6e544d51` · `44604dbd` | El banco de reservas sueltas contado como cadenas: 639 del pool se leían como 639 cadenas y 639 titulares sin reserva. El fixture no tenía ni una fila de banco ni `classroom_id` distinto del código operativo. |
| L100 | `44604dbd` · `6db870b3` | El fixture tenía 6 facultades y el reparto usaba un `%% 6` a mano: la lista podía crecer a 20 y seguían saliendo 6. Con 20 salieron tres defectos —el nombre no envolvía y se desbordaba 227 px sobre la cifra, los marcos se desigualaron (47/62 y 27/41) y dos textos pegados—. |
| L101 | `c2f9a906` · `3337620d` | El avance se contaba por fila del plan y no por slot: 84 110 respuestas donde el estudio pide 6 901, y 1 976 «por debajo de su meta» donde los slots son 202. Los extras salen a su propia pestaña: no reemplazan, son aulas adicionales para cerrar la cuota H/M por facultad. |
| L102 | `e95bb6de` | `course_status` se recortaba a 500 filas en silencio: 2 115 aulas de 2 615 no llegaban a la pantalla, y con la vista por facultad faltarían facultades enteras sin avisar. |
| L103 | `054c86c5` · `a092e41e` · `d362c2ea` · `3064d288` | «Todo por facultad» en las cinco secciones. El perfil por facultad se calculaba en la vista sobre el bloque recortado; ahora lo agrega el motor sobre el mismo conjunto que las demás cifras. |
| L104 | `25615b3d` · `9e29c5e1` | La tabla de la agenda tenía 88 px —tres filas de 236— porque la franja de días se llevaba 260 de 430. Acotar el elemento no sirve: la pista del grid sigue midiendo su contenido. La franja pasa a `details` plegable y la tabla a seis filas. |
| L105 | `c443daf4` | El gate visual, corrido con `--post-click-wait-selector` —el flag que verifica el DESTINO, no la página de entrada—, encontró 380 px de vacío en la pareja de Avance: el markup declaraba `intrinsic` y el CSS imponía `equal`. Queda medido y NO reparado: a 1024 hay dos dueños de scroll anidados (canvas + tabla), que el contrato prohíbe; el contenido SÍ se alcanza desplazando los dos, así que la etiqueta `scroll-unreachable` exagera. Es la misma decisión estructural del compacto. |
| L106 | `b1392119` | Avance enseñaba «3 700 válidas» y «0 de 3 743 · 0%» sin nada en medio: las respuestas llegan anónimas y ninguna se atribuye a un aula. La pantalla lo sabía —lo dice un control de Validación— y no lo decía ahí. |
| L107 | `3026f38b` · varios | **Una palabra para dos cosas**, cuatro veces: `brechas` con dos denominadores, «la meta» con tres valores, «cursos-horario» 196 vs 236, «aulas» 210 de la hoja vs 196 del plan. El banco sale de la agenda y los rótulos dicen de qué hablan. |
| L108 | `267db02f` | **Las tres dimensiones del libro, medidas campo a campo.** Agenda recogía 20 por eslabón y no enseñaba NINGUNO suyo —el ciclo de contacto entero: a quién se llama, por qué medio, qué día, cuántos intentos—. Campo enseñaba la aritmética del cuadre y no lo reportado —aula real, fecha, estado, observación—. **Control ya estaba bien** y era el modelo: agrupa lo que tiene y declara lo que no («Sin llenar en el libro: Duración»). El fixture escondía las dos primeras: sembraba 8 de los 14 campos del parte y ninguno del ciclo de contacto. |
| L109 | `29fcab4c` | **Los dos umbrales, como matriz.** El criterio que decide el estudio —70 % de asistentes **y** 70 % de matriculados— se leía como lista de frases; en celdas se ve cuántas quedaron a UN solo umbral y por cuál. Sobre el fixture: 31 los dos · 33 sólo asistentes · 6 sólo matriculados · 70 ninguno · 70 indeterminadas. Las 33 fallaron por el lado de los asistentes —fue poca gente a clase— y volver a esa sesión no las trae; las 6 del otro lado sí. Las frases se QUEDAN: dicen qué hacer con cada caso. Las indeterminadas van aparte, no dentro de «ninguno». |
| L110 | `6c35399b` | **El colchón de reservas, facultad por facultad.** Reemplazos tenía la historia de cada cadena y el consumo del operativo entero; ninguna dice DÓNDE se rompe, y la cuota es por facultad. Tres decisiones medidas: la reserva se atribuye a la facultad de su TITULAR —sólo repone esa cuota—; **«sin colchón» eran dos cosas** y partirlas cambió «20 de 20 facultades en riesgo» —que no discrimina— por «14 agotaron reserva» (operativo, corregible) y «146 cursos-horario nunca la tuvieron» (diseño muestral), y ese 146 coincide con el `sinReserva` que ya calculaba `consumoDeCadena` por otra vía; y la columna de extras **se retiró antes de nacer** porque no podía llenarse nunca —la vista filtra el banco a propósito desde `8feff91c`—. |
| L111 | `7b7860b5` | **El color se buscaba por rótulo cruzando vocabularios.** `colorDeEstado` comparaba contra los tramos de `application_state` y acertaba en `sample_status` por **pura coincidencia de rótulos** —«Agendada», «Reemplazada», «En reserva» existen en los dos—; en `operational_status`, cuyos once estados no comparten ninguno, fallaba entero: **0 de 168** celdas de Brechas con chip, en la misma pantalla donde otra tabla sí coloreaba. Un acierto por coincidencia se ve igual que uno de verdad hasta que cambia el dato. Ahora los once estados van a cinco familias de desenlace, el vocabulario se muda a `aulasPresentation` —estaba en `RegistroDeCampo` sirviendo sólo a un select— y un test recorre los DOS vocabularios enteros exigiendo color, más el aserto de que un rótulo compartido da el MISMO color. Verificado quitando `contactada`: rojo y nombra al culpable. 168 de 168 después. |
| L112 | `740dd85a` | **El veredicto que falla parecía ausencia.** `VALIDO TOTAL` y `VALIDO POBLACION` dibujaban el no cumple «·» y el sin dato «—»: dos marcas grises del mismo peso para cosas opuestas, y la más callada era la del caso MAYORITARIO. Medido en «Válido población», 210 filas: 103 no cumplen · 37 cumplen · 70 sin dato — la columna se leía como «casi todo vacío». El negativo pasa a ✗ en granate y el gris queda sólo para lo que de verdad calla. |
| L113 | `6db4f7a1`-serie | **Barrido de Avance, panel por panel.** Cuatro conformidades y tres arreglos. **Contador**: Avance contaba 236 donde Fuentes cuenta 196 «titulares y sus reservas encadenadas» —la diferencia son los 40 extras, y el 236 es CORRECTO porque los extras se aplican y traen respuestas—; ahora el contador dice «236 cursos-horario · 40 del banco», con la cuenta sacada de las MISMAS filas que el panel dibuja. **«Dónde falta más»**: cada fila ponía «9 cursos-horario» y «232 faltan» pegados, dos unidades y una sola nombrada; el grande son respuestas y no cabía en el título —«Dónde faltan más respuestas» chocaría con «Cumplimiento en respuestas»— así que la palabra va a la fila. **«Ritmo»**: el contador decía «12 días» y dentro se leía «10 días de campo» y «al ritmo de estos 10»; ahora «12 días · 10 con campo», con el sufijo sólo cuando difieren. Y su pie decía «Faltan 43» a dos dedos de un panel que dice «3 743 faltan» sobre la MISMA meta: son granos distintos —el estudio entero contra lo que se puede colgar de un aula— y ahora dice «para la meta TOTAL». **La tabla declara su orden**: la ordena el motor por tramo del circuito y dentro por brecha, y sin decirlo «CH 74, CH 99, CH 49» se lee como desorden. |
| L114 | — | **Cinco sospechas que se disolvieron al leer la superficie entera**, todas anotadas porque cada una iba a ser un «hallazgo». (1) 30 encabezados contra 26 celdas en la Base de control: el `thead` tiene dos filas de grupos. (2) «196» compitiendo con «236» dentro de Avance: los dos 196 son RESPUESTAS que faltan, coincidencia de dígitos. (3) «Cumplimiento en respuestas» sin denominador: parte bien su universo —0 cubren · 168 con brecha · 2 sin meta, fuera de la cuenta— y los tres grupos suman. (4) La tabla de Avance «sin ordenar»: la ordena R por `application_state` y luego `-brecha`, y la única inversión es el cambio de tramo. (5) El cap de 500 filas «arbitrario»: el orden pone primero lo accionable, así que el recorte suelta lo menos relevante. **Regla: medir la superficie entera, no el trozo que confirma la sospecha.** |
| L115 | `6db4f7a1`-serie | **Barrido de Modelo y Consultas.** **Registro**: el panel se llama como su hoja —«Aulas Aplicadas (Campo)»— y enseñaba 196 aulas en «Planificada», cero aplicadas; el nombre promete aplicadas y la lista entrega ninguna. El título NO se toca —es el lenguaje referencial del Excel, que es a lo que el equipo va a buscar la hoja— y la tensión se resuelve con dato: «196 cursos-horario · 0 con parte», que además es lo que se viene a saber en un registro. **Banco de extras**: la línea decía «1 345 alumnos · 580 mujeres y 460 hombres» y quien resta encuentra 305 sin explicación. No es error de cuenta: «alumnos» son TODOS los elegibles y mujeres/hombres salen de las dos categorías de sexo **más frecuentes** de cada aula (`sex_top_1_n`/`sex_top_2_n`). Y ese tercer número es el que decide, porque el banco existe para cerrar la cuota de sexo: sin él se cree que cubre más de lo que puede. Ahora «· 305 sin sexo declarado», nunca negativo. |
| L116 | — | **Conformes verificados por RECÁLCULO, no por vista.** «Aulas agendadas»: contador 196 = tabla 196 filas = suma de la banda de días 196; 10 días declarados y 10 listados; los 160 «sin empezar» coinciden con su leyenda. «Cursos-horario con brecha»: la suma de la columna Brecha da **3 743**, exactamente lo que Avance declara, y las aulas para cubrir la mitad dan **69**, el número que dice su línea de concentración. «Partes de campo»: 5 390 − 210 rechazos − 315 duplicados = **4 865** = «Efectivas que implican»; el equipo declaró 4 863, dos menos, y las dos que no cuadran abren la tabla. Tres superficies y tres cálculos independientes que coinciden. |
| L117 | — | **CORRECCIÓN de una cifra mía.** Dije «21 descuadres sobre 210» en el parte de campo, y lo repetí en un commit y en un traspaso a otra sesión. **Son 2 de 210.** El 21 salía de un EJEMPLO de una fila —«25 asistentes menos 1 rechazos y 3 duplicados dan 21, pero el parte declara 20»— que leí como si fuera el total. Consecuencia: el pendiente «dar color a la columna Cuadra» **decae**. Con 2 excepciones sobre 210, ya están declaradas en el contador («210 partes · 2 sin cuadrar»), dichas en una línea y puestas primero en la tabla; el color no añadiría nada. |
| L118 | (sesión 2026-08-18) | **La Base de control no tenía dónde.** Gonzalo: «no siento que tenga ningún lugar para poder ver lo que veía en Base de control». Estaba en la página pero para llegar a la hoja —210 filas, 26 columnas— había que bajar por un banner, tres KPIs y seis alertas. **Validación era la única sección del perfil sin pestañas** y apilaba sus dos superficies. Ahora «Controles» y «Base de control», cada una con la vista entera, misma razón que ya partió Agenda en dos. Siguen en la misma sección porque las dos son control de calidad, y separadas porque no son la misma medida: una la deriva el motor, la otra la calcula el equipo en su Excel. |
| L119 | (sesión 2026-08-18) | **«A dónde ir cada día», la agenda por facultad.** La tabla está en orden de curso-horario, que sirve para BUSCAR una fila cuando ya se sabe el código; la pregunta de campo es la contraria y obligaba a rastrear las 196 filas y rehacer el grupo a mano, entre 10 y 18 veces por día de campo. Tercera pestaña de Agenda, con el día, la hora, el código, DÓNDE («LUN 08:00 A130», con pabellón y salón), el docente y el estado. **Abierta la primera facultad y cerradas las demás**: con las 20 abiertas la lista mide 5 538 px y hay que recorrerla entera; el recorrido baja de 16× a 2,7× el alto visible. Un aula sin fecha va al FINAL de su facultad —ordenando por texto la cadena vacía es la menor y la vista abriría por lo único que no se puede planificar—. **Clase propia y no `aulas-agenda-panel`**, que tiene su grid afinado a TRES hijos: reusándola la lista recibía 118 px para 5 538 de contenido y quedaban 223 px muertos. |
| L120 | (sesión 2026-08-18) | **Un contador MÍO, mal, y cómo se cayó.** Puse «196 cursos-horario · 0 con parte» derivándolo de `operational_status`, que es el campo que mueve esa misma pantalla al guardar: sobre un libro importado se queda en «planificada» aunque el parte exista. Consultas enseñaba «210 partes» a la vez. **Son 170 de 196.** Y el resto cuadra solo: la hoja trae 210 filas, 170 son del plan y las otras 40 son los extras, el tamaño exacto del banco. Quedan 26 del plan sin parte. **Lección: un contador que nace de un campo CERCANO en vez del hecho que nombra pasa el typecheck, pasa los tests y se ve bien.** Sólo se cae al cruzarlo con otra pantalla que cuenta lo mismo por otra vía — el mismo método que encontró el 146 y el 3 743. |
| L121 | (sesión 2026-08-18) | **«Lo que se quedó atrás»: el cruce que faltaba.** La agenda tiene la fecha de cada aula y la hoja de partes dice cuáles se llenaron, y nadie las cruzaba: «cómo va el operativo» sólo se contestaba en agregado y ninguna superficie decía a qué aula ir a reclamar hoy. **18 de 119 vencidas siguen sin parte**, 77 aún por venir; la lista abre por la que lleva más días caída y los DÍAS van delante, porque la fecha sola obliga a restar de cabeza. Cuatro decisiones: el día del corte NO vence (el aula puede aplicarse esa tarde); el corte entra por argumento y no de `new Date()` (un panel que lee el reloj no se puede fijar en un test ni reproducir); **el banco fuera** —la primera versión daba 143+93=236, la agenda MÁS los 40 extras, que no tienen día que vencer; con el filtro 119+77=196—; y las sin fecha se declaran aparte. |
| — | (sin commit) | **Dos avisos del gate medidos y descartados**, para no reinvestigarlos: el `scroll-unreachable` de Avance a 1024 es una cadena de scroll anidada —el contenido SÍ se alcanza desplazando canvas y tabla—; y los 16 `overflow-x` de «Base de control» en Validación son columnas fuera de la ventana en una tabla de 2 674 px con `overflow-x: auto` propio, alcanzables y sin desbordar la página. |

**Lo que estos trece dejaron como método** —y es lo que de verdad se reutiliza—:

- **El fixture excluyó por construcción diez veces** lo que la vista existe para
  mostrar. Ya no basta con que el motor sepa hacer algo: hay que sembrar el caso.
- **Medir antes de opinar corrigió el propio encargo dos veces**: daba
  `threshold_total` y `threshold_population` por porcentajes cuando son conteos
  de encuestas, y daba por cruzables tres campos que están vacíos en una de las
  dos hojas.
- **La escala de una columna se decide sobre la columna entera**, nunca valor a
  valor: una cobertura del 108 % y una del 98 % conviven en la misma columna.

### 2026-08-17 — L90: el barrido de `frontend/src/api/`, y por qué un cero no es deuda

Medido sobre 41 archivos y **581 exports de valor** (`export function` y
`export const`). Con `\b` a los dos lados, porque un grep de prefijo cuenta de
más.

**129 tienen cero usos fuera de `src/api/`.** Ese número solo no dice nada, y
por eso se parte en dos con la pregunta que sí decide: *¿lo usa al menos otro
archivo de la carpeta?*

| Montón | Cuántos | Qué son |
|---|---|---|
| Primitiva interna de la capa | **30** | `apiFetch`, `SESSION_KEY`, `downloadFailedMessage`… Se exportan porque los módulos hermanos los necesitan. Su cero es **correcto**, no deuda. |
| Exportado y usado sólo en su propio archivo | **99** | Nadie los importa, ni fuera ni dentro. Éstos son los candidatos. |

De los 99, **50 viven en `calcMuestra*` y `hojasRuta.ts`**, que es territorio de
la otra sesión y está en obra: declararlos muertos pisaría trabajo en curso. Los
49 restantes se reparten sobre todo entre `codificacion.ts` (11), `monitoreo.ts`
(8), `xlsformEditor.ts` (8) y `validacion.ts` (5).

**Los ocho de Monitoreo, con su endpoint comprobado en R:**

| Función | Endpoint | Existe en R |
|---|---|---|
| `apiMonitoreoSheetsList` | `/api/monitoreo/sheets/list` | sí (`router_monitoreo.R:2912`) |
| `apiMonitoreoSheetsStatus` | `/api/monitoreo/sheets/status` | sí (`:2900`) |
| `apiMonitoreoSheetsSync` | `/api/monitoreo/sheets/sync` | sí (`:2937`) |
| `apiMonitoreoAulasConfig` | `/api/monitoreo/aulas/config` | sí (`:5017`) |
| `apiMonitoreoExport` | `/api/monitoreo/export` | sí |
| `apiMonitoreoProcessingHandoffPromote` | `/api/monitoreo/processing-handoff/promote` | sí |
| `apiMonitoreoSupervisionSample` · `apiMonitoreoTerritorialEnumeratorCodeReconciliation` | — | por comprobar |

Lo que se ve al mirarlos juntos: **las tres de Sheets son una generación
anterior**. La UI publica con `apiMonitoreoPublicationSheetsPublish`
(`MonitoreoOutputsWorkbench.tsx:1024`) y conecta con `apiMonitoreoSheetsInspect`
y `apiMonitoreoSheetsSource` (`ConectarFuente.tsx`). Conviven dos familias para
lo mismo y sólo una está viva.

**No se retira nada en esta pasada, y el motivo importa**: un endpoint de R que
sigue en pie con su envoltorio muerto puede ser una retirada a medias o una
capacidad esperando superficie —L29 fue exactamente eso al revés— y la
diferencia no se decide con un `grep`. Queda medido y con nombres, que es lo que
cuesta caro; retirarlo es una decisión aparte.

## 2026-08-17 — Gonzalo redirige el loop: «no vas a mejorar la interfaz de fondo»

Su mensaje, textual y entero, porque es la instrucción que manda sobre todo lo
anterior:

> «Lo que más me sorprende es que ya lleves por el Loop noventa y uno y hayan
> cosas que todavía se sigan viendo mal. O sea, tú vas a validación y es una
> tabla de control feísima sin ningún tipo de formato, tremendamente horrible.
> No entiendo fuentes también, no tienen ni ninguna pestaña, no hay ningún tipo
> de detalle. En agenda todo está mal distribuido, consultas también se ve fatal,
> tiene unas burbujas de cadenas de reemplazo que francamente no entiendo por qué
> se tienen que ver así tan mal, está desordenado, tienes el curso horario dos y
> luego el diez y luego el trece, no tiene sentido. El avance tiene gráficos,
> pero se sigue viendo vacío, crudo, en verdad. Yo no entiendo francamente para
> qué vas a tener tantos loops, si en cada loop no vas a mejorar la interfaz de
> fondo.»

**Tenía razón, y el diagnóstico de por qué es lo que importa.** Llevaba veinte
pasadas arreglando lo que las superficies **dicen** —rótulos, unidades, órdenes,
cuadres, capacidades sin consumir— y llamándolo producto. Todo eso era cierto y
ninguno era mentira, pero **cómo se ven** no se había movido. La regla nueva:
cada pasada deja una mejora visual con captura antes/después, o no cuenta.

### Sus cinco superficies, cerradas

| Superficie | Lo que estaba mal, medido | Commit |
|---|---|---|
| Consultas | Orden **alfabético** en los cuatro sitios que desempataban por código (`CH 2, CH 10, CH 11 … CH 24, CH 5`) y 21 tarjetas idénticas con borde, radio y franja diciendo la misma frase | `d198d67e` |
| Validación | 27 columnas alineadas a la izquierda con «91.7 %» partido en dos líneas · **tres alturas de fila** (98 a 33 px, 56 a 36, 16 a 47) porque «FUERA DE RANGO» envolvía · los cuatro grupos del libro sin corte · veredictos como `1`/`0` | `84876b7a` |
| Fuentes | `resumen` del libro llegaba **en el tipo** y no lo consumía nadie; `n_rows`/`variables` viven en el estado y la vista sólo recibía el tablero | `3d49b0e1` |
| Agenda | Barras de **seis colores sin leyenda**: el único modo de saber qué era cada segmento era pasar el ratón | `136a627f` |
| Avance | No era relleno —el padding era el del sistema—: **1 636 px de columna con el ancho sin usar**, cuatro gráficos cortos apilados | `ddbdc536` |

### Lo que salió al barrer el resto

- **`188244f3`** — el gris de la pirámide significa «todavía sin trabajar» y se
  usaba para todo lo que bajara del 50 %: una celda con 191 de 421 recogidas se
  pintaba como la menos urgente siendo la que iba más atrás.
- **`417a4b4d`** — en el mismo panel, el gráfico de estratos iba por brecha y su
  tabla por alfabético.
- **`e1a160e0`** — «Sesiones y aula» decía «Aula CH 24» junto a «CH 24»: parecía
  redundante y **era del fixture**, no del producto. Mirarlo antes evitó borrar
  una columna real del Excel.
- **`99aaedf3`** — las cifras se alineaban en **una** tabla de seis; las otras
  cinco pasan por `DataTable`, que lo ponía todo a la izquierda.
- **`fe5bb237`** — el registro de campo dejaba **1 030 × 436 px** sin nada hasta
  elegir un aula, con una línea de 13 px en la esquina.
- **`c57794be`** — el desplegable con menos texto de la vista era el campo más
  ancho: 1 034 px para once opciones cortas.
- **`0465df5c`** — la pareja de Avance declaraba contrato `equal` y al apilarse a
  1024 medía 307 contra 274. La declaración estaba de más, no la vista.
- **`173e9fc2`** — **el perfil no tenía eje de tiempo.** Acreditación y
  telefónico llevan ritmo diario desde hace tiempo. Al construirlo aparecieron
  dos incoherencias del fixture invisibles sin él: marcas de envío en progresión
  aritmética (trece días de 288) y un calendario del 1 al 13 cuando la agenda va
  del 10 al 21 — respuestas antes de que las aulas estuvieran agendadas.

### Lo que esta tanda enseñó

- **Arreglar lo que una superficie dice no la hace verse bien.** Son dos trabajos
  distintos y el segundo no sale del primero.
- **Leer el `innerText` no es mirar la pantalla.** Dos roturas de esta tanda
  —`state is not defined` y un `)}` huérfano— las vio el navegador antes que el
  typecheck, que todavía corría.
- **Una celda que envuelve desalinea la fila entera**, y con ella la tabla.
- **Un vacío y un hueco de maquetación se ven igual** si nadie los distingue: 56
  filas de guiones se leían como una franja en blanco.
- **Mirar el fixture antes que el producto.** Dos veces esta tanda el defecto
  visible era del dato de prueba, y arreglar el producto habría borrado
  capacidad real.

### 2026-08-18 — el perfil pasa entero el gate visual del proyecto

`ui-quick-check --require-geometry` **nunca se había pasado sobre aulas**. Al
correrlo por primera vez dio `ok=false` con dos `capacity-drift`, y tirando de
ese hilo salió algo mucho mayor que los 16 px que marcaba: **`.mon-workbench-head`
se estiliza en `monitoreo.css` y aulas no importa ese archivo**, así que el
encabezado se pintaba en `display: block`, sin una sola regla, con el icono y el
título apilados. No era un encabezado mal ajustado; era un encabezado sin estilo
—y explica los 142 px que medí al ponerlo y que me llevaron a recortarle el
`detail` por «caro»: no era caro, estaba roto. Con el material del perfil son
**64 px**.

**Cobertura, y su matiz.** La primera tanda cubría las cinco secciones, pero el
runner aterriza en la pestaña de entrada de cada una: las otras cinco pestañas
—Cuotas, Estratos, Brechas, Parte de campo y Registro— quedaban fuera. Decirlo
y cerrarlo después es la diferencia entre cobertura y verde compuesto.

Estado final, **12 direcciones × 2 viewports = 24 capturas**:

| | |
|---|---|
| `ok` | true en las doce |
| `geometryIssues` | 0 |
| `geometryCoverageMisses` | 0 — conformidad, no ausencia |
| `scrollJails` · `overflow` · errores de página/API/recursos | 0 |

Y lo que hizo falta para llegar: declarar el dueño del vacío en los cinco
contenedores de lista del perfil (ninguno lo tenía, ni los previos ni el ritmo
que añadí), y **no** declararlo en los dos gráficos de Plotly —medido sobre los
otros tres perfiles: 16 declaraciones de capacidad y ninguna en un archivo con
`PlotlyChart`, porque un gráfico llena su caja y no tiene vacío interior que
poseer—.

### 2026-08-18 — auditoría de guards: ¿ve cada uno lo que dice vigilar?

La pregunta no es «¿pasa el test?» sino **«¿el test puede ver lo que dice
vigilar?»**. Aplicada a los cinco guards de los que depende este trabajo:

| Guard | ¿Cubre lo que declara? |
|---|---|
| Títulos de panel | **sí** — ve el panel nuevo, y no hay ningún `<h3>` del perfil fuera de los tres archivos que lee |
| Vocabulario de controles R↔UI | **sí** — extrae los diez `check` del motor, el nuevo incluido |
| Columnas de tabla | **no** — cubría 2 de las 4 tablas que hoy se leen (`c4a30528`) |
| Resultados de acción | **sí** — lee los tres perfiles por ruta y revienta si se mueven |
| Geometría (`ui-quick-check --require-geometry`) | **nunca se había pasado** sobre aulas (`3daef3c9`) |

**Dos de cinco no cubrían lo que decían, y en ninguno de los dos casos fue por
descuido**: el guard se escribió bien y **el perfil creció por debajo**. El de
columnas se ató a «las tablas que se leen» cuando eran dos; después llegaron
Partes de campo y Base de control y siguió en dos. Ésa es la forma en que un
test envejece **sin ponerse rojo nunca**.

Lo que distingue a los que aguantaron: **fallan ruidosamente al crecer**. El de
resultados de acción lee sus archivos por ruta, así que mover uno revienta el
`readFileSync`. El de columnas usaba un regex que, al no casar, simplemente
devolvía menos columnas en silencio — de ahí el `expect(columnas.length)
.toBeGreaterThan(40)` que lleva ahora: si ese número baja es que dejó de ver una
tabla, y eso sólo se nota contando.

**Y comprobar que un guard nuevo CAZA, no sólo que pasa.** El de columnas
ampliado se verificó retirando la etiqueta de `attendance_pct`: rojo con el
mensaje correcto, y verde al restaurarla.

**El instrumento produce el hallazgo — tres veces en esta tanda.** Un `grep`
sobre `profiles/` dijo que `mon-calidad` sólo la usa aulas (la pinta el chrome
para los cuatro). Dos medidas de altura salieron falsas por tomarlas antes de
que asentara el layout. Y la primera expresión para extraer columnas cogió el
bloque del cuadre interno y campos de un grupo que la tabla no muestra.

### 2026-08-18 — límite declarado: el perfil de aulas no tiene proyecto de referencia

Todo lo verificado en esta tanda —los cinco gates, las 24 capturas del gate
visual, el cuadre entre hojas, el ritmo diario— está medido sobre **un solo
fixture**, `/tmp/cierres.pulso`, que produce `api/scripts/qa_pulso_aulas_campo.R`
y que he editado cinco veces hoy.

Intenté una segunda opinión sobre `hsvg2026` y **el verde no valía**: el runner
devolvió `ok=true` con `geometryIssues=0`, pero mirando qué había capturado, la
pantalla era la de elección de modo —«¿Qué tipo de estudio vas a monitorear?»—.
`hsvg2026` es el proyecto de **cálculo de muestra** de aulas a escala, no un
estudio con monitoreo configurado, así que la dirección aterrizaba en la
pregunta de modo y el gate medía una página ajena a este trabajo. Los dos
grupos de geometría en vez de cuatro fueron la señal que lo delató.

**Ninguno de los cinco proyectos de referencia tiene el perfil de aulas en
Monitoreo**: `acnur_pdm` es telefónico, `acrconta` acreditación, `acnur_acg`
pipeline y `hsvg2026` cálculo de muestra. El ADR 0043 los creó para reproducir
bugs sobre estado real, y este perfil —cinco secciones, doce direcciones, tres
hojas de Excel— no tiene ninguno.

**Decisión para Gonzalo:** ¿se anonimiza un estudio real de aulas con
`api/scripts/pulso_anonimizar.R` y entra como sexto proyecto de referencia? Sin
él, todo lo que este perfil afirma se apoya en un fixture que escribimos
nosotros — y esta misma tanda lleva **diez** casos en que ese fixture excluía
por construcción justo lo que la vista existe para mostrar.


## 2026-08-18 — Dos trampas de medición nuevas, de la misma tanda

**`ir()` con una clave de sección inexistente no navega ni avisa.** Las secciones
del perfil son `fuentes` · `modelo` · `avance` · `calidad` · `consultas`; barrí
con `monitoreo/aulas/agenda` y `monitoreo/aulas/validacion`, que no existen, y
el puente se quedó donde estaba. La sonda leyó la tabla de la página anterior y
la reporté como si fuera de Agenda. **La clave se saca de
`__pulsoNav.manifiesto`, nunca del nombre visible de la pestaña**, y la
dirección observada se comprueba contra la pedida antes de leer nada.

**`querySelectorAll('thead th')` no sirve en una tabla con cabecera agrupada.**
La Base de control aparentaba 30 encabezados contra 26 celdas, con «N.º mujeres»
lleno de horas: parecía un desalineamiento grave. El `thead` tiene DOS filas
—grupos «Cuenta» ×14, «Cuotas» ×9, «Rango horario» ×2— y la sonda las aplanó en
una sola lista. Leídas bien, las 26 columnas casan una a una: **la tabla estaba
correcta**. Es la tercera vez en la serie que una sospecha se disuelve al leer
la superficie entera en vez del trozo que confirmaba la sospecha.

## 2026-08-18 — Estado del barrido de tablas

| Sección | Tablas | Estado |
|---|---|---|
| Fuentes | 0 | son tarjetas; Gonzalo ya la había exceptuado |
| Modelo · Agenda | 1, 196 filas | 196 chips de estado, conforme |
| Calidad · Validación | 1, 210 filas | sin columna de estado —correcto—; veredicto reparado en L112 |
| Consultas | 4 | conforme tras L111 |

**Declarado y no reparado:** la columna «Cuadra» (Sí/No) del parte de campo, 21
descuadres sobre 210. No es un estado del vocabulario sino un veredicto por
fila, y darle color pide decidir antes si un descuadre se pinta como fallo.


## 2026-08-18 — Trampa del entorno: el HMR se atasca en el módulo roto

Tras un error de sintaxis, Vite deja de recargar el módulo y la página sigue
mostrando el estado anterior **aunque el typecheck ya esté limpio**. Pasó dos
veces en la misma sesión: los paneles devolvían `[]` con el código correcto ya
en disco. Lo dice la consola —«[vite] Failed to reload … 500»— y se arregla con
`location.reload()`.

**Un typecheck verde no garantiza que lo que ves en pantalla sea tu código.** Si
una medición en el navegador contradice lo que acabas de escribir, lee la
consola antes de dudar del código.


## 2026-08-18 — C5 categoría 2: lo que el fixture NO puede enseñar

Barrido de los estados vacíos y avisos de los paneles del perfil. **84 ramas**
en total; la clasificación deja dos grupos que el fixture `/tmp/cierres.pulso`
**no puede producir**, y por razones opuestas.

### 19 ramas de «sin dato» — el fixture tiene datos en todo

| Panel | Rama |
|---|---|
| `AulasAgendaPorDia` | «Ninguno de los N cursos-horario tiene fecha de aplicación» |
| `AulasAgendaPorFacultad` | «No hay agenda de cursos-horario» |
| `AulasAvanceEnRespuestas` | «El plan todavía no declara metas» · «Ninguno declara cuántas espera» |
| `AulasBrechaEstratoChart` | «El plan no declara estratos que comparar» |
| `AulasCadenaChart` · `AulasHistoriaCadena` | «El plan todavía no declara cadenas» · «Ninguno tiene reserva» |
| `AulasControles` | «No hay controles de validación para este corte» |
| `AulasFrenteDelOperativo` | «La agenda todavía no declara fechas» · «Ninguno tiene fecha agendada» |
| `AulasPerfilPorFacultad` | «Ninguno de los N declara facultad» |
| `RegistroDeCampo` | «No hay agenda de cursos-horario» |
| Tablas de la página | agenda sin importar · avance por estrato · composición por sexo · «Sin datos» del control |
| `VacioSinTablero` | el perfil sin tablero |

Sólo salen en un proyecto **recién abierto o a medio configurar**, que es
justamente el estado en que un usuario nuevo encuentra la app.

### Las ramas de «buena noticia» — el fixture está roto a propósito en todo

| Panel | Rama que nunca aparece | Lo que el fixture fuerza |
|---|---|---|
| `AulasFrenteDelOperativo` | «Todavía no vence ningún curso-horario» y «los N vencidos tienen su parte» | 18 de 119 sin parte |
| `AulasColchonPorFacultad` | «Ninguna facultad ha agotado la reserva» | 14 de 20 agotaron |
| `AulasPerfilPorFacultad` | «meta cumplida» por facultad | 0 de 20 la cumplen |
| `AulasMatrizUmbrales` | las tres celdas sin desglose | el motor siempre trae los dos umbrales |
| `AulasAvanceEnRespuestas` | el tramo de excedente | 0 respuestas atribuidas |

**Deuda declarada, no arreglo (C5 categoría 2).** No se fabrican datos para
llenarlas y no se tocan los componentes: lo que falta es un proyecto donde el
operativo vaya bien. Es la undécima vez en esta serie que el fixture excluye por
construcción una rama que la vista existe para mostrar, y refuerza la decisión
pendiente de Gonzalo — **anonimizar un estudio real de aulas como sexto proyecto
de referencia**.


## 2026-08-18 — El gate visual, corrido de verdad sobre las cuatro superficies nuevas

Once problemas reales, **nueve míos**, y ninguno se veía en el typecheck ni en
los 1 123 tests.

| Dirección | antes | después | lo que queda |
|---|---|---|---|
| `modelo/facultad` | 5 | **1** | `capacity-drift` de 5 px en «Preparación de campo», anterior |
| `avance/resumen` | 5 | **1** | `scroll-unreachable` a 1024×600, deuda L105 del compacto |
| `calidad/base` | 6 recortes | **0** a 1440 | — |
| `consultas/reemplazos` | 0 | **0** | limpio de entrada |

### Lo que encontró, uno por uno

- **La ruta por facultad era dueña de un scroll que no le tocaba.** Con una sola
  facultad abierta, el último contenido que el contrato cuenta está ARRIBA, así
  que al bajar al final del recorrido interno se iba por encima del borde: base a
  259 px en 1440×1000 y a **−108 px** en 1024×600. Un scroll cuyo final no
  enseña el último contenido es `scroll-unreachable`, y encima anidaba un
  segundo dueño. La lista pasa a crecer y la página la recorre: ~941 px con la
  primera abierta, un solo dueño.
- **Los dos paneles de gráfico de Avance no declaraban capacidad (C1).** El gate
  cae a la cabecera como dueña y reporta sus 4–5 px de holgura. Diagnóstico
  sobre el sitio equivocado: los paneles tienen 1 px libre abajo. **Falsa
  hipótesis descartada midiendo**: creí que era el contador que alargué hoy, y
  las cabeceras miden 32 px en los cuatro paneles, incluido uno que también
  alargué y que no salía marcado.
- **Tres cabeceras de la Base de control se recortaban sin `title`.** El recorte
  a 130 px es deliberado —esos rótulos ocupaban tres líneas— y el contrato
  acepta elipsis en una etiqueta. Lo que faltaba es lo que el propio comentario
  daba por hecho: «con elipsis, el nombre entero queda en el `title`». **El
  atributo no estaba** en ninguna de las 26.

### La trampa, otra vez, y cómo se detecta

La primera corrida dio **`ok=true`, 0 issues, 2 grupos**: estaba midiendo la
página de ATERRIZAJE. `--wait-selector` se comprueba antes de que `--ir`
navegue; el que verifica el destino es **`--post-click-wait-selector`**. Con él
aparecieron 10 grupos y los 5 problemas.

**La señal que lo delata es el número de grupos**: 2 contra 10. Si el gate
devuelve un verde con menos grupos de los que la vista tiene paneles, midió otra
pantalla.


## 2026-08-18 — Las doce direcciones del perfil, medidas

Barrido completo con `--require-geometry` y **`--post-click-wait-selector` en
todas**, que es lo único que distingue medir el destino de medir el aterrizaje.

| Dirección | |
|---|---|
| `fuentes` · `modelo/agenda` · `modelo/facultad` · `modelo/registro` | ✅ |
| `calidad/controles` · `calidad/base` | ✅ |
| `consultas/reemplazos` · `brechas` · `extras` · `parte` | ✅ |
| `avance/resumen` | 1 — `scroll-unreachable` a 1024×600, deuda L105 |

**Once de doce en verde por conformidad comprobada.**

### El defecto sistémico: cinco paneles culpaban a su cabecera

`capacity-drift` de 5 px atribuido a `mon-profile-panel-head` en «Preparación de
campo», «Operación del plan», «De dónde salen las respuestas», «Aulas aplicadas
(campo)» y los dos gráficos de Avance. Es **la trampa que la norma describe**:
con el grupo declarado en el `section`, la cabecera entra como miembro y su
holgura se contabiliza como espacio muerto — cuando el panel tiene 1 px libre
abajo, medido.

**Probado antes de dar la explicación por buena**: declarar la capacidad en el
contenedor interior NO bastaba, porque el miembro marcado pertenece al grupo
exterior. Sólo retirar el grupo del `section` lo resuelve. En los dos gráficos
la vía fue la otra —declarar `data-qa-geometry-capacity` en el contenedor del
gráfico— porque ahí el grupo sí envuelve los datos.

Que el mismo error esté en cinco paneles significa que **se copió de uno a
otro**; ahora el siguiente copiará el bueno.

### Regla nueva para el gate

**Un verde con menos grupos de los que la vista tiene paneles no es un verde.**
La primera corrida de la sesión dio `ok=true`, 0 issues y **2 grupos**; con el
flag correcto, **10 grupos y 5 problemas**.


## 2026-08-18 — El `scroll-unreachable` de Avance a 1024×600, resuelto y explicado

Era la última deuda estructural declarada (L105). Medida entera, se parte en dos
cosas distintas.

**Una era real y mía.** A 1024×600 la pantalla tenía **TRES dueños de scroll**:
el del workbench (2 740 px de excedente), el de la tabla (9 311) y
`aulas-frente-lista` (117). El tercero se lo puse yo con un `max-height` +
`overflow-y`, por la misma razón que se lo había puesto a la ruta por facultad
—«cien filas empujarían el resto de Avance»—. **Arreglé aquélla y dejé ésta**,
que es exactamente cómo se copian los defectos. Retirado: quedan dos dueños, y
el de la tabla es el aceptado.

**La otra es una limitación del runner, ahora medida y no opinada.** El
`lastContent` que exige ver al final del recorrido es un `<small>` con
«cursos-horario por debajo de su meta», que vive en el **`header`** del
workbench —por ENCIMA del dueño de scroll—, así que no puede estar visible a
`maxScroll`: nunca. Medido en el navegador a 1024×600: el dueño llega al final
(`atEnd`), los **siete paneles se alcanzan** y el último —«Avance por
curso-horario»— queda con su base exactamente en el borde inferior, visible.

**El contenido SÍ se alcanza.** La etiqueta `scroll-unreachable` no describe un
contenido inalcanzable sino un elemento fijo que su heurística espera abajo. Se
declara como falso positivo **con la evidencia**, no como pendiente, para que
nadie lo reabra por sospecha.


## 2026-08-18 — La matriz de viewports sobre «A dónde ir cada día»

Medida con el navegador sobre la pila propia, sin levantar más runners (los del
gate saturaron la máquina: load 28,45 con seis `launch.R`).

| Viewport | Ventana de la lista | Scroll vacío | Dueños | Llega al final | Última fila visible | Recortes sin `title` | Desborde X |
|---|---|---|---|---|---|---|---|
| 1710×1107 | 612 px | 0 | 1 | sí | sí | 0 | no |
| 1366×768 | 273 px | 0 | 1 | sí | sí | 0 | no |
| 1280×720 | 251 px | 0 | 1 | sí | sí | 0 | no |
| 1024×600 | **131 px** | 0 | 1 | sí | sí | 0 | no |

Los cuatro conformes. **A 1024×600 la ventana es de 131 px —unas cuatro filas—**:
apretado, y es la restricción de alto del PERFIL en compacto, no de este panel
—el KPI band se lleva 111 px de los ~370 disponibles—. Queda declarado, no
reparado: mejorarlo exige decidir qué cede en compacto para todo el perfil, y
esa decisión no es de una pasada visual.

Para comparar: la tabla de la agenda llegó a tener 88 px por el mismo motivo
antes de L104.

### Lo que enseñó esta medición

**`layoutPolicy` decide si un panel puede crecer o debe poseer su scroll, y
cambiarlo mirando un solo viewport ancho no se nota.** A 1440×1000 la versión sin
dueño se veía perfecta; a 1366×768 dejaba 823 px de scroll en vacío con el
contenido desbordando invisible. La matriz de viewports no es burocracia: es el
único sitio donde ese error aparece.
