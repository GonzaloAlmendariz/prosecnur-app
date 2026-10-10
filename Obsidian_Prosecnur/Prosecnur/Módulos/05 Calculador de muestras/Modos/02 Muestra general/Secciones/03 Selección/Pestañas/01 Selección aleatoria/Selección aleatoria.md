---
tipo: pestana
padres:
  - "[[Selección]]"
orden: 1
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=seleccion&pestana=seleccion-sorteo"
nodo: "calc-muestra/marco-disponible/seleccion/seleccion-sorteo"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/SeleccionGeneral.tsx"
  - "frontend/src/features/calcMuestra/general/modelo.ts"
  - "api/R/calc_muestra_general_sorteo.R"
---

# Selección aleatoria

> En la UI: **Selección aleatoria**. Elige método, semilla y reemplazos, y selecciona las unidades del marco declarado.

## Objetivo

Producir la selección reproducible del componente: misma semilla y mismo marco dan el mismo listado.

## Cómo se usa

1. Elige el método: **MAS**, **Sistemático** (intervalo fraccional sobre el marco ordenado; aparece «Ordenar por») o **PPS** (requiere columna de tamaño en Marco).
2. Fija la **Semilla** (entero entre 1 y 2147483646; **Nueva** genera otra) y los **Reemplazos por estrato**. Con PPS no hay reemplazos.
3. **Seleccionar muestra** (o **Seleccionar de nuevo**). Sin marco declarado la pestaña lleva a Marco; con técnica censal muestra el orden de contacto del marco entero (π = 1); con cuotas, conveniencia o conglomerados explica por qué no hay selección aquí.
