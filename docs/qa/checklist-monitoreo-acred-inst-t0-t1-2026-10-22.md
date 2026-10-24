# Checklist · Monitoreo acreditación a 45 mil contactos: T0 + T1 (2026-10-22)

Tipo: Checklist de pedido con varias indicaciones
Estado: Vigente
Fecha: 2026-10-22
Autoridad: Pedido de Gonzalo (citado abajo); sólo él da por terminado un ítem

Pedido de Gonzalo: «Dale con T0 y T1», sobre
`docs/qa/diagnostico-monitoreo-acred-institucional-2026-10-22.md` §4.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| T0 | Consultas deja de reclasificar como «Fuera de base» las efectivas de actores con nombre compuesto al servir el tablero desde caché | `api/R/monitoreo_router_acreditacion.R` (`.monitoreo_acreditacion_case_base_actor`) + `test-monitoreo-acreditacion-reparacion-cache.R` | hecho: rojo con el código previo (5 fallas), verde con el arreglo |
| T1.1 | Perfilar el cruce y el tablero al 10 % para ubicar los puntos calientes | experimento en el scratchpad de la sesión | hecho: revisión asistida (63 % del cruce), `.monitoreo_workbook_df` (47 % del tablero), `rollup_match_row`, índice de base, conteo de duplicados y deduplicación |
| T1.2 | `assisted_review$assignment_candidates` deja de copiar el universo entero del actor en cada caso | `monitoreo_acreditacion_cruce_escala.R` (`assignment_pool` + `assignment_pool_key`), `internalQueries.ts` (`normalizeAssignmentPool`), validación en `monitoreo_router_acreditacion.R` | hecho; vitest y testthat nuevos |
| T1.3 | Cruce y tablero en tiempo casi lineal; meta: cruce de 45 mil contactos en menos de 1 min | `monitoreo_acreditacion_cruce_escala.R` + ediciones que no crecen el engine (38,692 → 38,434 líneas) | hecho. 10 %: cruce 29.3 → 4.8 s, tablero 77.4 → 10.6 s · acrconta: 31.8 → 20.4 s y 42.2 → 30.5 s · 100 %: cruce ≈ 49 s (antes ≈ 30 min extrapolado), warmup completo del proyecto 103 s con las cuatro secciones listas (antes > 6 min y fuera de presupuesto) |
| T1.4 | Equivalencia: mismo resultado (casos, rollup, totales) antes y después, sobre el experimento y sobre acrconta | corrida HEAD vs nuevo + `test-monitoreo-acreditacion-cruce-escala.R` | hecho: iq y tablero completos iguales en ambos (candidatos rehidratados con el pool) |
| T1.6 | Transporte compacto de Consultas: casos en columnas (diccionario), rollup por índices, pool en columnas | `monitoreo_acreditacion_cruce_escala.R` (`.monitoreo_acreditacion_dashboard_para_cliente`, en la única línea de `router_monitoreo.R` que arma el tablero para el cliente) + `transportRecords` en `internalQueries.ts` | hecho; tests de ida y vuelta en R y vitest |
| T1.5 | Verificación en la app con la copia de trabajo a escala completa | `/ver-ui`, puertos 8877/5187 | hecho: Consultas 165 MB → 17.3 MB; servida desde caché en ~5 s; «Cruzó por llave 6,025 · Sin cruce 55» (sin falsos «Fuera de base»); el buscador de asignación lista las 10,430 personas pendientes de Egresados de pregrado desde el pool |

## Notas

- El 90 % del payload de Consultas (109 de 124 MB al 10 %) es `assisted_review`. Dentro de él,
  `assignment_candidates` lista toda la base del actor, menos las efectivas, en cada respuesta parcial o sin cruce. La UI la
  usa como buscador para asignar a mano (`AcreditacionAssistedReviewBlock`). El servidor
  valida la persona elegida contra esa misma lista
  (`.monitoreo_acreditacion_apply_case_reconciliation`). Un cambio de forma toca los dos lados.

- Lo que sigue caro a 45 mil contactos: la sección Avance del tablero (~76 s en el warmup). Es lineal y está repartida en normalizaciones por fila (`.monitoreo_report_key_details`, `.monitoreo_client_report_model`, `monitoreo_normalize_config`). Corre en el worker del warmup, no en el hilo de la API.
- La primera corrida de `make gate-front AREA=monitoreo` dio 1 rojo no identificado; la segunda, 5,381/5,381 verdes. Coincide con la trampa conocida de vitest con un dev server recién cerrado.
