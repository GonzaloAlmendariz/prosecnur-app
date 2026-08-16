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

---

## Vara

| # | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | De una selección de aulas (titulares + reemplazos) **sin enlaces**, el motor produce un enlace personalizado por unidad sin que nadie pegue links a mano. | La simulación `sim_qr_aulas.R` da cobertura `prepared` con `units_missing_access = 0`. |
| **V2** | El QR codifica el enlace **mínimo**: base + un parámetro, una sola vez. | El `qr_payload` compilado no repite ningún nombre de parámetro. |
| **V3** | El identificador que viaja en el QR es el **código operativo** del equipo (`CH 1`, `R 1.2`), no un slug interno con hash. | El `d[collectorID]` de la ficha de `CH 1` es literalmente `CH 1` (o su forma URL-safe estable), y la data que vuelve de Kobo se reconcilia sin tabla de traducción. |
| **V4** | La ficha dice **sin interpretación** si el aula es titular o reemplazo, y de quién es reemplazo. | Dos páginas del mismo PDF (una titular, una reserva) difieren en una marca legible; alguien que no conoce la nomenclatura acierta el rol. |
| **V5** | El coordinador registra desde la app el **estado real** de cada aula (agendada · en aplicación · aplicada · parcial · sin acceso · cancelada) con su motivo, y eso queda en el `.pulso`. | Existe una superficie que llama a `/api/monitoreo/aulas/agenda`. Hoy ese endpoint tiene **0 consumidores**. |
| **V6** | **Activar un reemplazo es un gesto de la app**, no una decisión en un chat. | Desde el aula caída se activa su cadena `R n.k`; el motivo queda registrado y el avance recalcula denominadores solo. |
| **V7** | Lo que pasa en el aula se ve **contra la meta de esa aula, mientras ocurre**. | El avance por aula cruza respuestas de Kobo por `collectorID` contra `expected_valid` sin que nadie re-sincronice a mano. **Parcial (2026-08-16)**: el cruce por `collectorID` ya funciona sin configurar nada (L8); falta el «mientras ocurre», que depende de L4. |
| **V8** | Nada de lo anterior exige una planilla paralela. | Ningún campo del registro de campo vive sólo en papel o en Excel. |

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
| **L20** | Las cuotas sexo×facultad salen vacías con un plan creado por el handoff. | Los objetivos derivan de `sex_top_1`/`sex_top_2`, composición que produce Cálculo de muestra y que el plan de Recopiladores **no transporta**. | ☐ sin empezar — límite conocido: las filas que **crea** el handoff son más delgadas que las que importa Monitoreo desde calc-muestra. El flujo soportado es importar primero y entregar después; conviene decidir si el plan de Recopiladores debe llevar la composición. |
| **L21** | El aviso «recolectores duplicados» saltaba **siempre**. | En un estudio de aulas el mismo QR lo escanean todos los alumnos: el colector se repite por diseño. El chequeo sólo decía «ok» con una única respuesta, que es el caso anómalo. | ☑ **hecho** (2026-08-16) — pasa a `duplicate_responses`, que mira el id de respuesta (`_uuid`/`_id`/`instanceID`); si la fuente no lo trae, lo dice en vez de callar o alarmar. Etiqueta del frontend actualizada. |
| **L22** | Una respuesta de un aula inexistente pasaba como **buena**. | `unmapped_valid_responses` miraba si la respuesta *tenía* colector, no si ese colector correspondía a un aula del plan. | ☑ **hecho** (2026-08-16) — se compara contra los ids del plan (`classroom_id` + `collection_unit_id`), posible sólo desde que el emparejamiento los conoce. |
| **L4** | No existe superficie para registrar el estado operativo de un aula. | `apiMonitoreoAulasAgenda` (`frontend/src/api/monitoreo.ts:4286`) tiene **0 consumidores**. El backend `/api/monitoreo/aulas/agenda` + `monitoreo_aulas_update_agenda()` ya funcionan. Falta decidir **dónde vive**: el comentario de `AulasOperationsPanel.tsx:1-7` dice que la agenda pertenece a Recopiladores, no a Monitoreo. | ⛔ bloqueado — necesita decisión de ubicación (¿ADR?) |
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

---

## Bitácora

