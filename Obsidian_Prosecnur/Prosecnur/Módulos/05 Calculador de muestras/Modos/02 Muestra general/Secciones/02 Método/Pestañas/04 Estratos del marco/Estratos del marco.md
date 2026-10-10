---
tipo: pestana
padres:
  - "[[Método]]"
orden: 4
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=metodo&pestana=metodo-estratos"
nodo: "calc-muestra/marco-disponible/metodo/metodo-estratos"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/MetodoGeneral.tsx"
  - "frontend/src/features/calcMuestra/general/EstratosGeneral.tsx"
  - "frontend/src/features/calcMuestra/general/modeloEstratos.ts"
  - "api/R/calc_muestra_general_reparto.R"
---

# Estratos del marco

> En la UI: **Estratos**. Muestra cómo se reparte el n entre los estratos del marco.

## Objetivo

Ver y, si el marco no viene de archivo, editar los estratos con su N_h, y leer cuántos casos completos y cuánta muestra a contactar le tocan a cada uno y por qué regla.

## Cómo se usa

1. Con marco declarado, estratos y N_h salen del archivo y no se editan; sin él, la tabla es editable (rótulo, N_h, agregar y quitar).
2. En el estratificado, cada estrato lleva además su **p esperada**: con ella el n se calcula por estrato y Neyman puede repartir mejor.
3. La columna **Reparto** dice la regla aplicada: proporcional, Neyman, piso o censo del estrato.
4. Si la técnica no reparte por estratos, la pestaña lo dice y lleva a «Técnica». Con matriz operativa (volumen por celda) se muestra la tabla de servicios.
