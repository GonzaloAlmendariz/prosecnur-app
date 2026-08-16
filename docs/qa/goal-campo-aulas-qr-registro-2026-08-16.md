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
| **L26** | El registro queda apretado en la vista Agenda, y duplica la lista de aulas. | La vista es de **alto fijo** y ahora compiten tres paneles; además la lista del registro y la tabla de agenda muestran lo mismo. | ☐ sin empezar — **decisión de layout**: o el registro sustituye a la tabla de solo lectura (borrar superficie exige tu visto bueno, gate 3), o va a pestaña propia dentro de Agenda. No se improvisó. |
| **L27** | La app no lee «Aulas Agendadas». | 241 columnas: 1 de `ID MATCH` + **12 bloques de 20** (titular y once eslabones, a lo ancho). | ☑ **hecho** (2026-08-16) — lector + endpoint `/api/monitoreo/aulas/importar-libro`. Contra el estudio real: **1012 filas**, 170 titulares, 230 contactadas. |
| **L28** | La app no lee «Aulas Aplicadas (Campo)». | Tres bloques de **ancho distinto** (34/33/33: sólo el principal trae `AULA`) y `FECHA DE APLICACIÓN` duplicada dentro del bloque. | ☑ **hecho** (2026-08-16) — lector + endpoint. **196 partes**, 4269 efectivas. |
| **L33** | Dos partes de 196 **no reconcilian**. | `asistentes − rechazos − duplicados ≠ efectivas` en `1TEA08-0401` (15−0−0, efectivas 14) y `LIN127-0203` (27−1−3, efectivas 27). El Excel no comprueba esa identidad. | ☑ **hecho** (2026-08-16) — control `field_report_reconciliation` en el tablero. Detecta los 2 descuadres del estudio real y **explica la resta**, no sólo el hecho. |
| **L38** | El tablero **reventaba entero** el primer día de campo. | `.monitoreo_aulas_quota_sex_faculty()` construía el caso vacío con la columna `x` y la renombraba a `observed` sólo `if (nrow(observed))` — que nunca se cumple. El merge salía sin la columna y la línea siguiente asignaba `integer(0)` a un data.frame con filas. | ☑ **hecho** (2026-08-16) — hallazgo de propina al sembrar el `.pulso` de L23. |
| **L39** | La sección **Avance** no mostraba el avance. | `AulasMonitoreoPage.tsx:387` hacía `quotaRows.length ? quotaRows : avance_por_estrato`: los dos **competían por un panel**, y como un estudio de cursos-horario siempre trae cuotas, el avance por estrato no se veía nunca. El avance por aula vivía en **Consultas**, concatenado con reemplazos y brechas en una tabla donde 7 aulas salían como 15 filas sin decir de qué lista venía cada una. | ☑ **hecho** (2026-08-16) — Avance tiene tres paneles propios y Consultas dos. |
| **L40** | El alto se repartía al revés del contenido. | El stack es grid y la tabla topa en `min(420px, 100vh−430px)`: dos límites pensados para **una** tabla por vista. Con tres, grid sirve enteras a las que caben y descuenta todo el faltante de la única que excede. A 1024×600 **dos de los tres paneles colapsaban a cero** — regresión que introdujo L39. | ☑ **hecho** (2026-08-16) — paneles que no se encogen; el scroll lo absorbe su dueño ya declarado. Verificado a 1440×1000 y 1024×600. |
| **L41** | Los códigos de la cadena salían de la **posición en la lista**. | `monitoreo_aulas_normalize_plan()` derivaba `titular_operational_code` y `replacement_chain_code` de `slot_number`, que cae a `orden`. Una reserva de `CH 4` en la fila 6 se declaraba titular de `CH 6` y se llamaba `R 6.1`. | ☑ **hecho** (2026-08-16) — tres derivaciones corregidas; verificado en pantalla. |
| **L42** | El **Registro de campo** es inalcanzable a 1024×600. | El stack de Agenda tiene 325 px. Franja (54) + mínimo de la agenda (180) + gaps (20) = **254**, así que al registro le quedan **71 px** y necesita ~190 para ser usable. No cabe por aritmética, no por scroll. | ⛔ **bloqueado** — depende de L26: es tu decisión de dónde vive. |
| **L43** | Dos superficies no declaraban su geometría (C1). | «Operación del plan» en Fuentes y «Aplicación por cursos-horario» en Agenda. La segunda declaraba su grid interior de tarjetas pero no la sección que las contiene: son dos superficies, no una. | ☑ **hecho** (2026-08-16) — cero sin declarar en las cinco secciones. |
| **L44** | Regenerar el libro **borraba el operativo en curso**. | El generador escribía las columnas de la persona siempre en blanco, así que un estudio en marcha perdía los 7 estados de agendamiento, los 7 contadores de intentos y los 3 partes de campo. Además la hoja de campo filtraba por `sample_role == "titular"`, así que el parte de una reserva activada no se escribía. | ☑ **hecho** (2026-08-16) — 3/3 partes y 7/7 estados sobreviven. |
| **L45** | El registro de la app capturaba **menos que el parte**. | Faltaban `duplicates`, `effective_surveys` y `actual_room`. Sin los dos primeros, el cuadre de L33 —asistentes − rechazos − duplicados = efectivas— **no se puede comprobar sobre lo que la app captura**; y «encuestas aplicadas» no es «efectivas», que es el número que manda. | ☑ **hecho** (2026-08-16) — tres campos nuevos; el backend ya los aceptaba. |
| **L46** | El desglose **hombres/mujeres** vive sólo en la ficha impresa. | `collection_material_field_form_rows()` lo pide en papel; no está ni en el registro de la app ni en el Excel. Puede ser deliberado —el sexo se deriva de las respuestas para las cuotas— o una fuga. | ☐ sin empezar — no lo declaro defecto sin saber para qué se usa en campo. |
| **L47** | Las **190 observaciones** del agendamiento se perdían al regenerar. | El lector guarda la columna `OBSERVACIONES` en `replacement_note` y el generador leía `notes`. Round-trip de 40 unidades del estudio real: 11 → 0. | ☑ **hecho** (2026-08-16) — 11 → 11. |
| **L48** | `monitoreo_aulas_estado_muestra()` **no reconocía su propia salida**. | Borraba el guion bajo en vez de convertirlo en espacio, así que `en_reserva` quedaba en `enreserva`, no casaba con `en reserva` y **degradaba a `sin_contactar`** en cada vuelta de normalización. | ☑ **hecho** (2026-08-16) — los tres vocabularios son idempotentes. |
| **L49** | Las marcas de la activación se caían al normalizar. | `monitoreo_aulas_normalize_plan()` reconstruye la fila campo a campo con lista **cerrada**: `replaced_at`, `activated_at` y `activation_reason` no estaban declarados, así que el motor los escribía y el tablero los mostraba vacíos. | ☑ **hecho** (2026-08-16) — **décima** aparición del patrón. |
| **L29** | La app no lee «Base de control». | Seis grupos de control por aula. | ☑ **hecho** (2026-08-16) — lector + endpoint. **194 filas, 36 campos**; las 7 columnas sin nombre de la cabecera se reportan. |
| **L34** | `VALIDO TOTAL` dice **NO CUMPLE en 149 de 194 aulas**. | Lo calcula el propio Excel contra los umbrales 70T/70P. | ☐ sin empezar — hay que entender si es el criterio o el operativo antes de llevarlo a ningún tablero. |
| **L35** | La app no **generaba** el libro, sólo lo leía. | Sin generarlo, cada estudio arranca copiando el del anterior y los encabezados derivan hasta que dejan de leerse. | ☑ **hecho** (2026-08-16) — `aulas_libro_generar()` + `POST /api/monitoreo/aulas/generar-libro`. Round-trip probado: lo que escribe lo vuelve a leer. |
| **L36** | El libro generado no se registra como **fuente** de Monitoreo. | En telefónico el Excel de barrido es una fuente que el motor consulta. | ☑ **hecho** (2026-08-16) — `kind = aulas_libro` y los roles `agendamiento` · `parte_campo` · `control`. El mismo libro en Drive entra como `google_sheets` con esos roles. Los otros tres modos no cambian. |
| **L37** | Un rol llamado `campo` es **indistinguible de la ausencia de rol**. | `.monitoreo_safe_name("")` devuelve literalmente `"campo"` como relleno. Declararlo rol válido convertía en «campo» a **toda fuente sin rol de todos los modos**. | ☑ **hecho** (2026-08-16) — el rol se llama `parte_campo`; hay test que fija por qué no puede llamarse `campo`. |
| **L30** | El modelo mezcla **dos ejes de estado** en uno. | `operational_status` junta agendamiento y aplicación. En el estudio real son columnas distintas y una fila puede estar `REEMPLAZADA` en muestra y `APLICADA` en campo. | ☑ **hecho** (2026-08-16) — `sample_status` y `application_status` son campos propios, cada uno con su vocabulario. `operational_status` se queda como estaba. |
| **L31** | Falta el **ciclo de contacto**. | `MEDIO DE CONTACTO`, `FECHA DE LLAMADA` y `NÚMERO DE INTENTOS` no existen en el modelo. Sin ellos no se explica por qué un aula sigue sin agendar. | ☑ **hecho** (2026-08-16) — `contact_medium`, `contact_date` y `contact_attempts` llegan al plan. En el estudio real: **232 aulas con intentos, hasta 7 llamadas**. |
| **L32** | El parte de campo está **incompleto**. | Faltan `DUPLICADOS (YA RESPONDIERON)`, `CANTIDAD DE EFECTIVAS` —que es el número que manda, no «encuestas aplicadas»— y el **aula real** donde se aplicó, que puede no ser la planificada. | ☑ **hecho** (2026-08-16) — `duplicates`, `effective_surveys` y `actual_room` completan el parte. |
| **L5** | Activar un reemplazo no es un gesto de la app. | El modelo tenía el vocabulario; faltaba la acción. | ☑ **hecho** (2026-08-16) — motor, endpoint y botón. Verificado en el navegador: `CH 4` → `R 4.1` → `R 4.2` → cadena agotada. |
| **L6** | El registro de campo no existe como concepto. | **Premisa corregida (2026-08-16): sí existe.** `collection_material_field_form_rows()` lo define entero, calcado de la hoja de papel en uso. | ◐ a medias — la ficha built-in ya imprime el vocabulario canónico («Alumnos en aula», «Encuestas aplicadas», «Rechazos», «Aplicador/a», «Fecha y hora») en vez de tres renglones numerados. Lo que falta es sólo la **vuelta**: teclearlo de regreso, que depende de L4. |
| **L7** | La ficha desperdicia alto en blanco y el enlace impreso corta a media palabra. | `collection_render_ficha.R`, layout `single_sheet`. | ☑ **hecho** (2026-08-16) — hueco interior mayor de 206 px a 124 px (11,7% → 7,1% del alto). El grid reparte su banda en vez de amontonarse; capacidad 6 → 8 filas (7 con careta). El corte del enlace ya lo había resuelto L1. |
| **L7b** | El lector de QR asumía la geometría de la ficha **sin** careta. | `collection_qr_matrix_from_png()` pedía `.crf_layout()` sin `branded`; funcionaba solo porque ambas variantes coincidían en `qr_y`. Hallazgo de propina al hacer L7. | ☑ **hecho** (2026-08-16) — el lector recibe `branded`. |
| **L8** | `apiMonitoreoAulasConfig` tiene 0 consumidores. | `frontend/src/api/monitoreo.ts`. | ☑ **hecho** (2026-08-16) — **no era limpieza: era el eslabón roto del circuito.** Su `source_mapping` es lo único que dice qué columna de Kobo lleva el id de colector, y sin UI nadie podía fijarlo. El fallback por nombres convencionales no incluía `collectorID`, que es justo el nombre que produce nuestro propio QR. Añadido a las dos listas de candidatos; el endpoint sigue sin superficie pero ya no hace falta para el caso normal. |
| **L9** | No hay test que ate la costura completa (selección → enlaces → fichas → handoff). | `api/tests/testthat/test-collection-costura-aulas.R`. | ☑ **hecho** (2026-08-16) — 41 asertos. Controles verificados revirtiendo L1, L3 y la geometría de L7: los tres lo ponen rojo. |
| **L10** | El QR no se decodifica a texto. | `collection_qr_matrix()` usa el paquete `qrcode`; `collection_qr_matrix_from_png()` relee la matriz del PNG y la compara módulo a módulo. | ◐ a medias — **la parte medible está hecha**: el fixture ya usa el enlace real (86 chars, 49 módulos) en vez del juguete de 18, y hay guardia de legibilidad física (mm por módulo). **Decodificar a texto queda ⛔ bloqueado**: no hay decodificador en R ni en Python en esta máquina, y añadirlo es una dependencia nueva en `DESCRIPTION` que el CI tendría que instalar. |

