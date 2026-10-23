---
tipo: pestana
padres:
  - "[[Control telefónico]]"
orden: 5
documentacion: parcial
ruta_app: "/monitoreo?modo=telefonico&seccion=control&pestana=respuestas"
nodo: "monitoreo/telefonico/control/respuestas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/telefonico/control/Respuestas.tsx"
  - "frontend/src/features/monitoreo/profiles/telefonico/control/respuestasModel.ts"
---
# Respuestas telefónicas

> Qué envío de Kobo es efectiva: la cadena de recibidas a efectivas, la duración y el registro de efectivas.

## Qué muestra

La cadena de envíos recibidos a efectivas, el histograma de duración con los envíos anómalos (por ejemplo, de más de 2 horas) y el registro de efectivas con filtros y su cola «Por revisar». Absorbe Efectivas Kobo, Validación de tiempo y Salvedades.

## De dónde lee

Los bloques `comparacion_codpulso` (o `campo_vs_plataforma_codpulso`) y `control_tiempo_kobo`.

## Qué decide

Qué efectivas se pueden defender antes de entregarlas.

## Ubicación en la jerarquía

- Padre: [[Control telefónico]].
