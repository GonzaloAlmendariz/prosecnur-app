---
tipo: pestana
padres:
  - "[[Control telefónico]]"
orden: 7
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=control&pestana=avisos"
nodo: "monitoreo/telefonico/control/avisos"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Avisos.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/avisosModel.ts"
  - "frontend/src/features/monitoreo/profiles/telefonico/TelefonicoPhoneAlerts.ts"
  - "api/R/monitoreo_avisos_telefonico.R"
---
# Avisos telefónicos

> Qué hay que corregir, agrupado por causa y con el lugar donde se corrige.

## Qué muestra

Los avisos agrupados por causa, con nivel, conteo y destino: casos sin asignar, efectivos en la hoja sin envío de Kobo por responsable, discrepancias pendientes, cruce de la llave bajo, filtro que no encuentra su columna, status sin regla y duraciones anómalas.

## De dónde lee

La hoja `alertas` del reporte y los bloques `discrepancias_telefonicas`, `no_barridos_responsable`, `comparacion_codpulso` y `estatus_dia`.

## Qué decide

El orden de las correcciones del día: cada aviso lleva a la pestaña donde se resuelve.

## Ubicación en la jerarquía

- Padre: [[Control telefónico]].