### 2026-08-16 — apertura
Simulación end-to-end corrida sobre el motor real. **V1 se cumple**: de aulas
seleccionadas sin enlaces salen 7 enlaces personalizados, 7 fichas con QR único
y el handoff escribe los 7 enlaces al plan de Monitoreo. **V2, V3, V4 fallan** en
el contenido del QR y de la ficha. **V5, V6, V7, V8 no tienen implementación**:
el registro en campo no existe como superficie.

Respuesta corta a las dos preguntas que abrieron el GOAL: el motor de archivos QR
**sí funciona hoy**; el registro en tiempo real desde el aula **no existe todavía**.

### 2026-08-16 — L1 y L1b cerrados
El adapter dejó de armar URLs. Ahora declara base (`access_ref`) y personalización
(`prefill`) por separado, que es lo que el contrato ya pedía, y
`.collection_access_url()` compone una sola vez sabiendo de qué proveedor habla.

| | antes | después |
|---|---|---|
| payload del QR | 116 chars, `d[collectorID]` ×2 | 71 chars, ×1 |
| PDF de 7 fichas | 244.981 bytes | 234.937 bytes |
| enlace impreso | cortaba en dos renglones | una línea |
| SurveyMonkey | `?unit_key=X&d[unit_key]=X` | `?unit_key=X` |

Gate: 12 archivos `test-collection-*.R` + 3 de monitoreo aguas abajo, todos en
verde. **V2 se cumple.** Siguen abiertos V3–V8.

### 2026-08-16 — L3 cerrado
La ficha ya declara el rol. `Rol: Titular` en las páginas de titular y
`Rol: Reemplazo de AULA-01` en las de reserva, verificado en el PNG de la
página 5. Tres piezas hacían falta, no una: el binding `unit.role` existía pero
la plantilla no lo dibujaba, el binding devolvía `chain_reserve` en crudo, y
`replacement_for` **ni siquiera llegaba al plan** —`.collection_legacy_unit()`
no lo leía—, así que «de quién es reemplazo» era irrecuperable en el render.

Se decidió una sola línea compuesta («Reemplazo de AULA-01») en vez de dos
campos, porque un campo «Reemplaza a» quedaría vacío en la mayoría de las
fichas, y un campo vacío impreso es ruido que el aplicador tiene que ignorar.

Built-in a revisión 2 — las instancias vivas quedan `stale` con
`template_changed`, que es el comportamiento correcto y ya estaba cubierto.

**V4 se cumple.** Siguen abiertos V3, V5–V8.

### 2026-08-16 — L7 y L7b cerrados; y una regresión propia atrapada
Al medir la capacidad del grid apareció que **L3 había desbordado la ficha con
careta**: le añadí «Rol» a un grid que ya tenía 6 campos y una capacidad de 6,
así que «Estudiantes» se caía con un `field_grid_overflow` que nadie lee. No lo
detectó ningún test —la suite pasó verde con la ficha mutilada— sino medir la
geometría a mano.

Es el mismo problema que L7: no había sitio porque el 30% de la hoja estaba
muerto en otro lado. Cerrarlo devolvió capacidad.

| | hueco interior mayor |
|---|---|
| antes de L7 | 206 px · 11,7% del alto |
| paso intermedio (mover anclajes) | 268 px · 15,3% — **peor** |
| final (el grid reparte su banda) | **124 px · 7,1%** |

Capacidad del grid: 6 → **8** filas sin careta, **7** con careta. Los anclajes
de las indicaciones y del registro, que vivían hardcodeados dentro del
dibujante, ahora son parte del layout: mover el cuerpo los mueve.

**Ninguna vara nueva se cierra con esto**: L7 es calidad de la hoja y no mapea a
una afirmación de la vara. Estado real: **V1, V2 y V4 cumplidas**; **V3 sigue
bloqueada** tras L2 (qué identificador viaja a Kobo); **V5–V8 sin
implementación**, que es el registro en campo.

Vale anotar que la vara no cubría «la ficha está bien compuesta». No se agrega
ahora una V9 a mitad de camino: se deja dicho que L7 y L11 miden calidad de la
pieza, no capacidad, y que la vara mide capacidad.

