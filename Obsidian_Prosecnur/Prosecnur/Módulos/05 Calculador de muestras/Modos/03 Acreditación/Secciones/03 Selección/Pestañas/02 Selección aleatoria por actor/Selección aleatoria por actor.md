---
tipo: pestana
padres:
  - "[[Selección]]"
orden: 2
documentacion: parcial
ruta_app: "/calc-muestra?modo=acreditacion&seccion=seleccion&pestana=seleccion-sorteo"
nodo: "calc-muestra/acreditacion/seleccion/seleccion-sorteo"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/SeleccionActores.tsx"
  - "frontend/src/features/calcMuestra/general/SeleccionGeneral.tsx"
  - "api/R/calc_muestra_general_sorteo.R"
---

# Selección aleatoria por actor

> En la UI: **Selección aleatoria**. Elige método, semilla y reemplazos y selecciona las unidades del actor en foco.

## Objetivo

Sortear a cada actor con el mismo motor de Muestra general, por su componente.

## Cómo se usa

1. Con el actor en foco, elige método (MAS, Sistemático o PPS), semilla y reemplazos por estrato, y pulsa **Seleccionar muestra**.
2. Si el actor todavía no tiene marco, la pestaña lleva a «Archivo del marco».
3. Un actor censal se lista entero en orden aleatorio de contacto (π = 1). Un actor por cuotas, o cuya técnica no se sortea aquí, lo dice y lleva a ver su meta en Actores.
