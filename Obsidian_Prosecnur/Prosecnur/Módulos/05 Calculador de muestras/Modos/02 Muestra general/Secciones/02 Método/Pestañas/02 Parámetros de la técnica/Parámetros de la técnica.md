---
tipo: pestana
padres:
  - "[[Método]]"
orden: 2
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=metodo&pestana=metodo-parametros"
nodo: "calc-muestra/marco-disponible/metodo/metodo-parametros"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/ParametrosTecnica.tsx"
  - "frontend/src/features/calcMuestra/general/AccionCalcular.tsx"
  - "api/R/calc_muestra_general_parametros.R"
---

# Parámetros de la técnica

> En la UI: **Parámetros**. Fija la confianza, el margen y la respuesta esperada que usa la técnica, y calcula el n.

## Objetivo

Pedir sólo los parámetros que la técnica del componente consume, con el rótulo y la ayuda que publica el motor, y calcular con ellos.

## Cómo se usa

1. Completa los campos que aparecen; la confianza se elige como nivel y la ayuda dice su z. Un valor que el motor corrigió lleva su aviso al lado.
2. Pulsa **Calcular**. Cambiar un parámetro borra el resultado anterior.
3. Si el N del marco es 0, el botón queda deshabilitado con el motivo: declara antes el archivo en Marco.