### 2026-08-16 — L11 cerrado, y la pregunta que importaba era otra
L11 se abrió como «dos plantillas por defecto divergentes». La pregunta que de
verdad importaba no era si diferían sino **cuál gana**: si el editor hacía PUT
de la suya, todo lo arreglado en L3 y L7 sobre la plantilla del backend nunca
llegaría al usuario.

No gana. `collection_material_template_get()` siempre responde una plantilla
—cae a `collection_material_builtin_template()`—, y el componente corta el
render mientras carga. `DEFAULT_COLLECTION_TEMPLATE` no se dibujaba nunca y su
rama de fallback era inalcanzable. **L3 y L7 sí llegan al usuario.**

Pero por eso mismo había derivado sin que nadie lo notara: otro `template_id`,
otra revisión, campos sin etiqueta, ni separador ni registro de aplicación. Una
segunda fuente de verdad que nadie consulta no se sincroniza —se borra—, porque
el día que alguien la lea va a creerle.

**Verificación**: `tsc --noEmit` en 0 y 13 archivos / 89 tests del feature en
verde. **No se hizo chequeo visual**: llegar al editor de materiales exige una
sesión con plan y deployment, y la ruta de render no se tocó. Riesgo residual
asumido y anotado.

Con esto **se acaban los ítems no bloqueados del lado del motor.** Lo que queda
—L6, L8, L9, L10— es menor, y las cuatro varas abiertas (V3, V5–V8) dependen de
las dos decisiones que esperan a Gonzalo.

### 2026-08-16 — L9 cerrado, y un aserto mío resultó inerte
La simulación es ahora `test-collection-costura-aulas.R`: 41 asertos que
recorren selección → plan → adapter → deployment → instancia → compilado →
render → handoff, sin red y sin depender del guion narrado.

Lo importante no fue escribirlo sino **probar que sirve**. Revertí cada arreglo
y comprobé que el test se pone rojo:

| control | resultado |
|---|---|
| revertir L1 (parámetro duplicado) | 🔴 7 fallos, uno por página |
| revertir L3 (rol en crudo) | 🔴 4 fallos |
| revertir `row_step` de L7 | 🟢 **verde — el aserto era inerte** |

El tercero delató un aserto mío que no verificaba nada: probaba el desborde
contra la plantilla **built-in**, que cabe en cualquier caso. La única que llegó
a desbordarse fue la de **careta** —cabecera más baja, banda más corta y un
campo más— y no la miraba nadie. Corregido: el test ahora hace PUT de la
plantilla con careta y además comprueba que las 7 filas siguen en la hoja, no
sólo que no hubo warning. Con eso, revertir la geometría de L7 sí lo pone rojo.

La lección se suma a las trampas: **un control que no se ejecuta no es un
control**. Verificar el arreglo no basta; hay que verificar el verificador.

### 2026-08-16 — L8 no era limpieza: era el circuito abierto
L8 entró en la cola como «un endpoint sin consumidores, ver si es capacidad
muerta antes de borrarla». Resultó ser lo contrario de código muerto.

La cadena, entera:

1. Recopiladores cuelga `d[collectorID]=` — `collectorID` es el `prefill_field`
   por defecto del adapter y también lo que fija la ruta legacy.
2. Kobo devuelve entonces una columna llamada **`collectorID`**.
3. El cruce de Monitoreo la buscaba entre `collector_id`, `collector`, `link`,
   `aula_id`, `classroom_id`. Y `.monitoreo_text_key()` **conserva el guion
   bajo**: normaliza `collectorID` → `collectorid`, que no es `collector_id`.
   No la encontraba.
4. El único arreglo era `source_mapping$collector_var`, cuyo único setter es
   `/api/monitoreo/aulas/config` — **el endpoint con cero consumidores**.

O sea: el sistema generaba un identificador que él mismo no sabía leer, y la
perilla para corregirlo no estaba al alcance de nadie. Ninguna suite lo veía
porque ningún test recorría la vuelta completa; los fixtures existentes ya traen
columnas llamadas `collector_id`.

Arreglado añadiendo `collectorID` a las dos listas de candidatos. Un mapeo
explícito sigue mandando sobre el fallback (probado). **V7 deja de estar rota de
raíz**: el cruce funciona sin configurar nada. Lo que falta de V7 —el «mientras
ocurre»— sigue dependiendo de L4.

Control verificado: revertir el fallback pone el test en rojo.

