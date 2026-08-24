---
tipo: pestana
padres:
  - "[[Consultas de cursos-horario]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=consultas&pestana=reemplazos"
nodo: "monitoreo/aulas/consultas/reemplazos"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/AulasHistoriaCadena.tsx"
---

# Reemplazos

> Sigue la cadena de reemplazo de cada curso-horario caído.

## Objetivo

Ver por qué escalón va cada cadena y cuánto colchón queda.

## Cómo se usa

1. Localiza el titular caído y lee su cadena, escalón por escalón, con el motivo de cada caída.
2. Sustituir fuera de la cadena rompe la lógica de la selección.
