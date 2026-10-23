---
tipo: seccion
padres:
  - "[[Telefónico]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=avance"
tags:
  - Seccion
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/CuotasFaltante.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/Ritmo.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/avance/Entregas.tsx"
  - "frontend/src/features/monitoreo/salidas/MonitoreoOutputsWorkbench.tsx"
---
# Avance telefónico

> Cuánto falta, a qué velocidad se avanza y qué sale del corte. El modo aterriza aquí, en Cuotas.

## Qué reúne

| Pestaña | Pregunta que responde |
|---|---|
| [[Avance por cuota telefónico]] | ¿Cuánto falta en cada cuota? (aterrizaje del modo) |
| [[Ritmo telefónico]] | ¿A qué velocidad se avanza? |
| [[Entregas telefónicas]] | ¿Qué sale para el cliente y para el equipo? |

La cuota es un mínimo: superarla es un cierre limpio. El faltante se repite en la barra del modo («FALTAN N») en todas las pestañas.

## Ubicación en la jerarquía

- Padre: [[Telefónico]].
