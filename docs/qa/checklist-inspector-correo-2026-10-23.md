# Checklist · Inspector del correo: Personas, puntos y ayuda (2026-10-23)

Tipo: Checklist de pedido con varias indicaciones
Estado: Vigente
Fecha: 2026-10-23
Autoridad: Pedido de Gonzalo (citado abajo); sólo él da por terminado un ítem

Pedido de Gonzalo (textual): «sí, hazlo en Personas, además aquí no sé por qué me muestras el qué hace ni el código en html, tampoco sé por qué me exige hacerlo todo en un campo de texto en vez de ir por el profesional approach de dejarme aumentar viñetas de forma interactiva».

Contexto: la propuesta aceptada fue juntar en Personas, en una sección visible aunque no haya lista importada, los campos de cada persona y el saludo según la persona (ver `checklist-ajustes-bloque-2026-10-23.md`, ítems 4 y 5).

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Personas › «Variables de cada persona», visible siempre. Cada campo (Nombre, Carrera, Enlace…) muestra su etiqueta de Mailchimp, la columna de la lista de la que sale (o «elige la columna al importar la lista» si aún no hay lista) y su texto de respaldo. Ahí mismo va «Saludo según la persona» (igual para todos o según el sexo, columna y las tres palabras), editable sin entrar al bloque Saludo | `PanelDestinatarios.tsx`, `SaludoSegunLaPersona.tsx`, `CorreosEditor.tsx` (cablear la edición de la plantilla) | hecho: visto a 1440 sin lista; campos con columna y respaldo, saludo editable |
| 2 | Quitar del inspector del bloque la tarjeta «Qué hace» y «Cómo sale en Mailchimp · Ver el código» (HTML crudo) | `PanelDeBloque.tsx` / `TarjetaDidactica.tsx` | hecho: ya no aparece en el inspector (verificado en pantalla) |
| 3 | Puntos de una lista o de un recuadro como lista interactiva: una fila por punto con su propio campo de texto con formato (negrita, campos), botón «Agregar punto», quitar y reordenar. Enter en un punto crea el siguiente, Backspace en un punto vacío lo borra. Desaparece el campo único «Enter empieza otro punto» | `PanelDeBloque.tsx` + componente nuevo `ListaDePuntos.tsx` | hecho: filas con subir/bajar/quitar, «+ Agregar punto» y «N de 10»; cabe a 1024 (322 px, sin desbordes) |

Gate: `tsc`, `make gate-front AREA=recopiladores` y revisión visual del inspector (Personas; bloque Recuadro y bloque Lista) a 1440 y 1024.
