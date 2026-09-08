# Checklist — loop indefinido de mejora estética y técnica: app de aulas y Sheets del operativo

**Fecha de apertura:** 2026-09-07, 16:40 · **Pedido de Gonzalo (textual):** «genera el
/loop indefinido para mejorar a nivel estético y técnico de la app y el sheets».
**Cómo ver lo que el loop aplica:** en el panel del navegador de Claude, la pestaña
`http://localhost:51547` (frontend del loop contra el backend 8837 con la copia
`HSVG26ULT2_loop.pulso`); la app de siempre (8787) no muestra nada del loop hasta
que se compile y relance.
**Objeto real:** copia de trabajo `HSVG26ULT2_loop.pulso` (scratchpad de la sesión
`83ff848b`) sobre un backend propio en `:8837`. **Nada hacia afuera**: el loop no
publica al Sheets del operativo ni al de distribución; lee en solo lectura.
Fuente de los ítems: `docs/qa/traspaso-operativo-aulas-2026-09-07.md` §5 y §7.
Sólo Gonzalo cierra el loop.

## Vara (lo que decide si una etapa pasa)

1. **Sheets y Excel**: dictado de Gonzalo del 2026-09-01, textual: «tiene una
   estructura muy, muy fea; no se ven bien las tablas, no se organiza bien, no se
   entiende cómo se organiza; se ve como toda esa información, no como una tabla».
   Pasa si cada bloque se lee como tabla en el xlsx y en el Sheets: banda a lo
   ancho de SU tabla, cabecera fija, anchos que no cortan, notas que no se
   derraman. Se comprueba con las requests que salen del motor (test que las pinea)
   y con el xlsx abierto con `openxlsx`, nunca leyendo código y opinando.
2. **App**: Contrato de Superficie C1–C5 (`/contrato-superficie`), «una definición
   por pregunta» y «ningún aviso se queda en el hecho: cada aviso dice causa y
   salida». Verde por conformidad, no por ausencia.
3. **Técnica**: cada etapa cierra con rojo primero (test que falla por el defecto),
   suites del área tocada en verde, `tsc` en cero y sin efectos hacia afuera.

