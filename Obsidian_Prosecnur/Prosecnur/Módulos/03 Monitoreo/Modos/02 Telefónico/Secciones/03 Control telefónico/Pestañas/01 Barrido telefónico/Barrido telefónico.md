---
tipo: pestana
padres:
  - "[[Control telefónico]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=control&pestana=barrido"
nodo: "monitoreo/telefonico/control/barrido"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Barrido.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/barridoModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/conteoDeEquipo.ts"
---
# Barrido telefónico

> Cómo rinde la hoja de barrido: del listado a la muestra, a los llamados y a las efectivas que registra la hoja.

## Qué muestra

El embudo simétrico (listado, muestra, llamados, efectivas en la hoja), la matriz categoría × familia de status, los llamados por fecha del último intento y lo que queda sin llamar, asignado o no. A la derecha, los status del cliente con su regla.

## De dónde lee

Los bloques `resumen_telefonico`, `estatus_telefonico`, `estatus_dia` y `no_barridos_responsable`.

## Qué decide

Si el problema está en la base o en el equipo, y si la hoja dejó de registrar mientras Kobo seguía recibiendo envíos.

## Ubicación en la jerarquía

- Padre: [[Control telefónico]].
