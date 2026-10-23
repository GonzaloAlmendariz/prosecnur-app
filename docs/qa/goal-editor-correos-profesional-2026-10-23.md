# GOAL · El editor de correos es un editor profesional (2026-10-23)

Calidad que se busca: **cualquiera del equipo arma, para cualquier estudio, un correo distinto, atractivo y profesional sin pedir ayuda, y el correo se ve igual de bien en Gmail, Outlook y el celular, enviado por Mailchimp con los datos de cada persona.**

Pedido de Gonzalo (textual, 2026-10-23):
- «siento que faltan tantas cosas… esta tabla de importante, esta de azul, no la puedes cambiar de otro color, no se puede hacer más cosas con ella, no se puede reemplazar por otra cosa… quizás cuando se menciona un sorteo… poner la imagen de lo que se va a sortear. No es que siempre sea un sorteo… tú lo tienes que volver general… veo muy poca imaginación… hacer un editor en condiciones, pero no te ciñes a lo específico».
- Al aprobar la propuesta: «Está súper, solo toma en cuenta de que la tabla o lo que sea puede ser una imagen y debe verse súper bien».

Antecedentes ya hechos (no rehacer): render profesional del correo (5988884dd y siguientes), alineación clásica + tamaños + tono acento (bda51fc33), ajustes con íconos (6328da799), Personas › Variables de cada persona + puntos por fila + sin «Qué hace» (c8a401237), Mailchimp por API (de3d6a560, c1cadaf16).

## Vara
| # | Afirmación | Cómo se mide |
|---|---|---|
| V1 | Todo bloque y sección tiene estilo propio: fondo (paleta del correo + color libre), borde (ninguno, fino, acento), esquinas, espaciado y color de texto | Inspector de cada tipo de bloque: los cinco controles presentes; el render los traduce a HTML inline (test por control) |
| V2 | Hay un catálogo de secciones prediseñadas que sirve para cualquier estudio: destacado con imagen, pasos, fecha límite, imagen + texto, tres beneficios, cita, preguntas frecuentes, contacto con foto, como mínimo | Biblioteca del editor: insertar cada una en un correo real de estudio y revisar la captura |
| V3 | **Toda sección puede llevar imagen o ser una imagen, y se ve muy bien**: recorte, proporción, esquinas y texto alternativo cuidados; nunca una imagen estirada, pixelada o con franjas | Captura de cada sección con imagen en 600 px y en celular, en Gmail y Outlook (Litmus o pruebas reales) |
| V4 | Una sección se cambia por otra sin perder su texto ni sus campos | «Cambiar por» en cada sección: el contenido pasa intacto (test del modelo) |
| V5 | Las secciones se guardan y se reutilizan entre campañas y estudios | «Mis secciones»: guardar en un estudio, usar en otro |
| V6 | Se edita sobre el lienzo: arrastrar, duplicar, mover y una barra flotante por sección; el panel derecho queda para el detalle | Recorrido de un correo completo sin usar el panel izquierdo de bloques |
| V7 | El HTML sigue siendo seguro para correo: tablas, estilo inline, Outlook, modo oscuro, campos de Mailchimp por persona | Gate `collection-mail` + paridad + prueba real enviada a Gmail y Outlook |
| V8 | Lo nuevo no se explica con muros de texto: cada control se entiende por su ícono, su rótulo corto y la vista previa | Revisión del inspector: ningún bloque con ayuda de más de una línea |

