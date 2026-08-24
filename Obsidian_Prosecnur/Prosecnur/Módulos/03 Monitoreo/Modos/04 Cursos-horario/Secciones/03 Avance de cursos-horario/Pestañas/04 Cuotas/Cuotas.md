---
tipo: pestana
padres:
  - "[[Avance de cursos-horario]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=avance&pestana=cuotas"
nodo: "monitoreo/aulas/avance/cuotas"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/avanceCuota.ts"
  - "api/R/monitoreo_aulas_avance_cuota.R"
---

# Cuotas

> Cruza el cumplimiento por sexo dentro de cada facultad.

## Objetivo

Comprobar que la sub-distribución por sexo que el diseño certificó se está cumpliendo.

## Cómo se usa

1. Revisa cada celda facultad × sexo contra su cuota.
2. Los objetivos por sexo salen de la sub-distribución del diseño, no de la composición del marco de aulas.
