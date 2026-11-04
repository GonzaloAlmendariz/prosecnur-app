# Formato en Hojas de ruta (4 nov 2026, noche)

Cuarta tanda del encargo de coordinación (Meta B) de la noche del 3 al 4 de noviembre. Receta de
`formato-monitoreo-2026-11-02.md` y `formato-calculo-graficos-2026-11-02.md`. Alcance de escritura:
`frontend/src/features/hojasRuta/` y este doc. Decisiones «decididas por coordinación, revisables por Gonzalo».

P3 ya estaba hecho (9e07233ef, 3 nov: 84 líneas, guard `puntoMedio.contract` en meta 0).

## Medición (4 nov, 02:40)

| # | Patrón | Antes | Después | Nota |
|---|---|---|---|---|
| P1 | `font-size` en px | 174 en 10 hojas (`mapaPage.css` 123, `atlas.css` 16) | **2** | La cifra héroe del resultado de Muestra (30 px; 24 px bajo 1280), declarada: el rol `kpi` (21) la achicaría. Hojas de ruta no estaba en `app/letraPorRol`; el guard es del módulo |
| P4 | `toLocaleString("es-PE", …)` de cifra | 38 | **0** | `formatoDecimal(x, d)` donde había `maximumFractionDigits: d` (mismo resultado) y `formatoConteo` en los conteos. Quedan los decimales FIJOS (`minimumFractionDigits`: «±3.0 %», «DEFF 1.5 en uso») y las fechas |
| P4 | Coma decimal escrita a mano | 3 | **0** | Los botones de DEFF («1,5») y el ICC («ICC 0,05 → 1,2») en Muestra cosían `.replace(".", ",")`: es-PE usa punto (`feedback_es_pe_usa_punto_decimal`) |
| P5 | Vacíos y cargas con receta propia | 10 (`hr-mapa-vacio` 6, `hr-atlas-vacio` 2, `hr-bitacora-vacio` 2) y 3 esperas a mano | **0** | El vacío de la lista de distritos del mapa mezclaba error, vacío y carga en una línea: ahora son `ErrorBlock`, `EstadoVacio` y `LoadingBlock` |
| P6 | Estados con píldora propia | 2 | **0** | El estado de la ruta en el inspector de Selección y la columna Revisión de la evidencia, a `EstadoChip` (error → peligro, aviso → aviso, ok → éxito) |
| P2 | Cajas propias / `h2–h4` | 30 / 45 | 29 / 45 | Línea base: el lienzo del mapa con sus inspectores es un banco de trabajo propio (ADR del lienzo, fase 3) |

## Guard

`features/hojasRuta/formatoDelModulo.contract.test.ts`, meta 0: P1 (salvo la cifra héroe), P4 (cifra a mano y coma
decimal), P5, P6, con el caso que prueba cada detector.

## Vistas (capturas «después», `acnur_acg`, 1440×1000 y 1024×600)

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| | | (se llena con la corrida «después») | |

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición | ☑ | (este doc) | |
| P1, P4, P5, P6 | ☑ | | |
| P2 | línea base | — | |
| Capturas después | en curso | | Se commitea antes de la captura (pedido de coordinación); lo que muestre va en el commit siguiente |
| Gate | ☑ | | `tsc` 0; `make gate-front AREA=hojasRuta` 68 suites, 874 tests |
