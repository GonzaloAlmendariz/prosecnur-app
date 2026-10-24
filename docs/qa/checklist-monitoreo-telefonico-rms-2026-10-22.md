# Checklist · Monitoreo telefónico para el ACNUR RMS 2026 (2026-10-22)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-22
Autoridad: Pedido de Gonzalo (citado abajo); sólo él da por terminado un ítem

Pedido de Gonzalo: «propón los cambios al motor para Status configurable, backup/reemplazos y la llave, con checklist antes de tocar código».

**Estado de este documento: propuesta. No se ha tocado código.** Solo el usuario da un ítem por terminado.

## Antecedente medido (2026-10-22)

Prueba sintética (`rms_prueba.R`, fuera del repo; 800 hogares, 4 periodos, 180 respuestas de Kobo con `intro/Intro01`) contra `build_monitoreo_telefonico_report_model`:

| Escenario | Respuestas que cruzan | Efectivas por periodo (Pre visa / Pandemia / Post / Actualidad) |
|---|---|---|
| A. Nada declarado | 0 de 180 | 0 / 0 / 0 / 0 |
| B. `key_rules` + `declared_person_code_var` | 179 de 180 | 43 / 48 / 43 / 41 (= verdad calculada fuera del motor) |
| C. B + `actor_var: "Periodo"` | 179 de 180 | 43 / 48 / 43 / 41, sin filas «Sin meta» |

Hallazgos de la prueba:
- Solo «Efectivo» y «Rechazo» tienen estado propio; los otros 12 Status del vocabulario caen en «Sin respuesta» sin aviso. «Encuesta parcial» no llega a Parcial.
- Los 400 backups entran al universo: de 355 «No barrido», 313 son backups sin abrir, y «Sin responsable» aparece como el mayor responsable.
- `Reemplaza a`, `Reemplazado por` y `¿Se reemplaza?` son columnas libres sin semántica.

## Reglas de ejecución

- `api/R/monitoreo_engine.R` y `api/R/monitoreo_telefonico.R` son archivos congelados a crecimiento (`node agentic/sync-agentic-os.mjs --audit`). La lógica nueva va en archivos nuevos que el engine llama.
- Todo cambio de cifras es **opt-in por perfil** (patrón de `actor_var`), para que ningún proyecto existente cambie al actualizar (`acnur_pdm`, `acnur_acg`, MedVida).
- `autor-regresiones` escribe el rojo antes que `backend-r`. Gate: `make gate-area AREA=monitoreo GATE_ARGS='--patron "telefon"'` y, si toca UI, `make gate-front AREA=monitoreo/profiles/telefonico`.

## Checklist

### 1. Llave de cruce (proGres)

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1.1 | «Código proGres» se reconoce como llave del barrido sin declararla a mano (hoy exige `key_rules.universe_fields`) | engine: `.monitoreo_report_key_details`, aliases por defecto de `key_rules`; archivo nuevo `monitoreo_llave_progres.R` | hecho (sin commitear): `monitoreo_llave_progres.R`; respaldo, no pisa a CodPulso ni a la llave declarada |
| 1.2 | La variable de código de Kobo (`Intro01`, etiqueta «Código proGres») se reconoce sin declarar `declared_person_code_var` | engine: `.monitoreo_response_key_aliases`; archivo nuevo | hecho (sin commitear): reconoce el nombre o la etiqueta «Código proGres»; depende de que la etiqueta llegue en el snapshot de Kobo |
| 1.3 | Declarar la llave desde la app (`key_rules` y `declared_person_code_var` no tienen UI; hoy solo por JSON o API) | frontend: Monitoreo › Fuentes; `frontend/src/api/monitoreo.ts` | bloqueado: decidir si 1.1 y 1.2 bastan |
| 1.4 | Aviso fuerte cuando casi nada cruza (hoy: 0 efectivas y alertas sueltas) | engine: alertas `respuesta_sin_llave`, `llave_no_detectada` | hecho (sin commitear): `cruce_llave_bajo`; con 0 cruces dice «ninguna respuesta cruza con el barrido» |
| 1.5 | Aviso cuando la columna de un filtro (consentimiento, test/real) no se encuentra: hoy da «0 efectivas» sin decir por qué | engine: `.monitoreo_report_filter_column`, `monitoreo_filtro_efectiva.R` | hecho (sin commitear): `filtro_columna_no_encontrada`; nivel Media si resuelve por coincidencia parcial, Alta si no resuelve |