## Tablero

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| S1 | «Avance de campo» en Sheets: congelar las filas de título, anchos de columna por contenido y cifras alineadas a la derecha | `api/R/monitoreo_aulas_avance_formato.R` (`.maaf_requests`, `.maaf_anchos_px`, `.maaf_columnas_cifra`) · test `test-monitoreo-aulas-formato-avance.R` | ☑ `6ecb1f82` — medido antes: freeze ya existía (2 filas + col. A), ancho único 150 px, 0 alineaciones; ahora ancho por columna 90–320 px, cifras/fechas/horas a la derecha, cabeceras con WRAP; rojo 6 → verde 44; con el libro real (70×12) la marca ISO de la columna B apagaba el bloque de meta y quedó cubierta |
| S2 | Notas largas fusionadas a lo ancho del bloque, con ajuste de texto y alto de fila, en xlsx y Sheets («Avance de campo» y «Base de control») | xlsx: `.cai_nota()` en `carga_aulas_libro_indicadores.R` (seis notas) · Sheets: `.maaf_nota_requests()` en `monitoreo_aulas_avance_formato.R` · tests en los dos archivos de Avance | ☑ `a0026989` — rojo 12 + 9 → verde 40 + 58; gate 18 suites, 922 aserciones; Base de control no escribe notas en columna A (medido), nada que fusionar ahí |
| S3 | La banda «Avance contra la meta» del xlsx cubre el ancho de su tabla | `carga_aulas_libro_indicadores.R` (`.cai_ancho_hoja`; seis bandas de sección) · test `test-carga-aulas-libro-avance-xlsx.R` | ☑ `4d75b392` — medido: meta y procedencia iban a 2 de 12 columnas, aplicadores a 7, diario a 4; ahora todas cubren la tabla más ancha; rojo 8 → verde 23 |
| S4 | «Efectivas declaradas» sin parte sale «—», no vacía | Sheets: `.cala_tabla_filas()` (`carga_aulas_libro_avance.R`) · xlsx: `.cai_rayas()` (`carga_aulas_libro_indicadores.R`) | ☑ `367a24ba` — 19 de 24 aplicadores sin parte tenían el hueco; el modelo sigue NA, la presentación escribe «—»; las cifras siguen siendo números en el xlsx (test de tipo de celda); gate 20 suites, 985 aserciones |
| S5 | «Avance diario» con fila de cierre (totales) en xlsx y Sheets | `.cali_cierre_diario()` (`carga_aulas_libro_cierre_diario.R`, nuevo) consumido por el xlsx y el renderer; banda «Total» en `.maaf_requests` | ☑ `516ed52f` — sólo con ≥ 2 días; suma del día, último acumulado y último faltante; rojo 11 → verde; gate 12 suites, 607 PASS |
| S6 | Base de control legible en el día a día: filtro en cabecera y columnas agrupadas por tramo (pestañas por tramo exige whitelist) | `monitoreo_aulas_sheets_formato.R` · `monitoreo_sheets_pestanas.R` | ☐ pregunta Q3 |
| S7 | La app recuerda el Sheets de distribución (`distribucion_sheets {spreadsheet_id, updated_at}`) y avisa «reparto cambiado desde la última publicación», con causa y salida | backend: huella + `distribucion_sheets` en la whitelist + `reparto.distribucion` en el tablero (`monitoreo_aulas_publicar_distribucion.R`, `monitoreo_aulas_cache.R`, router) · front: bloque «Sheets de los aplicadores» en Asignación (`distribucionDeAplicadores.ts`, `AulasAsignacionDeAplicadores.tsx`) | ☑ `f658edc4` — nunca/al día/cambiado/indeterminado con causa y salida; publicar recuerda el enlace; R 377 PASS, front 2556 PASS, tsc 0. Pendiente de ver en vivo tras relanzar el 8837 |
| S8 | Alerta cuando el parte y la plataforma difieren mucho (34 declaradas vs 72 en plataforma) | `avisoParteContraPlataforma.ts` (nuevo; lejos = ≥ 5 encuestas y ≥ 20 %) montado en `AulasParteContraPlataforma.tsx` | ☑ `f2832d89` — con el estado real nombra CH 76, CH 72 y CH 108 con sus dos cuentas, causa por lado y salida; rojo 6 → verde 36; tsc 0; perfil 2567 PASS (4 FAIL ajenos) |
| A1 | El recibo de publicación muestra `lectura_previa` («se recogieron 7 partes del equipo») | `fraseDeLecturaPrevia()` en `avisoLibroPublicado.ts` · tipo `MonitoreoAulasLecturaPrevia` en `api/monitoreo.ts` | ☑ `e40f1a0f` — «Antes de escribir se leyó lo del equipo: 7 partes de campo y 9 filas de control.»; si falló, causa y salida en tono de atención; rojo 3 → verde 12; tsc 0; perfil 2527 PASS (4 FAIL ajenos) |
| A2 | La tarjeta de respuestas dice lo mismo que el embudo (273 recibidas · 37 fuera · 212 efectivas) | regla única en `mermaDeRespuestas.ts` (nuevo); la leen `kpisDeAulas.ts` (`respuestasKpi`) y `embudoDelOperativo.ts` | ☑ `cd2bda71` — pista «37 fuera del operativo · 24 no pasan el criterio · 212 efectivas»; sin filas «Ninguna» con causa; rojo 3 → verde; tsc 0; perfil 2533 PASS (4 FAIL ajenos) |
| A3 | Aviso «ALUMNOS EN AULA sólo la sabe el parte»: qué se apaga y dónde se llena | `avisoAsistenciaSinParte.ts` (nuevo) montado en `AulasControlDelLibro.tsx` con los partes de la sesión (`AulasSeccionCalidad.tsx`) | ☑ `518640d2` — «2 cursos-horario aplicados sin parte de campo (CH 7, CH 55): … Se llenan en Registro de campo…» + «6 ya tienen parte … la próxima publicación las escribe»; verificado en vivo; contador de vocabulario 13 → 12 |
| A4 | Fundir `avance_cuota` y `.calaf_avance_por_facultad` en UNA definición con dos consumidores | `monitoreo_aulas_avance_cuota.R:231` · `carga_aulas_libro_avance_facultad.R:41` · consumidores `carga_aulas_libro_indicadores.R:227`, `monitoreo_aulas_universitarias.R:1637/1743` | ☑ `c9c2c2b9` — medido: hoy coinciden (212 / 2.288); la divergencia latente era la brecha (celdas de sexo vs neto); `monitoreo_aulas_brecha_facultad()` es la única regla; paridad tablero↔libro con test; gate 13 suites, 640 PASS |
| A5 | Declarar desde Fuentes el criterio de validez: `valid_filters`, `sex_var`, valores de sexo y `descartes` (verificar primero `AulasMonitoreoPage.tsx:1276-1320`, que ya toca `valid_filters`) | `AulasSeccionFuentes.tsx` · `AulasFuentesDelEstudio.tsx` · `criterioDelEstudio.ts` · `api/monitoreo.ts:808` | ☑ `32357ee9` — medido: la variable de sexo y los filtros ya tenían UI; faltaban los valores por sexo y los descartes. `AulasSexoYDescartes.tsx` bajo el selector de sexo, con sugerencias de descarte (colector sin curso-horario); guarda en `source_mapping`; verificado en vivo |
| A6 | Warm start de Avance (~40 s con el estudio real): medir, mostrar progreso, atacar el cuello | `monitoreo_perf` en el state · vista Avance | ☐ SIGUIENTE |
| A7 | `operational_status` nunca llega a «aplicada» desde el libro: retirar del vocabulario o ADR | vocabulario del plan · `docs/adrs/` | ☐ pregunta Q4 |
| A8 | Diez campos `solo_lectura` (`efectivas_pct_esperado`, `elegibles_esperados`, `short_*`, `long_*`, `threshold_*`, `valid_*`) | contrato del libro | ⛔ bloqueado: se retiran cuando no circulen libros 2025 (decisión de Gonzalo) |
| A9 | Cuatro tests rojos preexistentes del perfil (textos de `AulasSeccionCalidad.tsx`, ≥3 Plotly, cola de contacto) | otra sesión los tiene (`task_93fb976e`; worktree `xenodochial-montalcini` trabaja `<PlotlyChart`) | ⛔ no tocar; sólo registrar el conteo del gate |
| S9 | Las cifras de «Avance de campo» viajan como texto (RAW admite JSON numérico): publicarlas como número con `numberFormat` de porcentaje, sin romper la equivalencia xlsx↔Sheets ni el hash de pestaña | `.malp_df_a_values` (`monitoreo_aulas_publicar_libro.R:162`) · `.malp_canonizar` · `test-carga-aulas-libro-avance-sheets.R` | ☐ |
| S10 | El bloque «De dónde salió este libro» del xlsx: banda a lo ancho de su tabla y la marca `2026-09-07T20:41:36Z` en hora local legible | `carga_aulas_libro_indicadores.R` (`.cai_marca_local`) · pin de `test-carga-aulas-libro-procedencia.R` actualizado con el contrato viejo al lado | ☑ `4d75b392` — «2026-09-07T20:41:36Z» → «07/09/2026 15:41» en el huso del equipo que genera |
| S11 | Sin partes, el xlsx OMITE «Producción por aplicador» (guard de `aulas_libro_escribir_indicadores`) mientras el Sheets la declara vacía: una definición por pregunta pide que las dos hojas digan lo mismo | `carga_aulas_libro_indicadores.R` ~468 · `aulas_libro_hoja_avance` | ☑ `4aaec813` — `.cali_motivo_sin_aplicadores()` compartido; el xlsx escribe título, banda y nota; rojo 4 → verde 157; gate 12 suites, 623 PASS |
| S12 | Mismo trato en toda la hoja del xlsx: rejilla en la tabla de aplicadores, separador de miles y alineación en la procedencia (visto en el render real del 07/09) | `carga_aulas_libro_indicadores.R` (estilos `rejilla` y `derecha`) | ☑ `d666602d` — rojo 5 → verde 62; gate 11 suites, 547 PASS; verificado en render real |
| S14a | Lector y generador con «CANTIDAD DE ENCUESTAS APLICADAS» (dictado 07/09: «se cambió el encabezado de efectivas a CANTIDAD DE ENCUESTAS APLICADAS porque las efectivas las da la app, no el aplicador; el aplicador ve temas de lo que ve en aulas nomás»). El Sheets vivo lleva el título nuevo en TITULAR y el viejo en los REEMPLAZO | `carga_aulas_aplicadas.R` (alias por bloque) · `carga_aulas_libro_generar.R` (escribe el nuevo) · `test-carga-aulas-aplicadas-encuestas-aplicadas.R` | ☑ `79fabc56` — lee los dos títulos bloque a bloque, escribe el nuevo; gate 58 suites, 2288 PASS |
| S14b | La app deja de llamar «efectivas» al conteo del parte: ficha («Cantidad de efectivas»), Registro de campo (campo «efectivas»), tabla de Avance («Efectivas declaradas» en xlsx y Sheets), cuadre parte vs plataforma | ficha, Registro de campo, embudo del curso-horario, Consultas y la columna del Avance («Encuestas aplicadas (parte)») | ☑ `5624aeb6` — clave interna y cuadre intactos; pins con el contrato viejo citado; R 522 PASS, front 77/77, tsc 0 |
| A11 | La Base de control de la app toma del parte lo que la fila leída no trae (ALUMNOS EN AULA y derivadas), como ya hace el publicador; hoy 6 de 9 filas van con NA aunque el parte existe | `monitoreo_aulas_control_desde_parte.R` (nuevo), aplicado antes de `monitoreo_aulas_control_publicado()` en `monitoreo_aulas_universitarias.R` | ☑ `63bfc1ee` — llena lo vacío con el parte (asistentes, asistencia, no respondieron), nunca pisa lo tecleado; rojo 4 → verde 15; gate 29 suites, 1228 PASS. Pendiente de VER en vivo: exige relanzar el 8837 (reinstala el paquete) |
| A10 | Hora local con las nocturnas de HOY: CH 13 18:30, CH 148 19:00, CH 74 19:30, CH 9 19:45 deben caer en el 07/09 | `monitoreo_aulas_hora_local.R` · lectura pura de Kobo (`a10_kobo_nocturnas.R`, scratchpad `87ed0566`) | ☑ medido 07/09 ~22:00 (GET puro a Kobo EU): 54 respuestas desde las 17:00; CH 13 = 18 (18:28–18:31, UTC aún 07/09), CH 148 = 18 (19:03–19:08) y CH 9 = 11 (19:49–19:51) con `_submission_time` ya en 08/09 pero `start` en 07/09; **30 filas** cruzan la medianoche UTC y ninguna trae `start` vacío, así que la regla de hora local las deja en el lunes. CH 74 (19:30, L312) trajo **0 respuestas**: no se aplicó o entró por otro QR. Falta ver el tablero cuando Gonzalo sincronice: el avance diario del lunes debe sumar esas 47 |

