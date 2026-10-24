# ADR 0113: «Mis secciones» del correo viven en el estudio (`.pulso`)

Estado: Aceptado

Implementacion: En curso (GOAL editor de correos profesional, L9)

Fecha: 2026-10-24

Fecha de decision: 2026-10-24 (Gonzalo, ante el tablero «Decisión» de las maquetas aprobadas: «1. B»)

Reemplaza: —

Extiende: [ADR 0110](0110-material-de-campo-se-conecta-y-escribe-correos-para-mailchimp.md) (plantilla de correo y
sus imágenes) y [ADR 0111](0111-material-de-campo-se-organiza-por-campanas-tipadas.md) (campañas de correo).

## Contexto

El editor de correos arma cada correo con secciones (Destacado, Pasos, Fecha límite, Beneficios, Cita, Preguntas
frecuentes, Contacto…). Una sección bien hecha —el sorteo con su foto, el contacto con su retrato, las preguntas de
siempre— se repite entre los correos de un estudio y entre estudios. Los editores comerciales la guardan como «bloque»
o «módulo» en la cuenta del usuario (benchmark `docs/qa/benchmark-editores-correo-2026-10.md` §6).

Había dos lugares posibles:

- **A · por equipo**, en la app y fuera del `.pulso`: disponible en todo estudio sin hacer nada, pero al abrir el
  `.pulso` en otra computadora no están, y sus imágenes vivirían en la máquina, como los secretos (ADR 0005).
- **B · por estudio**, dentro de cada `.pulso`: el estudio viaja completo y lo enviado se puede reproducir en cualquier
  máquina; para reutilizarlas en otro estudio hay que importarlas (un paso).

## Decisión

**B.** «Mis secciones» es parte del material del estudio: vive en `collection_state$mail_sections` (contrato
`collection_mail_sections/v1`) y viaja en `state.rds` del `.pulso`.

- **Una sección guardada es una copia**, no un vínculo: usarla inserta una copia nueva del bloque en el correo;
  cambiar la sección después no toca los correos que ya la usan (ni los enviados). No hay sincronización.
- **Guarda el bloque con su texto, su imagen y su estilo**, y los campos de persona como `{{campo}}`, sin valores.
  No guarda lo `guardado` por «Cambiar por» (es contenido oculto del correo de origen).
- **Las imágenes** son las del proyecto (`mail_image`, por id): la sección las nombra y, con su descripción y su URL
  pública si la tienen, las lleva al correo donde se inserta. Todo `mail_image` vigente ya viaja en el `.pulso`
  (`.cmail_image_fids`), use o no un correo, así que una sección guardada nunca pierde su foto.
- **Datos personales**: un nombre de sección rechaza todo texto con forma de correo, como el de una campaña (ADR 0111);
  es texto libre de hasta 80 caracteres, igual que el nombre de una campaña. El bloque guardado de una sección Contacto
  lleva el nombre, el cargo, el correo y el teléfono de quien responde dudas en el estudio: los mismos datos que ya
  están en la plantilla del correo, nunca los de los destinatarios (los `{{campos}}` se guardan sin valores).
- **Revisión**: guardar y borrar exigen `expected_revision = state_revision`, como toda escritura del estado.
- **Rehacer el plan** (`collection_reseed.R`) conserva `mail_sections`: es configuración del usuario.
- **Importar de otro estudio** es un paso aparte y explícito: se elige un `.pulso` y sus secciones (con sus imágenes)
  se copian a este. Hasta que exista, una sección se lleva a otro estudio duplicando el correo que la usa.

## Consecuencias

- Un `.pulso` abierto en otra máquina trae sus secciones y sus fotos: el estudio es la unidad que se entrega y se
  reabre (ADR 0110).
- Un estudio nuevo empieza sin secciones propias; el catálogo de secciones prediseñadas (L6) sigue disponible siempre.
- El `.pulso` crece con cada sección guardada (un bloque es texto; las fotos ya viajaban).

## Cumplimiento

- `collection_mail_sections.R` es el único que escribe `mail_sections`; `test-collection-mail-sections.R` cubre
  guardar, listar, usar y borrar, el tope, el nombre y la revisión.
- `.COLLECTION_RESEED_CONSERVA` incluye `mail_sections` (`test-collection-reseed-conserva.R`).

## Notas

- La lista se relee al abrir la biblioteca: el store del editor es de la app y otro proyecto trae las suyas. Del mismo
  proyecto se sigue viendo lo que había mientras llega la respuesta.
- Borrar una sección no tiene deshacer: pide un segundo clic. Los correos que la usaron no cambian.
