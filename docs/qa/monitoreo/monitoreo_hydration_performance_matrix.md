# Monitoreo hydration and performance matrix

Fecha: 2026-06-29

## Reparacion aplicada

- Loop: Loops de reparacion / categoria Monitoreo hydration, performance, cache y QA.
- Fuente de verdad: `docs/adrs/0022-monitoreo-perfiles-frontend-dinamicos.md`, `frontend/src/features/monitoreo/profiles/registry.ts`, `frontend/src/app/warmupRegistry.ts`, `frontend/src/api/client.ts`.
- Scope lock: Monitoreo, cliente de cache de estado, harness de performance y documentos QA.
- Archivos intencionales: `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`, `frontend/src/app/BootGate.tsx`, `frontend/src/app/boot.css`, `frontend/src/app/warmupRegistry.ts`, `api/R/project_warmup.R`, `api/R/router_monitoreo.R`, `scripts/monitoreo-performance-check.mjs`, `scripts/monitoreo-hydration-performance-check.mjs`, `docs/qa/monitoreo/monitoreo_hydration_performance_matrix.md`, `docs/qa/monitoreo/monitoreo_profile_ui_parity_matrix.md`, `docs/qa/monitoreo/monitoreo_loading_experience_audit.md`.
- Excluidos: schema `.pulso`, Electron, conectores externos, modulos no Monitoreo, deprecated `../prosecnur/`.
- Riesgo principal: worktree con cambios previos amplios; no se revirtio nada ajeno.
- Validacion minima: tests de cliente/registro/cache, harness de performance, build/typecheck, `git diff --check`.

## Cambio enfocado

La reparacion de producto fue una iteracion unica y acotada: `apiMonitoreoState()` ahora registra la promesa de `apiFetch()` en el cache en vuelo antes de esperar la respuesta. Antes, dos lecturas simultaneas de warmup/shell podian duplicar `/api/monitoreo/state`; ahora comparten la misma promesa mientras la peticion esta pendiente.

## Proyectos localizados

| Perfil | Proyecto usado | Tipo | Estado en esta pasada |
| --- | --- | --- | --- |
| Territorial | `/Users/gonzaloalmendariz/Documents/Pulso/ACOGIDA ACNUR/ACNURCG.pulso` | Real | intento real; scopes pesados exceden la ventana interactiva |
| Acreditacion | `/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso` | Real | intento real; `advance_summary` y `queries_summary` son el cuello principal |
| Aulas universitarias | `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso` | Fixture local | medido de extremo a extremo |
| Telefonico | `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/monitoreo-telefonico-profile.pulso` | Fixture local | medido de extremo a extremo |

No se encontro un proyecto telefonico real adicional. `HSVG2026.pulso` existe, pero no se uso como evidencia de Aulas porque esta pasada no verifico que sea familia `aulas_universitarias`.

## Harness

Comando canonico:

```bash
node scripts/monitoreo-hydration-performance-check.mjs \
  --project-territorial "/Users/gonzaloalmendariz/Documents/Pulso/ACOGIDA ACNUR/ACNURCG.pulso" \
  --project-acreditacion "/Users/gonzaloalmendariz/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso" \
  --project-aulas "/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso" \
  --project-telefonico "/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/tmp/visual-qa/monitoreo-telefonico-profile.pulso" \
  --url http://127.0.0.1:5174/ \
  --api-url http://127.0.0.1:8788 \
  --out tmp/perf/monitoreo-hydration \
  --timeout-ms 90000 \
  --probe-timeout-ms 12000 \
  --tab-probe-timeout-ms 6000 \
  --tab-scope critical
```

Artefactos:

