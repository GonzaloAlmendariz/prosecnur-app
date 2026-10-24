---
tipo: pestana
padres:
  - "[[Avance telefónico]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=avance&pestana=ritmo"
nodo: "monitoreo/telefonico/avance/ritmo"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/Ritmo.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/ritmoModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/escalaDeEje.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/TelefonicoPhoneDailyTrend.ts"
---
# Ritmo telefónico

> A qué velocidad avanza el campo: una sola serie diaria con su eje y el acumulado con eje propio.

## Qué muestra

Una sola serie diaria de efectivas en barras con su eje, el acumulado en un eje propio, el mapa de calor por día y hora y las fechas que trae la hoja (formatos distintos o en blanco se señalan).

## De dónde lee

Los bloques `avance_efectivo_dia`, `avance_efectivo_variable_dia`, `estatus_dia` y `estatus_telefonico`.

## Qué decide

Si el ritmo alcanza para cerrar la cuota en los días que quedan, y si la hoja dejó de registrar mientras Kobo seguía.

## Ubicación en la jerarquía

- Padre: [[Avance telefónico]].
