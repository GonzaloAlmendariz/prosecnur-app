---
tipo: pestana
padres:
  - "[[Selección]]"
orden: 4
documentacion: parcial
ruta_app: "/calc-muestra?modo=acreditacion&seccion=seleccion&pestana=seleccion-unidades"
nodo: "calc-muestra/acreditacion/seleccion/seleccion-unidades"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/TablaUnidades.tsx"
---

# Unidades seleccionadas por actor

> En la UI: **Unidades**. Lista qué unidades del actor salieron, con su probabilidad de selección (π) y su peso.

## Objetivo

Ver el listado de contacto del actor en foco.

## Cómo se usa

1. Filtra por Todas, Principales o Reemplazos y recorre las páginas.
2. Cada fila trae id, estrato, π, peso base, estado y lote.
