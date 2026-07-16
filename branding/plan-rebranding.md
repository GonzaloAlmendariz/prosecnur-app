# Plan de rebranding — Prosecnur sobre el contrato v1.2

Fecha: 2026-07-16 · Fuente: tres auditorías de brechas (chrome por módulo,
componentes/KPIs, motion/voz) contra `direccion-creativa.md` v1.2.
Principio rector: **sin romper lo que funciona** — unidades quirúrgicas, cada
una con typecheck + tests + QA visual con proyecto real + gate `verificador`
antes de su commit. Máximo dos writers por oleada, globs disjuntos.

## Estado de partida (lo que ya cumple)

- Monitoreo es el ejemplar completo (command bar 3 zonas, pillbar embebido,
  sr-only, acento por reasignación). Calc-muestra casi entero; hojas-ruta,
  bitácora y analítica cumplen rail+acento; TODOS los módulos salvo
  recopiladores usan `headerMode="sr-only"`; los sidebars de 3er nivel ya
  siguen el patrón resuelto (ninguno queda en overlay).
- Ya aterrizado en commits previos: isotipo canónico + firma de arranque,
  instalador, segmented con gradiente maestro, sidebar QR a grid-push,
  outliers cromáticos.

## Oleada R1 — Pulido inmediato (S, riesgo ~nulo)

| # | Unidad | Evidencia | Notas |
|---|---|---|---|
| R1.1 | Focus rings `:focus-visible` en controles custom de hojas-ruta (`mode-switch:1999`, `map-layer-toggle:454`) y muestreo carga/validación | A2§5 | Ratio actual hojas-ruta 5/43 |
| R1.2 | `ProjectLifecycleDialog.tsx:36` → `toLocaleDateString("es-PE")` | A3§6 | Única fuga real de locale |
| R1.3 | Purgar easings contra-contrato: `cubic-bezier(.4,0,.2,1)` ×5, `(.22,1,.36,1)` ×4, `--dash-ease-press`, 2 springs → tokens | A3§2 | Find/replace acotado |
| R1.4 | `E_UNSUPPORTED_EXT` con doble mensaje (inglés `router_carga.R:308` vs español `:473`) → uno solo en español | A3§5 | + testthat afectado |
| R1.5 | Duraciones >420ms accidentales: `indicador-assembly.css:44` (720ms), `dimensiones.css:373/379` (480/520) | A3§1 | Firmas 620/680 quedan (amparadas) |
| R1.6 | Voz: «Aceptar» → «Aceptar sugerencia» (`IntegratedInstrumentsWizard.tsx:1115`); «Sí/No» de PonderacionPane con etiqueta de acción | A3§4 | |

## Oleada R2 — Impacto visual alto (M, riesgo bajo)

| # | Unidad | Evidencia | Notas de riesgo |
|---|---|---|---|
| R2.1 | **KPIs a 21/900 tabular** (~25 reglas: territorial 30/26/25/24/22, telefónico 28/25/24/22, hojas-ruta 32/24/22, calc-muestra 26/23/22, rec 24, home 27/22) | A2§1 | Solo font-size/weight; QA visual por módulo. Excepción propuesta: hero del Home ≤28px (homepage, no workbench) — decide el usuario en el freeze |
| R2.2 | **Switches unificados** sobre `.pulso-switch` 44×24 (8 caseros: carga, motor, gv2, validación, mon ×3, dash) | A2§2 | Patrón a replicar: `analitica-switch-row` |
| R2.3 | **Contrato de error**: `client.ts:95` mueve el código al final (`mensaje · E_*` en mono) + `States.tsx` heading «qué pasó + cómo seguir» | A3§5 | Los `message.includes("E_X")` de features siguen funcionando (el código permanece en el string) — verificar los 3 parseos ad-hoc |
| R2.4 | **Acento processing en carga/validación/codificación**: reasignar `--pulso-primary` (paridad `analitica-v2.css:34`) + limpiar fallback `#be123c` de carga | A1§4 | QA visual: el navy del contenido pasa a teal en chrome |
| R2.5 | **Editor-xlsform**: inyectar `--pulso-module-editor` en el scope del workbench frame | A1§3 | El chrome del editor gana su violeta; QA cuidadoso (superficie grande) |

## Oleada R3 — Convergencia de chrome (M-L)

| # | Unidad | Evidencia |
|---|---|---|
| R3.1 | Recopiladores: H1 visible → sr-only, kicker/detalle plegados al `rec-topbar` | A1§1 |
| R3.2 | Recopiladores: `rec-section-rail` → `pulso-phase-pillbar` | A1§5 |
| R3.3 | Bitácora: `command-row` pelado → command bar material 3 zonas | A1 |
| R3.4 | Hojas-ruta: rail embebido en su command bar (hoy fila aparte) | A1 |
| R3.5 | Calc-muestra: banda de comando material (hoy transparente) + decidir push vs icon-only+tooltip (el contrato declara push como maestro; la capa ≥921px lo revierte) — decide el usuario | A1 |
| R3.6 | Gráficos: acentos de rol `--layout-accent` hex → tokens `--pulso-*` conservando la semántica de procedencia | A1§2 |

## Oleada R4 — Fondo estructural (L, por lotes con QA)

| # | Unidad | Evidencia |
|---|---|---|
| R4.1 | Tokens de motion en features: `--cmv2-ease-*`/`--dash-ease-*` → alias de `--motion-*` (patrón `--gv2-press-ease`); literales near-map (150→fast, 200-250→base, 300-340→panel) | A3§1-2 |
| R4.2 | Hex semántico/navy/slate → tokens en `monitoreo.css` (~1064) y `editor-v2.css` (~985), por lotes 1:1 mecánicos con QA visual por perfil | A2§6 |
| R4.3 | Iconografía: alias nuevos (Database, FileText, Download, RotateCcw, FileSpreadsheet, Info, Upload, Filter, Save, Eye) + migración gradual de imports crudos a alias | A2§4 |
| R4.4 | Dashboard: convergencia de chrome (rail propio, capa `--dash-*`) — requiere decisión de diseño (es superficie de entregable) | A1 |

## No-hacer (por ahora)

- KpiCard del dashboard (medio-donut Plotly con paleta arcoíris) — es superficie
  de entregable publicado; cambiar su paleta a la secuencial navy requiere
  decisión de producto con clientes en mente.
- Reescritura masiva de mensajes de error del backend R — se corrige el
  contrato de presentación (R2.3) y los casos puntuales (R1.4); el barrido
  total de `stop_api` es programa aparte.

## Gates

Cada unidad termina en `verificador`; cada oleada cierra con QA visual con
proyecto real (`/ver-ui`, deep-link) del módulo tocado y commit atómico. El
Artifact del manual se republica cuando una unidad cambie normas (no píxeles).
