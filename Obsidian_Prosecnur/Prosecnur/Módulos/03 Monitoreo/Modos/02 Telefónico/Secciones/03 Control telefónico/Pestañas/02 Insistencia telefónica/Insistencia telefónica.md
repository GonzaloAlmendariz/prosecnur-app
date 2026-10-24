---
tipo: pestana
padres:
  - "[[Control telefónico]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=control&pestana=insistencia"
nodo: "monitoreo/telefonico/control/insistencia"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Insistencia.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/insistenciaModel.ts"
  - "frontend/src/features/monitoreo/core/ColaDeInsistencia.tsx"
  - "api/R/monitoreo_telefonico_cola.R"
---
# Insistencia telefónica

> La cola caso por caso de a quién se sigue llamando, con lo que registra la hoja.

## Qué muestra

Los casos por rellamar con CodPulso, intentos, último resultado, la observación literal de la hoja, la fecha y si ya son efectivas en Kobo. A la izquierda, los responsables con sus casos en cola; «Sin asignar» va aparte del atraso. La ficha del caso se abre como panel (`panel=caso&foco=<CodPulso>`).

## De dónde lee

Los bloques `cola_insistencia`, `cola_insistencia_responsables` y `no_barridos_responsable`.

## Qué decide

El supervisor decide si se sigue insistiendo. La app no reasigna ni marca agotado: la asignación se cambia en la hoja del equipo y Monitoreo la lee al actualizar.

## Ubicación en la jerarquía

- Padre: [[Control telefónico]].
