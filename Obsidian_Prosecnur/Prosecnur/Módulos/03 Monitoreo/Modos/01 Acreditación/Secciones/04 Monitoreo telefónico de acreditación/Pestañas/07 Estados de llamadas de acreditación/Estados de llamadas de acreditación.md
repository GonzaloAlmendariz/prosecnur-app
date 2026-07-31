---
tipo: pestana
padres:
  - "[[Monitoreo telefónico de acreditación]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=telefonico&pestana=estados"
nodo: "monitoreo/acreditacion/telefonico/estados"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx"
---

# Estados de llamadas de acreditación

> Confirma el significado y el color operativo de los estados que llegan desde el barrido telefónico.

## Objetivo

Mantener una lectura estable de los estados de origen sin perder su valor crudo ni confundir contacto con respuesta efectiva.

## Cómo se usa

1. Revisa los estados detectados en la fuente de barrido.
2. Confirma su agrupación operativa y su color.
3. Identifica estados nuevos o sin clasificación antes de leer las incidencias.

## Resultado y siguiente paso

Los estados quedan interpretados de forma trazable para las pestañas de ritmo, incidencia y alertas.

## Estados, alertas y límites

- El estado original se conserva aunque se agrupe para la lectura operativa.
- Un contacto efectivo en el barrido no equivale automáticamente a una encuesta efectiva.

## Ubicación en la jerarquía

- Padre: [[Monitoreo telefónico de acreditación]].