### 2026-08-16 — L6: la premisa era falsa y el arreglo casi rompe la hoja
L6 decía «el registro de campo no existe como concepto». **Existe**, y muy bien:
`collection_material_field_form_rows()` lo define completo —facultad, aula,
curso, docente, alumnos en aula con hombres y mujeres, encuestas aplicadas,
rechazos, aplicador/a, fecha y hora— calcado de la hoja de papel que el equipo
ya usaba. Vive en la ficha de campo (`ficha_campo_qr_a4_v1`).

Lo real era otra cosa: la ficha **built-in** imprimía tres renglones numerados
`1`, `2`, `3` sin etiqueta. Un segundo registro, vago, compitiendo con el bueno
— y unas líneas en blanco sin rótulo *son* la planilla paralela que V8 quiere
eliminar, sólo que impresa en nuestra propia hoja.

Ahora ambas plantillas leen el vocabulario de **una sola función**
(`collection_material_application_log_labels()`), recortado a lo que la ficha no
imprime ya. Dos listas paralelas del mismo registro derivan, y después no hay
forma de juntar lo anotado — la lección de L11 aplicada antes de cometerla.

**Y volví a tropezar con lo mismo que en L3**: pasar de 3 a 5 renglones metió el
quinto encima del pie, sobre el logo. `application_log` no tenía guardia de
desbordamiento —el contrato admite hasta 6 filas y la banda no da para seis al
paso cómodo— así que ni avisaba. Ahora reparte su banda y recorta con
`application_log_overflow`, igual que el grid.

Se ve en el PNG: los cinco rótulos caben y el pie queda limpio. Controles
verificados: quitar el reparto pone el test en rojo.

### 2026-08-16 — L10: lo medible hecho, lo demás bloqueado, y una corrección mía
El fixture de QR usaba `"https://kf/x?d=A-1"`: 18 caracteres, 33 módulos. El
enlace que el sistema produce de verdad ronda los 86 y da 49. **Se estaba
probando un símbolo que la app no genera** — el mismo sesgo de fixture que
escondía el bug del cruce por `collectorID` en L8. Corregido, con control.

Lo que decide si una cámara mala lee el símbolo no es el número de caracteres
sino los milímetros de cada módulo impreso:

| enlace | chars | módulos | mm/módulo |
|---|---|---|---|
| juguete del test | 18 | 33 | 2,16 |
| real, código operativo | 63 | 45 | 1,59 |
| real, slug interno | 86 | 49 | 1,46 |
| el más largo posible | 95 | 49 | 1,46 |

Umbral cómodo: 0,6 mm. **Sobra holgadamente** porque el símbolo mide 71 mm de
lado. Hay guardia con control invertido —un payload absurdo sí baja de 0,6—, de
modo que el aserto no pasa por vacío.

**Corrección de algo que afirmé el día que abrí el GOAL**: dije que el parámetro
duplicado dejaba el QR «al doble de denso, que es lo que se paga en un aula con
mala luz». Falso: 1,25 mm contra 1,46 mm, ambos muy por encima del umbral. El QR
nunca estuvo en riesgo. L1 sigue valiendo por el enlace impreso y por la higiene
del payload, no por la legibilidad. Escribí una consecuencia plausible sin
medirla.

**Decodificar a texto queda bloqueado**: no hay decodificador disponible ni en R
(`zxingcpp`, `quadrangle`, `opencv`) ni en Python (`pyzbar`, `cv2`). Añadirlo es
una dependencia nueva en `DESCRIPTION` que el CI instalaría en cada corrida — es
decisión tuya si vale la pena para cerrar el último tramo.

### 2026-08-16 — L12: el patrón de los fixtures vuelve a aparecer, y esta vez no se toca
Perseguí a propósito el patrón que había atravesado todo el loop —fixtures y
listas escritas mirando al consumidor y no a lo que el productor produce— y
apareció otra vez, en el filtro que decide qué respuesta cuenta como válida.

Dos capas encadenadas:

1. Kobo nombra su columna **`_validation_status`**, con guion bajo delante. Los
   candidatos son `response_status`, `validation_status`, `estado`, `status`,
   `_status` — alguien pensó en el prefijo, pero no en este nombre. No la
   encuentra.
2. Cuando no encuentra columna de estado, el filtro **abre**: `rep(TRUE, n)`.
   Todo cuenta como válido.

