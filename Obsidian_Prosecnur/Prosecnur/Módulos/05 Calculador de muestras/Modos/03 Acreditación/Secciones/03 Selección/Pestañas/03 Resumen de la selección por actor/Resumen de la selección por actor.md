---
tipo: pestana
padres:
  - "[[Selección]]"
orden: 3
documentacion: parcial
ruta_app: "/calc-muestra?modo=acreditacion&seccion=seleccion&pestana=seleccion-corrida"
nodo: "calc-muestra/acreditacion/seleccion/seleccion-corrida"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/FichaCorrida.tsx"
  - "api/R/calc_muestra_general_entrega.R"
---

# Resumen de la selección por actor

> En la UI: **Resumen**. Dice si la selección del actor es reproducible y cómo se repartió.

## Objetivo

Lo mismo que el resumen de Muestra general, para el actor en foco: cifras, traza para repetir la selección, reparto por estrato y descarga.

## Cómo se usa

1. Lee muestra a contactar usada, principales, reemplazos y N del marco del actor.
2. Revisa semilla, RNG, versión de R, identificador y huellas; y el reparto por estrato con π y peso base.
3. **Descargar listado (XLSX)** entrega el libro del actor.
