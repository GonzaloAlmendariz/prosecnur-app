---
tipo: pestana
padres:
  - "[[Método]]"
orden: 1
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=metodo&pestana=metodo-tecnica"
nodo: "calc-muestra/marco-disponible/metodo/metodo-tecnica"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/MetodoGeneral.tsx"
  - "frontend/src/features/calcMuestra/general/catalogos.ts"
---

# Técnica de muestreo

> En la UI: **Técnica**. Elige con qué técnica de muestreo se calcula el tamaño de muestra (n).

## Objetivo

Fijar la técnica del componente, que decide qué parámetros se piden, si hay fórmula de n y si después se puede sortear.

## Cómo se usa

1. Elige una tarjeta: Aleatorio simple, Estratificado, Estratificado por dominios, Sistemático, Por conglomerados, Censo, Cobertura total por rutas, Muestreo por cuotas o Por conveniencia con mínimos. Cada una dice qué marco supone y qué produce (muestra probabilística, cobertura del marco o matriz de cuotas).
2. Cambiar la técnica reemplaza la del componente; los parámetros que pide aparecen en «Parámetros».
