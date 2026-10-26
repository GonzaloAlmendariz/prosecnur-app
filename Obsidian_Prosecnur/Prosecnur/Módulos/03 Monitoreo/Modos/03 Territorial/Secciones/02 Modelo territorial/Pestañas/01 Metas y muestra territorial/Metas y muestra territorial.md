---
tipo: pestana
padres:
  - "[[Modelo territorial]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=territorial&seccion=modelo&pestana=metas"
nodo: "monitoreo/territorial/modelo/metas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/territorial/modelo/MetasTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/modelo/metasModel.ts"
  - "frontend/src/features/monitoreo/profiles/territorial/modelo/MapaDeLaMuestra.tsx"
---
# Metas y muestra territorial

> Qué hay que lograr: cuánto, dónde y en qué fase.

## Qué muestra

La meta por distrito con su base, las dos fases del operativo (Piloto y Campo) y cómo se arma la muestra de UMP titulares y reemplazos. Al costado, el mapa de las manzanas de la ruta, con los reemplazos que el corte de avance marca en uso.

## De dónde lee

De la muestra que se arma en Hojas de ruta. Aquí se lee; se edita allá. Mientras el corte de ruta no llega, la pestaña dice que está leyendo la muestra; si el proyecto no tiene muestra armada, lo dice y ofrece abrir Hojas de ruta.

## Qué absorbe

La definición que antes vivía en UMPs › Manzanas, la meta de Avance › Distritos y la banda de fase Piloto/Campo del chrome.

## Ubicación en la jerarquía

- Padre: [[Modelo territorial]].
