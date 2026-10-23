# Benchmark · editores de correo (2026-10)

GOAL `goal-editor-correos-profesional-2026-10-23.md`, ítem **L0**. Estudia cómo resuelven
**Mailchimp (editor nuevo)**, **Beefree**, **Stripo** y **Unlayer** los temas del GOAL y decide qué
copiamos, qué no y por qué. La regla que lo filtra todo: lo que copiamos tiene que salir como
**HTML seguro para correo** (tablas, estilo inline, Outlook de Windows con motor Word, modo oscuro,
merge tags de Mailchimp `*|FNAME|*` por persona). Lo que sólo funciona en el navegador del editor no
entra.

Método: documentación pública de cada producto y guías de render (fuentes al final), más lo que ya
sabemos del render de Prosecnur (ADR 0046 §11: no hay lienzo libre; `collection_mail_*.R`). No se
abrió una cuenta en ninguno; lo que sólo se ve con sesión (p. ej. la barra exacta de Mailchimp) se
marca como «según su ayuda».

## 1. Cómo modelan el correo

| | Unidad que se arrastra | Unidad que se estiliza | Unidad que se guarda |
|---|---|---|---|
| Mailchimp nuevo | bloque de contenido y **sección** (encabezado, cuerpo, pie) | bloque, con estilo propio por dispositivo (desktop / móvil se pueden desvincular) | plantilla; según terceros que usan el mismo patrón, «Secciones › Guardadas» |
| Beefree | **fila** (row) con columnas, dentro bloques de contenido | fila (fondo de fila, fondo de contenido, borde, imagen de fondo), columna (fondo, borde, padding) y bloque | **fila guardada**; y **fila sincronizada** (synced row): se edita una vez y cambia en todos los diseños que la usan, bloqueada para edición en el correo |
| Stripo | **franja** (stripe) → estructura → contenedor → bloque básico | franja (fondo, fondo de contenido, imagen de fondo, ocultar en móvil), estructura y contenedor | **módulo** de la biblioteca (una franja, estructura o contenedor), con módulos sincronizados |
| Unlayer | fila con columnas → contenido | fila (fondo, imagen de fondo, padding), columna, contenido | bloque personalizado / guardado |

Lectura: los cuatro convergen en **tres niveles** — sección (fila/franja) ▸ columna ▸ bloque — y
ponen el estilo fuerte (fondo, borde, imagen) en la **sección**, no en el párrafo. Nuestro modelo hoy
es una lista plana de bloques (`MailBlock[]`) con piezas gráficas en un registro cerrado.

**Decisión**: introducir la **sección** como unidad (una sección = una fila de tabla de 600 px con su
estilo y 1 o 2 columnas), sin bajar a la profundidad de Stripo (cuatro niveles confunden a quien no
diseña). Los bloques actuales siguen vivos dentro de una sección «Texto libre».

## 2. Estilo por bloque y sección

| Control | Mailchimp | Beefree | Stripo | Unlayer | Prosecnur (propuesta) |
|---|---|---|---|---|---|
| Fondo | color | color de fila + color de contenido + imagen | color de franja + color de contenido + imagen | color + imagen | **color de la paleta del correo** o libre (cuentagotas, ya existe) |
| Borde | sí, por bloque | por fila/columna, por lado | por contenedor | por columna | **ninguno · fino · acento** (tres opciones, no un editor de bordes por lado) |
| Esquinas | sí | sí | sí | sí | **rectas · suaves 8 px · redondas 16 px** |
| Espaciado | padding numérico por lado | padding por lado | padding por lado | padding por lado | **compacto · normal · amplio** (24/32/48 px arriba y abajo; laterales fijos de 40 px, 24 en el celular) y «sin margen» para imágenes a sangre |
| Color de texto | sí | sí | sí | sí | **auto** (contraste contra el fondo, ya calculado en `.cmail_accent_ink`) o elegido |

Qué copiamos: el *eje* (fondo, borde, esquinas, espaciado, texto) en todos los niveles, porque es
lo que Gonzalo pidió («esta de azul, no la puedes cambiar de otro color»).

Qué NO copiamos: el padding numérico por lado y el borde por lado. En los cuatro productos son la
fuente de correos descuadrados: cada sección termina con 13/17/22 px y nada alinea. Tres presets por
eje dan coherencia sin pensar y se traducen a valores fijos del contrato geométrico (§8).

Outlook: el fondo de color en `<td bgcolor>` + `background-color` inline funciona en todos. El
**borde** funciona. Las **esquinas** (`border-radius`) Outlook de Windows (motor Word) las ignora y
pinta recto: se acepta como degradación elegante — nunca se usa VML `v:roundrect` para secciones.
El botón tampoco lo usa hoy: es una celda con color y `mso-padding-alt`
(`collection_mail_blocks.R` ~87), así que en Outlook sale rectangular. El diseño se valida
suponiendo esquinas rectas en Outlook.

