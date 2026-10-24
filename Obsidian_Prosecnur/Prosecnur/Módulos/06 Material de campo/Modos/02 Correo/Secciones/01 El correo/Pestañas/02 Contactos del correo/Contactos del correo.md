---
tipo: pestana
padres:
  - "[[El correo]]"
orden: 2
documentacion: parcial
ruta_app: "/material-campo?modo=correo&seccion=correo&pestana=contactos"
nodo: "material-campo/correo/correo/contactos"
tags:
  - Pestaña
fuentes:
  - "frontend/src/features/recopiladores/correos/contactos/ContactosVista.tsx"
  - "frontend/src/features/recopiladores/correos/contactos/modeloContactos.ts"
  - "frontend/src/features/recopiladores/correos/contactos/EnlaceDeEncuesta.tsx"
  - "api/R/collection_mail_contactos.R"
  - "api/R/collection_mail_contactos_pulso.R"
  - "docs/adrs/0112-los-contactos-de-una-campana-de-correo-viajan-en-el-pulso.md"
---
# Contactos del correo

> Quién está en la lista de la campaña, cómo se reparte por perfil, quién respondió y el enlace personal de cada persona a la encuesta.

## Qué muestra

La lista de contactos con búsqueda, filtros y página; un tablero por variables de control elegidas (con el cruce de dos variables) y la tasa de respuesta por categoría; y el enlace personal a la encuesta que la app genera para cada contacto.

## De dónde lee

Los contactos de la campaña, que viajan en el `.pulso` (ADR 0112), y la marca de quién respondió. Cada fila es efectivo, sin correo, correo inválido o repetido; los porcentajes van siempre junto a su frecuencia.

## Qué decide

A quién va el recordatorio y en qué perfil falta respuesta. Al guardar, el proyecto avisa que lleva contactos. En el modo público estas rutas no se exponen.

## Ubicación en la jerarquía

- Padre: [[El correo]].