Y el caso peligroso es el de quien intente arreglarlo: si se apunta
`status_var = "_validation_status"`, los valores de Kobo
(`validation_status_approved`) no están en `valid_statuses`, así que **todas las
respuestas pasan a inválidas, en silencio y sin aviso**.

**No lo arreglé.** Cambiar fail-open por fail-closed cambia lo que cuenta en
estudios que ya están corriendo, y eso es tuyo, no mío. Lo que sí hice fue fijar
el comportamiento actual con tests de caracterización —que declaran lo que hoy
ocurre, no lo correcto— para que el día que se cambie sea una decisión visible y
no un efecto colateral.

Vale la pena notar que el `valid_statuses` actual (`aprobado`, `aplicada`) suena
a vocabulario nuestro, no de Kobo: probablemente se escribió pensando en un
estado que pone el pipeline, no la plataforma. Eso también entra en la decisión.

### 2026-08-16 — dos bugs que rompían Monitoreo justo después de entregar a campo
Siguiendo el mismo lente productor/consumidor aparecieron dos defectos
encadenados en el punto exacto por el que se abrió este GOAL: entregar los
materiales y empezar a monitorear.

**L13 — reventaba.** El handoff escribía `operational_status = "pendiente"`, que
no está en `monitoreo_aulas_estados()`. Y el normalizador resolvía el alias con
`aliases[[key]]`: `[[` sobre un vector con nombres **lanza** `subscript out of
bounds` con una clave desconocida, no devuelve `NULL`. El `%||%` que alguien
puso de red nunca llegaba a actuar. Cualquier plan con vocabulario ajeno tumbaba
la vista entera.

**L14 — y multiplicaba.** Ya sin el crash, 7 aulas normalizaban a **49
registros**, con los `classroom_id` ciclando `01..07, 01..07`. La causa:
`orden = getn(c("orden","order"), seq_len(n))` pasa un default **vectorial**, y
el helper hacía `rep(default, nrow(df))` — n² valores en vez de n. Al asignar
esa columna larga, el data.frame reciclaba todas las demás. Se disparaba sólo
cuando faltaba la columna `orden`, que es justo el caso de las filas nuevas del
handoff.

Ninguno de los dos lo veía la suite: sus fixtures traen `orden` y estados del
vocabulario. **Tercera y cuarta vez que el sesgo de fixture esconde un bug real
en este mismo loop.**

Camino hasta encontrarlo, sin adornos: perseguí primero una hipótesis de códigos
divergentes entre Recopiladores y Monitoreo — **falsa**, el handoff casa por
`classroom_id`. Después mi propio diagnóstico etiquetó «no es data.frame» como
«VACÍO» y me hizo perseguir un fantasma. El bisect por campo tampoco sirvió
porque el mínimo ya disparaba; lo que lo resolvió fue añadir campos de uno en
uno hasta ver que `orden` apagaba la inflación.

### 2026-08-16 — la vuelta se cierra: de la respuesta al avance de su aula
Un eslabón más allá del handoff estaba el que de verdad importa para V7. Con 12
respuestas repartidas en 3 aulas, el tablero decía **«12 válidas» y las 7 aulas
en cero**.

**L15.** El QR cuelga `collection_unit_id` y las respuestas vuelven con ese id,
pero `.monitoreo_aulas_course_status()` emparejaba sólo por `classroom_id` — y
la normalización ni siquiera conservaba `collection_unit_id`, así que el vínculo
se perdía antes de llegar al join. El KPI global contaba bien porque suma sin
agrupar; el desglose, que es lo que se mira en campo, estaba en cero.

Arreglarlo destapó dos más, en cascada:

**L16.** Las aulas quedaban con meta 0, porque el handoff no copiaba
`eligible_n` a las filas nuevas aunque el dato ya viajaba en la unidad. Sin
meta no hay brecha, y ninguna aula puede llegar a «cerrando».

**L17.** Con meta ya presente, un aula con **5 de 30** se declaraba
**«cerrando»**. `application_state` comparaba sin coaccionar y
`.monitoreo_aulas_df()` deja todas las columnas como texto: `"5" >= "30"` es
TRUE en orden lexicográfico. La línea de `brecha`, justo encima, sí coaccionaba
— alguien ya se había topado con esto y lo arregló en un sitio y no en el otro.
Estaba latente porque las válidas siempre eran 0 y `"0" >= "30"` da FALSE.

