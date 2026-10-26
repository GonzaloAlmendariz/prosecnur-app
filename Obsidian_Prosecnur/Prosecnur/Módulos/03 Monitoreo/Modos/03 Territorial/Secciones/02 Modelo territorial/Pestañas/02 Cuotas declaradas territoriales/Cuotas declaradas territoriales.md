---
tipo: pestana
padres:
  - "[[Modelo territorial]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=territorial&seccion=modelo&pestana=cuotas"
nodo: "monitoreo/territorial/modelo/cuotas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/territorial/modelo/CuotasTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/modelo/cuotasModel.ts"
---
# Cuotas declaradas territoriales

> Qué cuota declara el proyecto y por qué variable.

## Qué muestra

Las variables de cuota, la plantilla por UMP, la cuota por distrito y las reglas con que el motor cubre una celda. La contradicción entre celdas cruzadas y marginales no se resuelve en esta pestaña.

## De dónde lee

La cuota por UMP sale de la muestra de Hojas de ruta. Si no hay cuota territorial configurada, la pestaña lo dice y remite a [[Mapeo y filtro territorial]] para revisar el mapeo de variables.

## Qué absorbe

La definición de cuotas que antes estaba en Validación › Cuotas. La lectura del logro de cada celda quedó en [[Faltante por UMP territorial]].

## Ubicación en la jerarquía

- Padre: [[Modelo territorial]].
