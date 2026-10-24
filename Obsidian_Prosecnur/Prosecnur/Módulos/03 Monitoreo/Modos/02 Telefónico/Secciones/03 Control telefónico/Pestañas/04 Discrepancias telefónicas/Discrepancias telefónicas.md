---
tipo: pestana
padres:
  - "[[Control telefónico]]"
orden: 4
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=control&pestana=discrepancias"
nodo: "monitoreo/telefonico/control/discrepancias"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Discrepancias.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/discrepanciasModel.ts"
  - "api/R/monitoreo_telefonico_discrepancias.R"
---
# Discrepancias telefónicas

> Los casos en que Kobo y la hoja de barrido no dicen lo mismo, en los dos sentidos, con la decisión del supervisor.

## Qué muestra

La matriz 2 × 2 de cómo cruzan (efectiva o no en la hoja por efectiva o no en Kobo), los grupos por revisar y la cola del grupo con responsable, CodPulso, proGres cuando existe, envío en Kobo y enumerador (en ámbar si no es el responsable). La ficha del caso pone lado a lado lo que dicen las dos fuentes.

## De dónde lee

El bloque `discrepancias_telefonicas`, cruzado con `control_tiempo_kobo`.

## Qué decide

Cada caso se decide como «Cuenta» o «No cuenta», con nota, y la decisión queda guardada en el proyecto con quién decidió y cuándo. Mientras no se decide, la efectiva cuenta. Los pendientes se avisan al equipo en [[Avisos telefónicos]].

## Ubicación en la jerarquía

- Padre: [[Control telefónico]].