### 2. Status configurable

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 2.1 | Que `operational_model.state_rules` gobierne el estado de cada fila del barrido (hoy solo lo lee el frontend para colores) | engine: `.monitoreo_report_state_from_status`; archivo nuevo `monitoreo_status_reglas.R` | hecho (sin commitear): `status_from_rules`, apagada por defecto; `monitoreo_status_reglas.R` |
| 2.2 | Mapeo del RMS: Efectivo → Completa; Encuesta parcial → Parcial; Rechazo → Rechazo; el resto → Sin respuesta con familia (terminal, reintentable, en gestión) | `state_rules` del perfil RMS | hecho (sin commitear): el mapeo del RMS se declara en `state_rules` del perfil; probado: 13 parciales = 13 «Encuesta parcial» |
| 2.3 | Un Status que no está en el vocabulario ni en `state_rules` se avisa («valor desconocido»), no cae en silencio (caso real: «Número Incorrrecto» con tres r en PDM) | engine + bloque de alertas | hecho (sin commitear): `status_desconocido`, solo con la bandera encendida |
| 2.4 | Terminal vs reintentable sale de `state_rules` (`stop_contact`), no de una regex sobre el texto | `monitoreo_telefonico.R:717-721` | propuesto |
| 2.5 | El umbral de intentos lee `alerts.no_answer_min_attempts` (hoy fijo en 4, y el campo de config es letra muerta) | `monitoreo_telefonico.R:1121` | propuesto |

### 3. Backup y reemplazos

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 3.1 | `Origen` (Muestra / Backup) como dimensión declarada | `dimension_vars` de la fuente (`monitoreo_source_dimension_vars.R`) | por verificar si ya alcanza |
| 3.2 | Un backup sin abrir (Origen = Backup, sin responsable, «No barrido») no cuenta como «No barrido» ni como «Sin responsable» | `monitoreo_telefonico.R` (bloques de responsable); archivo nuevo `monitoreo_reemplazos.R` | propuesto |
| 3.3 | Un reemplazo y su sustituto cuentan como **un** cupo (lee `Reemplaza a` y `Reemplazado por`) | archivo nuevo `monitoreo_reemplazos.R` | bloqueado: decisión 3-A |
| 3.4 | Bloque nuevo «Reemplazos»: por periodo, reemplazables, reemplazados, backup usado y backup disponible | engine: bloque nuevo `reemplazos_telefonico` | propuesto |
| 3.5 | Alertas: backup usado ≥ 60 % por periodo; `¿Se reemplaza?` = Sí sin `Reemplazado por`; reemplazo de otro periodo; backup reutilizado | alertas del perfil | propuesto |
| 3.6 | Vista del bloque 3.4 en Monitoreo telefónico (Avance), con Contrato de Superficie C1–C5 | `frontend/src/features/monitoreo/profiles/telefonico` | propuesto, después de 3.4 |

### 4. Cuotas por periodo

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 4.1 | Documentar `actor_var: "Periodo"` como camino del RMS; sin él aparecen filas «Sin meta» duplicadas | `monitoreo_telefonico.R:421-452, 500-509` | propuesto |
| 4.2 | Declarar `actor_var` desde la app (hoy solo por el POST de la fuente) | frontend: Fuentes | bloqueado: decidir con 1.3 |

### 5. Pruebas y gate

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 5.1 | Promover `rms_prueba.R` a contrato de pruebas con fixture sintético (800 hogares, 4 periodos, anomalías de Kobo inyectadas) | `api/tests/testthat/test-monitoreo-telefonico-rms.R` (nuevo) | hecho (sin commitear): `test-monitoreo-telefonico-rms.R`, 19 tests |
| 5.2 | Prueba de no regresión: cifras de `acnur_pdm` iguales con la opción apagada | `api/inst/reference_projects/acnur_pdm` | hecho (sin commitear): `acnur_pdm` fijado con literales; verde antes y después |
| 5.3 | Verificar los nombres reales de las columnas de Kobo del RMS con un envío de prueba | Kobo `pulsopucp` | pendiente: depende de un envío real |

### Fuera de alcance (anotado, no se toca)

- Cruce del responsable de Kobo (`name_enumerator`) con el del Sheet.
- Contactabilidad por teléfonos anchos y «Telefono de la encuesta».
- Apps Script de Ulises que jala Kobo al Sheet.

## Decisiones abiertas (de Gonzalo)

