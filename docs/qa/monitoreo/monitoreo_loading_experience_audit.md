# Monitoreo loading experience audit

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-06-29
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de performance y arquitectura de Monitoreo](../historico/monitoreo-performance-arquitectura-2026-06.md)

Fecha: 2026-06-29

## Objetivo

Aceptar una apertura inicial de `.pulso` mas larga cuando esa espera prepara Monitoreo de forma real, siempre que el usuario vea progreso honesto y que la entrada posterior a `/monitoreo` no repita esperas largas.

## Estado observado

BootGate ya muestra una experiencia de carga con:

- nombre del producto y proyecto;
- porcentaje de progreso;
- barra de progreso con `role="progressbar"`;
- fases de preparacion recientes;
- mensaje amigable para backend/proyecto/modulos;
- detalle contextual para usuarios no tecnicos;
- subprogreso real de Monitoreo Territorial/Acreditacion mapeado al porcentaje global;
- porcentaje mostrado monotónico durante la preparación, para evitar retrocesos visuales cuando cambian las fuentes de progreso;
- detalle de paso activo con `N de M pasos` y porcentaje cuando el job backend lo informa;
- lista de pasos que prioriza trabajos activos o pendientes aunque existan muchos pasos ya listos;
- aviso de preparacion en segundo plano cuando la app ya esta lista.

Referencias auditadas: `frontend/src/app/BootGate.tsx`, `frontend/src/app/boot.css`, `frontend/src/app/warmupRegistry.ts`, `frontend/src/features/project/ProjectShell.tsx`.

## Matriz de carga

