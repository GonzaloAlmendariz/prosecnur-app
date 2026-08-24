# Monitoreo hydration and performance matrix

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-06-29
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de performance y arquitectura de Monitoreo](../historico/monitoreo-performance-arquitectura-2026-06.md)

Fecha: 2026-06-29

## Reparacion aplicada

- Loop: Loops de reparacion / categoria Monitoreo hydration, performance, cache y QA.
- Fuente de verdad: `docs/adrs/0022-monitoreo-perfiles-frontend-dinamicos.md`, `frontend/src/features/monitoreo/profiles/registry.ts`, `frontend/src/app/warmupRegistry.ts`, `frontend/src/api/client.ts`.
- Scope lock: Monitoreo, cliente de cache de estado, harness de performance, empaquetado frontend y documentos QA.
- Archivos intencionales: `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`, `frontend/src/app/BootGate.tsx`, `frontend/src/app/boot.css`, `frontend/src/app/warmupRegistry.ts`, `frontend/vite.config.ts`, `api/R/project_warmup.R`, `api/R/router_monitoreo.R`, `scripts/monitoreo-performance-check.mjs`, `scripts/monitoreo-hydration-performance-check.mjs`, `docs/qa/monitoreo/monitoreo_hydration_performance_matrix.md`, `docs/qa/monitoreo/monitoreo_profile_ui_parity_matrix.md`, `docs/qa/monitoreo/monitoreo_loading_experience_audit.md`.
- Excluidos: schema `.pulso`, Electron, conectores externos, modulos no Monitoreo, deprecated `../prosecnur/`.
- Riesgo principal: worktree con cambios previos amplios; no se revirtio nada ajeno.
- Validacion minima: tests de cliente/registro/cache, harness de performance, build/typecheck, `git diff --check`.

## Cambio enfocado

Las reparaciones de producto fueron iteraciones acotadas sobre cache:

- `apiMonitoreoState()` registra la promesa de `apiFetch()` en el cache en vuelo antes de esperar la respuesta. Antes, dos lecturas simultaneas de warmup/shell podian duplicar `/api/monitoreo/state`; ahora comparten la misma promesa mientras la peticion esta pendiente.
- Acreditacion guarda en memoria de pagina el `MonitoreoState` ya hidratado por `report_scope`. Asi, si la apertura inicial o el prefetch ya prepararon `queries_summary`, `phone_summary` o `advance_summary`, cambiar a Consultas, Telefono o Avance reutiliza ese paquete en vez de pedirlo otra vez.

## Proyectos localizados

| Perfil | Proyecto usado | Tipo | Estado en esta pasada |
| --- | --- | --- | --- |
| Territorial | `<ruta de trabajo local> ACNUR/ACNURCG.pulso` | Real | all-tabs real vigente; queda alto el costo de import/montaje territorial en dev |
| Acreditacion | `<ruta de trabajo local>` | Real | intento real; scope cache elimina duplicados y deja como cuello principal el costo de preparacion inicial/render all |
| Aulas universitarias | `<ruta de trabajo local>` | Fixture local | medido de extremo a extremo |
| Telefonico | `<ruta de trabajo local>` | Fixture local | medido de extremo a extremo |

Inventario verificado en esta pasada:

- `<ruta de trabajo local>` es un proyecto real con `calc_muestra_aulas_config` y `calc_muestra_aulas_frame`, pero no contiene `monitoreo_config`, `monitoreo_snapshot`, `monitoreo_aulas_plan` ni `monitoreo_aulas_snapshot`; por tanto no prueba Monitoreo Aulas.
- `<ruta de trabajo local>` y `tmp/monitoreo-audit/monitoreo-aulas_universitarias.pulso` si tienen `family=aulas_universitarias`, pero son fixtures/canonicos, no proyectos reales de campo.
- No se encontro un proyecto telefonico real adicional; el unico `.pulso` con `family=telefonico` localizado es el fixture `tmp/visual-qa/monitoreo-telefonico-profile.pulso`.

## Harness

Comando canonico:

