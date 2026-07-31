---
tipo: pestana
padres:
  - "[[Modelo operativo de acreditación]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=modelo&pestana=distribucion"
nodo: "monitoreo/acreditacion/modelo/distribucion"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx"
---

# Distribución de acreditación

> Revisa cómo se reparte la variable de interés entre los actores del estudio.

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
