# Prompt — validación visual sobre proyectos de referencia

Prompt reutilizable para abrir una sesión nueva que valide la UI de Prosecnur
contra los estudios reales anonimizados (ADR 0043) en vez de la semilla
sintética. Copiar desde la línea siguiente.

---

Valida la UI de Prosecnur contra los **proyectos de referencia**: cuatro
estudios reales anonimizados y versionados en el repo (ADR 0043
`docs/adrs/0043-proyectos-de-referencia-reales-anonimizados.md`). Carga el skill
`/ver-ui` antes de empezar.

## Por qué estos y no la semilla sintética

La semilla de `api/inst/audit_reference/` solo contiene los casos que alguien
pensó en construir. Los estudios reales traen lo que nadie diseña a propósito:
bases de 450 columnas, etiquetas de instrumento larguísimas, un repeat group de
667 filas, nombres de columna duplicados. Ahí es donde el layout se rompe de
verdad — tablas que desbordan, etiquetas que parten mal, scroll jails que con
tres filas no aparecen.

## Los cuatro proyectos

Ruta: `api/inst/reference_projects/<slug>/<slug>.pulso`

| slug | módulos | rutas que tiene sentido revisar con él |
|---|---|---|
| `acnur_acg` | 9 | `/carga` `/validacion` `/codificacion` `/analitica` `/graficos` `/hojas-ruta` `/monitoreo` |
| `acnur_pdm` | 7 | `/carga` (repeat groups) `/validacion` `/graficos` `/tablero` `/monitoreo` |
| `acrconta` | 7 | `/monitoreo` (multiactor, 4 actores, 13 fuentes) `/analitica` `/bitacora` |
| `hsvg2026` | 2 | `/calc-muestra` (29 mil estudiantes, 5.263 cursos-horario) `/editor-xlsform` |

Combinaciones ya verificadas el 2026-07-24, útiles como punto de partida:

| comando | qué se ve |
|---|---|
| `acrconta` → `/monitoreo --click-tab "Avance"` | 13/13 fuentes, 1.277 registros, 4 actores |
| `acnur_acg` → `/analitica --click-tab "Frecuencias"` | datos listos, base codificada, 8 secciones, 26 variables |
| `hsvg2026` → `/calc-muestra` | 29.090 estudiantes, 5.263 cursos-horario, 136.284 filas del marco |

Usa `/calc-muestra` a secas: con un query param que la mesa no reconoce, la app
cae al homepage del proyecto en vez de abrir la mesa.

Ningún proyecto cubre todo: `acnur_acg` es el único que llega a analítica con
datos reales, `hsvg2026` el único con marco de aulas a escala. Para una pasada
completa hacen falta varios. `make reference-project-verify` lista cuáles están
instalados y cuántos módulos puebla cada uno de verdad.

Son **read-only** (`0444`) a propósito y así están bien para revisar: la app los
abre sin problema y el permiso impide que un autosave los pise. Solo si
necesitas *modificar* el proyecto, saca una copia escribible:

```bash
Rscript api/scripts/reference_project_prepare_run.R --project acnur_acg
```

## La trampa: warm start

**Es el único error que vas a cometer si no lo sabes.** Estos proyectos cargan
datos de verdad, así que el warm start tarda de verdad, y una captura temprana
muestra una vista que parece rota sin estarlo. Medido el 2026-07-24 sobre
`acrconta` en `/monitoreo`:

| | captura temprana | tras el warm start |
|---|---|---|
| Fuentes | `0/0` | `13/13` |
| Registros | `0` | `1.277` |
| Sync | `Pendiente` | `Listo` |

Antes de reportar una vista como vacía o sin datos, confirma que el header del
módulo dejó de decir `Pendiente`/`Preparando` y que los contadores dejaron de
ser cero. Si ves una pantalla con un anillo de porcentaje, sigues en warm start.

## Cómo capturar

Camino corto, headless y reproducible:

```bash
node scripts/ui-quick-check.mjs \
  --project "api/inst/reference_projects/acnur_acg/acnur_acg.pulso" \
  --route /analitica --viewport 1440x900 --click-tab "<sección>"
```

`--click-tab` fuerza el asentamiento posterior al warm start y es la forma más
barata de obtener una captura ya cargada. Sin él, la primera captura suele caer
durante la carga.

Matriz completa de rutas y viewports contra un proyecto:

```bash
make reference-project-visual-matrix REFERENCE_PROJECT=acnur_acg
```

Para mirar e interactuar tú mismo, usa `/ver-ui` con el deep-link
`?pulso=<ruta absoluta>` y sondea hasta que la vista cargue; no uses sleeps
ciegos.

## Qué revisar

Sigue `docs/ui-layout-grammar.md` y el skill global `prosecnur-design-system`:

- **Scroll owner y No Scroll Jail** en cada ruta, con datos reales que sí llenan
  la vista.
- **Jerarquía de navegación**: Familia/Módulo → Sección (top bar) → Pestaña.
  Nunca una segunda barra de pasos duplicando el rail.
- **Paleta del módulo**: cada módulo tiene su acento; no debe contaminarse con
  el de otro. Solo tokens `--pulso-*`, sin hex en CSS de features.
- **Viewports**: para layout/shell recorre 1710x1107, 1440x1000, 1366x768,
  1280x720 y 1024x600. Para un cambio localizado basta el viewport afectado y un
  extremo opuesto.
- **Etiquetas largas**: es lo que estos proyectos aportan y la semilla no. Mira
  específicamente cómo se comportan los enunciados de instrumento en tablas,
  chips, headers de columna y tooltips.
- Consola, requests fallidos y `data-audit-ready` donde exista.

## Higiene de servers (obligatoria)

- Antes de levantar nada: `preview_list`. Si ya hay un frontend en esta sesión,
  reúsalo. Si el puerto **8787** responde, es el backend del usuario: reúsalo y
  **nunca lo mates**.
- Al terminar: cierra lo que tú levantaste. `make dev-status` lista servers dev
  con edad y conexiones; `make dev-prune` mata huérfanos y stale sin tocar el
  8787.

## Cómo reportar

Veredicto `APROBADO VISUAL`, `APROBADO CON PENDIENTES` o `RECHAZADO VISUAL`, y
por cada hallazgo: ruta, proyecto de referencia usado, viewport, screenshot y
severidad. Di explícitamente con qué slug validaste cada ruta — un hallazgo sin
esa referencia no es reproducible.

No edites producto ni fixtures: esto es revisión, no implementación. Si algo
exige cambio de código, repórtalo y deja que lo tome el implementador.
