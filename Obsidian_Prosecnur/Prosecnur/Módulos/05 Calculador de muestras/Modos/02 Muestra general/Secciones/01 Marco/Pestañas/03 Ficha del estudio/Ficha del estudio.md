---
tipo: pestana
padres:
  - "[[Marco]]"
orden: 3
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=marco&pestana=marco-ficha"
nodo: "calc-muestra/marco-disponible/marco/marco-ficha"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/FichaEstudio.tsx"
  - "frontend/src/features/calcMuestra/general/VariablesControl.tsx"
---

# Ficha del estudio

> En la UI: **Ficha del estudio**. Dice qué estudio es, de dónde sale su marco y qué variables controla.

## Objetivo

Dejar escrito el contexto que acompaña al diseño en sus salidas: título, cliente, fuente y unidades del marco, y las variables de control disponibles.

## Cómo se usa

1. En **Contexto y marco** completa Título, Cliente, Fuente del marco, Marco disponible, Unidad de observación y Unidad de muestreo.
2. En **Variables disponibles** nombra cada variable de control, dice su uso (estrato, cuota, filtro, segmento u otro) y marca con el interruptor si está **En el marco**; **Agregar variable** suma otra.
3. Desde la cabecera de la ficha se puede volver a elegir el tipo de estudio.