### Espera al usuario

| Ítem | Por qué no puedo yo |
|---|---|
| **L4** — dónde vive el registro de campo | El comentario de `AulasOperationsPanel.tsx` dice que la agenda pertenece a Recopiladores y que Monitoreo «solo lo lee». Pero el estado operativo **es** monitoreo: es lo que mueve los denominadores del avance. Poner la escritura en el lugar equivocado duplica navegación (regla del contrato v3) y es caro de revertir. Es una decisión de arquitectura, no de implementación. |
| **L2** — qué identificador viaja a Kobo | Cambiar el `collectorID` cambia lo que llega en la data de campo. Si algún estudio ya salió con el slug actual, migrarlo no es gratis. **Aprendido sin tocarlo (2026-08-16):** no es un solo productor. El adapter usa `.ca_unit_value()`, que prefiere `link_key` → `prefill_value` → `logical_collector_id` → `unit_id`; o sea que **el plan ya puede decidir el identificador** poniendo `link_key` en cada unidad — no hace falta tocar `.collection_stable_id()`. Pero la ruta legacy hace otra cosa: `.collection_seed_deployment()` fuerza `prefill = list(collectorID = unit_id)` con el slug interno **aunque el enlace pegado por el usuario ya traiga `OP-01`**. Es decir, hoy hay dos caminos que eligen distinto, y el legacy pisa silenciosamente el identificador del operador. Cerrar L2 es unificarlos, y por eso la decisión es tuya: define cuál es el identificador de campo. |

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