## 3. Paleta del correo

- Mailchimp: estilos globales del correo (colores, tipografía) que heredan todos los bloques;
  «Brand kit» con colores de la marca.
- Beefree / Stripo / Unlayer: ajustes generales (color de fondo, ancho, tipografía) y, en Stripo,
  colores que se sacan de la marca; el selector de color muestra los usados en el documento.

**Decisión**: una **paleta del correo** de 5 colores con nombre — *Tinta* (texto), *Acento*,
*Tinte* (acento al ~8 %), *Papel* (fondo de tarjeta) y *Contraste* (segundo color) — sembrada del
acento del tema y de los colores del banner (ya tenemos `useColoresDelBanner`). Todo control de color
abre primero la paleta y después «otro color». Cambiar el acento recolorea todas las secciones que
usan *Acento* o *Tinte*: el valor guardado es el **nombre** del color, no el hex (salvo color libre).
Eso es lo que hace que un correo se pueda re-vestir para otro estudio sin repintar sección por
sección.

## 4. Catálogo de secciones prediseñadas

Los cuatro ofrecen galerías de filas/módulos prearmados, en su mayoría de e-commerce (producto,
precio, carrito) o newsletter. Ninguno trae un catálogo pensado para **invitar a responder una
encuesta**, que es nuestro caso: acceso por persona, fecha límite, confidencialidad, incentivo,
contacto de quien responde dudas.

**Decisión**: catálogo propio, corto y del dominio (mínimo de la vara V2):

| Sección | Para qué | Imagen |
|---|---|---|
| Destacado con imagen | el sorteo, el incentivo, el anuncio central | imagen a la izquierda (1:1) o arriba (2:1) |
| Pasos | «cómo responder» en 3 pasos numerados | opcional: ícono por paso |
| Fecha límite | cierre de la encuesta, cuenta visible | opcional: foto de fondo de franja sólo con respaldo de color |
| Imagen + texto | contexto del estudio (el campus, el aula) | 4:3 a un lado; en móvil arriba |
| Tres beneficios | por qué responder (confidencial, 10 min, cuenta) | ícono o foto pequeña por columna |
| Cita | la voz de alguien (autoridad, docente) | foto redonda opcional |
| Preguntas frecuentes | dudas antes de escribir al equipo | no |
| Contacto | quién responde dudas | foto de la persona, redonda |
| Imagen completa | una pieza ya diseñada (afiche, tabla, infografía) | la sección **es** la imagen |

Cada sección tiene variantes de forma (imagen a la izquierda / derecha / arriba), no secciones
nuevas por cada variante: así el catálogo queda en nueve tarjetas.

## 5. «Cambiar por»

- Beefree y Stripo: no tienen un «cambiar por» con conservación de contenido; se borra la fila y se
  arrastra otra. Stripo tiene «elementos inteligentes» que se re-rellenan con datos, que es otra cosa.
- Mailchimp nuevo: se puede cambiar el *diseño* (layout) de algunos bloques conservando el contenido
  (en bloques de producto e imagen + texto; no verificado con sesión).
- Unlayer: no.

**Decisión — esto es donde podemos ser mejores que ellos**: todas las secciones comparten un mismo
juego de **ranuras** (`titulo`, `texto`, `imagen`, `boton`, `items[]`, `persona`). «Cambiar por»
mueve el contenido de ranura a ranura: un Destacado → Imagen + texto conserva título, texto, imagen
y botón; Pasos → Tres beneficios conserva los ítems; lo que la sección destino no tiene (p. ej. el
botón en una Cita) **no se borra**: queda guardado y la vista previa del menú avisa «el botón queda
oculto». Test del modelo: ida y vuelta sin pérdida (vara V4).

## 6. Secciones guardadas

| | Qué guarda | Dónde | Sincronización |
|---|---|---|---|
| Mailchimp | plantillas (y secciones guardadas en editores del mismo estilo) | la cuenta | no |
| Beefree | fila guardada / fila sincronizada | lo provee la app que embebe el SDK | sí, la sincronizada se edita en el «Row builder» y se propaga |
| Stripo | módulo | biblioteca de la cuenta / equipo | sí, módulos sincronizados |
| Unlayer | bloque | lo provee la app | no |

