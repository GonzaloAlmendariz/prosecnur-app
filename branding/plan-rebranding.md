# Plan de rebranding — Prosecnur sobre el contrato v1.2

Actualizado: 2026-07-16 · Fuente: tres auditorías de brechas contra
`direccion-creativa.md` v1.2 (chrome por módulo, componentes/KPIs, motion/voz).
**Este documento es autosuficiente: cualquier agente puede continuar el
programa leyendo solo esta página y las referencias que cita.**

## Protocolo de ejecución (handoff — léelo antes de tocar nada)

1. **Fuentes de verdad**: `branding/direccion-creativa.md` (normas) ·
   `branding/identity.json` (manifiesto frozen; NO cambiar status/decisiones) ·
   tokens `--pulso-*` de `frontend/src/app/theme.css` (valores operativos).
   El método completo de oleadas vive en
   `~/.claude/skills/orchestrate-app-identity/references/production-playbook.md`
   y las recetas de chrome en
   `~/.claude/skills/build-branded-react-app/references/master-patterns.md`.
2. **Grano**: una unidad = un commit atómico `feat(rebranding): …` en español,
   citando su verificación en el mensaje. Máximo 2 escritores por oleada con
   archivos SIN solape (si dos unidades comparten archivo → fusionar o
   serializar).
3. **Gate innegociable por unidad**: `pnpm --dir frontend typecheck` +
   `pnpm --dir frontend test` ejecutados de verdad (salida literal); testthat
   focalizado si se tocó `api/R/`; greps de confirmación del cambio; QA visual
   en runtime con proyecto real vía deep-link
   (`/<ruta>?pulso=<abs>/api/inst/audit_reference/prosecnur_audit_reference.pulso`
   en el Vite de dev — skill `/ver-ui`). Trampas del navegador embebido:
   playbook §D (animaciones infinitas cuelgan el scroll de automatización;
   capturas tras scroll JS salen en blanco; getComputedStyle puede leer stale
   bajo `:has(:focus-within)` — la captura con estado sostenido es la verdad).
4. **Reglas duras de código**: solo tokens (cero hex nuevo en features);
   acento de módulo por reasignación de variable en el scope; semántico ≠
   acento; TS estricto; archivos congelados
   (`MonitoreoPage.tsx`, `monitoreo_engine.R`, `router_monitoreo.R`,
   `reporte_plan_ppt.R`) no crecen.
5. **Si una norma cambia** (no píxeles): actualizar `direccion-creativa.md`,
   reensamblar el manual y republicar el Artifact EN LA MISMA URL con etiqueta
   de versión, y sincronizar `manual-identidad.html`.
6. **Decisiones humanas**: lo marcado «decide el usuario» NO se ejecuta sin
   respuesta explícita; se registra como decisión en `identity.json`
   (recomputando el hash con el método de sus `extensions`).

## Estado: COMPLETADO ✓

| Oleada | Commit | Contenido |
|---|---|---|
| R1 — pulido | `ac5756c` | Focus rings hojas-ruta, locale es-PE, purga de easings contra-contrato, duraciones >420ms accidentales, voz de botones, `E_UNSUPPORTED_EXT` es-PE + freeze del identity.json |
| R2-a | `f4b6469` | ~30 KPIs a 21/900+tabular (hero Home 28px, excepción aprobada) + contrato de error `mensaje · E_CODE` (ApiError; 4 parsers protegidos) |
| R2-b | `76830c7` | 8 switches al maestro 44×24 + acento teal en carga/validación/codificación + acento violeta del editor (antídoto AA 5.21:1) |
| R3-a | `62aac4e` | Recopiladores: H1→sr-only + rail al pillbar canónico · calc-muestra: push restaurado · gráficos: roles tokenizados 1:1 |
| R3-b | `13f9eb2` | Bitácora: command bar material ámbar · hojas-ruta: dos bandas fundidas en una (rail embebido) |
| R4.5 + compile | `0ba1a6e` | Token `--pulso-switch-track` (8 réplicas→maestro) + `branding/identity/` compilado determinista + validador persistido |

Gate integral del programa (verificador independiente, 2026-07-16):
**APTO CON OBSERVACIONES**, observaciones saldadas en `13f9eb2`/`0ba1a6e`.
Convergencia de chrome completa en todos los módulos salvo dashboard.