## Bitácora

Dieciséis iteraciones el 2026-08-16. Se conserva la medición de cada cierre; el
relato completo está en los mensajes de commit, que son el registro largo.

| cerrado | medición |
|---|---|
| **L1 · L1b** parámetro duplicado y sintaxis `d[]` | payload 116 → 71 chars · PDF 244.981 → 234.937 bytes |
| **L3** el rol en la ficha | «Rol: Titular» / «Rol: Reemplazo de AULA-01», verificado en PNG |
| **L7 · L7b** alto en blanco y geometría del lector | hueco interior 206 → 124 px (11,7 % → 7,1 %) · capacidad 6 → 8 filas |
| **L9** test de costura | 41 asertos · controles verificados revirtiendo L1, L3 y L7 |
| **L8** el circuito abierto del `collectorID` | la data de Kobo reencuentra su aula sin configurar nada |
| **L6** vocabulario del registro impreso | 3 renglones numerados → 5 rotulados, compartidos con la ficha de campo |
| **L10** legibilidad física del QR | 1,46 mm/módulo con el enlace más largo, umbral cómodo 0,6 |
| **L11** plantilla por defecto duplicada | borrada la del frontend; era inalcanzable |
| **L13 · L14** crash y multiplicación n² | 7 aulas siguen siendo 7 · confirmado en pantalla |
| **L15 · L16 · L17** avance, meta y estado | 5/4/3 atribuidas correctamente · meta presente · 5 de 30 ya no es «cerrando» |
| **L18 · L19** agregados y cadena de reemplazos | brechas 7→6 reales · estratos 0→40 válidas · reemplazos vacío→3 |
| **L21 · L22** los dos avisos invertidos | el que saltaba siempre ya no; el que nunca saltaba, sí |

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

### 2026-08-16 — L4 decidido y construido: el registro vive en Monitoreo
Gonzalo decidió que el registro de campo vive en **Monitoreo**, sección Agenda.
Es la elección coherente: lo que se registra es el estado operativo, y el estado
operativo mueve los denominadores del avance.

**Backend.** El modelo del plan no tenía dónde guardar lo que nace en el aula.
Gana seis campos, con sus alias en español: `observed_students` (cuántos
**asistieron**, no cuántos están matriculados — sin ese denominador no hay tasa
de respuesta por aula), `applied_surveys`, `refusals` (quien dice que no nunca
toca el formulario, así que es invisible para Kobo), `applied_by`, `applied_at`
y `field_note`.

**Frontend.** `RegistroDeCampo.tsx` conecta por fin `/api/monitoreo/aulas/agenda`
— el endpoint que llevaba **cero consumidores** y que abrió este GOAL. Manda un
PATCH: sólo los campos que el usuario tocó, porque mandar el resto en blanco
borraría lo que otro registró antes. El motivo se pide sólo cuando el estado lo
justifica.

**Un defecto propio, encontrado en pantalla y no por test.** El panel salió con
**26 px de alto y su cuerpo en 0**: el tamaño mínimo automático de un contenedor
con `overflow` es cero, así que el stack de alto fijo pudo aplastarlo. Estaba en
el DOM con sus siete aulas y era invisible. Ningún test lo habría visto.

**Queda L26**, y no se improvisó: la vista Agenda es de alto fijo y ahora
compiten tres paneles, además de que la lista del registro y la tabla de agenda
muestran lo mismo. O el registro sustituye a esa tabla —borrar una superficie
exige visto bueno explícito— o va a pestaña propia. Es decisión de layout.

**V5 se cumple.** V6 (activar reemplazo como gesto) y V8 quedan al alcance con
lo ya construido; V7 sigue esperando el «mientras ocurre».

### 2026-08-16 — reencuadre: el operativo se gobierna con tres Excel
Gonzalo compartió el estudio real de 2025. Leerlo cambia la prioridad del GOAL y
corrige una suposición que estaba debajo de todo lo construido hoy.

**La suposición equivocada.** L4 se implementó asumiendo que el registro de
campo se captura *en la app*. El flujo real es el contrario: el equipo llena
**tres Excel** —se llama al docente con la hoja abierta, se anota en campo sobre
ella— y lo que falta es que **la app los lea**. La superficie que se construyó
no sobra, pero es para correcciones puntuales, no el camino principal.

**Lo que «sin planilla paralela» significa de verdad.** No es eliminar el Excel:
es que el Excel y la app dejen de contar cosas distintas.

**Tres hallazgos que corrigen el modelo:**

1. **Son dos ejes de estado, no uno.** `STATUS MUESTRA` (AGENDADA · REAGENDADA ·
   EN RESERVA n · REEMPLAZADA) y `STATUS DE APLICACIÓN` (APLICADA · NO APLICADA)
   son independientes: un aula puede estar reemplazada en muestra y aplicada en
   campo. El `operational_status` de la app los mezcla → **L30**.
2. **Falta el ciclo de contacto.** Medio, fecha de llamada y sobre todo
   **número de intentos**: sin eso no se explica por qué un aula sigue sin
   agendar → **L31**.
3. **El parte de campo que construí está incompleto.** Faltan **duplicados**,
   **efectivas** —que es el número que manda, no «encuestas aplicadas»— y el
   **aula real**, que puede no ser la planificada → **L32**.

Y una diferencia estructural: la cadena de reemplazo en el Excel es **ancha**
(hasta once eslabones en la misma fila) y en la app es **larga** (filas con
`replacement_for`). Ambas valen; el importador traduce.

La prioridad pasa a **L27** (leer «Aulas Agendadas»), que es la hoja de la que
cuelgan las otras dos.

### 2026-08-16 — L27: el lector de «Aulas Agendadas», probado contra el estudio real
Primer tramo de la nueva prioridad. `aulas_agendadas_leer()` traduce la hoja
**ancha** —1 columna de `ID MATCH` y bloques de 20— al formato **largo** del
plan, con una fila por unidad y `replacement_for` apuntando al titular.

Corrido sobre `Hostigamiento PUCP 2025`: **170 titulares → 1012 filas**, 230 con
`STATUS MUESTRA` y 228 de esas con enlace de ficha. El vocabulario completo
resultó ser más rico que el visto en la primera inspección: `AGENDADA` ·
`REAGENDADA` · `EN RESERVA 1` · **`EN RESERVA 2`** · `REEMPLAZADA`.

