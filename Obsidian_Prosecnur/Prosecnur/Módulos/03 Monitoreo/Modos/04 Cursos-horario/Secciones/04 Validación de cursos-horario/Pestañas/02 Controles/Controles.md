---
tipo: pestana
padres:
  - "[[Validación de cursos-horario]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=calidad&pestana=controles"
nodo: "monitoreo/aulas/calidad/controles"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "api/R/monitoreo_aulas_avance_cuota.R"
---

# Controles

> Reúne lo que el motor deriva del corte: duplicados, huérfanas y respuestas fuera del universo.

## Objetivo

Separar lo que no cuenta al cumplimiento de lo que sí, con el motivo declarado.

## Cómo se usa

1. Revisa las respuestas sin fila del plan y las de aulas fuera del universo: se publican aparte y no suman a la cuota.
2. Comprueba que ningún identificador se haya contado dos veces.
