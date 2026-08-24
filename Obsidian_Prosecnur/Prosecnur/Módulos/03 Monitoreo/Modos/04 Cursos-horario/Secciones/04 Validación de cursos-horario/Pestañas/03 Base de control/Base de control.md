---
tipo: pestana
padres:
  - "[[Validación de cursos-horario]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=calidad&pestana=base"
nodo: "monitoreo/aulas/calidad/base"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "api/R/carga_aulas_libro_generar.R"
---

# Base de control

> Enseña la hoja del libro operativo que llena el equipo en campo.

## Objetivo

Contrastar lo que la app calcula con lo que el equipo anotó a mano.

## Cómo se usa

1. Lee la hoja tal como llega del libro, con sus cuatro tramos anclados por nombre de campo.
2. El libro distingue lo que trae la app de lo que llena la persona.
