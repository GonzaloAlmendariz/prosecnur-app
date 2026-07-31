---
tipo: pestana
padres:
  - "[[Fuentes de acreditación]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=fuentes&pestana=actores"
nodo: "monitoreo/acreditacion/fuentes/actores"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx"
---

# Actores de acreditación

> Declara los grupos que responden el estudio antes de vincular encuestas, universos y recopiladores.

## Objetivo

Conservar una identidad única por actor para que respuestas, metas y universos se atribuyan al mismo grupo.

## Cómo se usa

1. Revisa el inventario de actores del estudio.
2. Confirma que cada actor tenga una etiqueta inequívoca.
3. Continúa en [[Fuentes y universo de acreditación]] para asignar sus insumos.

## Resultado y siguiente paso

Queda definido quién responde el estudio y qué actor debe recibir cada fuente.

## Estados, alertas y límites

- Un actor sin fuente puede existir como configuración, pero todavía no aporta datos al corte.
- Esta pestaña no modifica las respuestas ni el universo; define su destinatario.

## Ubicación en la jerarquía

- Padre: [[Fuentes de acreditación]].