- **3-A.** ¿Un hogar reemplazado cuenta en el universo o sale? Propuesta: el universo es el listado de Muestra y el backup es reserva; el reemplazo ocupa el cupo del original.
- **2-A.** ¿Status configurable es opt-in por perfil, o cambia para todos los proyectos? Propuesta: opt-in, para no mover cifras ya entregadas.
- **1-A.** ¿«Código proGres» como alias nativo, o solo declarado por configuración? Propuesta: alias nativo, más aviso fuerte (1.4).
- **ADR.** Cambiar el contrato de datos del telefónico (columnas de reemplazo, `state_rules` vigentes) merece un ADR nuevo, a numerar.

## Orden propuesto

1. Antes del campo de mañana: nada de esto es necesario. El campo corre en los Sheets; alcanza con la validación de datos de Status que pidió el correo a Ulises.
2. Primera tanda, antes de conectar Monitoreo al RMS: 1.1, 1.2, 1.4, 1.5, 2.1–2.3 y 5.1–5.2.
3. Segunda tanda, cuando se empiece a reemplazar: 3.1–3.5, 2.4 y 2.5.
4. Tercera tanda: 3.6, 4.x y 1.3.

## Decisiones aprobadas (2026-10-22)

- **1-A.** «Código proGres» es alias nativo, con aviso fuerte cuando casi nada cruza.
- **2-A.** Status por reglas es opt-in por perfil.
- **3-A.** El reemplazo ocupa el cupo del original (segunda tanda).

## Contrato congelado de la primera tanda (1.1, 1.2, 1.4, 1.5, 2.1–2.3, 5.1–5.2)

Archivos nuevos (la lógica va aquí; `monitoreo_engine.R` y `monitoreo_telefonico.R` están congelados a crecimiento, así que en ellos solo se permiten cambios de llamada que **no suman líneas**):
`api/R/monitoreo_llave_progres.R`, `api/R/monitoreo_status_reglas.R`, `api/R/monitoreo_avisos_telefonico.R`.

**C1 · Llave proGres del barrido (1.1).** Una columna del barrido cuyo nombre o etiqueta normalizada (`.monitoreo_text_key`) contiene `progres` (`Código proGres`, `COD.proGres`, `Cod ProGres`) es llave de código **sin declararla**. Solo como *respaldo*: si la tabla ya tiene una columna de la familia CodPulso/declarada, no se usa (así los proyectos existentes no cambian de cifras). Una columna de teléfono o correo no cuenta aunque contenga `progres`.

**C2 · Llave proGres de las respuestas (1.2).** Misma regla del lado Kobo: nombre **o etiqueta de variable** que contiene `progres` (`intro/Intro01` con etiqueta «Código proGres») y valores plausibles de código (alfanuméricos, 6–14 caracteres tras quitar guiones; `CGU-26-7021494` pasa). Solo como respaldo: si hay una columna declarada (`declared_person_code_var`) o de la familia Pulso_code/CodPulso, esas mandan. El código se normaliza como hoy (`cgu 26 7021494` cruza con `CGU-26-7021494`).

**C3 · Aviso fuerte de cruce (1.4).** Alerta `cruce_llave_bajo` en el reporte telefónico, severidad alta, cuando hay ≥ 5 respuestas de plataforma y cruzan < 50 % con el barrido. Con 0 cruces el mensaje lo dice con esas palabras («ninguna respuesta cruza con el barrido»). Lleva `respuestas`, `cruzan`, `pct`, la columna de llave usada en el barrido y en las respuestas (o «ninguna detectada»). No se emite si cruzan ≥ 50 %.

**C4 · Aviso de filtro sin columna (1.5).** Alerta `filtro_columna_no_encontrada` por cada filtro habilitado (efectividad, prueba) cuya variable declarada no resuelve a ninguna columna de las respuestas. El mensaje nombra la variable declarada y hasta 3 columnas candidatas con la misma hoja (`Intro04` → `group_consent/Intro04`). No se emite si resuelve, ni si el filtro está deshabilitado.

**C5 · Status por reglas, opt-in (2.1, 2.2).** Bandera `monitoreo_profile$status_from_rules` (por defecto `FALSE`). Apagada, nada cambia. Encendida, el estado de las filas del **barrido** sale de `operational_model$state_rules`: se compara el Status normalizado (`.monitoreo_text_key`, `_` como espacio) contra `outcome_values`; `final_state` `complete` → «Completa», `partial` → «Parcial», `refusal` → «Rechazo», `pending` y `non_effective` → «Sin respuesta». La primera regla por `priority` ascendente que casa gana. Un Status sin regla cae en el vocabulario fijo de hoy. Las respuestas de plataforma no cambian. La plomería debe lograr que `.monitoreo_report_states(df, profile)` vea las reglas sin cambiar su firma (por ejemplo, copiándolas al perfil al normalizar la config).

