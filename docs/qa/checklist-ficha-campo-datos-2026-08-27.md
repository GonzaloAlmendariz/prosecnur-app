# Checklist — la ficha de campo sale con sus datos (2026-08-27)

Pedido de Gonzalo: **la ficha de campo (`ficha_campo_qr_a4_v1`) es el estándar y
hay que replicarla**, pero le preocupa que *pabellón y aula*, *curso*, *horario
del curso* y *docente* salgan en blanco «cuando toda esa información se tiene».

Tenía razón: se tenía, y moría en tres eslabones distintos. Sólo Gonzalo lo da
por terminado.

## Contexto medido

Proyecto: `HSTVG2026/HSVG26ULT.pulso` (guardado 2026-08-26).
Plan sembrado: **1.512 unidades** = 174 titulares + 1.259 reservas de cadena +
79 del pool extra. El lote completo se generó y verificó: ZIP de 53,5 MB con
1.512 PDF en 605 s, repartidos `Fichas/<FACULTAD>/<Titulares|Reemplazos|Adicionales>/`.

Referencia de diseño: el Sheet **«Recopiladores - Hostigamiento PUCP 2025»**
(hoja `Muestra - Full Data`, 1.098 filas, 26 columnas) que alimentaba
`docs/Generador_fichasQR.ipynb`.

## La tabla

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | **Facultad** llena en la ficha | Dato OK: `unit.faculty`, 0 vacíos en 1.512. Faltaba el `binding` | **hecho** |
| 2 | **Pabellón y aula** lleno | El catálogo lo dice dentro de `SESIONES` («MIE 17:00-20:00 C  A506»), pero `.cm_aulas_enrich_with_catalog()` sólo propagaba `teacher`/`teacher_email`. Parser nuevo en `calc_muestra_aulas_sesiones.R` + enganche + columna en el `aula_frame` + `public_cols` + `binding`. Cobertura: **1.447 de 1.512 (95,7 %)**; el resto son cursos sin aula asignada, que caen a su raya | **hecho** |
| 3 | **Curso** lleno | Dato OK: `unit.course_name`, 0 vacíos. Faltaba el `binding` | **hecho** |
| 4 | **Horario del curso** lleno | Se imprime el **día y la hora** («LUN 10:00-13:00»), no el código de sección («0591»), porque es lo que promete el rótulo. Sale de `SESIONES`; `.collection_legacy_unit()` prefiere `horario_sesiones` y deja `schedule` de respaldo. Cobertura: **1.512 de 1.512** | **hecho** |
| 5 | **Docente** lleno | El lookup pedía `"Nombre de docente"`, que por el `reverse_hit` de `.cm_aulas_col()` resolvía a la columna `DOCENTE` — el **código**. Medido: 1.473 de 1.512 salían «00008764» donde va «AGAPITO RUIZ, RUBEN ANGEL». Alias pegados antepuestos + `binding`. Cobertura: **1.512 de 1.512** | **hecho** |
| 14 | **Un valor largo no deforma la hoja** | El renderer dibujaba el valor donde acababa la etiqueta sin medir. Medido en el libro: horario hasta 141 caracteres y curso hasta 128, contra p99 de 51 y 65. `.cfc_recortar()` recorta con elipsis y avisa `form_value_no_room` | **hecho** |
| 17 | **La columna nueva no puede llamarse como un alias ajeno** | `pabellon_aula` —el nombre del Sheet 2025— fue capturada por el alias `aula` de `classroom_label`, que es lo que titula la ficha: las 1.512 pasaron a llamarse `CH 1 - A501.pdf` en vez de `CH 1 - MAT202_0591.pdf`. Renombradas a `venue` y `sesiones_dia_hora`, con prueba que sella que ningún otro rol las captura | **hecho** |
| 16 | **Rehacer el marco NO cambia el sorteo** | El `.pulso` guardado tiene el marco viejo, así que hay que rehacerlo para que los datos entren. Medido rehaciendo marco (4,7 min) y sorteo (0,4 min) con el código nuevo sobre una **copia**: **los 174 titulares son idénticos**, 0 perdidos, 0 nuevos, y las 1.512 unidades se conservan. La cobertura de `teacher` sigue en 1.512 de 1.512 tras pasar de código a nombre | **hecho** |

## Cola — decisiones y pendientes

