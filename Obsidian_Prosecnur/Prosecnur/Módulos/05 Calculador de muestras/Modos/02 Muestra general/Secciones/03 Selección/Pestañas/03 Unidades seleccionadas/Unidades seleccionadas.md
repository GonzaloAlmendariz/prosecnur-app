---
tipo: pestana
padres:
  - "[[Selección]]"
orden: 3
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=seleccion&pestana=seleccion-unidades"
nodo: "calc-muestra/marco-disponible/seleccion/seleccion-unidades"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/TablaUnidades.tsx"
  - "frontend/src/features/calcMuestra/general/SeleccionGeneral.tsx"
---

# Unidades seleccionadas

> En la UI: **Unidades**. Lista qué unidades salieron, con su probabilidad de selección (π) y su peso.

## Objetivo

Ver el listado que va a campo: cada unidad con estrato, π, peso base, si es principal o reemplazo y su lote.

## Cómo se usa

1. Filtra por **Todas**, **Principales** o **Reemplazos**; cada filtro lleva su conteo.
2. Recorre el listado por páginas.
3. Sin selección, la pestaña lo dice y lleva a «Selección aleatoria».