| Fase | Evidencia | Resultado |
| --- | --- | --- |
| Apertura de proyecto | `bootApiProjectWarmup()` y `warmupFrontendModules()` alimentan estado de BootGate. | progreso real disponible |
| Warmup Monitoreo | `warmupMonitoreoLocalData()` lee estado light y scopes por familia. | prepara datos antes de entrar al modulo |
| Dedupe de cache | `apiMonitoreoState()` comparte promesas en vuelo para la misma clave. | evita duplicacion simultanea warmup/shell |
| Cache por scope Acreditacion | `AcreditacionProfilePage` conserva `source`, `advance_summary`, `queries_summary` y `phone_summary` ya hidratados y los invalida en refresh/mutaciones. | evita recargas al cambiar de seccion |
| Entrada post-proyecto Aulas | fixture all: visual 0.377 s, 5/5 tabs declaradas en 2.357 s, retorno warm 0.358 s, 5 state requests, sin full scope. | medido OK |
| Proyecto real Aulas | `HSVG2026.pulso` inspeccionado: contiene `calc_muestra_aulas_config` y `calc_muestra_aulas_frame`, pero no `monitoreo_config` ni `monitoreo_aulas_snapshot`. | no es evidencia de Monitoreo Aulas |
| Entrada post-proyecto Telefonico | contrato vigente standalone focal: `tmp/perf/monitoreo-telefonico-focal-contract-20260629/report.json` mide visual 1.240 s, primera vista 2.440 s, 4/4 tabs locales en 5.400 s, retorno warm 0.766 s, 5 state requests, 0 duplicados, sin full scope. | funcional OK; fixture con datos limitados |
| Warmup inicial Telefonico | Regression backend: `test-project-warmup.R` prueba que `project.warmup` prepara `source`, `advance_summary`, `queries_summary` y `phone_summary` para familia `telefonico`, devuelve `Monitoreo telefónico preparado.` y no usa `full`. | contrato BootGate OK; falta medir en proyecto telefonico real |
| Entrada post-proyecto Territorial | BootGate real 118.570 s; topbar/sidebar 0.007 s; entry data 2.711 s; `source` 1.624 s; `advance_summary` 5.179 s; resumen de avance 8.318 s; 0 duplicados y sin full scope. | OK para entrada critica; mapa/footer pendiente |
| Entrada post-proyecto Territorial, mapa critico | Sesion focalizada ACNURCG: preparacion 110.410 s, visual 0.221 s, entry data 3.118 s, `Avance/Resumen` 8.853 s, `Avance/Mapa y UMP` 11.670 s, detalle UMP profundo 54.468 s, retorno warm 1.204 s; 3 state requests, 0 duplicados, sin full scope. | OK para mapa visible y detalle profundo sin loaders; costo de capas ricas/GPS sigue alto |
| Entrada post-proyecto Territorial, tabs all | Sesion ACNURCG final: preparacion 19.527 s, primer visual dev 170.606 s, entry data 172.166 s, 24/24 tabs hidratadas a 196.761 s, extra posterior al primer visual 26.155 s, warm map 1.550 s, 7 state requests, 1 duplicado light, sin full scope. | Cobertura all OK; el costo de import/montaje dev sigue pendiente |
| Entrada BootGate Territorial production-like | `tmp/perf/territorial-bootgate-client-cache-final-20260629/report.json`: BootGate 46.079 s, luego `/monitoreo` visual 0.126 s, topbar/sidebar 0.123 s, `Validacion/Geolocalizacion` 0.496 s, 6 state requests antes de entrar, 0 state requests en ruta, 0 duplicados, sin full scope. | OK para la logica de esperar mas al abrir y entrar ya hidratado |
| Warmup inicial Acreditacion 240 s | ACRDCONTA: `source` y `advance_summary` listos; `queries_summary` y `phone_summary` pendientes. | parcial, no suficiente |
| Warmup inicial Acreditacion 320 s | ACRDCONTA: `complete: true`, Monitoreo `ready`, `source`, `advance_summary`, `queries_summary` y `phone_summary` listos en 251.981 s. | backend OK |
| Entrada post-warmup Acreditacion | ACRDCONTA scope-cache: preparacion backend 22.471 s, warmup frontend `monitoreo,monitoreo_datos`, visual 27.120 s desde navegacion, primera vista 27.763 s, 22/22 tabs en 49.493 s, retorno warm 0.975 s, 5 state requests, 0 duplicados, sin full scope. | cobertura y dedupe OK; costo de preparacion/render all pendiente |
| Progreso BootGate Acreditacion por scopes | `frontend/src/app/BootGate.tsx` ahora mapea los scopes backend de Acreditacion como pasos legibles: "Fuentes de acreditacion", "Avance de acreditacion", "Consultas de revision" y "Seguimiento telefonico"; el mensaje general evita jerga tecnica y explica que se preparan fuentes, avance, consultas y seguimiento antes de entrar. Validacion: `pnpm --dir frontend typecheck`, focused Monitoreo Vitest 35 files / 232 tests, `pnpm --dir frontend build:fast` y `git diff --check`. | comunicacion de espera reforzada |
| Warmup inicial Territorial 320 s | ACNURCG: `complete: true`, Monitoreo territorial `ready`, fases `field` y `pilot`, scopes `source`, `route_summary`, `advance_summary`, `validation_summary`, `queries_summary` listos; corrida final v2 `project.warmup` 108.789 s. | backend OK |
| Loading visual Territorial | Capturas `tmp/perf/territorial-progress-mapped/ui-loading/`: inicio, medio y tarde con mensajes "Ordenando hojas de ruta" y "Revisando validaciones"; sin errores API/page/console. | UI OK |
| Progreso mapeado Territorial | `tmp/perf/territorial-progress-mapped/progress-summary.json`: 35% Monitoreo, 65% revision territorial/mapas, 67-78% scopes field, 80-95% scopes pilot, 100% done. | progreso honesto OK |
| Progreso BootGate micro-iteracion | `frontend/src/app/BootGate.tsx`: el porcentaje visible conserva el mayor avance observado durante warmup/background y el paso backend activo muestra `N de M pasos` + porcentaje real cuando existe. Validacion: `pnpm --dir frontend exec tsc --noEmit --pretty false` y `git diff --check`. | comunicacion de avance reforzada |
| Empaquetado Monitoreo | `frontend/vite.config.ts` coloca `salidas/` en `monitoreo-core`. Validacion: `pnpm --dir frontend build:fast`, `pnpm --dir frontend typecheck` y `git diff --check`. | build sin ciclo circular Acreditacion/Territorial; el impacto de usuario se mide via BootGate/cache cliente |

## Riesgos UX

