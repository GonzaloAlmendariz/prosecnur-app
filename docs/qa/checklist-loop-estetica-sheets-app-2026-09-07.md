# Checklist — loop indefinido de mejora estética y técnica: app de aulas y Sheets del operativo

**Fecha de apertura:** 2026-09-07, 16:40 · **Pedido de Gonzalo (textual):** «genera el
/loop indefinido para mejorar a nivel estético y técnico de la app y el sheets».
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
| S5 | «Avance diario» con fila de cierre (totales) en xlsx y Sheets | `carga_aulas_libro_indicadores.R` · `.maaf_requests` | ☐ |
| S6 | Base de control legible en el día a día: filtro en cabecera y columnas agrupadas por tramo (pestañas por tramo exige whitelist) | `monitoreo_aulas_sheets_formato.R` · `monitoreo_sheets_pestanas.R` | ☐ pregunta Q3 |
| S7 | La app recuerda el Sheets de distribución (`distribucion_sheets {spreadsheet_id, updated_at}`) y avisa «reparto cambiado desde la última publicación», con causa y salida | whitelist `monitoreo_aulas_universitarias.R` ~549 · `router_monitoreo.R` ~4934 · front Asignación | ☐ |
| S8 | Alerta cuando el parte y la plataforma difieren mucho (34 declaradas vs 72 en plataforma) | `frontend/.../aulas/parteContraPlataforma.ts` · Base de control | ☐ |
| A1 | El recibo de publicación muestra `lectura_previa` («se recogieron 7 partes del equipo») | `fraseDeLecturaPrevia()` en `avisoLibroPublicado.ts` · tipo `MonitoreoAulasLecturaPrevia` en `api/monitoreo.ts` | ☑ `e40f1a0f` — «Antes de escribir se leyó lo del equipo: 7 partes de campo y 9 filas de control.»; si falló, causa y salida en tono de atención; rojo 3 → verde 12; tsc 0; perfil 2527 PASS (4 FAIL ajenos) |
| A2 | La tarjeta de respuestas dice lo mismo que el embudo (273 recibidas · 37 fuera · 212 efectivas) | tarjeta en `kpisDeAulas.ts:504` (`kpis.respuestas_total`); embudo en `embudoDelOperativo.ts` (`respuestas_fuera_del_operativo`, misma clave); backend `monitoreo_aulas_universitarias.R:2351` | ☐ SIGUIENTE |
| A3 | Aviso «ALUMNOS EN AULA sólo la sabe el parte»: qué se apaga y dónde se llena | Base de control + Registro de campo (app) | ☐ |
| A4 | Fundir `avance_cuota` y `.calaf_avance_por_facultad` en UNA definición con dos consumidores | `monitoreo_aulas_avance_cuota.R:231` · `carga_aulas_libro_avance_facultad.R:41` · consumidores `carga_aulas_libro_indicadores.R:227`, `monitoreo_aulas_universitarias.R:1637/1743` | ☐ |
| A5 | Declarar desde Fuentes el criterio de validez: `valid_filters`, `sex_var`, valores de sexo y `descartes` (verificar primero `AulasMonitoreoPage.tsx:1276-1320`, que ya toca `valid_filters`) | `AulasSeccionFuentes.tsx` · `AulasFuentesDelEstudio.tsx` · `criterioDelEstudio.ts` · `api/monitoreo.ts:808` | ☐ |
| A6 | Warm start de Avance (~40 s con el estudio real): medir, mostrar progreso, atacar el cuello | `monitoreo_perf` en el state · vista Avance | ☐ |
| A7 | `operational_status` nunca llega a «aplicada» desde el libro: retirar del vocabulario o ADR | vocabulario del plan · `docs/adrs/` | ☐ pregunta Q4 |
| A8 | Diez campos `solo_lectura` (`efectivas_pct_esperado`, `elegibles_esperados`, `short_*`, `long_*`, `threshold_*`, `valid_*`) | contrato del libro | ⛔ bloqueado: se retiran cuando no circulen libros 2025 (decisión de Gonzalo) |
| A9 | Cuatro tests rojos preexistentes del perfil (textos de `AulasSeccionCalidad.tsx`, ≥3 Plotly, cola de contacto) | otra sesión los tiene (`task_93fb976e`; worktree `xenodochial-montalcini` trabaja `<PlotlyChart`) | ⛔ no tocar; sólo registrar el conteo del gate |
| S9 | Las cifras de «Avance de campo» viajan como texto (RAW admite JSON numérico): publicarlas como número con `numberFormat` de porcentaje, sin romper la equivalencia xlsx↔Sheets ni el hash de pestaña | `.malp_df_a_values` (`monitoreo_aulas_publicar_libro.R:162`) · `.malp_canonizar` · `test-carga-aulas-libro-avance-sheets.R` | ☐ |
| S10 | El bloque «De dónde salió este libro» del xlsx: banda a lo ancho de su tabla y la marca `2026-09-07T20:41:36Z` en hora local legible | `carga_aulas_libro_indicadores.R` (`.cai_marca_local`) · pin de `test-carga-aulas-libro-procedencia.R` actualizado con el contrato viejo al lado | ☑ `4d75b392` — «2026-09-07T20:41:36Z» → «07/09/2026 15:41» en el huso del equipo que genera |
| S11 | Sin partes, el xlsx OMITE «Producción por aplicador» (guard de `aulas_libro_escribir_indicadores`) mientras el Sheets la declara vacía: una definición por pregunta pide que las dos hojas digan lo mismo | `carga_aulas_libro_indicadores.R` ~468 · `aulas_libro_hoja_avance` | ☐ |
| A10 | Hora local con las nocturnas de HOY: CH 13 18:30, CH 148 19:00, CH 74 19:30, CH 9 19:45 deben caer en el 07/09 | `monitoreo_aulas_hora_local.R` · lectura pura de Kobo (`.kobo_api_fetch_json`) | ☐ mañana temprano |

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
