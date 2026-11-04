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
| P2 | Cajas propias | 84 | 84 | 4 nov, mañana (revisable por Gonzalo): los grupos de ajustes del editor de personalización (`SettingBlock`: Logos, Color principal, Resumen, Barras, Radar, Variables, Conductores, Por categoría, Layout) son `Panel`, porque el editor es chrome de la app. El tablero publicado y los gates de curaduría y fuente (`dash-cardbox`, dentro del lienzo y con su tema) se quedan. El editor se abre con `?panel=personalizar` (antes un `useState`); fuente, paletas y publicar siguen sin dirección. Ratchet `cajasPropias.contract.test.ts` (el conteo no baja: la caja de `SettingBlock` repartía borde y relleno en dos reglas y el detector no la veía). Captura con `acnur_acg` a 1440 y 1024: `ok=true` |

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

Primera corrida (`cap/dash-despues`): se quedó en «Fuente del dashboard» (la curaduría pide dos pasos). Segunda,
contra la pila de la sesión con `--sembrar "Cargar fuente" --sembrar "Confirmar y construir dashboard"`
(`cap/dash-2`): Resumen con sus donas a 1440 y 1024. Dimensiones aterriza en Resumen porque `acnur_pdm` no tiene
dimensiones construidas (esperado).

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| 1 | Resumen › Perfil de la muestra | `rotulosPartidos=4`: falso positivo, el título del KPI lleva un `<br>` (`wrapTitle`) y el runner lee «llegaral» | se queda |
| 2 | Resumen › Perfil de la muestra | «…Espacio de Protección de ${sede_ppl} ?» y etiquetas bilingües («Hasta 15 minutos Up to 15 minutes») | dato del XLSForm de `acnur_pdm`, no de la UI |
| 3 | Resumen de sección | «Cargando...» con tres puntos dentro de un recuadro punteado | ☐ lo pinta `shared/EmptyState` con `title="Cargando…"`; candidato a una espera del tablero con su propia marca |

## Estado

| Paso | Estado | Commit | Nota |
|---|---|---|---|
| Medición | ☑ | (este doc) | |
| P3, P4, P5 | ☑ | | |
| P1, P2, P6 | fuera de alcance / sin casos | — | |
| Capturas después | ☑ | | Ver «Vistas» |
| Gate | ☑ | | `tsc` 0; `make gate-front AREA=dashboard` 29 suites, 701 tests |

## Overlays direccionables y alcance a 1024 (4 nov, tarde; decidido por coordinación, revisable por Gonzalo)

Paletas, Publicar y Fuente («Datos») se abren con `?panel=paletas`, `?panel=publicar` y `?panel=fuente` (bb59b66ce,
f94f84aba, 53a3cbf73). `DashboardRuta` lee la dirección y pasa el control como prop; `DashboardPage` usa
`usePanelConRespaldo` (estado propio en la publicación, que monta la página fuera del Router). Fuente es `inspector`:
reemplaza el tablero en la página. Abrir Publicar por dirección no publica.

| # | Vista | Qué se ve | Estado |
|---|---|---|---|
| 4 | Fuente («Datos») a 1024 | `scroll-jail`: más alta que el marco del editor, su pie quedaba fuera de alcance | ☑ desplaza dentro del marco (53a3cbf73) |
| 5 | Curaduría (fase inicial) a 1440 y 1024 | Sin hallazgos: su lista ya es dueña de su scroll | ☑ medida |
| 6 | Base de datos a 1024, con todas las variables | La cabecera fija (nombres y filtros) tapaba 17 px de una fila al desplazar; el botón del libro de códigos se salía 3 px | ☑ `useAltoDeCabecera` y encaje de filas (el patrón de la grilla de bases); el botón sin relleno heredado |
| 7 | Base de datos, 52 columnas | Columnas a la derecha tras desplazar en horizontal (`alcanzable`) | no es defecto |
| 8 | Resumen, Relaciones y el editor de personalización a 1024 y 1440 | Sin hallazgos C4 | ☑ |
| 9 | Dimensiones | La pestaña está bloqueada en la copia («Dimensiones pendientes») y la dirección cae en Resumen | ☐ sin medir: pide un estudio con dimensiones configuradas |

**La curaduría no se hace direccionable.** No es un panel que se abra: es la fase inicial que el tablero muestra sola
mientras la curaduría no está confirmada, y una vez confirmada sus variables se ajustan en «Personalizar variables»,
dentro de la Fuente (`?panel=fuente`). Un `?panel=curaduria` sería una segunda entrada a lo mismo (regla de no
duplicar navegación).

Capturas con `--url` contra la pila de la sesión sobre una copia de `acnur_pdm` con la fuente del dashboard cargada por
la API (XLSForm y data del PDM de su sesión) y, para el recorrido de pestañas, la curaduría confirmada.
