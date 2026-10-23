# Plan de aplicación a la UI: Monitoreo telefónico

Tipo: Plan de implementación
Estado: Vigente
Fecha: 2026-10-23
Autoridad: Gonzalo, textual: «la idea es aprobar los diseños cuando todo se vea bien y coherente y aplicarlo a la UI,
con prioridad por el telefónico» y «una vez ya lo veas bien, aplícalo; no voy a poder dar aprobación explícita».
Diseño: `docs/qa/revamp-monitoreo/telefonico.md` (fichas), lienzo «Revamp de Monitoreo · Telefónico»,
`estandar-de-ficha.md` y `procedimientos-respondidos.md`.

## Reglas de ejecución

- Rama `revamp-monitoreo-telefonico` en un worktree propio; nunca se edita `main` directamente. Al cerrar cada fase con
  gate verde y verificador conforme, la rama se fusiona en `main` local. Nunca push, tag ni release.
- Antes de tocar `frontend/src/features/monitoreo/profiles/telefonico/` se avisa a la sesión «ACNUR RMS», que trabaja
  el backend de reemplazos del telefónico.
- `TelefonicoMonitoreoPage.tsx` está congelado (línea base 20,486 en `agentic/manifest.json`): solo cambia el montaje;
  todo lo nuevo va en archivos propios. Lo mismo para `monitoreo_engine.R` y `router_monitoreo.R`.
- Máximo dos escritores a la vez con globs sin solape (frontend-react en `frontend/`, backend-r en `api/`).
- Nada que dependa de una pregunta abierta de `telefonico.md` §0 se implementa: queda el estado «Por definir» del
  diseño o la pieza actual sin cambios.
- Gate por fase: `pnpm -C frontend typecheck`, `make gate-front AREA=monitoreo`, `make gate-area` del área R tocada
  con `GATE_ARGS='--patron "telefonico"'`, captura a 1440 × 1000 y 1024 × 600 con el runner de `ui-quick-check` sobre una
  copia de `ACNUR_PDM.pulso` en puertos propios (nunca 8787 ni 5173), y agente `verificador`.

## Fases

| # | Fase | Contenido | Depende de | Estado |
|---|---|---|---|---|
| T0 | Preparación | Worktree, `pnpm install`, copia de `ACNUR_PDM.pulso` y de `PDM_MedVida2026.pulso`, capturas «antes» de las pestañas actuales, aviso a «ACNUR RMS» | diseño conforme | ☐ |
| T1 | Navegación | Catálogo `telefonico` en `lib/navegacion/catalogos/monitoreo.ts` con Insumos · Modelo · Control · Avance y sus pestañas; alias de las direcciones viejas (se leen, nunca se escriben); aterrizaje en Avance › Cuotas; contratos `modulesNavigation`, `auditReadyRoutes`, `direccion` | T0 | ☑ (ver «Notas de T1 a T3») |
| T2 | Chrome común | Cabecera de pestaña de 44 px, CORTE y FALTAN en la barra del modo, insignias en las píldoras, píldora de estado común, pie del rail con CORTE, switch `#002457` | T1 | ☐ |
| T3 | Avance › Cuotas | `avance/CuotasFaltante.tsx`, `avance/FaltanteDiario.tsx`; reutiliza `segmentoDeCuotas.ts`, `metasPendientes.ts`, `telefonicoGoalModel.ts`, `avance/ritmoDiario.ts` | T2 | ☐ |
| T4 | Control › Insistencia | Backend: bloque `cola_insistencia` en `api/R/monitoreo_telefonico_cola.R` con test. Front: `core/ColaDeInsistencia.tsx`, `control/Insistencia.tsx`, `control/insistenciaModel.ts` | T2 | ☐ |
| T5 | Control › Barrido y Equipo | `control/Barrido.tsx`, `control/Equipo.tsx`, `control/EquipoMatriz.tsx`; reutiliza `conteoDeEquipo.ts`, `telefonicoTeamModel.ts` | T2 | ☐ |
| T6 | Control › Respuestas y Avisos | `control/Respuestas.tsx`, `control/Avisos.tsx`; reutiliza `filtroEfectiva/`, `TelefonicoPhoneAlerts.ts` | T2 | ☐ |
| T7 | Insumos | Fuentes, Llave y filtros, Estados (`insumos/Estados.tsx`), reutilizando `fuentes/` | T2 | ☐ |
| T8 | Modelo y Avance restantes | Cuotas y calendario, Ritmo, Entregas; Reserva y Reemplazos condicionales | T2; Reserva y Reemplazos esperan P8–P9 y el contrato de «ACNUR RMS» | ☐ |
| T9 | Control › Discrepancias y Supervisión | Discrepancias con decisión auditada; supervisión estratificada | **Bloqueada** por P1–P7 | ⛔ |

