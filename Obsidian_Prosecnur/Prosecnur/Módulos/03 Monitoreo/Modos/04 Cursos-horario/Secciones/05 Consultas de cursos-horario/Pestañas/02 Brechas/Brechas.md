---
tipo: pestana
padres:
  - "[[Consultas de cursos-horario]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=consultas&pestana=brechas"
nodo: "monitoreo/aulas/consultas/brechas"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/kpisDeAulas.ts"
---

# Brechas

> Lista los cursos-horario que quedaron por debajo de la meta que el diseño esperaba de ellos.

## Objetivo

Decidir si una sesión se repite, se refuerza o se reemplaza.

## Cómo se usa

1. Ordena por la distancia a la meta del aula.
2. Cada aula declara por qué esperaba lo que esperaba.
