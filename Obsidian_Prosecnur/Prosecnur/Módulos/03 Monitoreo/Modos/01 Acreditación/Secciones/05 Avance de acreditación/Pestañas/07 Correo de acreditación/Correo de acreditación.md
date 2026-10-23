---
tipo: pestana
padres:
  - "[[Avance de acreditación]]"
orden: 7
documentacion: parcial
ruta_app: "/monitoreo?modo=acreditacion&seccion=avance&pestana=correo"
nodo: "monitoreo/acreditacion/avance/correo"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/monitoreo/profiles/acreditacion/AvanceCorreo.tsx"
  - "frontend/src/features/monitoreo/profiles/acreditacion/avanceCorreoModelo.ts"
  - "api/R/monitoreo_mailchimp_modelo.R"
  - "api/R/monitoreo_mailchimp_lectura.R"
---
# Correo de acreditación

> Trae de Mailchimp los envíos del estudio y los mide por público, con los correos inválidos fuera de la base alcanzable.

## Qué muestra

Por público: universo, invitados, correos inválidos, base alcanzable, efectivas y tasas sobre las dos bases, bajas y quejas. Por envío: el embudo entregados, aperturas, clics y respuestas, también abierto por público, y la lista de correos inválidos por token.

## De dónde lee

El snapshot de Mailchimp que deja `monitoreo_mailchimp_lectura.R` y el universo del cruce de Monitoreo. El público de cada destinatario es el actor de su token en el universo, no la etiqueta del envío; un rebote duro sale del denominador en vez de contar como «no respondió».

## Qué decide

Cuándo mandar el siguiente recordatorio y a quién, con el ritmo sugerido por bajas y quejas.

## Ubicación en la jerarquía

- Padre: [[Avance de acreditación]].