Dos decisiones que salieron de mirar el dato y no de suponerlo:

- **El ancho de bloque se deduce, no se asume.** 12 es lo que trae este estudio;
  otro con cadenas más cortas produce menos bloques.
- **Un guion es ausencia, no un valor.** El equipo escribe `-` para «todavía
  nada aquí»: 1810 de 2040 celdas de estado. Tratarlo como dato inflaba el plan
  de 1012 a 2040 filas y creaba una categoría fantasma llamada `-` en los
  conteos.

**La fixture del test es sintética a propósito**: el libro real trae nombre,
teléfono y correo de cada docente, así que no entra al repositorio ni como
golden. Lo que se fija es la anatomía, no los datos.

Falta el endpoint que cuelgue el resultado de una sesión y la superficie que lo
dispare; y después L28 (parte de campo) y L29 (base de control), que son las
hojas que cuelgan de esta.

### 2026-08-16 — L28: el parte de campo, y un descuadre que el Excel no ve
`aulas_aplicadas_leer()` corre contra el estudio real: **196 partes** —170 del
bloque principal, 24 del reemplazo 2 y 2 del reemplazo 3—, con
`APLICADA` (194) y `NO APLICADA` (2). Totales: 4931 asistentes, 219 rechazos,
446 duplicados y **4269 efectivas**.

Dos trampas de esta hoja que obligaron a leerla distinto de «Aulas Agendadas»:

1. **Los bloques no miden lo mismo.** 34 columnas el principal y 33 los de
   reemplazo, porque sólo el primero trae `AULA` —dónde se aplicó de verdad, que
   puede no ser la planificada—. Un paso fijo desalinearía todo a partir del
   segundo, así que los bloques se detectan por su marcador `ID MATCH`.
2. **`FECHA DE APLICACIÓN` aparece dos veces en el mismo bloque**: la agendada y
   la real. Resolver por título a secas devuelve siempre la primera. La frontera
   la marca la **segunda** `MATRICULADOS TOTAL DTI`, que el equipo repite al
   abrir el parte.

**Hallazgo (L33):** en **2 de 196** partes la identidad
`asistentes − rechazos − duplicados = efectivas` no cierra —`1TEA08-0401` da 14
donde deberían ser 15, y `LIN127-0203` da 27 donde deberían ser 23—. El Excel no
comprueba esa identidad; **la app sí puede**, y es exactamente el tipo de control
que justifica leer estas hojas en vez de mirarlas.

### 2026-08-16 — L29: la tercera hoja, y un símbolo que borraba seis campos
`base_control_leer()` cierra el trío: **194 filas y 36 campos** del estudio real,
con los seis grupos de control —cuenta contra los dos denominadores, duración
(cortas/largas), umbrales 70T/70P, cuotas por sexo y rango horario—.

**Dos defectos propios, encontrados midiendo y no leyendo:**

1. **`iconv` convierte `°` en un cero.** «N° ASISTENTES EN AULA» se normalizaba
   como `N0 ASISTENTES...` y no casaba con nada: **seis campos de cuotas
   quedaban sin mapear en silencio**. Arreglado quitando el símbolo *antes* de
   transliterar; el mapeo pasó de 32 a 36 campos.
2. **El diagnóstico de cabecera incompleta decía 0.** `.caa_key(NA)` devuelve el
   **texto** `"NA"`, que pasa `nzchar()`. La hoja tiene **siete** columnas con
   datos y sin nombre en la fila 2; el lector ahora las cuenta y las reporta en
   vez de bautizarlas a ojo.

**Hallazgo (L34):** el propio Excel marca `VALIDO TOTAL = NO CUMPLE` en **149 de
194 aulas**. Es un número lo bastante grande como para no llevarlo a un tablero
sin entender antes si lo que falla es el criterio o el operativo.

Con esto las **tres hojas ya se leen**. Lo que falta de L27–L29 es común:
colgarlas de una sesión con su endpoint y su superficie.

### 2026-08-16 — las tres hojas cuelgan de una sesión
`aulas_libro_importar()` compone los tres lectores sobre **un solo archivo**,
que es como el equipo lo tiene: las tres hojas viven en el mismo libro. El
endpoint `POST /api/monitoreo/aulas/importar-libro` lo deja en la sesión.

Contra el estudio real, en una sola llamada: **1012 unidades** (170 titulares,
230 contactadas), **196 partes de campo** y **194 filas de control**.

Tres decisiones de diseño que valen más que el código:

- **Ninguna hoja es obligatoria.** Un estudio recién agendado no tiene parte de
  campo todavía. Lo que falta viaja en `hojas_ausentes` para que la UI pueda
  decir qué no encontró, en vez de mostrar un cero mudo.
- **Las tres medidas no se fusionan.** Plan, parte de campo y control quedan uno
  al lado del otro en la sesión. Son medidas distintas del mismo aula, y
  mezclarlas perdería de cuál viene cada número — que es exactamente el problema
  que este GOAL lleva todo el día persiguiendo.
- **Lo que no se pudo leer se reporta.** Las 7 columnas sin nombre de «Base de
  control» viajan en `control_sin_nombre`.

Con esto **L27, L28 y L29 quedan cerrados** del lado del motor. Falta la
superficie que dispare la importación, y los tres ítems que el reencuadre
destapó: L30 (dos ejes de estado), L31 (ciclo de contacto) y L32 (parte
incompleto), que ahora sí tienen de dónde alimentarse.

### 2026-08-16 — la otra mitad: la app produce el libro, no sólo lo lee
Gonzalo precisó lo que faltaba: esos Excel **no son un insumo ajeno**, son el
instrumento de trabajo de varios roles —quien agenda llama a los docentes sobre
la hoja 1, quien supervisa campo llena la 2 con aplicador y conteos— y la app
tiene que **producirlos** para que después pueda **releerlos como fuente**.
Exactamente el papel que cumple el Excel de barrido en el modo telefónico.

`aulas_libro_generar()` escribe las tres hojas con la misma spec de columnas que
usan los lectores, así que **generador y lector no pueden divergir**: si mañana
cambia un título, cambia en los dos a la vez.

El reparto de quién llena qué es el corazón del diseño:

| Lo llena la app | Lo llena la persona |
|---|---|
| Identidad del curso-horario, docente y contacto, los dos denominadores, **enlace de la ficha** | Medio de contacto, fecha de llamada, **intentos**, estado de muestra, agendamiento |
| Identidad y denominadores en el parte | Asistentes, rechazos, duplicados, **efectivas**, aplicador, aula real, fecha/hora, estado |

Rellenar lo de la persona sería inventar campo.

**El contrato que se fija es el round-trip**: lo que la app escribe lo tiene que
poder volver a leer. Probado: 3 unidades generadas → 3 releídas, cadena
preservada (`ABC-02` → `ABC-01`), enlaces intactos y las columnas de cada rol en
blanco. Sin ese test, generador y lectores derivarían en silencio y el equipo se
enteraría cuando un libro en curso dejara de importar.

