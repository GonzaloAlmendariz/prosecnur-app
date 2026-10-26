---
tipo: pestana
padres:
  - "[[Avance de acreditación]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=avance&pestana=cuotas"
nodo: "monitoreo/acreditacion/avance/cuotas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/acreditacion/AvanceCuotas.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/avanceCuotasModelo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AvanceCuotasEditorMetas.tsx"
  - "api/R/monitoreo_acreditacion_cuotas.R"
---
# Cuotas por categoría de acreditación

> Mide las metas por categoría dentro de cada público (por ejemplo, tipo de docente, facultad o puesto).

## Qué muestra

Para cada público, las categorías de la variable elegida con su meta, sus efectivas y lo que falta, y el editor de metas. La propuesta de meta replica la hoja «Metas de encuestas» del dimensionamiento: personas de la categoría por la cobertura esperada, redondeado hacia arriba.

## De dónde lee

El motor `monitoreo_acreditacion_cuotas.R`: la categoría de cada persona sale de su fila en la base (la columna del universo de su público), no de lo que respondió, y la efectiva se cruza por la llave de la base contra el cruce de Monitoreo.

## Qué decide

Dónde insistir dentro de un público que en total ya parece cubierto.

## Ubicación en la jerarquía

- Padre: [[Avance de acreditación]].