**Decisión**: «Mis secciones» guarda una **copia** (no sincronizada) con su estilo y su contenido.
La sincronización (Beefree/Stripo) resuelve pies legales corporativos de marketing; en nuestros
estudios cada correo cambia de cliente y de estudio, y una edición que se propaga a una campaña ya
enviada es un riesgo de reproducibilidad (ADR del `.pulso`). Dónde vive (por equipo fuera del
`.pulso`, o dentro del estudio) **espera a Gonzalo** — está en la tabla «Espera al usuario» del GOAL.
Las imágenes de una sección guardada viajan con ella (las copia al estudio que la usa), porque el
flujo de entrega es ZIP con imágenes relativas.

## 7. Edición sobre el lienzo

Patrón común a los cuatro (Mailchimp y Beefree lo documentan explícitamente):

- al pasar el mouse sobre una sección aparece un **contorno** y una **barra flotante** con: mover
  (manija), subir/bajar, duplicar, guardar, borrar; Beefree añade «guardar fila» en esa barra;
- al hacer clic se selecciona y el **panel derecho** muestra sus propiedades;
- un **«+» entre secciones** abre la biblioteca en ese punto;
- arrastrar desde el panel de contenidos al lienzo, con una línea de inserción.

Qué copiamos: contorno + barra flotante por sección con **mover · duplicar · cambiar por · estilo ·
guardar · borrar**, y el «+» entre secciones (ya tenemos el «+» de bloque en `CapaDeEdicion`). El
panel derecho queda para el detalle (vara V6). Teclado: la barra es alcanzable con Tab y los
atajos ya existentes (`atajosDelEditor.ts`) se amplían a duplicar (⌘D) y subir/bajar (⌥↑/⌥↓).

Qué NO copiamos: el arrastre libre de **columnas** dentro de una sección y el editor de estructura
de Stripo. Un correo de estudio no necesita tres columnas arbitrarias, y cada combinación nueva es
un riesgo de Outlook. Las columnas las fija la sección.

## 8. Imágenes: el punto que más importa

### Qué hacen los editores
- **Recorte** (de sus editores públicos, no de la documentación citada): Mailchimp recorta en su
  editor de imágenes; Beefree y Stripo integran un editor de imagen (recorte, filtros); Unlayer
  delega en la app. Todos permiten «ancho automático» (la imagen llena la columna).
- **@2x / retina**: ninguno lo hace por ti de forma visible; la práctica (Litmus, Email on Acid) es
  subir el doble del ancho y fijar el ancho de muestra con el atributo `width`.
- **Texto alternativo**: campo de alt en el panel de la imagen, en los cuatro.
- **Imagen de fondo**: los cuatro la ofrecen en filas/franjas; Stripo documenta que Outlook de
  Windows 2007–2019, Windows 10 Mail y Gmail app con cuentas no Gmail **no la muestran** y que la
  salida es un truco VML (`v:rect` + `v:fill`) que choca con otros objetos VML como los botones.

### Reglas que adoptamos (todas se cumplen en el HTML, no en el CSS de la app)
1. **Toda imagen tiene una ranura con proporción fija** declarada por la sección: 2:1 (destacado
   arriba, imagen completa ancha), 1:1 (destacado a la izquierda, beneficio), 4:3 (imagen + texto),
   16:9 (imagen completa), círculo 1:1 (persona). El usuario no estira: **recorta** dentro de esa
   proporción (encuadre arrastrable + zoom), y el render recorta el archivo de verdad (no con CSS
   `object-fit`, que Outlook y Gmail ignoran).
2. **@2x siempre**: el archivo exportado mide el doble del ancho de muestra (una ranura de 260 px se
   exporta a 520 px), JPEG calidad ~85 para fotos, PNG para piezas con texto. Si la foto subida es
   más chica que el @2x se avisa por la causa: «la foto mide 380 px; para verse nítida en pantallas
   retina necesita 520 px» (ya existe `nitidez.ts`, se reutiliza).
3. `<img width="260" height="195" style="display:block;width:100%;max-width:260px;height:auto;border:0">`
   — `width` como **atributo** para Outlook, `max-width` para el resto, `display:block` para que no
   aparezca la franja de 3–4 px bajo la imagen.
4. **Esquinas de imagen**: `border-radius` inline; Outlook de Windows las dibuja rectas. Si el diseño
   exige esquinas redondas en todos (la foto de contacto), el render **hornea** las esquinas en el
   PNG (fondo = color de la sección). Lo mismo para el círculo de persona: se hornea.
5. **Nada de texto sobre imagen de fondo por defecto.** La sección «Fecha límite» puede llevar foto de
   fondo sólo si declara color de respaldo con contraste AA para el texto; en Outlook se verá el
   color. Es la única sección con imagen de fondo; las demás ponen la imagen como `<img>`.
