---
tipo: seccion
padres:
  - "[[Acreditación]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=insumos"
tags:
  - Seccion
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/Publicos.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/Fuentes.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/insumos/reglas/Reglas.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AcreditacionSourcesModel.ts"
  - "api/R/monitoreo_engine.R"
  - "docs/adrs/0045-monitoreo-actores-modelo-telefonia-explicita.md"
---
# Insumos de acreditación

> De dónde sale cada dato y quién responde: el elenco de públicos con su padrón, las fuentes conectadas y las reglas con que se lee y se cruza cada dato.

## Qué reúne

Absorbe la antigua sección Fuentes (Actores, Fuentes y universo, Recopiladores) y los estados de llamadas que vivían en Teléfono, desde el revamp de Monitoreo (2026-10-23).

| Pestaña | Rótulo en la app | Pregunta que responde |
|---|---|---|
| [[Públicos de acreditación]] | Públicos | ¿quiénes responden y contra qué padrón? |
| [[Fuentes de acreditación]] | Fuentes | ¿qué está conectado y por qué canal entra? |
| [[Reglas de acreditación]] | Reglas | ¿cómo se lee y se cruza cada dato? |

## Regla de lectura

Las encuestas en plataforma aportan respuestas; los padrones aportan el universo contra el que esas respuestas se cruzan. Una respuesta completa no es efectiva por sí sola: cuenta cuando pasa las reglas declaradas aquí y cruza con el padrón de su público. Actor y canal se declaran de forma explícita en cada fuente (ADR 0045); una inferencia desde nombres o títulos es una señal de migración, no una autoridad. Todo lo que el modo afirma después descansa en esta sección: cuando una cifra no cuadra, se vuelve aquí.

## Ubicación en la jerarquía

- Padre: [[Acreditación]].