- Intento con perfiles reales pesados: `tmp/perf/monitoreo-hydration-heavy-timeout/report.json`.
- Reporte fixture corregido: `tmp/perf/monitoreo-hydration-fixtures/report.json`.
- Capturas fixture corregidas: `tmp/perf/monitoreo-hydration-fixtures/aulas_universitarias/screenshots/` y `tmp/perf/monitoreo-hydration-fixtures/telefonico/screenshots/`.
- Cobertura all Aulas/Telefonico: `tmp/perf/monitoreo-aulas-telefonico-all-v3/report.json`.
- Paridad Telefonico con Acreditacion/Telefono corregida: `tmp/perf/monitoreo-telefonico-parity-v4/report.json`.
- Warmup backend Acreditacion 240 s: `tmp/perf/acreditacion-backend-full-warmup/summary.json`.
- Warmup backend Acreditacion 320 s: `tmp/perf/acreditacion-backend-full-warmup-320/summary.json`.
- Lecturas post-warmup Acreditacion: `tmp/perf/acreditacion-backend-full-warmup-320/state-cache-summary-second-pass.json`.
- Entrada visual post-warmup Acreditacion: `tmp/perf/acreditacion-backend-full-warmup-320/ui-post-warmup/summary.json`.
- Warmup backend Territorial 320 s: `tmp/perf/territorial-backend-full-warmup-320/summary.json`.
- Lecturas post-warmup Territorial: `tmp/perf/territorial-backend-full-warmup-320/state-cache-second-pass/summary.json`.
- Progreso loading Territorial mapeado: `tmp/perf/territorial-progress-mapped/progress-summary.json`.
- Capturas loading Territorial: `tmp/perf/territorial-progress-mapped/ui-loading/` y `tmp/perf/territorial-progress-mapped/ui-loading-updated/`.
- Entrada final Territorial con BootGate real, cache hit y cobertura honesta: `tmp/perf/territorial-bootgate-cache-hit-final-v2/report.json`.

Nota: el helper `finiteMs()` fue corregido despues del intento pesado para que `null` no se compute como `0 ms`. Por eso el reporte fixture corregido es la fuente canonica para `project_loading_screen.blocking_ms`.

## Matriz de rendimiento

| Perfil | Proyecto/carga inicial | Monitoreo visible tras proyecto | Tabs criticas hidratadas | Espera extra tras visual | Retorno warm | `/api/monitoreo/state` | Full scope |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Territorial | BootGate real 118.570 s; job `project.warmup` 108.789 s completo; sesion focalizada final 110.410 s (`open` 1.311 s + warmup 109.099 s) | topbar/sidebar 0.007 s en BootGate real; sesion focalizada visual 0.221 s, topbar/sidebar 0.228 s, entry data 3.118 s | 3/24 tabs declaradas medidas; 3/3 criticas hidratadas (`Fuente/Formulario`, `Avance/Resumen`, `Avance/Mapa y UMP`); detalle UMP profundo 6/6 probes OK, sin loaders | mapa visible frio 11.670 s; detalle UMP profundo 54.468 s; `source` 1.559 s, `advance_summary` 5.337 s | `Avance/Mapa y UMP` warm 1.204 s | 3 state requests, 0 duplicados; mapas/cartografia 16 requests, sin duplicados por URL; sin `full`; `source`/`advance_summary` cache hit post-warmup | false |
| Acreditacion | backend warmup completo en 251.981 s con presupuesto 320 s | UI post-warmup visible 2.465 s; audit `monitoreo-acreditacion`, dashboard true | 4/4 scopes criticos backend | `queries_summary` sigue pesado por payload 19.8 MB | pendiente medir tabs all | 5 requests de estado, 4 scopes criticos | false |
| Aulas universitarias | 4.952 s | 0.377 s | 5/5 all declaradas | 1.980 s | 0.358 s | 5 | false |
| Telefonico | 9.070 s | 0.531 s | 8/8 all declaradas | 9.189 s | 0.804 s | 5 | false |

## Scopes observados

| Perfil | Scopes usados |
| --- | --- |
| Aulas universitarias | `include_reports=0` default, `advance_summary`, `source` |
| Telefonico | `include_reports=0` default, `phone_summary`, `source`, `advance_summary`, `queries_summary` |

