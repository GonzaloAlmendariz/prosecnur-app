---
tipo: pestana
padres:
  - "[[Avance telefónico]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=avance&pestana=cuotas"
nodo: "monitoreo/telefonico/avance/cuotas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/CuotasFaltante.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/cuotasFaltanteModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/FaltanteDiario.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/segmentoDeCuotas.ts"
---
# Avance por cuota telefónico

> Cuánto falta en cada categoría de la cuota. Es la pestaña donde aterriza el modo.

## Qué muestra

La tabla por categoría con el faltante primero (carmesí si falta, verde si cumple), las efectivas contra la meta y su acumulado diario. A la derecha, «Faltan para la meta» con ritmo, rendimiento, sin llamar y sin asignar, la muestra por familia de status y «De dónde sale la cifra». Con pocas categorías se suma el faltante al cierre de cada día.

## De dónde lee

Los bloques `cuotas_variable` y `avance_efectivo_variable_dia`; faltante = meta − efectivas, con piso en cero.

## Qué decide

Dónde concentrar las llamadas que quedan. Sin metas declaradas, la pestaña mide cobertura del listado.

## Ubicación en la jerarquía

- Padre: [[Avance telefónico]].