También: **la profundidad de la cadena sale del plan**, no de una constante. Un
estudio con cadenas de dos produce 41 columnas, no las 241 del de 2025.

Queda **L36**: registrar el libro como *fuente* de Monitoreo, que es lo que
cierra del todo la analogía con telefónico.

### 2026-08-16 — L36: el libro es una fuente, y un nombre que casi rompe todo
El libro operativo entra como fuente de Monitoreo con `kind = aulas_libro` y
tres roles que coinciden con sus tres hojas y con quién las llena:
`agendamiento` · `parte_campo` · `control`. El mismo libro alojado en Drive
—«un solo Sheet con tres pestañas»— entra como `google_sheets` con esos mismos
roles: cambia por dónde entra, no qué es.

Con esto la analogía con telefónico queda cerrada: allí el Excel de barrido es
una fuente que el motor consulta para decidir; aquí lo es el libro.

**Dos veces el mismo vocabulario.** Los roles están escritos en dos sitios —el
`switch` de `.monitoreo_source_role()` y el guardián
`.monitoreo_allowed_source_roles()`—. Añadirlo sólo en el `switch` no bastaba:
el guardián lo reescribía a `respuestas` en silencio. Ya van cinco apariciones
de este patrón en el GOAL.

**Y una colisión que rompió tres modos (L37).** El rol se iba a llamar `campo`,
que es lo natural. Pero `.monitoreo_safe_name("")` devuelve **literalmente
`"campo"`** como relleno de lo vacío: al declararlo rol válido, **toda fuente sin
rol —de telefónico y de acreditación también— pasó a ser «campo»** y desapareció
de sus avances. Lo atraparon tres tests existentes, no yo.

Se renombró a `parte_campo` y hay test que fija **por qué** no puede llamarse
`campo`, porque el siguiente que lo intente va a encontrar el mismo muro.

### 2026-08-16 — L30, L31 y L32: los dos ejes, por fin separados
Los tres salían del mismo reencuadre y eran el mismo cambio. El plan normalizado
gana lo que el estudio real ya distinguía:

- **Eje de agendamiento** — `sample_status` con su propio vocabulario:
  `agendada` · `reagendada` · `en_reserva` · `reemplazada` · `sin_contactar`.
- **Eje de aplicación** — `application_status`: `aplicada` · `no_aplicada` ·
  `pendiente`.
- **Ciclo de contacto** — `contact_medium`, `contact_date` y sobre todo
  `contact_attempts`.
- **Parte completo** — `duplicates`, `effective_surveys` y `actual_room`.

Sobre el estudio real, los dos ejes conviven sin pisarse:

| eje de agendamiento | |
|---|---|
| agendada | 160 |
| reemplazada | 34 |
| en_reserva | 26 |
| reagendada | 10 |
| **sin_contactar** | **782** |

Y el ciclo de contacto ya se ve: **232 aulas con intentos registrados, hasta 7
llamadas a un mismo docente**. Eso es exactamente lo que faltaba para poder
decir *por qué* un aula sigue sin agendar.

Dos decisiones al normalizar:

- **`EN RESERVA 1` y `EN RESERVA 2` colapsan a `en_reserva`.** El número es la
  profundidad de la cadena y ya vive en `replacement_order`; duplicarlo aquí
  crearía tantas categorías como eslabones tenga el estudio.
- **Lo vacío es `sin_contactar`, que es información**, no ausencia: 782 de 1012
  unidades son cadena que nunca se llegó a llamar.

Hay test que fija que los campos nuevos **no multiplican el plan** — el defecto
del n² vivía en defaults vectoriales y estos son escalares.

### 2026-08-16 — L33: el cuadre del parte, que el Excel no hace
El parte declara cuatro números que no son independientes:
`asistentes − rechazos − duplicados = efectivas`. El Excel **no comprueba** esa
identidad, y falla en 2 de 196 partes del estudio real. Son pocos, y por eso
mismo son invisibles a ojo en una hoja de 101 columnas.

El control nuevo aparece en Validación como **«Cuadre del parte de campo»**, y
lo que dice es la resta entera:

> `LIN127-0203`: 27 asistentes menos 1 rechazos y 3 duplicados dan 23, pero el
> parte declara 27 efectivas (sobran 4).

Tres decisiones sobre qué es un descuadre y qué no:

- **Sin asistentes o sin efectivas no se comprueba nada.** Suponer cero donde no
  hay dato denunciaría aulas que nadie llegó a medir.
- **Rechazos y duplicados ausentes sí valen cero**: son cantidades de eventos, y
  si no se anotaron, no ocurrieron.
- **El control señala, no corrige.** No decide cuál de los cuatro números está
  mal — quien sabe qué pasó en esa aula es el equipo.

**Sexta aparición del patrón**: `monitoreo_aulas_normalize_config()` reconstruye
la config con una lista cerrada de campos, así que `partes_campo` se descartaba
y el control no veía nada que comprobar. Declararlo en el normalizador *y* en el
default es lo que lo hizo llegar.


### 2026-08-16 — L23: la premisa era falsa, y por eso salió un 500

La nota de L23 decía que verlo en pantalla exigía recorrer el flujo entero desde
Cálculo de muestra, porque «la whitelist de persistencia guarda el plan y poco
más». **No hay whitelist.** `build_pulso()` serializa el estado completo salvo
los caches que `.pulso_strip_caches()` nombra uno a uno. Comprobado con una ida
y vuelta: plan, `monitoreo_config$aulas_universitarias`, partes de campo y las
respuestas de `monitoreo_snapshot$data` sobreviven todos.

Eso desbloqueó `api/scripts/qa_pulso_aulas_campo.R`: siete aulas donde cada una
existe para hacer fallar un control distinto, 35 respuestas que llegan por
`collectorID` como las devuelve Kobo, y tres partes de campo con un descuadre
deliberado.

**Y al primer intento reventó.** No por el fixture: `.monitoreo_aulas_quota_sex_faculty()`
lanzaba un 500 cuando hay respuestas y **ninguna es válida todavía** — el estado
más normal del arranque de campo. Con cero respuestas no falla, y con respuestas
válidas tampoco; sólo en esa franja. Un estudio con cuotas declaradas recibía un
error al abrir Monitoreo el primer día. Es **L38**, y es exactamente lo que L23
existía para encontrar: ocho reparaciones verdes en tests, y el camino que las
une reventaba.

Lo que el tablero muestra ahora sobre ese `.pulso`:

| Fenómeno | Evidencia |
|---|---|
| **L15** avance por aula | `CH 1` 20/20 · `CH 2` 5/20 · `R 4.1` 9/16 |
| **L17** «cerrando» falso | `CH 1` cerrando · `CH 2` **en_aplicación**, no cerrando |
| **L18** brechas y estratos | Ciencias 25 válidas / 15 brecha · Letras 9/57 · Derecho 0/28 |
| **L19** cadena de reemplazos | `R 4.1` y `R 4.2` cuelgan de `CH 4` |
| **L20** cuotas sexo×facultad | 6 celdas, 4 en riesgo y 2 pendientes |
| **L21 · L22** los dos avisos | duplicados no salta · la respuesta fantasma sí |
| **L33** cuadre del parte | 2 descuadres de 3 partes, con la resta explicada |

