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
| S1 | «Avance de campo» en Sheets: congelar las filas de título, anchos de columna por contenido y cifras alineadas a la derecha | `api/R/monitoreo_aulas_avance_formato.R` (`.maaf_requests` ~104 sólo emite bandas) · test `test-monitoreo-aulas-formato-avance.R` | ☐ SIGUIENTE |
| S2 | Notas largas fusionadas a lo ancho del bloque, con ajuste de texto y alto de fila, en xlsx y Sheets («Avance de campo» y «Base de control») | xlsx: `carga_aulas_libro_indicadores.R` (~438, ~492) · Sheets: `.maaf_alto_fila` + `mergeCells` | ☐ |
| S3 | La banda «Avance contra la meta» del xlsx cubre el ancho de su tabla | `carga_aulas_libro_indicadores.R:320` (`cols = 1:2`) | ☐ |
| S4 | «Efectivas declaradas» sin parte sale «—», no vacía | `carga_base_control.R` | ☐ |
| S5 | «Avance diario» con fila de cierre (totales) en xlsx y Sheets | `carga_aulas_libro_indicadores.R` · `.maaf_requests` | ☐ |
| S6 | Base de control legible en el día a día: filtro en cabecera y columnas agrupadas por tramo (pestañas por tramo exige whitelist) | `monitoreo_aulas_sheets_formato.R` · `monitoreo_sheets_pestanas.R` | ☐ pregunta Q3 |
| S7 | La app recuerda el Sheets de distribución (`distribucion_sheets {spreadsheet_id, updated_at}`) y avisa «reparto cambiado desde la última publicación», con causa y salida | whitelist `monitoreo_aulas_universitarias.R` ~549 · `router_monitoreo.R` ~4934 · front Asignación | ☐ |
| S8 | Alerta cuando el parte y la plataforma difieren mucho (34 declaradas vs 72 en plataforma) | `frontend/.../aulas/parteContraPlataforma.ts` · Base de control | ☐ |
| A1 | El recibo de publicación muestra `lectura_previa` («se recogieron 7 partes del equipo») | `frontend/src/features/monitoreo/profiles/aulas/avisoLibroPublicado.ts` · `frontend/src/api/monitoreo.ts` | ☐ |
| A2 | La tarjeta de respuestas dice lo mismo que el embudo (273 recibidas · 37 fuera · 212 efectivas) | `kpisDeAulas.ts` · `embudoDelOperativo.ts` · `aulasPresentation.ts` | ☐ |
| A3 | Aviso «ALUMNOS EN AULA sólo la sabe el parte»: qué se apaga y dónde se llena | Base de control + Registro de campo (app) | ☐ |
| A4 | Fundir `avance_cuota` y `.calaf_avance_por_facultad` en UNA definición con dos consumidores | `monitoreo_aulas_avance_cuota.R:231` · `carga_aulas_libro_avance_facultad.R:41` · consumidores `carga_aulas_libro_indicadores.R:227`, `monitoreo_aulas_universitarias.R:1637/1743` | ☐ |
| A5 | Declarar desde Fuentes el criterio de validez: `valid_filters`, `sex_var`, valores de sexo y `descartes` (verificar primero `AulasMonitoreoPage.tsx:1276-1320`, que ya toca `valid_filters`) | `AulasSeccionFuentes.tsx` · `AulasFuentesDelEstudio.tsx` · `criterioDelEstudio.ts` · `api/monitoreo.ts:808` | ☐ |
| A6 | Warm start de Avance (~40 s con el estudio real): medir, mostrar progreso, atacar el cuello | `monitoreo_perf` en el state · vista Avance | ☐ |
| A7 | `operational_status` nunca llega a «aplicada» desde el libro: retirar del vocabulario o ADR | vocabulario del plan · `docs/adrs/` | ☐ pregunta Q4 |
| A8 | Diez campos `solo_lectura` (`efectivas_pct_esperado`, `elegibles_esperados`, `short_*`, `long_*`, `threshold_*`, `valid_*`) | contrato del libro | ⛔ bloqueado: se retiran cuando no circulen libros 2025 (decisión de Gonzalo) |
| A9 | Cuatro tests rojos preexistentes del perfil (textos de `AulasSeccionCalidad.tsx`, ≥3 Plotly, cola de contacto) | otra sesión los tiene (`task_93fb976e`; worktree `xenodochial-montalcini` trabaja `<PlotlyChart`) | ⛔ no tocar; sólo registrar el conteo del gate |
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