| # | Hallazgo | Estado |
|---|---|---|
| 6 | **`returnUrl` camelCase y codificado**, que es lo del formulario de 2026. Se cambió a `return_url` literal siguiendo el enlace de 2025 y Gonzalo lo corrigió el mismo día con el enlace real del estudio. Un parámetro de retorno que el servidor no reconoce falla callado: el formulario abre y la respuesta entra igual | **hecho** |
| 7 | **Ruta XPath completa `d[/asset_uid/collectorID]`**, la del formulario de 2026. El nombre pelado (2025) sigue disponible por `prefill_field` en Accesos, con su propia prueba | **hecho** |
| 8 | **Viaja el curso-horario** (`mat202_0591`), no el slug `unit-aulas-ch-1-50200d1467`. Cierra la L2, abierta desde 2026-08-16. Además es la clave con la que `.monitoreo_aulas_contar_por_fila()` empareja primero, así que no obliga a reimprimir ni migrar lo ya recogido | **hecho** |
| 9 | **Acortador: no se implementa.** Sería una llamada de red externa (`is.gd`) que una app local-first no debe hacer sola. Medido con el enlace de 2026: 165 chars → QR 59×59, que escanea sin problema en A4 | resuelto sin código |
| 18 | **Fichas de prueba desde la UI.** `PRUEBA_2026`, `CAPACITACION`, `prueba_interna`: una hoja suelta con el **mismo enlace** del operativo y otro colector. Clona el `access_ref` y el nombre del prefill de una unidad real —el `target` guardado no conserva la URL base, la poda `.collection_deployment_normalize()`—. Motor en `collection_material_prueba.R`, ruta `POST /api/recopiladores/materials/prueba`, control en `FichaPruebaControl.tsx` | **hecho** |
| 21 | **Histórico de fichas de prueba.** Quedan registradas en `collection_state$pruebas`, lista **hermana** de `plan` — nunca dentro de `plan$units`, que es lo que movería el conteo y el handoff. Se guarda el enlace **tal como se generó** (una hoja impresa lleva el QR que llevaba) más el `deployment_fingerprint`, que permite marcar «de un despliegue anterior». Un mismo código se actualiza en su sitio, no se duplica. Del PDF se guarda el enlace, no el archivo: un binario en el estado lo prohíbe `.cc_security_problems` y regenerarlo es determinista. `GET /api/recopiladores/materials/pruebas` + `FichasPruebaHistorico.tsx` | **hecho** |
| 19 | **El título lleva los dos códigos**: «CH 1 MAT202_0591». Con guion bajo, la forma estándar: así coincide letra por letra con el nombre del PDF y con el identificador del QR, en vez de haber dos escrituras del mismo código en la hoja | **hecho** |
| 20 | **El margen de la hoja.** De 239 px sobre el QR (13,6 % del alto) a 54, contra 44 abajo; hueco QR–título de 144 a 47 px; renglones de 30–38 px a 49–57. Observaciones pasó a **dos líneas**, declaradas con `lines = 2` en el campo y no con una fila sin etiqueta, que el contrato de plantilla prohíbe | **hecho** |
| 11 | **Escuela: NO va en la ficha de 2026.** Decisión de Gonzalo (2026-08-28): «es mejor dejarlo en facultad», y el aula es la que dice dónde hay que ir. El defecto de datos sigue ahí —`mapping$program` se resuelve contra la base y pesca `ALUMNO`, 1.512 de 1.512 sólo dígitos— pero **no se toca**, porque ninguna superficie de este estudio lo imprime. Queda anotado por si otro preset lo saca | **cerrado sin cambio** |
| 12 | **Correo del docente: NO hace falta en la ficha.** Decisión de Gonzalo (2026-08-28). El alias quedó reparado junto con el ítem 5, así que el dato **ya llega** en 1.512 de 1.512 y está disponible para quien lo necesite; simplemente no se imprime | **cerrado sin cambio** |
| 22 | **Horarios partidos legibles.** El `<br />` ya se normalizaba, pero la hora se repetía por día: «MIE 11:00-13:00 · VIE 11:00-13:00». `.cm_aulas_agrupar_horario()` agrupa los días que comparten franja y los ordena por semana: «MIE y VIE 11:00-13:00», «LUN, MIE y VIE 08:00-10:00». Medido sobre las 1.512: **310 cambian**, el largo máximo baja de **87 a 63** caracteres y la media de 21,5 a 19. Las 977 de una sola sesión no cambian. Un horario en texto libre se deja como vino | **hecho** |
| 23 | **La UI de Recopiladores se ve peor que otros módulos**, en particular los botones del toolbar superior. Pedido de Gonzalo (2026-08-28) | pendiente |
| 24 | **Poder crear la ficha de prueba desde la app** para testear que los enlaces salen bien. El endpoint existe en el backend vivo; falta verlo funcionar de punta a punta en la ventana de Gonzalo | en curso |
| 13 | **`replacement_for` tenía DOS defectos, no uno.** (a) Los **174 titulares** se reemplazaban a sí mismos: su campo viene vacío y el fallback caía en `titular_operational_code`, que para un titular es su propio código. (b) Las **1.259 reservas** apuntaban con el `classroom_id` del titular («mat202_0591»), no con su código operativo: medido, **0 de 1.259** enlazaban con el `legacy_ref` de ninguna unidad — el mismo hallazgo que ya tenían anotado `monitoreo_aulas_en_juego.R` y `PlanSection.tsx`, cada uno parcheándolo por su lado. `.collection_replacement_for()` antepone `titular_operational_code` con guarda de autorreferencia y arregla los dos: titulares **174 → 0**, reservas que enlazan **0 → 1.259 de 1.259**. La ficha pasa de «Reemplazo 1 de mat202_0591» a «Reemplazo 1 de CH 1» | **hecho** |

