---
tipo: modo
padres:
  - "[[Material de campo]]"
orden: 2
documentacion: parcial
ruta_app: "/material-campo?modo=correo"
nodo: "material-campo/correo"
tags:
  - Modo
fuentes:
  - "frontend/src/lib/modules.ts"
  - "frontend/src/features/recopiladores/campanas/CampanaCorreoShell.tsx"
  - "frontend/src/features/recopiladores/correos/CorreosEditor.tsx"
  - "docs/adrs/0111-material-de-campo-se-organiza-por-campanas-tipadas.md"
---

# Correo

> Una campaña por correo para un grupo (egresados, empleadores, docentes): su plantilla, sus envíos y su salida para Mailchimp o SurveyMonkey.

## Qué es

Es el tipo `correo` de una campaña (ADR 0111). Un proyecto puede tener hasta veinte. Cada una se proyecta de `mail_campaigns`, que sigue siendo su única fuente. Se crea desde «Nueva campaña › Correo» (plantilla real, en blanco o desde un correo existente con su asunto), y se duplica, renombra o borra desde su tarjeta o desde la cabecera de la campaña abierta. Borrar la abierta vuelve a la lista.

## Dirección

`/material-campo?modo=correo&campana=correo.<id>&seccion=correo&pestana=editor&foco=<bloque>`. El enlace viejo `?seccion=catalogo&pestana=correos&foco=<id>~<bloque>` se lee y se reescribe a esta forma.

## Secciones

Una sola: [[El correo]].

## Ubicación en la jerarquía

- Padre: [[Material de campo]].