**Dos veces miré la lista equivocada** y estuve a punto de reportar defectos que
no existían: `application_state` vive en `course_status`, no en `agenda`; y la
representatividad no se llama `representatividad_efectiva` en los KPIs. La
consulta mal dirigida devuelve vacío, que es indistinguible de un cero real.

**Aprendido de L12 sin tocarlo:** declarar `status_var = "_validation_status"`
descarta **todas** las respuestas de Kobo, porque Kobo deja esa columna vacía
mientras nadie las revisa a mano y `""` no está entre los estados válidos. O sea
que L12 no sólo falla abierto cuando no hay columna: falla **cerrado y en
silencio** cuando sí la hay. Las dos caras del mismo ítem siguen esperando tu
decisión.


### 2026-08-16 — L23 cerrado en pantalla, y lo que apareció al mirar

Pila propia en 8799 (API) y 5199 (Vite) para no tocar la del usuario, con el
`.pulso` sembrado. Readiness real (`__pulsoNav.listo()` → `monitoreo-aulas`), no
un sleep.

**Lo verificado en pantalla**, con captura: la cadena `R 4.1`/`R 4.2` colgando de
`CH 4` (L19), las brechas por aula con sus denominadores (L18), el avance por
estrato con números reales (L18), las 6 celdas de cuota (L20), y los cuatro
controles con su etiqueta en español —incluido «Cuadre del parte de campo»
mostrando la resta entera (L33) y «Respuestas válidas sin curso-horario»
señalando la respuesta fantasma (L22).

**Y apareció L39, que ningún test podía ver.** La sección se llama Avance y no
mostraba el avance: las cuotas y el avance por estrato competían por un solo
panel, y el avance por aula estaba en Consultas mezclado con otras dos listas —
7 aulas se veían como 15 filas, sin ninguna columna que dijera de cuál venía
cada fila. El backend calculaba las cuatro cosas bien desde hacía tres ítems.
Es C5 categoría 3 en estado puro: **el motor lo sabía y la pantalla no lo decía**.

**Dos errores de método propios, anotados porque volverán:**

- Navegué a `monitoreo/aulas/agenda` porque la pestaña **dice** «Agenda». La
  sección se llama `modelo`. El `ir()` no se queja: se queda donde estaba, y la
  captura siguiente parece decir que la vista no cambió.
- Corrí `git checkout` sobre un archivo con ediciones sin stagear para deshacer
  **una línea** de un control invertido, y perdí las dos ediciones del turno.
  Para revertir un experimento sobre trabajo vivo, copia y restaura el archivo;
  `checkout` no distingue tu experimento de tu trabajo.

**El test de geometría estaba atado al nombre del grupo**, no a la relación:
contaba cinco `monitoring-aulas-table` y se puso rojo al separar los paneles —un
cambio que *añade* superficies declaradas. Ahora exige que **todo panel de datos
declare su contrato**, sea cual sea su nombre. Verificado quitando una
declaración: rojo.


### 2026-08-16 — L41: tres derivaciones que salían de la posición

Visto en pantalla, no en un test: en Consultas > Cadena de reemplazos, `R 4.1` y
`R 4.2` reemplazan a `CH 4` y la tabla decía que su titular era `CH 6` y `CH 7`.
El código no salía vacío — **apuntaba a otra aula real del estudio**, y esa es la
tabla desde la que el equipo decide a quién activar.

La causa: `slot_number` cae a `orden` cuando el plan no trae
`selection_slot_id`, y de ahí salían tres cosas distintas. Al reparar la primera
apareció la segunda en la línea de al lado, y al reparar esa, la tercera:

| Derivación | Decía | Dice |
|---|---|---|
| `titular_operational_code` de una reserva | `CH 6` / `CH 7` (su posición) | `CH 4` (su `replacement_for`) |
| `replacement_chain_code` | `R 6.1` / `R 7.1` | `R 4.1` / `R 4.2` |
| `replacement_order` sin declarar | 1 para todas → **dos aulas con el mismo nombre** | su puesto dentro de la cadena |

**Séptima aparición del patrón**: lo escrito dos veces se arregla una sola vez.
Aquí estaban en líneas consecutivas del mismo archivo.

Dos decisiones sobre qué hacer cuando no hay de dónde:

- Una reserva **sin** `replacement_for` deja el titular **vacío**. Inventar
  `CH 9` desde la posición es peor que no decir nada: es plausible.
- El orden dentro de la cadena se cuenta **sólo entre reservas**. Incluir al
  titular en su propio grupo lo hacía ocupar el puesto 1 y desplazaba a sus
  reservas a `R n.2` y `R n.3` — lo detectó el test, no la lectura del código.

**Lección de método aplicada**: el control invertido de este ítem se hizo con
copia y restauración del archivo, no con `git checkout` — que en el turno
anterior se llevó por delante dos ediciones sin stagear.


### 2026-08-16 — L40: dos intentos fallidos antes del bueno

La reparación de L39 tenía una regresión que sólo se veía en el viewport bajo:
al pasar de un panel a tres, **a 1024×600 dos de ellos colapsaban a altura
cero**. A 1440×1000 la vista se veía bien, y por eso no lo noté al commitear.

Dos intentos que no sirvieron, anotados para no repetirlos:

- **Un `min-height` en la tabla.** Grid le concede a la que desborda
  exactamente ese mínimo y ni un píxel más, así que subirlo sólo traslada vacío
  a las tablas cortas (190 px daba 188/188/229, con 58 px muertos en la de 3
  filas) y bajarlo empeora la principal (150 px la dejaba en 148). Y a 1024×600
  hacía que los paneles **se solaparan**: peor que el defecto original.
- **Quitar sólo el `max-height`.** La compresión no la produce el tope sino que
  las filas del grid se encogen. Volvía exacto a 61 px.

Lo que funcionó: que los paneles **no se encojan** (`flex: 0 0 auto`) y que el
total lo absorba `.mon-profile-content`, que ya era el dueño de scroll declarado
de la vista. Sin `max-height` la tabla tampoco scrollea por dentro, así que no
aparece una cadena anidada.

| | 1440×1000 | 1024×600 |
|---|---|---|
| Antes | 61 / 130 / 229 de 313 / 130 / 229 | dos paneles a cero |
| Ahora | 313 / 130 / 229 — completas | 313 / 141 / 229 — completas |

`atEnd` alcanzable, última fila visible, **cero scrollers dentro del stack**.

**La lección es del método, no del CSS**: medí L39 sólo a 1440×1000 y di por
bueno un cambio que rompía el viewport bajo. La matriz de QA tiene cinco
viewports por esto exactamente, y «se ve bien» en uno no es evidencia de nada
sobre los otros.