## El enlace que sale ahora

```
https://ee-eu.kobotoolbox.org/single/ccIcHAqm?d%5B/aNNuP72AedZ886EoAUeV5o/collectorID%5D=mat202_0591&returnUrl=https%3A%2F%2Fpulso.pucp.edu.pe%2Fnoticias%2Fenlace
```

Es la forma del **formulario de 2026**, que Gonzalo confirmó: ruta XPath completa
y `returnUrl` camelCase codificado. Lo único de 2025 que se conservó es el
identificador: viaja el **curso-horario**, no el slug.

**Hubo un rodeo que conviene no repetir.** El Sheet de 2025 usa campo pelado y
`return_url` literal; con «lo que funcionó el año pasado hay que seguirlo aquí»
se cambió el motor a esa forma, y al día siguiente el enlace real de 2026 la
desmintió. La lección no es que el enlace de 2025 fuera falso —recogió 1.098
aulas— sino que **el formato lo fija el formulario que se va a usar**, y eso se
comprueba pidiendo el enlace, no razonando desde el operativo anterior.

Sigue pendiente la prueba de campo: escanear un QR del lote y ver que la
respuesta llega con su `collectorID` y que redirige. Para eso está el ítem 18.

## El QR necesita internet

`/single/` es «Online-Only (single submission)» en la nomenclatura de Kobo: no
cachea el formulario. El modo offline-capable es `/x/` («Online-Offline»), y aun
ése exige haber abierto el enlace **antes** con conexión, cosa que no ocurre si
el estudiante escanea ya dentro del aula. Que el operativo de 2025 funcionara es
evidencia de que hubo cobertura, no de que el enlace fuera offline.

Comprobación de un minuto y sin código: móvil en modo avión, escanear el QR.

## Lo que NO hay que volver a investigar

- El plan de Recopiladores **se siembra solo** al abrir el `.pulso`
  (`collection_state_migrate_legacy()` dentro de `load_pulso`). El `.pulso` no
  guarda `collection_state` todavía en este proyecto.
- `.cm_aulas_text_key()` **conserva los guiones bajos**: `correo_pucp_docente` NO
  casa con `CORREOPUCPDOCENTE`. Y `.cm_aulas_col()` tiene un `reverse_hit` que
  acepta que el nombre de la columna esté **contenido en el candidato**, así que
  un alias largo puede resolver a una columna corta y equivocada. Las dos cosas
  juntas son las que hacían ganar al código sobre el nombre.
- `.cm_aulas_fill_from_lookup()` **sólo rellena donde está vacío**: un alias
  nuevo no pisa un dato que ya venía. Hay que mirar el orden de candidatos.
- `label` del `aula_frame` **es igual a `classroom_id` en las 5.269 aulas**, y es
  lo que titula la ficha y nombra el PDF. Meter `SESIONES` ahí cambiaría las dos
  cosas: por eso el aula viaja en `pabellon_aula`, columna propia.
- La semilla del sorteo es `selector$seed` (un entero de config), **no el
  `frame_hash`**. Pero `teacher` pasa de código a nombre, y
  `.cm_aulas_docente_unico_reparar()` deduplica por docente: por ahí sí puede
  moverse el sorteo. Es lo que mide el ítem 16.
- La cobertura del deployment sale **1.512 de 1.512 sin acceso faltante**, y las
  1.512 URLs son únicas. El transporte no es el problema.

## Verificación

- `test-calc-muestra-aulas-sesiones.R` — nuevo, verde.
- 21 suites (`collection*` + sesiones + docente-contacto + catálogo) — **sin fallos**.
- `pnpm -C frontend exec tsc --noEmit` — exit 0.
- `vitest run src/features/recopiladores` — **28 archivos, 205 tests, verde**.
- 83 suites de `calc-muestra-aulas` — un solo rojo,
  `test-calc-muestra-aulas-tipo-curso-mapeo.R:80`, **preexistente**: se reprodujo
  idéntico con el `calc_muestra_aulas.R` de HEAD. Es el mismo `reverse_hit` de
  `.cm_aulas_col()` de esta tanda, pero por otro lado: el candidato `tipo_curso`
  de `session_type` captura una columna llamada `curso`. No se toca aquí.
- `node agentic/sync-agentic-os.mjs --audit` y `--check` — OK;
  `calc_muestra_aulas.R` en 4.692 líneas, 13 por debajo de su línea base.
- El `.pulso` de Gonzalo **no se tocó**: todo corrió sobre una copia en el
  scratchpad. Hash y fecha del original sin cambios (26 ago 09:33).