## Cola
| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| L0 | **Fase 0 — benchmark**: cómo resuelven estilo por bloque, secciones, imágenes, «cambiar por», guardado y edición en lienzo Mailchimp (nuevo editor), Beefree, Stripo y Unlayer; qué copiamos y qué no | `docs/qa/benchmark-editores-correo-2026-10.md` | ☑ ed7d0507a — tres niveles (sección ▸ columna ▸ bloque), presets en vez de padding numérico, «cambiar por» por ranuras, guardado como copia, reglas de imagen (proporción fija, @2x, alt, esquinas horneadas, sin texto sobre foto salvo Fecha límite) |
| L1 | **Fase 0 — diseño**: lienzo de maquetas del editor nuevo | [maquetas L1](https://claude.ai/artifact/TMbUJg6XhTxoRhJgixpdVn) (v39) | ☑ diseño cerrado tras 14 pasadas de mejora; Gonzalo (2026-10-23): «dejamos esto pendiente a implementar». Contiene: editor con sección seleccionada y barra «Ver como», biblioteca (Invitar, Confianza, Abrir y cerrar, Pieza completa), panel Estilo, barra flotante, «Cambiar por», «Mis secciones», decisión A/B de dónde viven, «Nuevo correo» (Invitación, Recordatorio, Último aviso, Agradecimiento, En blanco, Desde Mis secciones), correo completo PC/celular, paletas + «Tu color» en vivo + modo oscuro, así en Outlook, estados de imagen, recorte, y 11 secciones con y sin imagen y en celular. Contrato de espaciado medido: vertical 24/32/48, lateral 40 (24 en celular) |
| L2 | Modelo de estilo por bloque (fondo, borde, esquinas, espaciado, color de texto) en plantilla, render R y validación | `api/R/collection_mail_styles.R`, `collection_mail_blocks.R`, `materialMail.ts` | ☐ |
| L3 | Paleta del correo: colores del tema + sacados del logo y del banner | Identidad, render | ☐ |
| L4 | Panel «Estilo» en el inspector para todo bloque | `PanelDeBloque.tsx` + componente nuevo | ☐ |
| L5 | Sección «Destacado con imagen» (imagen a la izquierda o arriba, título, texto, botón opcional) | render + catálogo | ☐ |
| L6 | Resto del catálogo (pasos, fecha límite, imagen + texto, beneficios, cita, preguntas, contacto) | render + catálogo | ☐ |
| L7 | Imagen en cualquier sección: recorte y proporción, esquinas, alt; sección completa como imagen | render + `PanelDeImagen.tsx` | ☐ |
| L8 | «Cambiar por» conservando contenido | modelo + barra de sección | ☐ |
| L9 | «Mis secciones» guardadas y reutilizables entre estudios | almacenamiento fuera del .pulso o en él (decidir con ADR) | ☐ |
| L10 | Edición en lienzo: arrastrar, duplicar, barra flotante | `CapaDeEdicion.tsx` | ☐ |
| L11 | Prueba real en Gmail, Outlook y celular de un correo con todas las secciones | envío de prueba | ☐ |
| L12 | «Imagen completa» con una segunda imagen para el celular (una tabla de 600 px a 327 px deja letras de ~9 px) | render (media query + `<img>` alterno) | ☐ (salió de L1) |
| L13 | Esquinas y círculo de persona horneados en el archivo (Outlook ignora `border-radius`) | `collection_mail_images.R` | ☐ (salió de L0) |
| L14 | (Opcional) Botón redondeado también en Outlook con VML `v:roundrect`; hoy sale rectangular | `collection_mail_blocks.R` ~87 | ☐ (salió del loop de maquetas, P8) |

## Espera al usuario
| Qué | Por qué no puedo yo |
|---|---|
| Arrancar la implementación (L2 en adelante) cuando lo decida | la dejó pendiente el 2026-10-23 |
| Decidir dónde viven «Mis secciones»: A por equipo (fuera del .pulso) o B por estudio (dentro; recomendada). Tablero «Decisión» en el artifact | cambia el contrato del .pulso |

## Trampas
- Gonzalo pidió quitar la vista «imágenes bloqueadas» de las maquetas («no veo necesario…»): el texto alternativo se sigue exigiendo en el render, pero no se maqueta esa vista.
- Un `.mini` escalado con `transform` dentro de un flex se estira al alto del contenedor (`align-items: stretch`) y el fondo se corta: `align-items: flex-start`.
- El benchmark afirmaba que el botón ya usaba VML: no es así (celda con color + `mso-padding-alt`). Se corrigió al verificarlo en el código; una afirmación sobre el render se comprueba con `grep` en `collection_mail_*.R`, no de memoria.
- Una tabla o afiche hecho imagen se ve perfecto en 600 px y es ilegible en el celular: el texto escala con la imagen. Se mide el tamaño de letra resultante, no la imagen (L1).
- Las fotos de las maquetas L1 son de Unsplash (licencia libre, sin atribución obligatoria): sirven para el diseño, no son material de un estudio. Sus recortes @2x están en el artifact.
- Resolver el pedido al pie de la letra (un control, una pestaña) en vez de pensar el editor completo: es lo que Gonzalo marcó el 2026-10-23.
- Lo que se ve bien en el navegador puede romperse en Outlook (imágenes de fondo, esquinas, columnas): todo diseño se valida contra el HTML de correo, no contra CSS de la app.
- Una imagen sin dimensiones o sin recorte sale estirada o pixelada: toda imagen lleva tamaño fijo y versión @2x.
- Otras sesiones editan `frontend/src/features/recopiladores/correos/**`: coordinar antes de tocar un archivo y commitear por nombre.
