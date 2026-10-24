---
tipo: pestana
padres:
  - "[[Modelo operativo telefónico]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=modelo&pestana=cuotas"
nodo: "monitoreo/telefonico/modelo/cuotas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/modelo/Cuotas.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/modelo/cuotasModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/modelo/variablesDeCuota.ts"
  - "api/R/monitoreo_telefonico_cuotas.R"
---
# Cuotas y calendario telefónicos

> Sobre qué variable se mide la cuota, cuánto se pide en cada categoría y en qué días de campo.

## Qué muestra

Las variables candidatas a eje de cuota, la meta de cada categoría frente al reparto proporcional del listado, la validación de que las metas suman y el calendario de días y horas de campo.

## De dónde lee

La configuración de metas del perfil y el bloque de cuotas del motor (`cuotas_variable`).

## Qué decide

El criterio de cumplimiento: sin metas, Avance mide cobertura del listado; con metas, mide el faltante por categoría.

## Ubicación en la jerarquía

- Padre: [[Modelo operativo telefónico]].
