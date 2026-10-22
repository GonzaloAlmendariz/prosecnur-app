# Checklist · Monitoreo acreditación a 45 mil contactos: T0 + T1 (2026-10-22)

Pedido de Gonzalo: «Dale con T0 y T1», sobre
`docs/qa/diagnostico-monitoreo-acred-institucional-2026-10-22.md` §4.

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| T0 | Consultas deja de reclasificar como «Fuera de base» las efectivas de actores con nombre compuesto al servir el tablero desde caché | `api/R/monitoreo_router_acreditacion.R` (`.monitoreo_acreditacion_case_base_actor`) + `test-monitoreo-acreditacion-reparacion-cache.R` | hecho: rojo con el código previo (5 fallas), verde con el arreglo |
| T1.1 | Perfilar el cruce y el tablero al 10 % para ubicar los puntos calientes | experimento en el scratchpad de la sesión | en curso |
| T1.2 | `assisted_review$assignment_candidates` deja de copiar el universo entero del actor en cada caso | engine (extraído a archivo nuevo) + normalizador front | pendiente |
| T1.3 | Cruce y tablero en tiempo casi lineal; meta: 45 mil contactos en minutos, no horas | archivos nuevos extraídos del engine | pendiente |
| T1.4 | Equivalencia: mismo resultado (casos, rollup, totales) antes y después, sobre el experimento y sobre acrconta | test nuevo | pendiente |
| T1.5 | Verificación en la app con la copia de trabajo a escala completa | `/ver-ui` | pendiente |

## Notas

- El 90 % del payload de Consultas (109 de 124 MB al 10 %) es `assisted_review`. Dentro de él,
  `assignment_candidates` lista toda la base del actor, menos las efectivas, en cada respuesta parcial o sin cruce. La UI la
  usa como buscador para asignar a mano (`AcreditacionAssistedReviewBlock`). El servidor
  valida la persona elegida contra esa misma lista
  (`.monitoreo_acreditacion_apply_case_reconciliation`). Un cambio de forma toca los dos lados.
