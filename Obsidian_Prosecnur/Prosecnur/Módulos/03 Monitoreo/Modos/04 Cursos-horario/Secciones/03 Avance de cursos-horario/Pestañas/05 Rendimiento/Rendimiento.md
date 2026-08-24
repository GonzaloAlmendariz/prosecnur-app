---
tipo: pestana
padres:
  - "[[Avance de cursos-horario]]"
orden: 5
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=avance&pestana=rendimiento"
nodo: "monitoreo/aulas/avance/rendimiento"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasRitmoDiario.tsx"
  - "frontend/src/features/monitoreo/profiles/aulas/kpisDeAulas.ts"
---

# Rendimiento

> Ordena las facultades por lo que rinde cada curso-horario aplicado.

## Objetivo

Saber dónde una sesión más aporta más respuestas, para priorizar el esfuerzo que queda.

## Cómo se usa

1. Compara el rendimiento por facultad, ajustado por el tamaño de la muestra de cada una.
2. Contrástalo con el colchón de reservas antes de reasignar equipo.
