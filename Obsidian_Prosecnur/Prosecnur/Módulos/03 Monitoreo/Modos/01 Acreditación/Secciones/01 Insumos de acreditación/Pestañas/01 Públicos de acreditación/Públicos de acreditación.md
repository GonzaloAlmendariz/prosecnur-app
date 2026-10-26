---
tipo: pestana
padres:
  - "[[Insumos de acreditación]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=insumos&pestana=publicos"
nodo: "monitoreo/acreditacion/insumos/publicos"
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/Publicos.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/publicosModelo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/fuentes/ActoresDelEstudio.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx"
---

# Públicos de acreditación

> Declara los grupos que responden el estudio antes de vincular encuestas, universos y recopiladores.

## En la navegación actual

Pestaña **Públicos** de Insumos (`monitoreo/acreditacion/insumos/publicos`): quiénes responden y contra qué padrón. Absorbe Fuentes › Actores, de la navegación anterior al revamp de Monitoreo (2026-10-23).

> [!note] Texto heredado
> Lo que sigue se escribió para la pestaña «Actores de acreditación». La capacidad pasó a esta pestaña, pero la composición de la pantalla y algunos rótulos cambiaron: contrástalo con la vista antes de citarlo.

## Objetivo

Conservar una identidad única por actor para que respuestas, metas y universos se atribuyan al mismo grupo.

## Cómo se usa

1. Revisa el inventario de actores del estudio.
2. Confirma que cada actor tenga una etiqueta inequívoca.
3. Continúa en [[Fuentes de acreditación]] para asignar sus insumos.

## Resultado y siguiente paso

Queda definido quién responde el estudio y qué actor debe recibir cada fuente.

## Estados, alertas y límites

- Un actor sin fuente puede existir como configuración, pero todavía no aporta datos al corte.
- Esta pestaña no modifica las respuestas ni el universo; define su destinatario.

## Ubicación en la jerarquía

- Padre: [[Insumos de acreditación]].
