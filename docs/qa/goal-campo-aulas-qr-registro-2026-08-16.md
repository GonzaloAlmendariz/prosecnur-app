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
| **V7** | Lo que pasa en el aula se ve **contra la meta de esa aula, mientras ocurre**. | El avance por aula cruza respuestas de Kobo por `collectorID` contra `expected_valid` sin que nadie re-sincronice a mano. |
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
**slug interno** en vez de `CH 1`. El enlace impreso ocupa dos renglones y el QR
sale al doble de denso de lo necesario — que es justamente lo que se paga en un
aula con mala luz y un teléfono viejo.

---

## Cola

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| **L1** | El parámetro del enlace va duplicado (`d[collectorID]` dos veces). | `api/R/collection_adapters.R:.ca_binding` dejaba el param dentro de `access_ref`; `api/R/collection_engine.R:.collection_access_url` volvía a colgar el `prefill`. | ☑ **hecho** (2026-08-16) — el adapter ya no arma URL: declara base en `access_ref` y personalización en `prefill`, y el resolvedor compone una sola vez. Payload de 116 → 71 chars, PDF de 244.981 → 234.937 bytes. Regresión en `test-collection-engine.R` («la costura adapter → resolvedor no duplica el parámetro»). |
| **L1b** | SurveyMonkey recibía la sintaxis `d[]` de Kobo. | Hallazgo de propina al hacer L1: `.collection_access_url` hardcodeaba `d[%s]` para todo proveedor, así que al link de SM se le colgaba un parámetro que su formulario ignora. | ☑ **hecho** (2026-08-16) — `.collection_prefill_param()` decide por proveedor; el resolvedor recibe `deployment$target$provider`. |
| **L2** | El valor del `collectorID` es un slug interno con hash, no el código operativo. | `.collection_stable_id()` en `collection_engine.R`; el código operativo canónico lo produce `.cm_aulas_codigo_operativo()`. Decidir cuál viaja a Kobo — afecta la reconciliación de la data que vuelve. | ⛔ bloqueado — ver «Espera al usuario» |
| **L3** | La ficha no declara el rol: titular y reemplazo se ven iguales. | `collection_material_builtin_template()` no usaba `unit.role`; y el binding devolvía la clave cruda del motor. | ☑ **hecho** (2026-08-16) — la ficha imprime «Rol: Titular» / «Rol: Reemplazo de AULA-01». `.crf_role_label()` traduce, `replacement_for` viaja al plan y existe el binding `unit.replacement_for`. Built-in a revisión 2. |
| **L11** | Hay **dos plantillas por defecto que no coinciden**. | `collection_material_builtin_template()` (backend, `template-ficha-aplicacion-a4-v1`) y `DEFAULT_COLLECTION_TEMPLATE` (`frontend/.../MaterialsSection.tsx:80`, `template-ficha-aplicacion`) declaran bloques distintos. El editor siembra una ficha que el motor nunca produce. Hallazgo de propina al hacer L3. | ☐ sin empezar |
| **L4** | No existe superficie para registrar el estado operativo de un aula. | `apiMonitoreoAulasAgenda` (`frontend/src/api/monitoreo.ts:4286`) tiene **0 consumidores**. El backend `/api/monitoreo/aulas/agenda` + `monitoreo_aulas_update_agenda()` ya funcionan. Falta decidir **dónde vive**: el comentario de `AulasOperationsPanel.tsx:1-7` dice que la agenda pertenece a Recopiladores, no a Monitoreo. | ⛔ bloqueado — necesita decisión de ubicación (¿ADR?) |
| **L5** | Activar un reemplazo no es un gesto de la app. | El modelo ya tiene `replacement_for`, `replacement_reason`, `replacement_chain_code`, `chain_depth` y la taxonomía `reemplazo_pendiente`. Falta la acción y su registro. | ☐ sin empezar (depende de L4) |
| **L6** | El registro de campo no existe como concepto: hora de inicio, aforo observado, quién aplicó. | La ficha impresa **sí** los tiene (bloque `application_log`, 3 renglones a mano). Nunca vuelven al sistema. | ☐ sin empezar |
| **L7** | La ficha desperdicia alto en blanco y el enlace impreso corta a media palabra. | `collection_render_ficha.R`, layout `single_sheet`. | ☑ **hecho** (2026-08-16) — hueco interior mayor de 206 px a 124 px (11,7% → 7,1% del alto). El grid reparte su banda en vez de amontonarse; capacidad 6 → 8 filas (7 con careta). El corte del enlace ya lo había resuelto L1. |
| **L7b** | El lector de QR asumía la geometría de la ficha **sin** careta. | `collection_qr_matrix_from_png()` pedía `.crf_layout()` sin `branded`; funcionaba solo porque ambas variantes coincidían en `qr_y`. Hallazgo de propina al hacer L7. | ☑ **hecho** (2026-08-16) — el lector recibe `branded`. |
| **L8** | `apiMonitoreoAulasConfig` también tiene 0 consumidores. | `frontend/src/api/monitoreo.ts`. Verificar si es capacidad muerta o pendiente de conectar antes de borrarla. | ☐ sin empezar |
| **L9** | No hay test que ate la simulación end-to-end (selección → enlaces → fichas → handoff). | Hay tests por pieza (`test-collection-engine.R`, `test-collection-materials.R`, `test-collection-render-ficha.R`) pero ninguno recorre la costura completa. La simulación de este GOAL es el borrador de ese test. | ☐ sin empezar |
| **L10** | El QR nunca se verificó decodificándolo. | **Corregido el 2026-08-16: la premisa era inexacta.** `collection_qr_matrix_from_png()` sí relee el QR del PNG renderizado y compara la matriz módulo a módulo contra la esperada, en 5 archivos de test. Lo que falta es más estrecho: nadie **decodifica** la matriz a texto, así que un error de encoding del payload (no de dibujo) pasaría. Y ningún lector real ha visto la hoja impresa. | ◐ a medias |

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
