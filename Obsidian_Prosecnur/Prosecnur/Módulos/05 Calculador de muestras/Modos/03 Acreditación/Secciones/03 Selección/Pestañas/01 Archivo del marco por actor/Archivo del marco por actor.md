---
tipo: pestana
padres:
  - "[[Selección]]"
orden: 1
documentacion: parcial
ruta_app: "/calc-muestra?modo=acreditacion&seccion=seleccion&pestana=seleccion-marco"
nodo: "calc-muestra/acreditacion/seleccion/seleccion-marco"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/SeleccionActores.tsx"
  - "frontend/src/features/calcMuestra/general/ArchivoMarcoGeneral.tsx"
  - "api/R/calc_muestra_general_marco.R"
---

# Archivo del marco por actor

> En la UI: **Archivo del marco**. Declara de qué archivo salen las unidades del actor en foco.

## Objetivo

Dar a cada actor su padrón real. Acreditación no tiene sección Marco: el marco de cada actor vive aquí, y declararlo escribe su N en el cálculo.

## Cómo se usa

1. Elige el actor en el selector de arriba (queda en la dirección como `foco`).
2. Sube el archivo, elige hoja y columnas (id obligatorio; estrato y tamaño opcionales) y pulsa **Declarar marco**: es el mismo formulario que Muestra general.
3. Declarar el marco puede cambiar la técnica del actor, porque el motor la infiere del N (ADR 0091). Con marco declarado, la sección abre por defecto en «Selección aleatoria».
