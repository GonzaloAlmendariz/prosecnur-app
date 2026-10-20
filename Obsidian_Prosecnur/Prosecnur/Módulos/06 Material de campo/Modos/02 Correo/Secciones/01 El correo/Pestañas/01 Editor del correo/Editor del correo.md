---
tipo: pestana
padres:
  - "[[El correo]]"
orden: 1
documentacion: parcial
ruta_app: "/material-campo?modo=correo&seccion=correo&pestana=editor"
nodo: "material-campo/correo/correo/editor"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/recopiladores/correos/CorreosEditor.tsx"
  - "frontend/src/features/recopiladores/correos/panelesCorreos.ts"
  - "frontend/src/features/recopiladores/correos/modeloSalidas.ts"
---

# Editor del correo

> Se compone el correo con bloques sobre su vista real y sale como insumo para la plataforma; la app no envía nada.

## Paneles

`?panel=correo-identidad`, `correo-destinatarios`, `correo-revision`, `correo-envios` (inspector) y `correo-importar` (diálogo). El bloque elegido es el `foco`.

## Salidas

Cada plataforma tiene una salida principal y lo dice junto a los botones: en SurveyMonkey, **Copiar HTML** (lo que se pega en el recopilador); el **Paquete del envío** es un ZIP de respaldo. En Mailchimp, la **Plantilla para importar**; con audiencia o para Outlook son respaldos.

## Ubicación en la jerarquía

- Padre: [[El correo]].
