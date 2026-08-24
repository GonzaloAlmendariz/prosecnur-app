---
tipo: pestana
padres:
  - "[[Validación de cursos-horario]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=aulas&seccion=calidad&pestana=registro"
nodo: "monitoreo/aulas/calidad/registro"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/aulas/RegistroDeCampo.tsx"
---

# Registro de campo

> Recorre cómo fue cada aplicación, aula por aula.

## Objetivo

Reconstruir lo que ocurrió en una sesión concreta cuando una cifra no cuadra.

## Cómo se usa

1. Filtra por facultad para acotar el recorrido.
2. Desde aquí se activa el reemplazo de un curso-horario caído.
