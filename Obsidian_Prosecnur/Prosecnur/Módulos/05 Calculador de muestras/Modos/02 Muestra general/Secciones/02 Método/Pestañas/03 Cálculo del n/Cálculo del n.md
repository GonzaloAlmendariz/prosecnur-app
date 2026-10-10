---
tipo: pestana
padres:
  - "[[Método]]"
orden: 3
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=metodo&pestana=metodo-memoria"
nodo: "calc-muestra/marco-disponible/metodo/metodo-memoria"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/MetodoGeneral.tsx"
  - "frontend/src/features/calcMuestra/general/cadenaDelN.ts"
  - "frontend/src/features/calcMuestra/general/MemoriaCalculoGeneral.tsx"
---

# Cálculo del n

> En la UI: **Cálculo del n**. Muestra la fórmula que lleva del N de la población al n y a la muestra a contactar.

## Objetivo

Defender el número: la cadena del marco a la muestra a contactar y la memoria de cálculo con la fórmula, los valores puestos en ella y el resultado.

## Cómo se usa

1. Lee la cadena **Tamaño del marco (N) → Casos completos → Muestra a contactar**. Sin cálculo cada etapa dice «—»; cuando se aborda el marco entero lo dice en vez de dividir por la respuesta.
2. Debajo, la memoria de cálculo pinta la fórmula principal con su glosario y los pasos siguientes en línea.
3. Sólo las técnicas de elementos (aleatorio simple, estratificado, sistemático) tienen memoria; las demás muestran que no hay fórmula de n porque se fija por cobertura o por cuotas.
