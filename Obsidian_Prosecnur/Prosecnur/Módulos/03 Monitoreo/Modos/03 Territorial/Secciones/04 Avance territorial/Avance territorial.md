---
tipo: seccion
padres:
  - "[[Territorial]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=territorial&seccion=avance"
tags:
  - Seccion
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/territorial/avance/FaltantePorUmp.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/avance/Resumen.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/avance/MapaTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/avance/UmpsTab.tsx"
  - "frontend/src/features/monitoreo/profiles/territorial/TerritorialOutputsPanel.tsx"
---
# Avance territorial

> Cómo vamos y si se cumplen metas y cuotas. El modo aterriza en Faltante por UMP.

## Qué reúne

Conserva Resumen y Salidas y absorbe Distritos y Ritmo diario (dentro de Resumen), Mapa y UMP y UMPs › Cobertura (Mapa), el estado de UMPs › Manzanas (UMP) y la lectura de Validación › Cuotas (Faltante por UMP).

| Pestaña | Rótulo en la app | Pregunta que responde |
|---|---|---|
| [[Faltante por UMP territorial]] | Faltante por UMP | ¿qué celdas faltan y quién las cubre? |
| [[Resumen de avance territorial]] | Resumen | ¿cuánto cuenta y a qué ritmo? |
| [[Mapa territorial]] | Mapa | ¿dónde está el campo? |
| [[UMP territoriales]] | UMP | ¿qué UMP están completas? |
| [[Salidas territoriales]] | Salidas | ¿qué se entrega? |

## Regla de lectura

Faltante por UMP va primero porque el equipo ve primero qué celdas de cuota faltan, en qué UMP y quién las cubre.

## Ubicación en la jerarquía

- Padre: [[Territorial]].
