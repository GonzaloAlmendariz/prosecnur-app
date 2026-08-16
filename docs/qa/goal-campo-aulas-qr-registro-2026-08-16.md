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
| **L7** | La ficha desperdicia ~30% del alto en blanco y el enlace impreso corta a media palabra. | `collection_render_ficha.R`, layout `single_sheet`. Se ve en `ficha_sim_p1.png`. | ☐ sin empezar |
| **L8** | `apiMonitoreoAulasConfig` también tiene 0 consumidores. | `frontend/src/api/monitoreo.ts`. Verificar si es capacidad muerta o pendiente de conectar antes de borrarla. | ☐ sin empezar |
| **L9** | No hay test que ate la simulación end-to-end (selección → enlaces → fichas → handoff). | Hay tests por pieza (`test-collection-engine.R`, `test-collection-materials.R`, `test-collection-render-ficha.R`) pero ninguno recorre la costura completa. La simulación de este GOAL es el borrador de ese test. | ☐ sin empezar |
| **L10** | El QR nunca se verificó decodificándolo. | Los tests comprueban que la matriz tiene módulos claros y oscuros, no que un lector recupere la URL. La legibilidad real es una suposición. | ☐ sin empezar |

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