## Preguntas a Gonzalo (y qué hacer con cada respuesta)

- **Q1 Distribución del martes**: ¿republicar el reparto vigente tal cual, o fijar las
  cuatro citas del martes como ya se publicaron y republicar sólo con CH 51 añadida?
  El loop NO publica en ningún caso; si dice «publica tú», se corre el `curl` del
  addendum §7.2 sobre el backend 8836 (el del operativo), una vez.
- **Q2 Sheets de pruebas**: ¿autoriza un spreadsheet propio de pruebas en su Drive
  («PRUEBAS loop estética»)? Sí → S1, S2, S5 y S6 se verifican en vivo publicando
  desde el backend 8837 con la copia loop a ESE id. No → se verifican con tests de
  requests y con el xlsx.
- **Q3 (S6)**: filtro y grupos de columnas en la misma pestaña, o pestañas por tramo.
  Sin respuesta se hace lo primero (no exige whitelist).
- **Q4 (A7)**: retirar `operational_status` o documentarlo en un ADR. Sin respuesta,
  ADR corto que lo declara derivado y en desuso, sin tocar código.

## Lo aprendido que no hay que reinvestigar

- En Sheets, la banda de «Avance de campo» YA cubre todas las columnas
  (`.maaf_banda(sheet_id, i, n_cols, …)`); el corte a la mitad es del **xlsx**
  (`cols = 1:2`). S3 es sólo xlsx.
