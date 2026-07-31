# Prompt — validación visual sobre proyectos de referencia

Tipo: Prompt operativo QA
Estado: Vigente
Fecha: 2026-07-30
Autoridad: Guía reutilizable de validación; no constituye evidencia de una ejecución

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

| proyecto y destino | qué se ve |
|---|---|
| `acrconta` → Monitoreo / Avance, mediante `--ir` | 13/13 fuentes, 1.277 registros, 4 actores |
| `acnur_acg` → Analítica / Frecuencias, mediante `--ir` | datos listos, base codificada, 8 secciones, 26 variables |
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
  --route /monitoreo --viewport 1440x900 \
  --ir monitoreo/territorial/avance
```

`--ir` usa la dirección canónica y permite comprobar ruta solicitada, ruta real
y pestaña activa. `--click-tab` queda como fallback frágil: depende del texto
visible, que puede cambiar, truncarse o no existir todavía durante el warm
start. Ninguno de los dos reemplaza el gate de readiness descrito arriba; una
captura temprana con contadores en cero debe repetirse. Con `--ir`, el runner
mantiene la espera mientras la marca todavía no existe y aborta si la dirección
no alcanza readiness final; no se acepta el shell global como sustituto.

Cuando el objetivo incluya cajas pares, repetidos o secciones apiladas, activa
el comprobador geométrico sobre los grupos concretos. `equal` exige marcos con
una diferencia máxima de 2 px y permite capacidad vacía dentro; `intrinsic`
rechaza capacidad sin dueño dentro de secciones que deben abrazar su contenido:

```bash
node scripts/ui-quick-check.mjs \
  --project "api/inst/reference_projects/acnur_acg/acnur_acg.pulso" \
  --route /monitoreo --viewport 1440x1000 \
  --ir monitoreo/territorial/avance/resumen \
  --geometry-group "equal::.selector-del-grupo-par" \
  --geometry-group "intrinsic::.selector-de-secciones-independientes" \
  --require-geometry --fail-on-issues
```

El reporte expone `geometryAudits` con marco, cardinalidad, `contentBottom`,
`unusedInteriorBottom`, `exteriorGapBottom` y dueño de overflow. También puede
descubrir grupos anotados con `data-qa-geometry-group`; una corrida requerida
sin grupos medidos falla como cobertura ausente. El chrome de Monitoreo anota
automáticamente sus filas como `monitoring-workbench-rows`: cabecera y claridad
son intrínsecas, mientras la superficie de contenido declara su capacidad como
propia. Así, un track implícito o inflado se reporta como `capacity-drift` aunque
no produzca overflow.

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
- **Geometría de pares y repetidos**: identifica bloques comparables y cards de
  la misma variante. Sus marcos deben conservar alto/ancho coherentes aunque
  tengan distinta cantidad de información. Mide marco y contenido por separado.
- **Vacío interior frente a hueco exterior**: es correcto que quede capacidad
  sin usar dentro de una caja estable; rechaza huecos sin contenedor ni dueño
  entre superficies, y cajas cuyo alto crece directamente con cada ítem.
- **Cardinalidad**: repite vacío, pocos y muchos elementos. La caja exterior
  permanece estable; el exceso se resuelve con el scroll, paginación o detalle
  previsto y debe seguir siendo alcanzable.
- **Visibilidad real**: al buscar el último elemento alcanzable, excluye
  descendientes de `details:not([open])`, `[hidden]`, `display:none` y
  `visibility:hidden`. En un detalle cerrado solo se mide el `summary`; abre el
  cuerpo deliberadamente si esa divulgación pertenece al flujo auditado.
- **Scroll anidado**: identifica toda la cadena de dueños. Desplaza primero el
  exterior para traer la región al viewport y después el interior hasta su
  máximo; comparar la última hoja con el viewport sin mover sus ancestros
  produce falsos positivos de clipping.
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
severidad. Para geometría, incluye el grupo/variante, altos medidos, diferencia
máxima y si el blanco está dentro o fuera del contenedor. Di explícitamente con
qué slug validaste cada ruta — un hallazgo sin esa referencia no es
reproducible.

No edites producto ni fixtures: esto es revisión, no implementación. Si algo
exige cambio de código, repórtalo y deja que lo tome el implementador.
