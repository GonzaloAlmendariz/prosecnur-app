---
tipo: pestana
padres:
  - "[[Modelo operativo de acreditación]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=modelo&pestana=cuotas"
nodo: "monitoreo/acreditacion/modelo/cuotas"
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/modelo/Cuotas.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/modelo/DistribucionPorActor.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/useConfiguracionDeCuotas.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx"
---

# Cuotas de acreditación

> Revisa cómo se reparte la variable de interés entre los actores del estudio.

## En la navegación actual

Pestaña **Cuotas** de Modelo (`monitoreo/acreditacion/modelo/cuotas`): cuántas por categoría. Absorbe Modelo › Distribución (variable de control por público) y la definición de cuotas que antes se editaba desde Avance › Cuotas, de la navegación anterior al revamp de Monitoreo (2026-10-23).

> [!note] Texto heredado
> Lo que sigue se escribió para la pestaña «Distribución de acreditación». La capacidad pasó a esta pestaña, pero la composición de la pantalla y algunos rótulos cambiaron: contrástalo con la vista antes de citarlo.

## Objetivo

Contrastar la distribución observada por actor antes de interpretar metas y cumplimiento agregados.

## Cómo se usa

1. Selecciona la variable de interés disponible.
2. Compara su distribución entre actores.
3. Identifica categorías ausentes, dominantes o incompatibles con el diseño.

## Resultado y siguiente paso

Queda una lectura por actor que acompaña al modelo operativo y al cronograma.

## Estados, alertas y límites

- La distribución describe el corte disponible; no reemplaza la definición de metas.
- Categorías sin datos deben conservarse como ausencia, no como cero observado.

## Ubicación en la jerarquía

- Padre: [[Modelo operativo de acreditación]].