- «Base de control» y «Plan del día» sí congelan cabecera y primera columna en Sheets
  (`monitoreo_aulas_sheets_formato_requests`, ~196). Lo que no lo tiene es «Avance
  de campo» (`.maaf_requests`): sólo bandas.
- El Sheets de distribución hoy tiene una sola pestaña, «Plan del día»; el pendiente
  manual de borrar la vieja está cerrado.
- El diff distribución vigente ↔ Sheets vive en `distribucion_diff.R` (scratchpad
  `83ff848b`): 85 citas contra 83 publicadas, 20 cambios de persona.

## Trampas medidas durante el loop

- **Lanzar un backend reinstala el paquete.** `launcher/launch.R` (~82–107) compara
  el mtime de la fuente con el instalado y corre `install.packages` al arrancar si
  la fuente es más nueva: el 8837 lo hizo a las 16:50 con tres backends sirviendo.
  Relanzar tras cada cambio en R repite ese install; los motores se verifican con
  `load_all` + testthat y el 8837 se relanza lo menos posible.
- `POST /api/monitoreo/aulas/generar-libro` responde `{file_id, filename}` y deja el
  archivo en `tempdir()/prosecnur/<sid>/downloads/<uuid>_<filename>` del proceso R
  (`/var/folders/.../T/Rtmp*/prosecnur/<sid>/downloads/`); el uuid del nombre no es
  el `file_id`. Se descarga por `GET /api/files/<file_id>/download`.