## Lectura

- Es valido aceptar mas tiempo en la apertura inicial del proyecto si BootGate/ProjectShell hidrata Monitoreo durante esa fase. En las fixtures all, Aulas queda lista en 5/5 tabs con 2.357 s post-visual; Telefonico queda funcionalmente correcto en 8/8 tabs, pero la hidratacion completa sube a 9.720 s por `queries_summary`.
- Acreditacion ahora tiene evidencia backend de hidratacion completa en apertura con ACRDCONTA: 320 s alcanzo para `source`, `advance_summary`, `queries_summary` y `phone_summary`; despues del warmup, la entrada visual a `/monitoreo` marco dashboard listo en 2.465 s.
- Territorial ya tiene evidencia backend completa con presupuesto ampliado, entrada final mejorada, mapa visible `Avance/Mapa y UMP` frio/warm y detalle UMP profundo sin loaders. No se debe afirmar que tabs `all` estan rapidas porque solo se midieron tabs criticas y el detalle UMP profundo aun tarda 54.468 s en cargar capas ricas/GPS.
- No se debe afirmar que Acreditacion esta cerrada en paridad total hasta remedir tabs `all`; la evidencia actual prueba warmup backend completo, entrada visual post-warmup y lecturas post-warmup mas rapidas.
- No se debe afirmar que Telefonico esta optimizado: la paridad con Acreditacion/Telefono ya esta corregida y `Consultas/Casos` pasa, pero el costo de la cobertura all todavia requiere otra vuelta de performance.
- El cache en vuelo del cliente evita duplicar solicitudes simultaneas warmup/shell para la misma clave `includeReports + reportScope + session`.

## Contrato de iteracion

