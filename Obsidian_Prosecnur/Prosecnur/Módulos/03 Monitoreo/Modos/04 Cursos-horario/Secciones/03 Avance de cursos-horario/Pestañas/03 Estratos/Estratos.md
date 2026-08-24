---
tipo: pestana
padres:
  - "[[Avance de cursos-horario]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=avance&pestana=estratos"
nodo: "monitoreo/aulas/avance/estratos"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/avanceCuota.ts"
  - "api/R/monitoreo_aulas_avance_cuota.R"
---

# Estratos

> Muestra el avance y la brecha que le falta a cada estrato del diseño.

## Objetivo

Ver qué estrato va retrasado antes de que el retraso se vuelva irrecuperable.

## Cómo se usa

1. Lee el avance por estrato contra la cuota que el diseño le asignó.
2. La brecha se mide contra la cuota del diseño, no contra la suma de metas por aula (ADR 0079).
