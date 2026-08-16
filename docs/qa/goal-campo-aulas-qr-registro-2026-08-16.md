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
| **V6** | **Activar un reemplazo es un gesto de la app**, no una decisión en un chat. | Desde el aula caída se activa su cadena `R n.k`; el motivo queda registrado y el avance recalcula denominadores solo. |
| **V7** | Lo que pasa en el aula se ve **contra la meta de esa aula, mientras ocurre**. | El avance por aula cruza respuestas de Kobo por `collectorID` contra `expected_valid` sin que nadie re-sincronice a mano. **Parcial (2026-08-16)**: el cruce por `collectorID` ya funciona sin configurar nada (L8); falta el «mientras ocurre», que depende de L4. |
| **V8** | Nada de lo anterior exige una planilla paralela. | Ningún campo del registro de campo vive sólo en papel o en Excel. |
| **V9** | La app **lee** las tres hojas del estudio sin que nadie retranscriba. | Importar el libro real deja el plan, el agendamiento y el parte de campo en el `.pulso`, y sus totales cuadran con los del Excel. |
| **V10** | El **agendamiento** y la **aplicación** se miden por separado. | `STATUS MUESTRA` (AGENDADA · REAGENDADA · EN RESERVA n · REEMPLAZADA) y `STATUS DE APLICACIÓN` (APLICADA · NO APLICADA) viven en campos distintos; hoy la app los mezcla en un solo `operational_status`. |
| **V11** | Se sabe **por qué** un aula no está agendada todavía. | El ciclo de contacto —medio, fecha de llamada y **número de intentos**— llega al modelo y se ve por aula. |
| **V12** | La app **produce** el libro que el equipo llena, y lo **vuelve a leer**. | Generar y reimportar cierra el círculo sin perder la cadena ni los enlaces; las columnas de cada rol salen vacías. |

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
| **L23** | Los números de L15–L22 no se han visto en pantalla. | Un `.pulso` armado a mano no transporta las respuestas ni `monitoreo_config$aulas_universitarias`: la whitelist de persistencia guarda el plan y poco más. | ☐ sin empezar — exige recorrer el flujo real desde la UI (calc-muestra → importar → Recopiladores → handoff). L13 y L14 **sí** quedaron confirmados en pantalla: 7 cursos-horario, no 49, y sin crash. |
| **L4** | No existe superficie para registrar el estado operativo de un aula. | Decidido por Gonzalo el 2026-08-16: **vive en Monitoreo**, sección Agenda — el estado operativo mueve los denominadores del avance. | ☑ **hecho** — `RegistroDeCampo.tsx` conecta `/api/monitoreo/aulas/agenda`, que llevaba 0 consumidores. El modelo del plan gana `observed_students`, `applied_surveys`, `refusals`, `applied_by`, `applied_at` y `field_note`. ⚠ **queda un pase de layout**: ver L26. |
| **L26** | El registro queda apretado en la vista Agenda, y duplica la lista de aulas. | La vista es de **alto fijo** y ahora compiten tres paneles; además la lista del registro y la tabla de agenda muestran lo mismo. | ☐ sin empezar — **decisión de layout**: o el registro sustituye a la tabla de solo lectura (borrar superficie exige tu visto bueno, gate 3), o va a pestaña propia dentro de Agenda. No se improvisó. |
| **L27** | La app no lee «Aulas Agendadas». | 241 columnas: 1 de `ID MATCH` + **12 bloques de 20** (titular y once eslabones, a lo ancho). | ☑ **hecho** (2026-08-16) — lector + endpoint `/api/monitoreo/aulas/importar-libro`. Contra el estudio real: **1012 filas**, 170 titulares, 230 contactadas. |
| **L28** | La app no lee «Aulas Aplicadas (Campo)». | Tres bloques de **ancho distinto** (34/33/33: sólo el principal trae `AULA`) y `FECHA DE APLICACIÓN` duplicada dentro del bloque. | ☑ **hecho** (2026-08-16) — lector + endpoint. **196 partes**, 4269 efectivas. |
| **L33** | Dos partes de 196 **no reconcilian**. | `asistentes − rechazos − duplicados ≠ efectivas` en `1TEA08-0401` (15−0−0, efectivas 14) y `LIN127-0203` (27−1−3, efectivas 27). El Excel no comprueba esa identidad. | ☐ sin empezar — es un control que la app **sí** puede aportar |
| **L29** | La app no lee «Base de control». | Seis grupos de control por aula. | ☑ **hecho** (2026-08-16) — lector + endpoint. **194 filas, 36 campos**; las 7 columnas sin nombre de la cabecera se reportan. |
| **L34** | `VALIDO TOTAL` dice **NO CUMPLE en 149 de 194 aulas**. | Lo calcula el propio Excel contra los umbrales 70T/70P. | ☐ sin empezar — hay que entender si es el criterio o el operativo antes de llevarlo a ningún tablero. |
| **L35** | La app no **generaba** el libro, sólo lo leía. | Sin generarlo, cada estudio arranca copiando el del anterior y los encabezados derivan hasta que dejan de leerse. | ☑ **hecho** (2026-08-16) — `aulas_libro_generar()` + `POST /api/monitoreo/aulas/generar-libro`. Round-trip probado: lo que escribe lo vuelve a leer. |
| **L36** | El libro generado no se registra como **fuente** de Monitoreo. | En telefónico el Excel de barrido es una fuente (`kind`) que el motor consulta para decidir. Aquí el libro todavía se importa a mano. | ☐ sin empezar — es lo que cierra la analogía |
| **L30** | El modelo mezcla **dos ejes de estado** en uno. | `operational_status` junta agendamiento y aplicación. En el estudio real son columnas distintas y una fila puede estar `REEMPLAZADA` en muestra y `APLICADA` en campo. | ☐ sin empezar — afecta a lo construido en L4 |
| **L31** | Falta el **ciclo de contacto**. | `MEDIO DE CONTACTO`, `FECHA DE LLAMADA` y `NÚMERO DE INTENTOS` no existen en el modelo. Sin ellos no se explica por qué un aula sigue sin agendar. | ☐ sin empezar |
| **L32** | El parte de campo está **incompleto**. | Faltan `DUPLICADOS (YA RESPONDIERON)`, `CANTIDAD DE EFECTIVAS` —que es el número que manda, no «encuestas aplicadas»— y el **aula real** donde se aplicó, que puede no ser la planificada. | ☐ sin empezar — corrige lo construido hoy en L4 |
| **L5** | Activar un reemplazo no es un gesto de la app. | El modelo ya tiene `replacement_for`, `replacement_reason`, `replacement_chain_code`, `chain_depth` y la taxonomía `reemplazo_pendiente`. Falta la acción y su registro. | ☐ sin empezar (depende de L4) |
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