**C6 · Status desconocido (2.3).** Con la bandera encendida, una alerta `status_desconocido` lista cada valor de Status del barrido que no casa con ninguna regla **ni** con el vocabulario fijo, con su conteo («Número Incorrrecto: 6»). Con la bandera apagada no hay alerta (no se agrega ruido a proyectos existentes).

**C7 · No regresión (5.2).** Las cifras de cuotas, resumen y responsables de `api/inst/reference_projects/acnur_pdm` quedan idénticas con todo apagado. La prueba fija el valor *antes* de implementar.

**Prohibido en esta tanda:** tocar frontend, `NAMESPACE`, `DESCRIPTION`, reemplazos/backup (segunda tanda), instalar el paquete con `R CMD INSTALL`, levantar o matar servidores (el 8787 es del usuario), `git add -A`, commitear.


## Resultado de la primera tanda (2026-10-22)

Verificación independiente: **PASS con reservas**.
- 19 de 19 tests del RMS en verde; 8 estaban en rojo antes de implementar y C7 (no regresión de `acnur_pdm`) estaba y sigue en verde.
- Familia telefónica, filtro de efectividad, acreditación, aulas, y contratos transversales sin fallos.
- Extremo a extremo con el RMS sintético: con solo la etiqueta «Código proGres» en Kobo, 179 de 180 respuestas cruzan y las efectivas por periodo salen 43 / 48 / 43 / 41; sin etiqueta, `cruce_llave_bajo` sale en nivel Alta.
- `monitoreo_engine.R`: 5 sustituciones de una línea, 0 líneas netas; `monitoreo_telefonico.R` no se tocó.

Reservas:
1. `test-monitoreo-engine.R` falla en el árbol compartido por el refactor sin commitear de acreditación (otra sesión); limpio y con este trabajo superpuesto da 0 fallos.
2. El engine tiene cambios ajenos sin commitear: este trabajo debe commitearse por archivo y por hunk, sin arrastrarlos.
3. `status_from_rules` y la llave se declaran por JSON o API (sin UI, 1.3 y 4.2 siguen bloqueados). Falta probar guardar y reabrir el `.pulso` con la bandera encendida.
4. Falta 5.3: verificar con un envío real los nombres de columna de Kobo del RMS.

## Principio de diseño (Gonzalo, 2026-10-22): un proyecto no gobierna la plataforma

El RMS es un proyecto en particular. El modo Telefónico atiende proyectos con naturalezas muestrales distintas (PDM Telefónico por sede, Medios de Vida por actor, CBI, RMS por periodo de llegada con backup), así que **nada del RMS se vuelve comportamiento por defecto del modo**. Se trata «con pinzas»:

- **Backup y reemplazos (sección 3) son una capacidad opcional**, declarada por el proyecto en su perfil (por ejemplo, un bloque `reserva` con la columna de origen, las columnas de reemplazo y el umbral de aviso). Sin esa declaración, ni el motor ni la UI muestran reemplazos, ni reservan espacio, ni emiten sus alertas.
- **La dimensión de cuota es genérica** (sede, actor, periodo…), con rótulo declarado por el proyecto; «Periodo» no se escribe a fuego en ningún sitio.
- **La llave y el vocabulario de Status son configuración del proyecto.** La primera tanda ya sigue esto: proGres es solo respaldo, y el Status por reglas es opt-in. Cualquier alias nuevo entra igual: respaldo, nunca pisa lo declarado.
- **Los nombres de columnas del RMS** (`¿Se reemplaza?`, `Reemplaza a`, `Reemplazado por`, `Código proGres`) son ejemplo de configuración de un proyecto, no contrato del modo.
- **Prueba de no regresión obligatoria** para toda capacidad nueva: con ella apagada, las cifras de `acnur_pdm` y de Medios de Vida no cambian (5.2).

Efecto en la segunda tanda: 3.1–3.6 se rediseñan como capacidad declarativa; 3.6 (la vista) solo se pinta si el perfil declara reserva. Esto reemplaza al contrato «propuesto» que se le envió a la sesión del revamp visual.
