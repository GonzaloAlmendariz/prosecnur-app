# Checklist · Ajustes del bloque y campos por persona (2026-10-23)

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-10-23
Autoridad: Pedido de Gonzalo (citado abajo); sólo él da por terminado un ítem

Pedido de Gonzalo (textual): «¿No sería poder tener más control del tono o el tamaño? O de la alineación no tener un "Del estilo" sino lo que ya clásicamente está establecido. Además, ¿dónde puedo editar los campos personalizados, conectarlos con las variables de la audiencia, y cómo puedo configurar que cada audiencia tenga una variable o campo para el correo, por ejemplo cómo sé quién es estimado o estimada?»

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | Alineación clásica: Izquierda · Centrado · Derecha · Justificado, sin «Del estilo». Queda marcada la que se aplica: la del bloque o, si el bloque no fija ninguna, la de Identidad | `api/R/collection_mail_styles.R` (enums) + render de bloques; `ajustesDeBloque.ts`, `AjusteDeBloque.tsx` | hecho: Izquierda/Centrado/Derecha/Justificado; se marca la heredada sin escribir la clave; verificado guardado y render |
| 2 | Tamaño del párrafo con más pasos: Pequeño · Normal · Grande · Muy grande | ídem | hecho: 13/20 (sin cambio), 16/26, 18/28, 21/32 |
| 3 | Tono del párrafo con más pasos: Normal · Suave · Acento (el color del correo) | ídem | hecho: acento con respaldo y aviso `paragraph_accent_contrast` si no hay contraste 4.5:1 |
| 4 | Dónde se editan los campos personalizados y cómo se conectan a las columnas de la audiencia | Personas › Campos de cada persona (existe; requiere lista importada para ver el selector de columna) | explicado; mejora de visibilidad pendiente de decisión |
| 5 | Una variable por audiencia para el correo, por ejemplo Estimado/Estimada | Bloque Saludo › «Saludo según la persona» (por sexo, columna de la lista, tres palabras editables) | explicado; mejora de visibilidad pendiente de decisión |

## Contrato (ítems 1–3)
- **Enums** (`.CMAIL_STYLE_ENUMS`):
  - paragraph: `align = left|center|right|justify`, `size = pequeno|normal|grande|muy_grande`, `tone = normal|suave|acento`;
  - heading: `align = left|center|right`;
  - button: `align = left|center|right`.
  - Los valores existentes no cambian de significado, así que las plantillas guardadas siguen igual.
- **Render**: con los valores por defecto, el HTML no cambia. Los hashes de paridad (`fixtures/mail-import/paridad-mailchimp-sha256.json`) no deben moverse.
  - Tamaños del párrafo: pequeño 13/21, normal (el actual), grande 18/28, muy grande 21/32 (px/línea).
  - Tono acento: el color del acento del tema, solo si su contraste con el fondo de la tarjeta es suficiente. Si no, usar el texto normal y avisarlo en la Revisión.
- **Frontend**:
  - Desaparece la opción «Del estilo». El valor que se muestra es el del bloque o, si falta, el que hereda de Identidad.
  - Elegir el valor heredado no escribe la clave: la ausencia sigue significando «hereda».
  - Íconos: alinear a la derecha y muestras de color para el tono (el acento con el color real del tema).
- **Gate**: `make gate-area AREA=collection-mail`, `tsc`, `make gate-front AREA=recopiladores` y una revisión visual del inspector a 1440 y 1024.