Orden de la noche: T0, T1, T2, T3, T4, y luego T5 a T7 si el tiempo alcanza. Cada fase cierra en su propio commit en
español (conventional commits) con el diseño citado.

## T4 backend: contrato de `cola_insistencia` (commit c797a1a0e)

Archivo `api/R/monitoreo_telefonico_cola.R`, enganchado en `.monitoreo_report_phone_blocks` (`monitoreo_telefonico.R`,
+9 líneas; ningún congelado crece). Los bloques viven en `reports.sheets[id="monitoreo_telefonico"].blocks`, solo en
la familia `telefonico`. Vacío o NA llega como `""`.

`cola_insistencia`, una fila por caso barrido no final (tope 5000; la nota dice el corte):
`CodPulso` · `Responsable` («Sin asignar» si vacío) · `Sin asignar` (bool) · `Status` (literal) · `Intentos` (int o
"") · `Fecha` (ISO o "") · `Observación` (literal) · `Variable cuota` · `Cuota` · `efectiva_kobo` (bool) ·
`dias_sin_registro` (int o "") · `Criterio cola` · condicionales `OrdenTelefono`, `TelefonosIntentados`,
`NumTelefonos`, `Origen`. Orden neutro; el frontend ordena (P12 abierta).

`cola_insistencia_responsables`: `Responsable` · `Sin asignar` · `Casos en cola` · `Ya efectivas en Kobo` ·
`Promedio intentos` · `Sin dato de intentos` · `Por llamar`.

«No final»: fuera los efectivos y «No barrido»; si el status casa con `state_rules`, manda la familia declarada
(salen `stop_contact`, `complete`, `refusal`, `excluded`); si no, la clasificación `reattempt_mask` del motor.

Cifras reales: PDM 374 por rellamar (el diseño decía 324 con una lista cerrada; la diferencia es Número suspendido 31,
No efectivo 11, «Número Incorrrecto» 6 y Encuesta parcial 2), 38 ya efectivas en Kobo, Op-09 42; Medios de Vida 2026
82 (el diseño decía 92; salen los Rechazo, declarados `stop_contact`), Op-03 23. Gate: 398 pass, 0 fail.

Para el frontend: bloque ausente en snapshots viejos se trata como «Preparando» con invitación a Actualizar; sin hoja de
barrido, bloques vacíos con nota. El worker `callr` usa el paquete instalado y no tendrá el bloque hasta reinstalar.

## Preguntas surgidas en la implementación

- **P13 (qué forma la cola)**: hoy decide el vocabulario del proyecto; si Gonzalo quiere sacar «Número suspendido» o
  «No existe el número», basta con marcar «Cierra» en Insumos › Estados.
- **Corte**: el reporte no recibe `synced_at` (pasarlo exige tocar `monitoreo_engine.R`, congelado); usa la fecha de
  armado. En Medios de Vida 2026 hay fechas de la hoja posteriores al sync y `dias_sin_registro` sale negativo.
- **«Sin asignar» por origen**: separar Muestra de Backup depende de P8–P9 y del contrato de «ACNUR RMS»; hoy va el
  total (PDM 1,197).
- **Acreditación con barrido**: el bloque no se publica ahí todavía; montarlo en `Reintentos.tsx` es una línea cuando
  se unifique.
- **MEDVID 2025**: «Observación de rebarrido» no entra en la cola.

## Notas de T1 a T3 (frontend)

**T1, navegación.** Catálogo público `MONITOREO_PESTANAS.telefonico` con Insumos (Fuentes, Llave y filtros, Estados),
Modelo (Cuotas y calendario), Control (Barrido, Insistencia, Equipo, Discrepancias, Respuestas, Avisos) y Avance
(Cuotas, Ritmo, Entregas): 13 pestañas. Las vistas que la página monta siguen con su clave histórica en
`MONITOREO_PESTANAS_INTERNAS_TELEFONICO`; la tabla `profiles/telefonico/navegacion/direccionTelefonica.ts` traduce en las
dos direcciones y lee las claves viejas como alias (`seccion=telefonico&pestana=incidencia` termina en
`seccion=control&pestana=insistencia`). Cuando una pestaña absorbe más de una vista, las demás cuelgan como sub-vista
direccionable con `panel`: Respuestas (`tiempos`, `salvedades`; Salvedades sólo si hay efectivas no identificables) y
Cuotas y calendario (`calendario`). Sin dirección, el modo aterriza en Avance › Cuotas.

- **Supervisión no se declaró**: hoy no existe en el modo telefónico (la página la oculta) y su diseño está bloqueado
  por P4–P7 (T9). Queda para T9.
- Reserva y Reemplazos no se declararon (P8–P9), como pide el plan.
- `scripts/build-visual-catalog.mjs` y `scripts/monitoreo-performance-check.mjs` todavía nombran las secciones viejas
  del telefónico; están fuera del glob del frontend. Funcionan por alias, pero conviene actualizarlos.