### 2026-08-16 — Barrido de las cinco secciones en la matriz

Tras la regresión de L40 —que se me coló por medir en un solo viewport— recorrí
las cinco secciones del perfil en 1440×1000 y 1024×600 con un medidor que
reporta por cláusula.

**1440×1000 está limpio.** Cero paneles colapsados, cero fuera de contenedor,
cero tablas cortadas sin salida. Sólo dos superficies sin declarar (C1) en
Fuentes y Agenda.

**1024×600 tiene un defecto real: L42.** En Agenda, el «Registro de campo» —la
superficie que pediste que viviera en Monitoreo— queda **127 px cortada y sin
forma de llegar**: el stack está en `overflow: hidden`. Los otros recortes de esa
viewport (Fuente y plan 138/163, Agenda 181/313, Validación 255/304) **sí** son
conformes: cada tabla scrollea dentro de su propia caja.

**El detalle que hace peligroso a L42**: `scrollIntoView()` sí trae el panel a la
vista, moviendo un stack que el usuario no puede mover. Cualquier verificación
que pregunte «¿es visible?» tras un `scrollIntoView` responde que sí. Lo que
distingue el caso es preguntar si **el dueño de scroll declarado** puede llegar.

**Tres reparaciones descartadas, cada una con su medición:**

| Intento | Por qué no |
|---|---|
| `min-height: min(18rem, 40vh)` en el registro | El panel pide 388 px de contenido; bajar su suelo de 288 a 240 no cambia nada |
| `grid-template-rows: auto auto auto` bajo media query | El stack tiene el alto **impuesto desde arriba** (325 px); cambiar sus filas no lo hace crecer |
| El patrón `flex: 0 0 auto` que sí arregló Avance | El stack pasó a pedir 845 px y siguió clavado en 325. En Avance funcionó porque allí nada le imponía altura |

La causa es arquitectónica: `.aulas-mon-view` es un **workbench de alto fijo**, y
en ese layout quien scrollea debe ser una superficie interior, no el contenido.
La vía que queda es dar al cuerpo del registro su propio scroll dentro de su
borde — dueño claro, sin cadena nueva.

**Dato duro para L26**, que sigue esperando tu decisión: donde el registro vive
hoy, **no cabe** en la viewport baja de la matriz.


### 2026-08-16 — L42 no es un problema de scroll: es de aritmética

Fui a repararlo por la vía identificada —scroll propio en el cuerpo del
registro— y la medición cerró el caso antes de tocar CSS. El stack de Agenda
dispone de **325 px** en 1024×600 y lo tiene comprometido:

| | px |
|---|---|
| Franja «Aplicación por cursos-horario» | 54 |
| Mínimo declarado de la agenda | 180 |
| Dos gaps | 20 |
| **Comprometido** | **254** |
| **Queda para el registro** | **71** |

El registro necesita ~190 px para ser usable, y su lista ya scrollea por dentro
(320 px topados en `max-height: 20rem`). Bajar ese tope reduce el panel pero no
crea espacio: aunque el registro cayera a 71 px, un formulario de cinco campos
no cabe ahí.

**Las tres superficies no caben juntas en esa altura.** Cuál cede es una
decisión de producto, no de CSS — es exactamente **L26**, que sigue esperándote.
L42 pasa de pendiente a **bloqueado**, y aporta el dato que le faltaba a L26: si
eliges pestaña propia para el registro, L42 desaparece por construcción.

**L43 de propina, y cerrado**: dos superficies no declaraban su geometría. La de
Agenda declaraba su grid interior de tarjetas pero no la sección que lo
contiene — son dos superficies distintas, y sólo una estaba declarada.

**Y el test que yo mismo escribí contaba mal.** Su regex era
`className="mon-profile-panel"` con la comilla de cierre, así que los tres
paneles con clase modificadora —handoff, registro, operación— quedaban fuera del
balance: justo los que podían estar sin declarar. Un control que no mira donde
está el riesgo pasa siempre.


### 2026-08-16 — Auditoría de la vara: V12 se cumplía a medias

Sin ítems abiertos, audité las doce afirmaciones de la vara buscando cuáles se
daban por buenas sin que nadie las hubiera ejecutado. La más expuesta era
**V12** —«generar y reimportar cierra el círculo»—, porque el generador y el
lector están escritos por separado y en este GOAL lo escrito dos veces ya
divergió siete veces.

El round-trip sobre el `.pulso` real: **el plan sobrevive entero** — 7 unidades,
cadena, enlaces, docentes, denominadores, todo. La vara decía «sin perder la
cadena ni los enlaces» y eso era cierto.

**Lo que la vara no medía era el trabajo del equipo:**

| | Antes | Ahora |
|---|---|---|
| Partes de campo | 3 → **0** | 3 → **3** |
| Estados de agendamiento | 7 → **0** | 7 → **7** |
| Contadores de intentos | 7 → **0** | 7 → **7** |

Regenerar el libro de un estudio en marcha **borraba todo lo anotado**. La
decisión original —«dejar en blanco lo de la persona para no inventar campo»— es
correcta para un libro **nuevo** y destructiva para uno **en curso**. Ahora el
generador devuelve lo que ya está registrado y sigue dejando en blanco lo que no
existe; hay un test para cada uno de los dos casos.

**Dos hallazgos dentro del hallazgo:**

- La hoja de campo filtraba por `sample_role == "titular"`, así que **el parte de
  una reserva activada no se escribía**. En el estudio de 2025, 26 de los 196
  partes son de reservas.
- El generador escribía `applicator`/`applied_at` y el lector lee
  `applied_by`/`applied_date`. Octava aparición del patrón, y esta vez entre dos
  archivos que existen justo para hablarse.

**La lección sobre la vara**: V12 estaba redactada de forma que se cumplía sin
cubrir lo importante. «Sin perder la cadena ni los enlaces» mide lo que la app
puso; lo que hay que medir es lo que **la persona** puso. Una vara puede pasar y
dejar pasar.

**Aparte, no es de este GOAL**: `test-reporte-word-multiactor-alto.R` falla en
main desde antes de esta sesión (verificado con `git stash`). Queda flaggeado
como tarea propia.


### 2026-08-16 — V8: tres inventarios que no coincidían

V8 dice «ningún campo del registro de campo vive sólo en papel o en Excel». Para
medirla hay que comparar tres listas que nadie había puesto una al lado de otra:
el formulario **impreso** de la ficha, el registro de la **app**, y el parte del
**Excel**.

**Lo que faltaba en la app** (L45, reparado):

| Campo | Papel | Excel | App antes | App ahora |
|---|:-:|:-:|:-:|:-:|
| Alumnos en aula | ✓ | ✓ | ✓ | ✓ |
| Rechazos | ✓ | ✓ | ✓ | ✓ |
| **Ya respondieron** (duplicados) | — | ✓ | **—** | **✓** |
| **Efectivas** | — | ✓ | **—** | **✓** |
| **Aula real** | ✓ | ✓ | **—** | **✓** |