| Iteracion | Falla | Cambio | Evidencia |
| --- | --- | --- | --- |
| 1 | Warmup y shell podian duplicar la misma lectura de estado mientras la primera peticion seguia pendiente. | Registrar la promesa de `apiFetch()` antes del `await` en `apiMonitoreoState()`. | `frontend/src/api/client.test.ts` agrega dedupe de peticiones en vuelo; tests pasan. |
| 2 | El harness no cubria Aulas/Telefonico ni separaba carga inicial de post-proyecto. | Agregar wrapper `monitoreo-hydration-performance-check.mjs`, cobertura por perfil, probes y matriz de tiempos. | `tmp/perf/monitoreo-hydration-fixtures/report.json`. |
| 3 | ACRDCONTA no quedaba completo con 240 s: `queries_summary` y `phone_summary` quedaban pendientes. | Subir presupuesto de warmup inicial a 320 s y hacer que backend Acreditacion prepare los 4 scopes criticos antes de marcar `ready`. | `tmp/perf/acreditacion-backend-full-warmup-320/summary.json` muestra `complete: true`, Monitoreo `ready`, scopes 4/4. |
| 4 | Con cargas reales mas largas, BootGate podia mostrar progreso demasiado grueso y poco informativo. | Mapear subprogreso real de Monitoreo/Territorial al porcentaje global y traducir mensajes a fases de usuario: fuentes, rutas, mapas, avance, validaciones, consultas y telefono. | `tmp/perf/territorial-progress-mapped/progress-summary.json` muestra 65-95% dentro de Territorial y capturas `ui-loading/` sin errores. |
| 5 | BootGate podia lanzar `monitoreo_datos` en frontend mientras el backend ya preparaba `monitoreo`/`monitoreo_territorial`. | Filtrar `monitoreo_datos` cuando el backend warmup activo cubre Monitoreo, y marcarlo completo solo si el job backend termina `ready`/`skipped`. | `tmp/perf/territorial-bootgate-cache-hit-final-v2/report.json`: 3 state requests, 0 duplicados, full false. |
| 6 | El warmup territorial guardaba cache con datos crudos y `/state` calculaba claves con metadatos de fuente aplicados, provocando `cache_source=build` al entrar. | Aplicar `monitoreo_apply_source_metadata_to_data()` dentro de `.monitoreo_territorial_prewarm_scopes()` antes de construir claves y dashboards. | Validacion in-process: `source` 1.072 s y `advance_summary` 2.652 s con `cache_source=project`, `cache_hit=true`; Playwright final v2: BootGate 118.570 s, entry data 2.711 s, resumen avance 8.318 s, mapa/footer pendiente. |
| 7 | El harness marcaba `Avance/Mapa y UMP` como fallo porque esperaba el footer del mapa UMP profundo, pero el tab ahora abre con el mapa canonico de `Zonas con cierre` en el primer viewport. | Separar `advance_map_hydrated` para el mapa visible real del tab y agregar `advance_map_detail_hydrated` para el detalle UMP profundo con scroll explicito. | `tmp/perf/territorial-map-probe-contract-v1/report.json`: sesion ACNURCG 114.642 s de preparacion, visual 0.680 s, `Avance/Mapa y UMP` frio 15.986 s, warm 1.361 s, 3 state requests, 0 duplicados, `full=false`; detalle UMP profundo conserva loaders locales 45 s. |
| 8 | El detalle UMP repetia requests de GPS y block/zone para el mismo ubigeo, y el probe aun penalizaba una vista ya cargada por umbral de datos del mapa/inspector. | Agregar in-flight dedupe para `apiMonitoreoTerritorialMap()`, reutilizar cartografia basica al cargar capas ricas en `loadTerritorialRouteCartography()`, y ajustar el probe del detalle al nucleo visible del mapa/inspector. | `tmp/perf/territorial-map-detail-ready-v3/report.json`: mapa/cartografia baja de 20 a 16 requests, sin duplicados por URL; detalle UMP profundo OK a 54.468 s, loading 0, visual 872; warm map 1.204 s; 3 state requests, `full=false`. |
| 9 | Con la carga inicial mas larga, el porcentaje de BootGate podia sentirse irregular si cambiaba la fuente de progreso o si una fase larga seguia activa. | Mantener el porcentaje visible como avance monotónico durante warmup/background y mostrar `N de M pasos` + porcentaje real en el paso backend activo. | `pnpm --dir frontend exec tsc --noEmit --pretty false` y `git diff --check` pasan; cambio limitado a `frontend/src/app/BootGate.tsx` y registro QA. |
| 10 | Telefonico no estaba alineado con el contrato visual de Acreditacion/Telefono: reutilizaba la pagina canonica, pero declaraba menos secciones/scopes y `Consultas/Casos` podia quedarse visualmente en `Telefono`. | Alinear `frontend/src/features/monitoreo/profiles/telefonico/index.ts` con las secciones canonicas `Fuentes`, `Modelo`, `Consultas`, `Telefono`, `Avance`; agregar `queries_summary` a warmup/report scopes; normalizar reportes parciales en `AcreditacionMonitoreoPage.tsx`. | `tmp/perf/monitoreo-telefonico-parity-v4/report.json`: 8/8 tabs declaradas hidratadas, `Consultas/Casos` OK con 63 datos/21 visuales/6 filas, 5 state requests, 0 duplicados, `full=false`, 0 errores page/resource. |

## Regla de parada

Esta iteracion se detiene cuando:

- el dedupe de cache queda probado;
- Aulas y Telefonico quedan medidos con capturas all en fixtures y sin full scope; Telefonico queda funcionalmente alineado con Acreditacion/Telefono, con performance all pendiente de optimizar;
- Territorial queda con warmup backend completo, loading mapeado, entrada critica post-warmup, mapa visible y detalle UMP profundo medidos; tabs all y costo de capas ricas/GPS quedan pendientes. Acreditacion queda con warmup backend completo pero tabs all pendiente;
- las matrices QA registran evidencia y limitaciones;
- la validacion automatica disponible queda ejecutada o justificada.