- La carga inicial comunica progreso y ahora tiene presupuesto suficiente para completar Acreditacion y Territorial reales en backend. En Acreditacion, BootGate divide el trabajo visible en fuentes, avance, consultas y seguimiento telefonico para que la espera larga se lea como avance concreto antes de entrar. Telefonico comparte el warmup compacto de Acreditacion para pagar `source`, `advance_summary`, `queries_summary` y `phone_summary` antes de entrar. Territorial reutiliza cache al entrar y ya cubre 24/24 tabs; ademas, en el flujo BootGate production-like, los scopes territoriales se transfieren al cliente antes de soltar la suite, de modo que `/monitoreo` entra en 0.126 s y Validacion abre en 0.496 s sin requests de state en la ruta. El ciclo circular de chunks Acreditacion/Territorial quedo eliminado en build; el primer montaje/import del perfil en dev sigue siendo un cuello del entorno dev, no la lectura principal del flujo de usuario. En Acreditacion, `tab-scope all` ya esta cubierto y los duplicados se eliminaron, pero la experiencia no debe considerarse instantanea porque una parte importante se paga en la preparacion inicial y otra al recorrer todas las tabs en frio.
- BootGate tiene mensajes de error y estados de timeout, pero esta auditoria no verifico un flujo visual de reintento especifico para Monitoreo.
- Las fixtures pequenas validan sensacion post-proyecto; no representan el costo real de ACRDCONTA/ACNURCG. `HSVG2026.pulso` se descarta como evidencia de Monitoreo Aulas porque todavia no contiene configuracion/snapshot de Monitoreo. En Telefonico, el warmup backend ya comunica y prepara `source`, `advance_summary`, `queries_summary` y `phone_summary`; el standalone vigente queda centrado en 4 tabs locales y el harness ya mide ese contrato focal, pero sigue faltando un proyecto real telefonico con datos ricos.

## Recomendaciones

1. Mantener el modelo de espera inicial larga: Acreditacion puede requerir una preparacion backend larga en proyectos reales y, ademas, conviene que el navegador precaliente `monitoreo_datos` antes de soltar el shell; Territorial ya aplica esta regla en BootGate, pagando backend y transferencia de scopes de cliente antes de entrar; Telefonico debe prepararse en BootGate con los scopes compactos y entrar directo al tablero de telefono, dejando al perfil solo el costo de pintar o transferir sus 4 tabs locales.
2. Mantener mensajes de progreso orientados a trabajo: fuentes, rutas, mapas, avance, validaciones, consultas y telefono; evitar jerga como backend/cache en la pantalla principal.
3. Exponer en UI cuando un tab esta usando un scope caro y permitir que el resto del workbench quede interactivo.
4. Usar mas hitos de progreso durante cargas de 5-10 s: "preparando fuentes", "preparando consultas", "ordenando casos", "actualizando tablero telefonico" y "dejando el perfil listo" son mensajes entendibles para usuario no tecnico.
5. Usar la evidencia `--tab-scope all` vigente de Territorial y Acreditacion para atacar el siguiente cuello: medir de nuevo import/montaje territorial tras el ajuste de chunks y seguir con preparacion/render lento de Acreditacion, sin reintroducir requests duplicados.

## Checklist de salida

- BootGate no queda en blanco: auditado por codigo y screenshots previas.
- Progreso no es decorativo: conectado a backend/frontend warmup, incluyendo pasos por scope en Acreditacion.
- Post-proyecto rapido en fixtures: Aulas medido OK; Telefonico focal medido funcionalmente OK en 4/4 tabs locales, con 4.160 s extra tras visual todavia por optimizar.
- Inventario Aulas/Telefonico: `HSVG2026.pulso` no es Monitoreo Aulas; audit reference/tmp Aulas son fixtures validos; Telefonico no tiene `.pulso` real localizado.
- Capturas Telefonico: la evidencia vigente muestra `Telefono` como unica seccion del standalone y `Resumen`, `Dia`, `Responsables`, `Alertas` sin loaders; la evidencia v8 queda como historica del contrato anterior de perfil completo.
- Warmup Telefonico: regression backend prueba preparacion compacta previa a la entrada; queda pendiente proyecto telefonico real.
- Post-proyecto rapido en proyectos reales: Acreditacion demostrado para entrada inicial y 22/22 tabs con 0 duplicados, pero no instantaneo por preparacion/render all; Territorial demostrado con 24/24 tabs, mapa visible `Avance/Mapa y UMP` y detalle UMP profundo sin loaders en corrida all, y demostrado en flujo BootGate production-like con entrada 0.126 s y Validacion 0.496 s sin state requests en ruta.
- Build frontend: `pnpm --dir frontend build:fast` ya no reporta ciclo circular `monitoreo-acreditacion -> monitoreo-territorial`; esto corrige empaquetado, no reemplaza una medicion de UX.
- Regla de honestidad: no afirmar que Monitoreo completo esta rapido hasta reducir los cuellos de preparacion/render de Acreditacion y el primer montaje/import territorial.
