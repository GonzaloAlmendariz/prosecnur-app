# Monitoreo loading experience audit

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
| Entrada post-proyecto Aulas | fixture: visual 0.283 s, tabs criticas 1.002 s. | medido OK |
| Entrada post-proyecto Telefonico | fixture: visual 0.176 s, tabs criticas 1.113 s. | medido OK |
| Entrada post-proyecto Territorial | BootGate real 118.570 s; topbar/sidebar 0.007 s; entry data 2.711 s; `source` 1.624 s; `advance_summary` 5.179 s; resumen de avance 8.318 s; 0 duplicados y sin full scope. | OK para entrada critica; mapa/footer pendiente |
| Entrada post-proyecto Territorial, mapa critico | Sesion focalizada ACNURCG: preparacion 110.410 s, visual 0.221 s, entry data 3.118 s, `Avance/Resumen` 8.853 s, `Avance/Mapa y UMP` 11.670 s, detalle UMP profundo 54.468 s, retorno warm 1.204 s; 3 state requests, 0 duplicados, sin full scope. | OK para mapa visible y detalle profundo sin loaders; costo de capas ricas/GPS sigue alto |
| Warmup inicial Acreditacion 240 s | ACRDCONTA: `source` y `advance_summary` listos; `queries_summary` y `phone_summary` pendientes. | parcial, no suficiente |
| Warmup inicial Acreditacion 320 s | ACRDCONTA: `complete: true`, Monitoreo `ready`, `source`, `advance_summary`, `queries_summary` y `phone_summary` listos en 251.981 s. | backend OK |
| Entrada post-warmup Acreditacion | UI visible 2.465 s con `data-audit-ready=monitoreo-acreditacion` y dashboard true; lecturas de state ya hidratado: 2.6 s, 2.6 s, 9.0 s y 2.8 s; `queries_summary` pesa 19.8 MB. | OK para entrada, tabs all pendiente |
| Warmup inicial Territorial 320 s | ACNURCG: `complete: true`, Monitoreo territorial `ready`, fases `field` y `pilot`, scopes `source`, `route_summary`, `advance_summary`, `validation_summary`, `queries_summary` listos; corrida final v2 `project.warmup` 108.789 s. | backend OK |
| Loading visual Territorial | Capturas `tmp/perf/territorial-progress-mapped/ui-loading/`: inicio, medio y tarde con mensajes "Ordenando hojas de ruta" y "Revisando validaciones"; sin errores API/page/console. | UI OK |
| Progreso mapeado Territorial | `tmp/perf/territorial-progress-mapped/progress-summary.json`: 35% Monitoreo, 65% revision territorial/mapas, 67-78% scopes field, 80-95% scopes pilot, 100% done. | progreso honesto OK |
| Progreso BootGate micro-iteracion | `frontend/src/app/BootGate.tsx`: el porcentaje visible conserva el mayor avance observado durante warmup/background y el paso backend activo muestra `N de M pasos` + porcentaje real cuando existe. Validacion: `pnpm --dir frontend exec tsc --noEmit --pretty false` y `git diff --check`. | comunicacion de avance reforzada |

## Riesgos UX

- La carga inicial comunica progreso y ahora tiene presupuesto suficiente para completar Acreditacion y Territorial reales en backend. Territorial reutiliza cache al entrar; algunos payloads grandes aun pueden tardar varios segundos por transferencia/render.
- BootGate tiene mensajes de error y estados de timeout, pero esta auditoria no verifico un flujo visual de reintento especifico para Monitoreo.
- Las fixtures pequenas validan sensacion post-proyecto; no representan el costo real de ACRDCONTA/ACNURCG.

## Recomendaciones

1. Mantener el modelo de espera inicial larga: Acreditacion requiere alrededor de 252 s y Territorial puede requerir 70-120 s segun cache/metadatos para quedar completo en backend con proyectos reales.
2. Mantener mensajes de progreso orientados a trabajo: fuentes, rutas, mapas, avance, validaciones, consultas y telefono; evitar jerga como backend/cache en la pantalla principal.
3. Exponer en UI cuando un tab esta usando un scope caro y permitir que el resto del workbench quede interactivo.
4. Ampliar el harness a `--tab-scope all` despues de resolver los cuellos reales.

## Checklist de salida

- BootGate no queda en blanco: auditado por codigo y screenshots previas.
- Progreso no es decorativo: conectado a backend/frontend warmup.
- Post-proyecto rapido en fixtures: medido.
- Post-proyecto rapido en proyectos reales: Acreditacion demostrado para entrada inicial post-warmup; Territorial demostrado para entrada critica post-warmup, mapa visible `Avance/Mapa y UMP` y detalle UMP profundo sin loaders; tabs all y costo de capas ricas/GPS pendientes.
- Regla de honestidad: no afirmar que Monitoreo esta rapido hasta remedir Territorial y Acreditacion con JSON completo.
