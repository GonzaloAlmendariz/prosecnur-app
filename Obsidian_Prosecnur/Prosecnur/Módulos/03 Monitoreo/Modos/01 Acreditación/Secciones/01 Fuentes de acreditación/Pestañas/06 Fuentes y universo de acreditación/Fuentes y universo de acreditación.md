---
tipo: pestana
padres:
  - "[[Fuentes de acreditación]]"
orden: 2
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=fuentes&pestana=fuentes"
nodo: "monitoreo/acreditacion/fuentes/fuentes"
verificado_contra: ""
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionSourcesModel.ts"
---

# Fuentes y universo de acreditación

> Vincula las encuestas que aportan respuestas y las hojas que definen el universo de cada actor.

## Objetivo

Hacer explícito qué fuente está conectada, a quién pertenece y qué papel cumple en el corte.

## Cómo se usa

1. Vincula las fuentes de respuestas del operativo.
2. Asigna cada fuente al actor correspondiente.
3. Declara la hoja de universo y, cuando aplique, la fuente de barrido.
4. Comprueba el estado de sincronización antes de interpretar el avance.

## Resultado y siguiente paso

Cada actor queda asociado a respuestas y a un denominador verificable. Continúa en [[Recopiladores de acreditación]] para decidir qué canales cuentan.

## Estados, alertas y límites

- Una fuente activa indica que se leerá; no garantiza por sí sola que el dato esté fresco o sea correcto.
- Una respuesta que no cruza con el universo declarado no debe atribuirse como efectiva.

## Ubicación en la jerarquía

- Padre: [[Fuentes de acreditación]].

