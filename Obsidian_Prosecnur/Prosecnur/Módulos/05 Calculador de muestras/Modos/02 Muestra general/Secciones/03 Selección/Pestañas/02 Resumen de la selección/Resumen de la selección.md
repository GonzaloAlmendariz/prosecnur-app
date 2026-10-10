---
tipo: pestana
padres:
  - "[[Selección]]"
orden: 2
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=seleccion&pestana=seleccion-corrida"
nodo: "calc-muestra/marco-disponible/seleccion/seleccion-corrida"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/FichaCorrida.tsx"
  - "api/R/calc_muestra_general_entrega.R"
---

# Resumen de la selección

> En la UI: **Resumen**. Dice si la selección es reproducible, cómo se repartió y la entrega en XLSX.

## Objetivo

Dejar a la vista lo necesario para repetir la selección y comprobar su reparto, y descargar el libro de entrega.

## Cómo se usa

1. Lee las cifras: muestra a contactar usada, principales, reemplazos y tamaño del marco (N) con su huella.
2. Revisa la traza: modalidad, semilla, RNG, versión de R, identificador, huellas del marco y de la configuración, y fecha.
3. Revisa el reparto por estrato (N_h, n_h a contactar, reemplazos, π, peso base). Si el n cambió en Método, un aviso pide volver a sortear.
4. **Descargar listado (XLSX)**: hojas Corrida, Memoria de cálculo, Estratos y Listado.
