---
tipo: pestana
padres:
  - "[[Insumos de acreditación]]"
orden: 3
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=insumos&pestana=reglas"
nodo: "monitoreo/acreditacion/insumos/reglas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/reglas/Reglas.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/reglas/reglasModelo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/reglas/LlaveDeCruce.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/reglas/QueCuentaComoEfectiva.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx"
---

# Reglas de acreditación

> Confirma el significado y el color operativo de los estados que llegan desde el barrido telefónico.

## En la navegación actual

Pestaña **Reglas** de Insumos (`monitoreo/acreditacion/insumos/reglas`): cómo se lee y se cruza cada dato. Absorbe Teléfono › Estados y las reglas que antes estaban dispersas en el perfil (llave, qué cuenta como efectiva, alertas), de la navegación anterior al revamp de Monitoreo (2026-10-23).

> [!note] Texto heredado
> Lo que sigue se escribió para la pestaña «Estados de llamadas de acreditación». La capacidad pasó a esta pestaña, pero la composición de la pantalla y algunos rótulos cambiaron: contrástalo con la vista antes de citarlo.

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

- Padre: [[Insumos de acreditación]].
