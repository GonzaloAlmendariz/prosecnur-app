---
tipo: pestana
padres:
  - "[[Validación de cursos-horario]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=calidad&pestana=abiertas"
nodo: "monitoreo/aulas/calidad/abiertas"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/observacionesDeCampo.ts"
---

# Respuestas abiertas

> Junta lo que se escribió a mano en las preguntas abiertas del corte.

## Objetivo

Detectar respuestas vacías o sin contenido antes de que lleguen a Procesamiento.

## Cómo se usa

1. Recorre las observaciones por facultad.
2. El motor avisa cuando una respuesta abierta no dice nada.
