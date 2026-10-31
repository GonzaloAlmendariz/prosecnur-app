# ADR 0136: Un correo, varios públicos — trato tú/usted en el texto y «Aplicar a las campañas hermanas»

Estado: Aceptado

Implementacion: Hecha (GOAL editor de correos profesional, L16)

Fecha: 2026-10-31

Fecha de decision: 2026-10-31 (Gonzalo, «Apruebo», sobre la propuesta `editor-correos-L16-propuesta.md`)

Reemplaza: —

Extiende: [ADR 0110](0110-material-de-campo-se-conecta-y-escribe-correos-para-mailchimp.md) (plantilla de correo) y
[ADR 0111](0111-material-de-campo-se-organiza-por-campanas-tipadas.md) (campañas de correo).

## Contexto

Acreditación Institucional 2026 mandó el mismo correo a seis públicos: profesores, estudiantes de pregrado y posgrado,
administrativos y egresados de pregrado y posgrado. Entre una campaña y otra cambiaban de 3 a 8 líneas: el vocativo, el
premio, la duración, el campo de enlace (`*|ENLPROF|*`, `*|ENLPRE|*`…) y el **trato**. A los estudiantes se les tuteaba
y a los demás se les trataba de usted, y eso cambia conjugaciones en todo el texto («Responde» / «Responda», «Tus» /
«Sus»).

Los datos de campaña (`constants`, L6) cubren los valores, pero no el trato ni el paso de un cambio de estructura de una
campaña a las otras. En la práctica las seis plantillas se mantuvieron una por una y por script.

Había dos modelos:

- **A · plantilla madre** como entidad nueva, con un hijo por público que sólo guarda lo propio.
- **B · campañas hermanas**: cada campaña sigue siendo completa y una acción explícita copia lo común a las otras.

## Decisión

**B**, con el trato dentro del texto.

1. **Trato.** `template.registro` vale `"tu"` o `"usted"`; si falta, usted. En cualquier texto del correo,
   `[[forma de tú|forma de usted]]` escribe la forma que corresponde al trato de la campaña. Cualquiera de las dos
   formas puede ir vacía. Se resuelve como texto en la plantilla efectiva (`.cmail_constants_apply`, después de los
   datos: un dato puede llevar su propia variante), así que vale para la vista previa, la revisión, las exportaciones y
   Mailchimp. Un correo sin variantes sale byte a byte como antes. Un `[[` o `]]` que no forma una variante es un
   problema de validación (`bad_variante`), porque llegaría tal cual al destinatario.
2. **Campañas hermanas.** `POST /api/recopiladores/mail-campaigns/apply-siblings` copia lo que la campaña de origen
   tiene guardado a las campañas elegidas, con revisión global y en todo o nada. Las partes son:
   - `cuerpo`: asunto, vista previa, estilo, cabecera, imágenes y bloques, menos el **Saludo**. El vocativo y su
     trato por sexo son de cada público, así que el de la hermana queda en su lugar.
   - `envios`: se emparejan por posición. Se copian el rótulo, a quién va, el asunto, la vista previa y la apertura.
     La fecha, el recopilador y el registro de exportación quedan de cada campaña. Los envíos que sobran en el origen
     se agregan y los que sobran en la hermana se quedan.

   Cada hermana **conserva** su saludo, su trato, sus campos (su enlace), el valor de sus datos, sus destinatarios, su
   plataforma y su nombre. Un campo o un dato que el origen usa y la hermana no tiene se agrega y se avisa.
3. **Ver antes de aplicar.** `dry_run` devuelve qué cambia en cada hermana. La UI siempre lo muestra antes del botón
   «Aplicar a N campañas». Si una hermana quedaría inválida, no se aplica a ninguna.
4. **No hay sincronización viva.** Después de aplicar, cada campaña es independiente. Lo que se envió se puede rehacer
   tal cual (benchmark §6: las filas sincronizadas se descartan por reproducibilidad). Tampoco hay un grupo guardado:
   las hermanas se eligen en cada aplicación entre las campañas de correo del proyecto.

## Consecuencias

- Seis públicos se mantienen con un solo correo de referencia: se edita uno y se aplica a los demás. Las diferencias
  reales quedan donde se ven: el trato en una variante, el premio en un dato y el enlace en un campo.
- No hace falta una entidad nueva en el `.pulso` ni una migración: `registro` es una clave opcional de la plantilla y
  la acción escribe campañas que ya existen.
- No hay deshacer de servidor. La salvaguarda es ver qué cambia en cada hermana antes de aplicar; la revisión global
  evita pisar un cambio ajeno.
- El editor muestra la variante tal cual (`[[Responde|Responda]]`) en el texto que se edita; la vista previa la
  resuelve.
- Las variantes valen también en el asunto, la vista previa y la apertura de cada envío, y se validan ahí. El aviso
  de asunto repetido compara los asuntos ya escritos en el trato de la campaña.

## Cumplimiento

- `collection_mail_registro.R` (trato y variantes) y `collection_mail_hermanas.R` (aplicar).
  `test-collection-mail-hermanas.R` cubre:
  - El trato por defecto y explícito, la apertura de un envío, una variante dentro de un dato, el HTML sin `[[`.
  - La paridad sin variantes y las variantes mal cerradas.
  - Simular sin escribir, aplicar el cuerpo y los envíos conservando trato, enlace, datos y fechas.
  - Aplicar sólo el cuerpo, el destino vacío, una parte desconocida y el todo o nada ante una hermana inválida.
- Front: `TratoDeLaCampana`, `AplicarAHermanas` (panel direccionable `correo-hermanas`), `modeloRegistro`,
  `modeloHermanas`, `materialMailHermanas` y `registroYHermanas.test.tsx`.

## Notas

- Si una campaña elegida está cargada en el editor con cambios sin guardar, no se aplica: se pide guardarla o
  descartarlos.
- En Acreditación 2026 el tú de pregrado estaba escrito a mano, sin variantes. Por eso, cuando el origen no tiene
  ninguna `[[tú|usted]]`, el diálogo avisa antes de aplicar que el texto pasa tal cual.
