---
tipo: pestana
padres:
  - "[[Marco]]"
orden: 2
documentacion: parcial
ruta_app: "/calc-muestra?modo=marco-disponible&seccion=marco&pestana=marco-archivo"
nodo: "calc-muestra/marco-disponible/marco/marco-archivo"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/calcMuestra.ts"
  - "frontend/src/features/calcMuestra/general/ArchivoMarcoGeneral.tsx"
  - "frontend/src/features/calcMuestra/general/ResumenMarcoDeclarado.tsx"
  - "api/R/calc_muestra_general_marco.R"
  - "docs/adrs/0090-muestra-general-sortea-de-un-marco-real.md"
---

# Archivo del marco

> En la UI: **Archivo del marco**. Sube el padrón de unidades, elige sus columnas y lo declara: de ahí salen las unidades y el N.

## Objetivo

Que el N del cálculo y el sorteo de Selección salgan de un archivo real y no de un número tecleado (ADR 0090). Al declarar, el motor escribe N y N_h en el componente.

## Cómo se usa

1. **Subir archivo** (Excel o CSV, una fila por unidad). Si es un libro con varias hojas, elige la **Hoja**.
2. Asigna las columnas: **Id de la unidad** (obligatoria; ordena el marco antes de seleccionar), **Estrato** (opcional; reparte y selecciona dentro de cada grupo) y **Tamaño** (opcional; habilita PPS). La app propone columnas por su nombre.
3. **Declarar marco**. Si el botón está deshabilitado, el motivo aparece al lado.
4. Con un marco declarado se ve su resumen; **Cambiar archivo o columnas** reabre el formulario. Sin componente, la pestaña pide primero elegir la forma del marco.
