---
tipo: pestana
padres:
  - "[[Control telefónico]]"
orden: 6
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=control&pestana=supervision"
nodo: "monitoreo/telefonico/control/supervision"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Supervision.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/supervisionModel.ts"
  - "api/R/monitoreo_supervision_estratificada.R"
---
# Supervisión telefónica

> Qué efectivas se vuelven a llamar: un sorteo proporcional a cada enumerador, con al menos un caso por enumerador.

## Qué muestra

A la izquierda, cada enumerador con sus efectivas y los casos que le tocan; al centro, los casos sorteados con su enumerador, categoría y envío; a la derecha, el sorteo (base, tamaño, semilla y regla) y, si se conecta, el resultado de la rellamada.

## De dónde lee

Los bloques `supervision_resumen`, `supervision_reparto`, `supervision_controles` y `supervision_casos`. La base son las efectivas únicas de Kobo, no todas las filas del listado; el reparto es proporcional con redondeo por mayor resto y la misma semilla da la misma lista.

## Qué decide

La lista de rellamadas de control de calidad, verificable a simple vista: la suma por enumerador es el tamaño de la muestra.

## Ubicación en la jerarquía

- Padre: [[Control telefónico]].
