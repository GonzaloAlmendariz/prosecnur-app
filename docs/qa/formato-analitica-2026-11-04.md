# Formato en Analítica (4 nov 2026, madrugada)

Quinta tanda del encargo de coordinación (Meta B), pedida al cerrar Hojas de ruta: «si te queda noche, sigue con
Analítica: 51 «·» y la misma receta». Receta de `formato-monitoreo-2026-11-02.md` y
`formato-calculo-graficos-2026-11-02.md`. Alcance: `frontend/src/features/analitica/`, las reglas de Analítica que
vivían en `app/theme.css` y este doc. Decisiones «decididas por coordinación, revisables por Gonzalo».

## Medición (4 nov, 04:30)

| # | Patrón | Antes | Después | Nota |
|---|---|---|---|---|
| P1 | `font-size` en px en hojas | 0 | 0 | Ya por rol desde el 1 nov (`app/letraPorRol`, 196 → 0) |
| P1b | `fontSize` numérico en línea (JSX) | 170 | **0** | El asistente de Dimensiones, `DefinicionGlobal`, `DataReviewPane`: misma regla que las hojas (`p1b.mjs`). Las 4 cifras de 22 px pasan a `kpi` (21) |
| P3 | « · » en código | 33 líneas (51 contando comentarios) | **3** | Los tres LEEN el formato del backend («… · E_CODIGO»): `PaneKit` (¿el estado de guardado es un error?), `CrucesReglaEstudio` (quita el código del mensaje) y `comparativosModel` (`CODIGO_AL_FINAL`). Reglas: lista → coma; desglose por base con comas dentro → punto y coma («2024: 4 preguntas, elegido en 3; 2026: …»); el separador suelto entre el id de sección y su conteo se va (el `gap` ya separa) |
| P4 | `toLocaleString` de cifra | 1 | 0 | «¡Listo! 1,283 filas» por `formatoConteo`. Los 41 `toFixed` son porcentajes, pesos y DEFF de decimales fijos |
| P5 | Vacíos con receta propia | 5 (`analitica-empty` ×2, `analitica-dimensiones-empty`, `analitica-orden-catalogo-empty`, `analitica-panel-empty`) | **0** | Declarada la pantalla de preparación de la Ficha técnica (`analitica-ficha-loading*`). −11 reglas huérfanas en `analitica-v2.css` y `app/theme.css` |
| P6 | Estados con píldora propia | 1 | **0** | «ID común listo / Falta ID común» del Panel base, a `EstadoChip`. Las demás «pill» son descargas y etiquetas |
| P8 | `fontFamily: "monospace"` en línea | 4 | 0 | La pila completa: en Chromium y Electron `monospace` a secas es Courier |
| P2 | `<Panel>` / cajas propias | 14 / 62 | 14 / 62 | Línea base |

Además: el glifo «·» del aviso informativo del importador JSON pasa a «i».

## Guard

`features/analitica/formatoDelModulo.contract.test.ts`, meta 0: P1 en línea, P3 con la foto de los tres lectores, P4,
P5 (declaradas la preparación de la Ficha y el valor de readiness `analitica-vacio`) y P6.

## Vistas (capturas «después» contra la pila de la sesión, `acnur_acg`)

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| | | (se llena con la corrida «después») | |

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición | ☑ | (este doc) | |
| P1b, P3, P4, P5, P6, P8 | ☑ | | |
| P2 | línea base | — | |
| Capturas después | en curso | | Contra la pila de la sesión con `--url`; lo que muestre va en el commit siguiente |
| Gate | ☑ | | `tsc` 0; `make gate-front AREA=analitica` 53 suites, 914 tests |