## Corrección de dirección en curso (2026-07-16, tarde)

**dec-sidebar-icon-tooltip** (supersede a dec-calc-sidebar-push): el 3er nivel
es SIEMPRE comprimido + burbuja flotante en hover/focus (incluida la activa,
cuyo tooltip estaba asesinado por regla en theme.css ~45692) + título compacto
de la pestaña activa al inicio del workbench. En ejecución: fix del bug de la
activa + universalización en processing (theme.css), restauración de la capa
tooltip de calc-muestra (desde 62aac4e^) y conversión de Recopiladores
push→burbuja. La dirección v1.2 (patrón 3) ya está reescrita; falta el demo
del manual (componentes 07.3) y el patrón 3 del skill master-patterns.md.

## Cola: PENDIENTE (por orden recomendado)

| # | Unidad | Detalle y evidencia | Esfuerzo |
|---|---|---|---|
| P1 | **R4.1 Motion tokens en features** | `--cmv2-ease-*` (ui.css:11, copia exacta, 95 usos) y `--dash-ease-*` (theme/tokens.css, 143 usos) → aliasar a `var(--motion-ease-*)` (patrón `--gv2-press-ease`); literales `ms` near-map en calcMuestra/dashboard (150→fast, 200-250→base, 300-340→panel); los 81 `cubic-bezier(.23,1,.32,1)` inline → token. Exentos: crecimientos de barras 350-500ms (carve-out documentado en aulas.css:604) y loops ambientales | L |
| P2 | **R4.2 Hex→tokens por lotes** | ~1064 hex en `monitoreo.css` + ~985 en `editor-v2.css` (mayoría semántico/slate/navy con token 1:1: `#64748b`→text-soft, `#168a55`→success…, escala navy suelta→tokens). Lotes mecánicos SOLO 1:1 + QA visual por perfil tras cada lote. NO tocar: paleta violeta de procedencia, SVG de dominio, sets "apagados" deliberados de editor-v2 (~10790) | L |
| P3 | **R4.3 Alias de iconos** | Añadir a `src/lib/icons.ts`: Database(37 archivos), FileText(27), Download(27), RotateCcw(27), FileSpreadsheet(26), Info(23), Upload(16), Filter(14), Save(14), Eye(14); migración gradual de imports crudos a alias (290 archivos importan crudo vs 35 por alias) | S-M |
| P4 | **R3.5b Banda material de calc-muestra** | `.cmv2-commandbar` es transparente (border:0/background:transparent, calcMuestra.css:98-103); darle el material canónico de mon-commandbar | S |
| P5 | **Voz: barrido E_UNSUPPORTED_EXT** | Mensajes divergentes restantes: `router_validacion.R:396` (inglés), `router_analitica.R:188`, `router_codificacion.R:75/2154/2179` (listas de extensiones distintas — evaluar códigos propios para el caso xlsx-only) | S |
| P6 | **Limpieza MODULE_TONES** | `style={MODULE_TONES.x as CSSProperties}` es no-op enmascarado (pasa claves que no son CSS vars); sustituir por `moduleChromeVars()` en RecopiladoresPage y AulasApplicationFlow | S |
| P7 | **R4.4 Dashboard chrome** | Rail propio (`dash-tab-nav`) y capa `--dash-*` vs patrones maestros. **DECIDE EL USUARIO**: es superficie de entregable con clientes; presentar opciones antes de tocar. Ídem paleta arcoíris del KpiCard (donut) → secuencial navy | M + gate humano |
| P8 | **Instaladores reales** | Próximo build regenera `.ico`/`.icns`/BMPs desde los SVG canónicos automáticamente (guard `-nt` en `build-dmg.sh`); verificar en el próximo corte de release | — |
| P9 | **data-audit-ready de Recopiladores** | El módulo no registra readiness en el QA contract; unidad aparte si entra a la matriz visual | S |

## No-hacer (vigente)

- KpiCard del dashboard sin decisión de producto (ver P7).
- Reescritura masiva de mensajes `stop_api` del backend (solo los casos P5).
- Mover/renombrar archivos de `branding/` (las rutas están referenciadas por
  ADR, manifiesto, skills y pipeline del icns).
