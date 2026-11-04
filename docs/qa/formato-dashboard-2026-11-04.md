# Formato en Dashboard (4 nov 2026, noche)

Tercera tanda del encargo de coordinación (Meta B) de la noche del 3 al 4 de noviembre. Receta de
`formato-monitoreo-2026-11-02.md` y `formato-calculo-graficos-2026-11-02.md`. Alcance de escritura:
`frontend/src/features/dashboard/` y este doc. Decisiones «decididas por coordinación, revisables por Gonzalo».

## Lo que NO entra, y por qué

**Dashboard queda fuera de P1 de forma definitiva** (decisión de Gonzalo, 1 nov 2026, escrita en
`app/letraPorRol`): su tema es el del tablero publicado que ve el cliente. Los 208 `font-size` en px de
`theme/tokens.css`, `customize/`, `tabs/*` son la letra del artefacto, no de la app. Por el mismo motivo esta pasada
**no lleva el vacío y la carga al `EstadoVacio` del kit**: el tablero ya tiene los suyos (`shared/EmptyState`, con
tokens `--dash-*`), y meter el material de la app en el tablero publicado lo descompondría. Las recetas sueltas van a
ese `EmptyState` propio.

## Medición (4 nov, 02:20)

| # | Patrón | Antes | Después | Nota |
|---|---|---|---|---|
| P1 | `font-size` en px | 208 | 208 | Fuera de alcance (ver arriba) |
| P3 | « · » en código y hojas | 16 líneas y un separador `<span>·</span>` con su regla | **0** | Cuadrantes del FODA («Score alto, variabilidad baja»), los dos cortes del FODA (el `gap` del contenedor ya los separa), «n=…» del paso de iteración («(n = 1,283)»), leyenda de la matriz de unidades, el selector de token de Publicar, las vistas de Personalizar |
| P4 | `toLocaleString` en cifras / `toFixed(1).replace(/\.0$/)` | 3 / 2 | 0 / 0 | `formatoConteo` en el total de Resumen y en Base de datos; `formatoDecimal(v, 1)` en las marcas del FODA (mismo resultado). Quedan los `toFixed(1)` de decimal fijo (score y DE del FODA: «80.0» se lee distinto de «80») y los porcentajes que van dentro de Plotly |
| P5 | Vacíos y cargas con receta propia | 2 sin declarar | **0** | «Sin indicadores configurados» (Resumen) y «Sin coincidencias» (Paletas) pasan a `shared/EmptyState` |
| P6 | Estados con píldora propia | 0 | 0 | Los «chip» del módulo son etiquetas de dato y conmutadores (cuadrantes FODA, ensamblado del indicador), no estados |
| P2 | Cajas propias | 84 | 84 | Las tarjetas son las del tablero publicado: mismo motivo que P1 |

### Declarados (decididos por coordinación, revisables por Gonzalo)

- `dash-kpi-empty`: la celda «Sin datos» dentro de una tarjeta KPI que conserva su título.
- `dash-dt-empty`: la fila vacía de la tabla de Base de datos.
- `dash-construccion-loading`: «Cargando subcriterios…» sobre un gráfico de sol que ya se ve.
- `dash-customize-logo-empty`: la ranura de logo sin imagen en Personalizar.
- Las esperas en línea bajo el rótulo de un campo de formulario (`dash-cardbox-help`: «Cargando catálogo…»,
  «Cargando secciones…»): son el estado de un campo, como el rótulo ocupado de un botón.
- ~~`dash-palette-list-empty`~~: podada en el commit siguiente junto con su foto en `app/letraPorRol` (78 → 77), con autorización de coordinación.

## Guard

`features/dashboard/formatoDelModulo.contract.test.ts`, meta 0: P3 sin « · » en código ni hojas, P4 sin
`toLocaleString` de cifra (salvo la fecha completa del `title` de la última actualización), P5 sin recetas propias
fuera de las declaradas. Con el caso que prueba que cada detector reconoce lo que prohíbe.

## Vistas (capturas «después», `acnur_pdm` con la curaduría confirmada, 1440×1000 y 1024×600)

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| | | (se llena con la corrida «después») | |

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición | ☑ | (este doc) | |
| P3, P4, P5 | ☑ | | |
| P1, P2, P6 | fuera de alcance / sin casos | — | |
| Capturas después | en curso | | Se commitea antes de la captura (pedido de coordinación); lo que muestre va en el commit siguiente |
| Gate | ☑ | | `tsc` 0; `make gate-front AREA=dashboard` 29 suites, 701 tests |
