---
tipo: pestana
padres:
  - "[[Control telefónico]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=control&pestana=equipo"
nodo: "monitoreo/telefonico/control/equipo"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Equipo.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/EquipoMatriz.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/equipoModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/telefonicoTeamModel.ts"
---
# Equipo telefónico

> Cómo rinde cada responsable: su carga y sus status frente a la mediana del equipo.

## Qué muestra

Dos vistas: «Carga» (asignados, llamados, sin llamar, efectivas en la hoja y en Kobo, brecha y días) y «Estados por operador», la matriz operador × status en porcentaje con las celdas que se desvían 12 puntos o más de la mediana (con un mínimo de 10 casos).

## De dónde lee

Los bloques `operacion_responsable`, `reintentos_responsable` y `estatus_responsable`.

## Qué decide

A quién pedirle qué. La brecha entre Kobo y la hoja por responsable es trabajo sin registrar; un desvío alto de rechazo o de no contesta apunta a guion o a franja horaria.

## Ubicación en la jerarquía

- Padre: [[Control telefónico]].