```bash
node scripts/monitoreo-hydration-performance-check.mjs \
  --project-territorial "<ruta de trabajo local> ACNUR/ACNURCG.pulso" \
  --project-acreditacion "<ruta de trabajo local>" \
  --project-aulas "<ruta de trabajo local>" \
  --project-telefonico "<ruta de trabajo local>" \
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
- Warmup backend Telefonico con scopes compactos: `tmp/perf/monitoreo-telefonico-backend-warmup-v6/report.json`.
- Capturas all Telefonico estabilizadas por viewport: `tmp/perf/monitoreo-telefonico-screenshot-settle-v8/report.json`.
- Contrato vigente Telefonico standalone focal automatizado: `tmp/perf/monitoreo-telefonico-focal-contract-20260629/report.json`.
- Captura manual focal Telefonico: `tmp/visual-qa/telefonico-standalone-parity-20260629/report.json` y `tmp/visual-qa/telefonico-standalone-parity-20260629/tabs/report.json`.
- Regression backend Telefonico warmup: `api/tests/testthat/test-project-warmup.R`
  confirms project warmup prepares `source`, `advance_summary`,
  `queries_summary` and `phone_summary` before entering the app, without
  requesting `full`; it now also covers the aliases `telefonico`,
  `telefónico`, `telephone`, `phone`, `telephone_monitoring` and
  `monitoreo_telefonico` as the internal family `telefonico`.
- Warmup backend Acreditacion 240 s: `tmp/perf/acreditacion-backend-full-warmup/summary.json`.
- Warmup backend Acreditacion 320 s: `tmp/perf/acreditacion-backend-full-warmup-320/summary.json`.
- Lecturas post-warmup Acreditacion: `tmp/perf/acreditacion-backend-full-warmup-320/state-cache-summary-second-pass.json`.
- Entrada visual post-warmup Acreditacion: `tmp/perf/acreditacion-backend-full-warmup-320/ui-post-warmup/summary.json`.
- Cobertura all Acreditacion real ACRDCONTA: `tmp/perf/acrdconta-all-current-20260629/report.json`.
- Acreditacion con cache por scope y warmup frontend de datos: `tmp/perf/acrdconta-scope-cache-final-20260629/report.json`.
- Warmup backend Territorial 320 s: `tmp/perf/territorial-backend-full-warmup-320/summary.json`.
- Lecturas post-warmup Territorial: `tmp/perf/territorial-backend-full-warmup-320/state-cache-second-pass/summary.json`.
- Progreso loading Territorial mapeado: `tmp/perf/territorial-progress-mapped/progress-summary.json`.
- Capturas loading Territorial: `tmp/perf/territorial-progress-mapped/ui-loading/` y `tmp/perf/territorial-progress-mapped/ui-loading-updated/`.
- Entrada final Territorial con BootGate real, cache hit y cobertura honesta: `tmp/perf/territorial-bootgate-cache-hit-final-v2/report.json`.
- Contrato de proyectos omitidos: `tmp/perf/monitoreo-hydration-skip-contract-20260629/report.json`
  y `report.md` verifican que el wrapper `monitoreo-hydration-performance-check.mjs`
  produce `skipped: project not provided` para Territorial, Acreditacion,
  Aulas y Telefonico cuando no se pasa proyecto, sin requerir servidor ni
  inventar rutas.
- Empaquetado Monitoreo: `pnpm --dir frontend build:fast` pasa y ya no muestra
  el aviso circular `monitoreo-acreditacion -> monitoreo-territorial`; el
  workbench compartido de `salidas/` queda en `monitoreo-core`.
- Entrada production-like sin BootGate visual: `tmp/perf/territorial-production-chunk-warmup-final-20260629/report.json`
  prueba build estatico sin ciclo circular; el backend warmup queda `done`,
  pero al saltar la transferencia de cache al cliente la ruta aun paga
  `validation_summary` y solo 21/24 tabs hidratan con umbral 12 s.
- Entrada BootGate + cache de cliente: `tmp/perf/territorial-bootgate-client-cache-final-20260629/report.json`
  prueba el flujo de usuario: BootGate paga backend + scopes de cliente, y
  luego Monitoreo entra sin requests de `/api/monitoreo/state` en la ruta.

Nota: el helper `finiteMs()` fue corregido despues del intento pesado para que `null` no se compute como `0 ms`. Por eso el reporte fixture corregido es la fuente canonica para `project_loading_screen.blocking_ms`.

## Matriz de rendimiento

| Perfil | Proyecto/carga inicial | Monitoreo visible tras proyecto | Tabs criticas hidratadas | Espera extra tras visual | Retorno warm | `/api/monitoreo/state` | Full scope |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Territorial | BootGate production-like ACNURCG: 46.079 s pagando backend + transferencia de scopes de cliente; evidencia all dev previa: 19.527 s (`open` 1.046 s + warmup backend 18.481 s) | despues de BootGate: visual 0.126 s, topbar/sidebar 0.123 s; evidencia dev all previa: visual 170.606 s | BootGate/client cache: `Validacion/Geolocalizacion` 0.496 s sin loader; evidencia all dev previa: 24/24 tabs declaradas hidratadas | production-like sin BootGate visual diagnostico: 21/24 con Validacion aun esperando transferencia; flujo BootGate corregido no repite state en la ruta | retorno warm mapa dev 1.550 s | BootGate: 6 state requests antes de entrar, 0 state requests en ruta, 0 duplicados, `source`, `route_summary`, `validation_summary`, `advance_summary`, `queries_summary`; sin `full` | false |
| Acreditacion | ACRDCONTA scope-cache actual: 22.471 s (`open` 0.499 s + warmup backend 21.972 s); el navegador tambien precalienta `monitoreo` y `monitoreo_datos` antes de soltar el shell | 27.120 s visual desde navegacion; topbar/sidebar 27.131 s; primera vista 27.763 s | 22/22 tabs all hidratadas | 22.373 s; ya sin recargas de Consultas/Telefono/Avance; cuello residual `Modelo/Enlaces` 3.655 s | 0.975 s | 5 requests, 0 duplicados (`source`, `advance_summary`, `queries_summary`, `phone_summary` + light) | false |
| Aulas universitarias | 4.952 s | 0.377 s | 5/5 all declaradas | 1.980 s | 0.358 s | 5 | false |
| Telefonico | 7.057 s; `project.warmup` 6.345 s prepara el fixture telefonico | 1.240 s visual; topbar/sidebar 1.251 s; primera vista 2.440 s | 4/4 tabs focales (`Resumen`, `Dia`, `Responsables`, `Alertas`) | 4.160 s | 0.766 s | 5 requests, 0 duplicados | false |

## Scopes observados

| Perfil | Scopes usados |
| --- | --- |
| Aulas universitarias | `include_reports=0` default, `advance_summary`, `source` |
| Telefonico | `include_reports=0` default, `phone_summary`, `source`, `advance_summary`, `queries_summary` |

## Lectura

- Es valido aceptar mas tiempo en la apertura inicial del proyecto si BootGate/ProjectShell hidrata Monitoreo durante esa fase. En las fixtures all, Aulas queda lista en 5/5 tabs con 2.357 s post-visual. Telefonico tuvo una evidencia historica de perfil completo 8/8; el contrato vigente del standalone queda focalizado en `Telefono` para parecerse al corte `Acreditacion > Telefono`, y el harness actualizado ya mide 4/4 tabs locales sin loaders.
- Para Telefonico, el contrato queda separado: la pantalla de carga del proyecto
  debe pagar los cuatro scopes compactos (`source`, `advance_summary`,
  `queries_summary`, `phone_summary`) y avisar "Monitoreo telefónico preparado";
  la espera dentro del perfil solo debe quedar para render/transferencia de tabs
  ya declaradas, no para descubrir nuevamente el paquete telefonico ni pedir
  `full`.
- Acreditacion ahora tiene evidencia backend de hidratacion completa en apertura con ACRDCONTA y evidencia all vigente: 22/22 tabs declaradas hidratan sin loaders ni `full`. La version con cache por scope elimina duplicados (`5` state requests, `0` repetidos) y traslada trabajo real a la preparacion inicial; no se debe presentar como instantanea porque aun deja 22.373 s al recorrer todas las tabs declaradas en frio.
- Territorial ya tiene evidencia all real con ACNURCG: 24/24 tabs declaradas hidratadas en la corrida dev all, `full=false`, 7 state requests y un solo duplicado light residual. El aviso circular de empaquetado Acreditacion/Territorial queda corregido al mover `salidas/` a un chunk compartido. En el flujo production-like real, BootGate paga 46.079 s y luego `/monitoreo` entra en 0.126 s con `Validacion/Geolocalizacion` usable en 0.496 s y 0 requests de state dentro de la ruta; esta es la lectura que respeta la decision de esperar mas al abrir el proyecto para entrar ya hidratado.
- No se debe afirmar que Acreditacion esta completamente rapida: la cobertura `tab-scope all` esta probada y los duplicados quedaron eliminados, pero la preparacion inicial y el render secuencial all siguen marcando costo real.
- No se debe afirmar que Telefonico esta optimizado: la paridad visual del standalone con Acreditacion/Telefono queda corregida al entrar directo a `Telefono` y el harness automatico ya mide el contrato focal 4/4, pero el fixture tiene datos telefonicos limitados y aun deja 4.160 s extra tras el visual.
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
| 11 | Aunque Telefonico ya tenia contrato visual correcto, `POST /api/project/warmup` lo marcaba como `hydrated_by_frontend`, dejando `source`, `advance_summary`, `queries_summary` y `phone_summary` para despues de entrar a `/monitoreo`, aunque esos scopes son la verdad principal del monitoreo telefonico. | Compartir el contrato compacto en `.project_warmup_monitoreo_compact_scopes()` para `acreditacion` y `telefonico`, con mensajes de progreso reales, mensaje de familia `Monitoreo telefónico preparado.` y sin `full`. | `api/tests/testthat/test-project-warmup.R` pasa 42/42 y verifica scopes exactos `source`, `advance_summary`, `queries_summary`, `phone_summary`, mensaje `Monitoreo telefónico preparado.` y `ready_scopes` igual a las llamadas; `tmp/perf/monitoreo-telefonico-backend-warmup-v6/report.json`: warmup 4/4 scopes ready, all tabs 8/8, 5 state requests, 0 duplicados, `full=false`, 0 errores page/resource. |
| 12 | El normalizador canonico de perfil aceptaba `telefonico`, pero aliases externos como `telefónico`, `telephone`, `phone`, `telephone_monitoring` o `monitoreo_telefonico` podian caer a `acreditacion`; ademas, algunas capturas del harness podian quedar en un scroll residual aunque el DOM estuviera hidratado. | Normalizar la familia desde `.monitoreo_text_key()` y mapear aliases de acreditacion, territorial, aulas y telefonico antes de aplicar el fallback; el test de warmup usa `telephone_monitoring` para exigir scopes telefonicos reales; el harness recentra el viewport activo antes de guardar capturas. | `Rscript -e 'pkgload::load_all("api", quiet=TRUE); testthat::test_file("api/tests/testthat/test-project-warmup.R")'` pasa 43/43; `test-monitoreo-engine.R` pasa 1353/1353; el caso nuevo verifica seis aliases telefonicos contra la familia interna `telefonico`; `tmp/perf/monitoreo-telefonico-screenshot-settle-v8/report.json`: 8/8 tabs, capturas no vacias para `Telefono/Resumen` y `Consultas/Casos`, 5 state requests, 0 duplicados, `full=false`, 0 errores. |
| 13 | El standalone Telefonico se parecia a un perfil completo, no al corte `Acreditacion > Telefono`: mostraba Fuentes/Modelo/Consultas/Avance como secciones principales aunque el usuario espera entrar directo al tablero telefonico; ademas, el harness seguia declarando 8 tabs historicas. | Definir `TELEFONICO_WORKBENCH_VIEWS` con una sola seccion `Telefono`, reducir `frontend/src/features/monitoreo/profiles/telefonico/index.ts` a `views: ["telefonico"]`, `warmupScopes: ["phone_summary"]`, y alinear `PROFILE_COVERAGE.telefonico`/`PROFILE_TAB_PLANS.telefonico` a 4 tabs focales. | `node --check scripts/monitoreo-performance-check.mjs`, `node scripts/monitoreo-hydration-performance-check.mjs --help`, `pnpm --dir frontend typecheck` y `git diff --check` pasan; `tmp/perf/monitoreo-telefonico-focal-contract-20260629/report.json`: 4/4 tabs, visual 1.240 s, all tabs 5.400 s, warm 0.766 s, 5 state requests, 0 duplicados, `full=false`, 0 errores. |
| 14 | La matriz seguia diciendo que Acreditacion tenia `tabs all` pendiente, aunque ACRDCONTA ya estaba medido con el harness actual. | Reconciliar evidencia ACRDCONTA vigente y dejar duplicados/lentitud como residuales, sin tocar cache por no tener causa unica aislada. | `tmp/perf/acrdconta-all-current-20260629/report.json`: 22/22 tabs declaradas, visual 0.667 s, all tabs 59.272 s, warm 0.786 s, 8 state requests, 3 duplicados, `full=false`, 0 errores page/resource. |
| 15 | Acreditacion precalentaba `advance_summary`, `queries_summary` y `phone_summary`, pero al cambiar a Avance, Consultas o Telefono los pedia otra vez porque el componente solo conservaba un `state` activo. | Guardar `MonitoreoState` por `report_scope` dentro de `AcreditacionProfilePage`, reutilizarlo en cambios de seccion y limpiar ese cache al forzar refresh o ejecutar mutaciones. El harness de sesion tambien declara `monitoreo,monitoreo_datos` como warmup frontend. | `tmp/perf/acrdconta-scope-cache-final-20260629/report.json`: 22/22 tabs declaradas, visual 27.120 s, all tabs 49.493 s, warm 0.975 s, 5 state requests, 0 duplicados, `full=false`, 0 errores page/resource. |
| 16 | La matriz mencionaba `HSVG2026.pulso` como candidato Aulas sin confirmar si era Monitoreo, y Telefonico seguia sin inventario real. | Inspeccionar manifest/state.rds de `HSVG2026`, fixture Aulas, audit reference, fixture Telefonico, ACRDCONTA, ACNURCG y candidatos ACRD ING sin modificar `.pulso`. | `HSVG2026` no tiene Monitoreo; audit reference/tmp Aulas si son `family=aulas_universitarias` pero fixtures; fixture Telefonico es `family=telefonico`; ACRDCONTA y ACNURCG siguen siendo los reales validos para Acreditacion/Territorial. |
| 17 | Territorial all real quedaba en 23/24 por `Validacion/Geolocalizacion` y repetia scopes ya calentados al montar la pagina. | Conectar `warmupMonitoreoLocalData()` con `monitoreoScopeCache`, consumir el scope territorial cacheado al montar, guardar estados por `phase/source/scope` en la pagina territorial y ajustar el harness para no tratar spinners no bloqueantes como loaders de pantalla. | `tmp/perf/territorial-final-20260629/report.json`: 24/24 tabs declaradas, visual dev 170.606 s, all tabs 196.761 s, 7 state requests, 1 duplicado light, `full=false`, 0 errores page/resource. |
| 18 | El objetivo exige que Aulas/Telefonico puedan quedar `skipped: project not provided` cuando no existe proyecto real, pero faltaba una evidencia aislada del contrato sin servidores ni rutas inventadas. | Ejecutar el wrapper sin proyectos y registrar el artifact de skips para los cuatro perfiles. | `tmp/perf/monitoreo-hydration-skip-contract-20260629/report.json`: schema `monitoreo_hydration_performance_check_v4`, cuatro resultados `skipped=true`, reason `project not provided`; se escriben `report.json`, `summary.json`, `report.md` y `screenshots/` por perfil. |
| 19 | El build de produccion avisaba un ciclo entre `monitoreo-acreditacion` y `monitoreo-territorial`, senal de que codigo compartido de salidas podia quedar pegado a chunks de perfil. | Incluir `frontend/src/features/monitoreo/salidas/` en el chunk compartido `monitoreo-core` dentro de `frontend/vite.config.ts`. | `pnpm --dir frontend build:fast` pasa sin warning circular; `pnpm --dir frontend typecheck` y `git diff --check` pasan. No se registra como mejora de tiempos hasta medir una nueva corrida. |
| 20 | Con backend listo, BootGate marcaba `monitoreo_datos` como cubierto y el cliente entraba a `/monitoreo` sin tener `validation_summary`/`queries_summary` transferidos; al saltar BootGate visual, la production-like quedaba en 21/24 por Validacion. | Mantener `monitoreo_datos` fuera del paralelo con backend, pero ejecutarlo justo despues de que backend confirme Monitoreo; cuando esa senal existe, `warmupMonitoreoLocalData()` solo trae scopes al cliente y evita repetir prewarm/mapas territoriales. | `tmp/perf/territorial-bootgate-client-cache-final-20260629/report.json`: BootGate 46.079 s, `/monitoreo` visual 0.126 s, topbar/sidebar 0.123 s, `Validacion/Geolocalizacion` 0.496 s, 6 state requests en BootGate, 0 en ruta, 0 duplicados, `full=false`, 0 errores. |

## Regla de parada

Esta iteracion se detiene cuando:

- el dedupe de cache queda probado;
- Aulas queda medida con capturas all en fixture y sin full scope; se verifico que `HSVG2026.pulso` no es evidencia de Monitoreo Aulas. Telefonico queda funcionalmente alineado como acceso directo a Acreditacion/Telefono con 4/4 tabs locales focales medidas por el harness automatico, pero sin proyecto real telefonico localizado;
- Territorial queda con warmup backend completo, loading mapeado, entrada critica post-warmup, mapa visible, detalle UMP profundo y tabs all medidos; el costo de import/montaje dev queda como residual. Acreditacion queda con tabs all medidos y dedupe corregido; performance de preparacion inicial/render all queda como residual;
- el build de Monitoreo no emite ciclo circular entre chunks de Acreditacion y Territorial; queda pendiente medir si la correccion impacta el primer montaje dev;
- el flujo BootGate real transfiere cache territorial al cliente antes de entrar a Monitoreo, sin repetir prewarm territorial cuando backend ya lo preparo;
- las matrices QA registran evidencia y limitaciones;
- la validacion automatica disponible queda ejecutada o justificada.
