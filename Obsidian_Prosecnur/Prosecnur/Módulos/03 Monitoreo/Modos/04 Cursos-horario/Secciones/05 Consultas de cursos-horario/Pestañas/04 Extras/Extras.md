---
tipo: pestana
padres:
  - "[[Consultas de cursos-horario]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=consultas&pestana=extras"
nodo: "monitoreo/aulas/consultas/extras"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "api/R/monitoreo_aulas_universitarias.R"
---

# Extras

> Consulta el banco de aulas adicionales disponible para cerrar la cuota de cada facultad.

## Objetivo

Saber si el banco alcanza para cubrir lo que falta, y no sólo cuántas aulas tiene.

## Cómo se usa

1. Consulta el banco por facultad.
2. Un extra activado se aplica igual que un titular y suma al numerador; la cuota no crece con él.