Los dos primeros no son adorno: **sin ellos el cuadre de L33 no se puede
comprobar sobre lo que la app captura**. El control existe en Validación desde
hace cuatro ítems y el registro no producía sus insumos. Y «encuestas aplicadas»
no es «efectivas» — L32 ya había dicho que efectivas es el número que manda.

El backend **ya aceptaba los tres**: `monitoreo_aulas_update_agenda()` los
persiste sin tocar nada. Era sólo la superficie la que no los pedía.

**L46, anotado sin tocar**: el desglose hombres/mujeres se pide **en papel** y no
está en ningún otro sitio. Puede ser deliberado —el sexo se deriva de las
respuestas para las cuotas sexo×facultad— o ser una fuga real. No lo declaro
defecto sin saber para qué lo usa el equipo en campo, que es justo lo que la
regla de este GOAL pide anotar en vez de adivinar.


### 2026-08-16 — V9: el lector cuadra, y mi instrumento no

V9 pedía que los totales del lector cuadraran con los del Excel. Medirlos con el
propio lector sería circular, así que conté el Excel real por un camino
independiente. **Y el que falló fue mi conteo, no el lector.**

| | Conteo independiente | Lector |
|---|---:|---:|
| Unidades con código | 1012 | **1012** |
| Con enlace de ficha | 766 | **766** |
| Con estado de muestra | 230 | **230** |
| Partes de campo | 196 | **196** |
| Filas de control | 194 | **194** |

Mi primer intento buscó el título `STATUS MUESTRA` en la fila de cabecera y dio
**0**. El título real es `"STATUS\nMUESTRA"`: lleva un salto de línea, y el
lector lo normaliza antes de comparar. Estuve a punto de reportar un defecto que
era de mi regla de medición. Lo mismo con las filas de control: el conteo crudo
dio **40 578** porque `read_excel` arrastra el rango usado entero, y el lector
filtra bien a 194.

**Pero el barrido sí encontró L47**, y es el que importaba: la columna
`OBSERVACIONES` del agendamiento tiene **190 celdas con contenido** en el estudio
de 2025 —«el docente pidió reprogramar», «no contesta»— y el round-trip las
perdía todas. El lector las guarda en `replacement_note`; el generador leía
`notes`. **Novena aparición** del patrón productor/consumidor, y la primera que
encuentro contra datos reales en vez de contra un fixture.

Es también la contracara de L44: ese arreglo devolvió el operativo al libro, y
este cierra la última columna que seguía cayéndose por el camino.

**Nota de método**: dos veces en un mismo tick di por defectuoso lo medido
cuando el defectuoso era el instrumento. La regla que funciona es no aceptar una
divergencia sin antes reproducirla desde el otro lado — el conteo posicional,
que confirmó los 230.


### 2026-08-16 — L5: el gesto existe, y de paso salió L48

Activar un reemplazo ya no es una decisión de chat. `monitoreo_aulas_activar_reemplazo()`
mueve la caída a `reemplazada`, entra su siguiente reserva como `agendada`, y
deja el motivo y la marca de tiempo en las dos. El endpoint
`POST /api/monitoreo/aulas/activar-reemplazo` lo expone y persiste en el `.pulso`.

Tres decisiones sobre qué **no** hace:

- **No toca `activation_weight_status`.** Ese campo dice que el peso de una
  reserva es condicional *por diseño muestral*, y el relato de Cálculo de
  muestra lo explica así. La activación es un hecho operativo; que el peso se
  active lo deriva el ponderador al ver una reserva condicional ya agendada.
- **Con la cadena agotada, no marca la caída como reemplazada.** No lo está.
  Decir que sí la sacaría del avance sin que nadie cubra su meta. Devuelve
  `agotada` y cuántas reservas se habían usado.
- **Nunca toma una reserva de otra cadena**, aunque esté libre.

La cadena encadenada funciona porque `replacement_for` de `R 4.2` apunta al
**titular** `CH 4`, no a `R 4.1`: buscar «reservas de R 4.1» no encontraría
ninguna. Es la misma propiedad que L41 dejó correcta hace tres ítems.

**L48, encontrado por el test que comprueba que la brecha se mueve**: el
tablero convertía `en_reserva` en `sin_contactar`. La causa es de manual —
`gsub("[^a-z ]", "", key)` **borraba** el guion bajo en vez de convertirlo en
espacio, así que `en_reserva` quedaba en `enreserva` y ya no empezaba por
`en reserva`. **La función no reconocía el valor que ella misma devuelve**, y
degradaba la reserva en cada vuelta: cargar, guardar, reimportar. De los tres
vocabularios, `en_reserva` es el único con guion bajo en una expresión de dos
palabras — por eso era el único afectado. Ahora hay un test que exige que los
tres sean idempotentes.

Falta el botón: la UI todavía no ofrece el gesto. **V6 sigue sin cumplirse del
todo**, y es lo único de la vara que queda.


### 2026-08-16 — V6 cumplida, y dos cosas que sólo se vieron al pulsar el botón

El botón vive en Registro de campo, que es donde el coordinador marca que un
aula cayó — el momento exacto en que la decisión se toma. Aparece sólo con
`sin_acceso`, `cancelada` o `reemplazo_pendiente`, y **no** sobre un aula ya
reemplazada: volver a activarla consumiría otra reserva sin que nadie lo pida.

Verificado end-to-end en el navegador, no en un test: `CH 4` → entra `R 4.1` →
cae `R 4.1` → entra `R 4.2` → cae `R 4.2` → **cadena agotada**, con el mensaje
diciendo que esa meta se queda sin cubrir.

**Dos defectos que ningún test mío habría encontrado**, porque los dos aparecen
al mirar el resultado en la sesión real:

- **L49**: el motor escribía `replaced_at`, `activated_at` y `activation_reason`,
  y el tablero los mostraba **vacíos**. `monitoreo_aulas_normalize_plan()` tiene
  lista **cerrada** de campos. Décima aparición del mismo patrón en este GOAL, y
  la primera contra código que yo mismo acababa de escribir.
- **El motivo se degradaba a «otro»**: mi UI pasaba `form.estado` como sustituto
  cuando no había motivo, y **un estado no es un motivo**. `sin_acceso` es
  estado; `docente_no_autoriza` es motivo. Que se normalizara a «otro» era
  correcto — el error era colarlo.

**Nota de método**: al pulsar el botón no vi mensaje y estuve a punto de darlo
por roto. Había funcionado: el mensaje quedaba bajo el recorte de L42, y la
prueba fue que la siguiente activación entró `R 4.2` en vez de `R 4.1`. Un
defecto de layout puede disfrazarse de defecto funcional.

Con esto **la vara queda completa salvo L46** (hombres/mujeres en papel) y tus
cinco decisiones.