Los tres se encadenan: el primero ocultaba al segundo y el segundo al tercero.
Es el mismo mecanismo que hace que un loop así valga la pena — arreglar de
verdad destapa lo que estaba tapado, y sólo se ve corriendo la cadena entera.

**V7 pasa a cumplirse en su mitad medible**: el cruce por `collectorID` contra
la meta del aula funciona sin configurar nada. Lo que falta —el «mientras
ocurre»— sigue dependiendo de L4.

### 2026-08-16 — el mismo join estaba escrito dos veces
Bajé a las secciones que **agrupan** —brechas, avance por estrato, reemplazos,
cuotas— con un escenario real: un aula cerrada en 20/20, otra a medias en 8/20,
una sin acceso y su reserva aportando 12.

El tablero decía «40 válidas» y a la vez daba **brecha 20 para el aula que ya
había cerrado**. La causa: el emparejamiento respuesta→aula está escrito dos
veces, en `monitoreo_aulas_dashboard()` y en `.monitoreo_aulas_course_status()`.
L15 arregló el segundo, así que el desglose por aula quedó correcto y **todo lo
que agrupa siguió calculando sobre ceros**. Ahora es un helper único.

| sección | antes | después |
|---|---|---|
| brechas | 7 entradas, todas con la meta entera | 6, con la brecha real |
| avance por estrato | 0 válidas · brecha 140 | 40 válidas · brecha 100 · 28,6 % |
| reemplazos | vacío | la cadena de 3 |

Y **L19**: la cadena de reemplazos era invisible porque el handoff no arrastraba
`replacement_for`, que es justo el campo por el que filtra esa sección.

Queda **L20** anotado, no resuelto: las cuotas sexo×facultad siguen vacías
porque sus objetivos derivan de la composición (`sex_top_*`) que produce Cálculo
de muestra y el plan de Recopiladores no transporta. Es el límite general de
este tramo: **las filas que el handoff *crea* son más delgadas que las que
Monitoreo *importa* desde calc-muestra.** El flujo soportado es importar primero
y entregar después; que el plan de Recopiladores lleve la composición es una
decisión de contrato, no un arreglo.

Van cuatro sitios distintos donde el mismo defecto de emparejamiento o de
coerción estaba **arreglado en un lado y no en el otro**: el prefill del enlace,
la coerción numérica de `brecha` vs `application_state`, este join, y el
vocabulario de estados. Cuando algo se escribe dos veces, se arregla una.

### 2026-08-16 — los dos avisos del tablero decían lo contrario de lo útil
Última sección sin ejercitar. Los dos chequeos que miran las respuestas estaban
invertidos respecto de lo que un estudio de aulas necesita.

**L21 — el aviso que salta siempre.** «Recolectores duplicados» disparaba en
cuanto un aula tenía dos respuestas: el mismo QR lo escanean todos los alumnos,
así que el duplicado **es el diseño**. Sólo decía «ok» con una única respuesta,
que es justo el caso raro. Un aviso permanentemente encendido se ignora, y con
él se ignora el panel entero. Ahora mira el id de respuesta —`_uuid`, `_id`,
`instanceID`— y, si la fuente no lo trae, **lo dice** en vez de callar o alarmar.

**L22 — el aviso que nunca salta.** `unmapped_valid_responses` comprobaba si la
respuesta *tenía* valor de colector, no si ese valor correspondía a un aula del
plan. Una respuesta con un QR de otro estudio o un id mal tecleado pasaba como
buena. Comprobarlo de verdad sólo es posible desde que el emparejamiento conoce
`collection_unit_id` (L15).

Renombrar el chequeo obligó a tocar el frontend: `aulasPresentation.ts` traduce
los nombres a etiquetas, y dejarlo sin actualizar habría mostrado el aviso sin
traducir — la misma clase de costura que este loop lleva persiguiendo. Gate:
44 archivos de R, `tsc` en 0 y 17 tests del perfil de aulas.

Con esto **el tablero de aulas queda recorrido entero** con datos: KPIs,
desglose por aula, brechas, estratos, reemplazos, cuotas y validación.