6. **Sección hecha de imagen** («Imagen completa»: un afiche, una tabla que el cliente mandó como
   imagen): ocupa los 600 px a sangre o con margen, lleva **alt obligatorio y descriptivo** (no
   «imagen1.png»), enlace opcional, y debajo una línea de texto real opcional con lo esencial (fecha,
   enlace), porque Outlook bloquea imágenes por defecto y un correo que es sólo imagen llega vacío.
   Si la imagen trae texto, el aviso de revisión pide repetir lo crítico en el alt.
7. **Móvil**: las secciones de dos columnas apilan (imagen arriba) con la clase de media query que ya
   usa el render; la imagen pasa a 100 % del ancho con su proporción. Gmail app respeta media queries
   desde 2016; Outlook móvil también.
8. **Modo oscuro**: fotos sin cambios (los clientes no invierten JPEG). Las piezas PNG con fondo
   transparente llevan un fondo sólido o un borde claro de 1 px para no desaparecer al invertirse.
   Los logos ya tienen ese tratamiento.

## 9. Merge tags y Mailchimp

Mailchimp resuelve `*|FNAME|*` y los campos de audiencia en cualquier texto, incluidos `alt` y
`href`. Nuestras ranuras de texto aceptan los mismos campos de cada persona que ya existen
(`CampoConCampos`); el enlace por persona (`ENLACE`, `?t=`) va en el botón. Una sección guardada
**no** guarda valores de una persona, sólo los campos. Las imágenes no son por persona.

## 10. Resumen: qué copiamos y qué no

| Copiamos | Por qué |
|---|---|
| Sección como unidad con estilo (fondo, borde, esquinas, espaciado, texto) | los cuatro lo hacen y es el pedido literal |
| Paleta con nombres que re-viste el correo | cambiar de estudio sin repintar |
| Barra flotante por sección + «+» entre secciones | patrón universal, vara V6 |
| Secciones guardadas como copia | reutilizar entre estudios (V5) |
| Recorte a proporción fija + @2x + alt | lo que hace que una imagen «se vea súper bien» en todos lados |

| No copiamos | Por qué |
|---|---|
| Padding y borde numéricos por lado | descuadran el correo; presets con escala fija |
| Columnas libres / editor de estructura | riesgo de Outlook sin beneficio para encuestas |
| Imagen de fondo en cualquier fila | Outlook no la muestra; sólo «Fecha límite», con respaldo |
| Filas sincronizadas | una edición que cambia campañas enviadas rompe la reproducibilidad |
| Catálogos de e-commerce | no sirven para invitar a responder |

| Donde somos mejores | |
|---|---|
| «Cambiar por» que conserva el contenido por ranuras | ninguno de los cuatro lo ofrece en general |
| Catálogo del dominio (acceso, fecha límite, contacto, confidencialidad) | ninguno lo trae |
| Avisos por la causa (nitidez, alt, contraste) antes de exportar | ya tenemos el chequeo; se extiende a cada ranura |

## Fuentes

- Mailchimp: [Design an Email with the New Builder](https://mailchimp.com/help/design-an-email-new-builder/), [Compare Mailchimp's Email Builders](https://mailchimp.com/help/compare-mailchimps-email-builders/).
- Beefree: [Saved Rows (guía de usuario)](https://docs.beefree.io/end-user-guide/reuse-content/saved-rows), [Synced Rows](https://docs.beefree.io/end-user-guide/synced-rows), [Implement Synced Rows (SDK)](https://docs.beefree.io/beefree-sdk/rows/reusable-content/sync/implement-synced-rows), [Designing with Saved Rows (RGE)](https://support.reallygoodemails.com/hc/en-us/articles/5872178483858).
- Stripo: [Qué son las franjas](https://stripo.email/blog/usage-stripes-optimal-design-letter/), [Imagen de fondo en Outlook](https://support.stripo.email/en/articles/3174119-why-i-can-t-see-the-background-image-in-outlook), [Cómo añadir imagen de fondo](https://support.stripo.email/en/articles/7958972-how-to-add-a-background-image-to-your-designs), [Problemas de render en Outlook](https://stripo.email/blog/common-email-rendering-issues-in-outlook-and-how-stripo-solves-them/).
- Render: [Fluid retina images for email (Email on Acid)](https://www.emailonacid.com/blog/article/email-development/fluid-retina-images-for-email/), [Outlook rendering issues (Mailtrap)](https://mailtrap.io/blog/email-rendering-issues-outlook/), [Email HTML in 2026: dark mode y MSO](https://hackernoon.com/why-email-html-in-2026-is-still-a-nightmare-reverse-engineering-dark-mode-and-outlook-mso-tables).
- Unlayer: su documentación no apareció en las búsquedas; lo dicho de Unlayer viene de su editor público y queda como «sin fuente citada» hasta confirmarlo.
