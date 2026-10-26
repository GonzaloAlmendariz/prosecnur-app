---
tipo: pestana
padres:
  - "[[Insumos de acreditación]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=insumos&pestana=fuentes"
nodo: "monitoreo/acreditacion/insumos/fuentes"
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/Fuentes.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/fuentesModelo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionSourcesModel.ts"
---

# Fuentes de acreditación

> Vincula las encuestas que aportan respuestas y las hojas que definen el universo de cada actor.

## En la navegación actual

Pestaña **Fuentes** de Insumos (`monitoreo/acreditacion/insumos/fuentes`): qué está conectado y por qué canal entra. Absorbe Fuentes › Fuentes y universo y Fuentes › Recopiladores (un recopilador es una propiedad de su fuente), de la navegación anterior al revamp de Monitoreo (2026-10-23).

> [!note] Texto heredado
> Lo que sigue se escribió para la pestaña «Fuentes y universo de acreditación». La capacidad pasó a esta pestaña, pero la composición de la pantalla y algunos rótulos cambiaron: contrástalo con la vista antes de citarlo.

## Objetivo

Hacer explícito qué fuente está conectada, a quién pertenece y qué papel cumple en el corte.

## Cómo se usa

1. Vincula las fuentes de respuestas del operativo.
2. Asigna cada fuente al actor correspondiente.
3. Declara la hoja de universo y, cuando aplique, la fuente de barrido.
4. Comprueba el estado de sincronización antes de interpretar el avance.

## Resultado y siguiente paso

Cada actor queda asociado a respuestas y a un denominador verificable. Continúa en Fuentes de acreditación para decidir qué canales cuentan.

## Estados, alertas y límites

- Una fuente activa indica que se leerá; no garantiza por sí sola que el dato esté fresco o sea correcto.
- Una respuesta que no cruza con el universo declarado no debe atribuirse como efectiva.

## Ubicación en la jerarquía

- Padre: [[Insumos de acreditación]].
