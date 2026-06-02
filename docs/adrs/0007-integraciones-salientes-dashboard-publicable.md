# ADR 0007: Integraciones salientes y dashboard publicable

Estado: Aceptado

Fecha: 2026-05-31

## Contexto

Prosecnur es una aplicacion local, pero algunos flujos necesitan interactuar
con servicios externos. SurveyMonkey y Kobo permiten importar instrumentos o
respuestas cuando el usuario provee credenciales. El dashboard tambien tiene la
intencion explicita de publicarse en Hugging Face como un artefacto hospedado
para compartir resultados.

La tension arquitectonica es evitar que esas integraciones se interpreten como
una conversion de Prosecnur en una plataforma web o SaaS. La aplicacion
principal debe seguir siendo local, controlada por el analista y basada en
proyectos `.pulso`.

## Decision

Prosecnur permite conexiones salientes controladas y publicacion de dashboards
en Hugging Face, sin dejar de ser una aplicacion local.

SurveyMonkey/Kobo se tratan como conectores externos iniciados por el usuario.
Hugging Face se trata como destino de un artefacto derivado: un snapshot del
dashboard/proyecto con superficie publica acotada. El flujo principal de
trabajo, la sesion, el proyecto `.pulso` y la edicion siguen viviendo en la app
local.

## Consecuencias

Se gana interoperabilidad con plataformas de recoleccion y una forma practica
de compartir dashboards sin construir una plataforma colaborativa propia.

Se sacrifica aislamiento total de red. Tambien aparece una superficie adicional
de seguridad: tokens externos, datos que salen hacia servicios configurados por
el usuario y endpoints read-only del artefacto publicado.

## Cumplimiento

- Los tokens y credenciales no deben persistirse dentro del `.pulso`.
- Los conectores externos deben estar documentados como conexiones salientes
  iniciadas o configuradas por el usuario.
- El dashboard publicado debe exponer solo una superficie acotada, idealmente
  read-only, protegida por whitelist.
- La documentacion debe evitar describir Prosecnur como app web o SaaS; debe
  distinguir entre la app local y sus artefactos publicados.
- Cambios que hagan mutable el dashboard hospedado o agreguen sincronizacion
  remota bidireccional requieren un ADR nuevo.

## Notas

Relacionado con [ADR 0001](0001-app-local.md),
[ADR 0005](0005-secretos-fuera-del-proyecto.md) y la
[guia arquitectonica](../arquitectura-prosecnur.md).
