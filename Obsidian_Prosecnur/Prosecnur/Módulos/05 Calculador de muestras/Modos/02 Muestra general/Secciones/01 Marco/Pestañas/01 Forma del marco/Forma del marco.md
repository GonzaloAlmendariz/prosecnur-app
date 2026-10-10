---
tipo: pestana
padres:
  - "[[Marco]]"
orden: 1
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=marco&pestana=marco-forma"
nodo: "calc-muestra/marco-disponible/marco/marco-forma"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/calcMuestra/CalcMuestraPage.tsx"
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/MesaGeneral.tsx"
  - "frontend/src/features/calcMuestra/general/MarcoShapeSelector.tsx"
---

# Forma del marco

> En la UI: **Forma del marco**. Declara qué elementos contiene el marco muestral antes de subir su archivo.

## Objetivo

Decir de qué tipo es el marco disponible —lista enumerable, estratos, conglomerados, volumen por celda, cuotas o cobertura total—, porque de esa forma depende el componente que se crea y las técnicas que tienen sentido después.

## Cómo se usa

1. Elige una de las seis tarjetas: **Marco total**, **Estratos y variables de control**, **Conglomerados**, **Volumen por celda**, **Muestreo por cuotas** o **Censo o cobertura total**. La activa queda marcada.
2. Elegir la forma crea el componente si todavía no existe y le fija una técnica de partida (estratos → estratificado, conglomerados → por conglomerados, cuotas → muestreo por cuotas, censo → intención censal, el resto → aleatorio simple), que luego se ajusta en Método. Sin componente, «Archivo del marco» no tiene a qué declarar su padrón.
3. Con el marco ya declarado la mesa abre por defecto en «Archivo del marco», no aquí.
