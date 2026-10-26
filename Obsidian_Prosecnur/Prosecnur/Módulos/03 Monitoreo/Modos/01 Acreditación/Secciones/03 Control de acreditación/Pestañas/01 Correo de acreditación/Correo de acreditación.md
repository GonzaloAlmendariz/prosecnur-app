---
tipo: pestana
padres:
  - "[[Control de acreditación]]"
orden: 1
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=control&pestana=correo"
nodo: "monitoreo/acreditacion/control/correo"
tags:
  - Pestaña
fuentes:
  - "frontend/src/lib/navegacion/catalogos/monitoreo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/control/contacto/Correo.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/control/contacto/correoModelo.ts"
  - "frontend/src/features/monitoreo/profiles/acreditacion/AvanceCorreo.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/avanceCorreoModelo.ts"
  - "api/R/monitoreo_mailchimp_modelo.R"
  - "api/R/monitoreo_mailchimp_lectura.R"
---
# Correo de acreditación

> Trae de Mailchimp los envíos del estudio y los mide por público, con los correos inválidos fuera de la base alcanzable.

## En la navegación actual

Pestaña **Correo** de Control (`monitoreo/acreditacion/control/correo`): cómo rinde cada envío. Absorbe Avance › Correo (es operación de contacto, no lectura), de la navegación anterior al revamp de Monitoreo (2026-10-23).

> [!note] Texto heredado
> Lo que sigue se escribió para la pestaña «Correo de acreditación». La capacidad pasó a esta pestaña, pero la composición de la pantalla y algunos rótulos cambiaron: contrástalo con la vista antes de citarlo.

## Qué muestra

Por público: universo, invitados, correos inválidos, base alcanzable, efectivas y tasas sobre las dos bases, bajas y quejas. Por envío: el embudo entregados, aperturas, clics y respuestas, también abierto por público, y la lista de correos inválidos por token.

## De dónde lee

El snapshot de Mailchimp que deja `monitoreo_mailchimp_lectura.R` y el universo del cruce de Monitoreo. El público de cada destinatario es el actor de su token en el universo, no la etiqueta del envío; un rebote duro sale del denominador en vez de contar como «no respondió».

## Qué decide

Cuándo mandar el siguiente recordatorio y a quién, con el ritmo sugerido por bajas y quejas.

## Ubicación en la jerarquía

- Padre: [[Control de acreditación]].
