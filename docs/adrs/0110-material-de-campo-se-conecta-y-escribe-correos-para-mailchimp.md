# ADR 0110: Material de campo se conecta con sus vecinos y escribe correos para Mailchimp

Estado: Aceptado

Implementacion: En curso (E1f backend: plantilla, destinatarios, revisión y exportación; ver «Implementación de E1f»)

Fecha: 2026-10-16

Fecha de decision: 2026-10-16 (Gonzalo, sobre los artboards 5b y 8b del canvas: «sí»)

Reemplaza: —

Extiende: [ADR 0109](0109-material-de-campo-se-compone-e-imprime-por-tipo-de-campo.md) (conexiones y correos) y
[ADR 0108](0108-material-de-campo-catalogo-de-materiales-por-unidad.md) §2 (fuentes de unidades).

Referencia visual: canvas «Revamp de Material de campo» (artifact privado `W7xx1vTeBZE2tkdJtQCcSy`), artboards
«5b · Correos personalizados e identidad» y «8b · Conexiones con otros módulos».

## Contexto

Dos huecos quedaron a la vista al revisar el canvas con Gonzalo:

- **Las conexiones.** El canvas decía «la lista no se edita aquí», pero no decía qué entrega cada módulo vecino, cómo se
  sabe que cambió ni qué ve el otro lado. Sin eso, el material se desactualiza en silencio.
- **Los correos.** En CCSS Perfil 2026 y en el estudio de hostigamiento de la UNSA, el cuerpo del correo se armó como HTML
  fuera de la app, se abrió en Chrome y se copió a mano, con riesgo de que los logos no se vieran y sin personalizar.
  Los envíos masivos de Pulso se hacen en **Mailchimp**. El banner del formulario se carga directamente en SurveyMonkey
  y no es trabajo de este módulo.

## Decisión

### 1. Conexiones: recibir, citar y avisar

Material de campo no decide: recibe de cada vecino con una **huella**, cita el dato en vez de copiarlo y avisa cuando
la fuente cambió.

| Vecino | Entrega | Si cambia | Del otro lado |
|---|---|---|---|
| Cálculo de muestra | Aulas titulares con su reserva y refuerzo; docente, aula, horario, facultad, matriculados; código operativo; semilla del sorteo | Solo el material de las unidades afectadas pasa a desactualizado | Su Entrega muestra «Material de campo: N fichas listas» con enlace |
| Hojas de ruta | Manzanas titulares y reemplazos o fichas de cuota; meta por celda con los ejes; variante; topes; polígonos para el mapa | Se marcan las hojas afectadas e Imprenta dice qué archivos reimprimir | Su Selección ofrece «Preparar material de campo» |
| Formularios | Revisión publicada; cuestionario impreso; texto del consentimiento; campo `collectorID` | Cuestionario y consentimiento desactualizados; si cambió `collectorID`, los accesos se bloquean hasta revisarlos | Su Impreso muestra en qué carpeta está su PDF |
| Monitoreo | Recibe la entrega con su recibo; **devuelve** reemplazos activados y unidades reagendadas o canceladas | Un reemplazo activado aparece como unidad nueva con su ficha por generar; la entrega anterior no se toca | Lee el recibo para saber qué ficha y qué acceso tiene cada unidad |

Reglas:

- cada lectura guarda la huella de la fuente; si la huella actual difiere, la vista dice **qué** cambió (unidades,
  campos, metas), no solo «desactualizado»;
- **nada se regenera solo**: la persona elige «Actualizar desde la fuente»;
- el camino de vuelta desde Monitoreo es nuevo: se modela como lectura de los reemplazos activados, nunca como escritura
  de Monitoreo sobre el estado de Material de campo;
- la pestaña Unidades › Origen es donde vive esta vista.

### 2. Correos: componer aquí, enviar en Mailchimp

Los correos son un tipo de material de la familia «va al participante», con canal digital:

- **Componer** con bloques del registro: cabecera (franja de logos o banner de mailing), saludo, párrafo, botón de
  acción, recuadro, lista y firma; vista de escritorio, teléfono y modo oscuro.
- **Campos de cada persona** que se traducen a etiquetas de Mailchimp (`{{nombre}}` → `*|FNAME|*`, y los campos del
  estudio como `*|CARRERA|*`, `*|CODIGO|*`, `*|ENLACE|*`).
- **Exportar para Mailchimp**: la plantilla HTML con sus etiquetas, la audiencia en CSV con una columna por etiqueta, y
  las imágenes para Content Studio. «Copiar para Outlook» queda como salida secundaria.
- **Revisión antes de exportar**: asunto, texto de vista previa, peso por debajo del recorte de Gmail (102 KB),
  imágenes alojadas y no incrustadas, texto alternativo, campos sin dato con su respaldo, modo oscuro, pie con
  `*|UNSUB|*` y dirección, y una columna en la audiencia para cada etiqueta.
- **Identidad del correo**: el banner de mailing (1200 × 600) lo entrega el cliente; la app revisa su tamaño y su peso.
  El banner del formulario no pasa por este módulo.
- **El envío masivo se hace en Mailchimp, no desde la app.** Esto respeta lo que el ADR 0046 descartó (convertir el
  módulo en herramienta de emailing). Una integración con la API de Mailchimp para crear la plantilla o la campaña en
  borrador sería una etapa aparte, con su credencial fuera del `.pulso` (ADR 0005).

### 3. Etapas

| Etapa | Contenido |
|---|---|
| E1e | Unidades › Origen con huella, diferencias y «Actualizar desde la fuente» para aulas |
| E1f | Correos: editor, campos, vistas y exportación para Mailchimp |
| E2 (amplía) | Conexión con Hojas de ruta y lectura de reemplazos activados desde Monitoreo |
| E7 (opcional) | API de Mailchimp: crear plantilla o campaña en borrador (bloqueada: credencial y autorización) |

## Consecuencias

- La audiencia exportada contiene correos personales: sale como archivo al lado del proyecto, nunca dentro del
  `.pulso`, y la vista de Destinatarios no muestra los correos.
- Cada vecino necesita exponer su huella de forma estable; Monitoreo necesita exponer sus reemplazos activados como
  lectura.
- Los bloques de correo son un registro distinto al de papel (HTML de correo, no `grid`); comparten la regla de
  registro cerrado.

## Cumplimiento

- Un cambio en la fuente produce un aviso con la lista de diferencias; un test por vecino.
- Ningún flujo regenera material sin la acción de la persona.
- La plantilla exportada contiene solo etiquetas que existen como columna en la audiencia (test de paridad).
- El pie exportado contiene `*|UNSUB|*`; el peso queda bajo 102 KB con imágenes alojadas.
- Ningún correo personal entra al `.pulso` (scan del estado).

## Implementación de E1f (backend)

Vive en `api/R/collection_mail_template.R` (contrato y presets), `collection_mail_render.R` (HTML),
`collection_mail_text.R` (correo, vacío y nombre de pila), `collection_mail_usage.R` (dónde se usa cada campo),
`collection_mail_recipients.R` (importación efímera), `collection_mail_export.R` (vista previa, revisión y ZIP) y
`collection_brand_assets.R` (logos del proyecto). Tests: `test-collection-mail-template.R`,
`test-collection-mail-export.R` y `test-collection-mail-recipients-hardening.R`.

- **Lectura.** CSV en UTF-8 (con o sin BOM), UTF-16 con BOM o Windows-1252 (el «CSV» de Excel en Windows); otra
  codificación responde `E_COLLECTION_MAIL_RECIPIENTS_ENCODING`. Un aviso del lector (comilla sin cerrar, fila a
  medias) es error `E_COLLECTION_MAIL_RECIPIENTS_UNREADABLE` con motivo fijo y `error_id`; nunca una lectura parcial.
  Espacios duros e invisibles se limpian en todas las celdas.
- **Correo.** Validador estricto (parte local ASCII sin puntos al borde ni dobles, dominio con TLD de 2+ letras); se
  quita `mailto:`; se compara en minúsculas y se exporta tal como quedó limpio.
- **Partición.** `total = valid + without_email + invalid_email + duplicated` (efectivo = correo válido y primera
  aparición). Además: `duplicated_conflicting` (mismo correo con otro dato en un campo usado), `names_unsplit`,
  `persons_with_any_empty` y `rows_blank_dropped` (fuera de `total`).
- **Sin dato.** Vacío = celda vacía, solo espacios o `NA`, `N/A`, `#N/A`, `-`, `s/d`; el denominador son los
  efectivos. El respaldo se evalúa donde se usa el campo: en un enlace no existe y un vacío bloquea la exportación; en
  asunto y preheader, y `{{nombre}}` fuera del saludo, tampoco se aplica. Un repetido con otro valor en un campo de
  enlace también bloquea; en otro campo, avisa. En `audiencia.csv` el marcador sale vacío para que Mailchimp aplique el
  respaldo.
- **Datos personales.** Correos y nombres solo en `<sesión>/mail_recipients/` y dentro del ZIP. La vista, la vista
  previa y el manifest ocultan cualquier valor con forma de correo; el mapeo no admite llevar la columna del correo a
  otra etiqueta. Se borran con DELETE, al cerrar la sesión y al reemplazarla con `open in_place`.
- **`.pulso`.** Viaja la plantilla; no los destinatarios. Viajan los logos `brand_logo` vigentes (el más reciente por
  `uploaded_at` para cada nombre), que la cabecera y la careta del afiche resuelven al reabrir. Una plantilla guardada
  que ya no cumple el contrato responde `E_COLLECTION_MAIL_TEMPLATE_STORED_INVALID` hasta que se guarda otra.
- **Exportación** síncrona (tope 5 MB), con `expected_revision` obligatorio, nombre público de hasta 80 caracteres y
  `manifest.json` con procedencia (archivo, fecha, huella, codificación, mapeo y formato del nombre), cifras completas
  y resumen de la revisión, sin correos. `LEEME.txt` abre con una línea de cifras y trae la tabla de marcadores de
  imagen.
- **Pendiente.** La revisión de modo oscuro que pide §2 no existe todavía: el HTML declara `color-scheme: light only`,
  pero ningún chequeo lo verifica contra un cliente real. Queda como pendiente de E1f.

### Supuestos documentados

- **La lista importada es la población.** La app no la cruza con la muestra ni con quienes ya respondieron: quien arma
  la lista (por ejemplo, los no respondientes de las aulas sorteadas) decide a quién se escribe.
- **Las filas totalmente vacías se descartan** y se informan aparte (`rows_blank_dropped`); no son personas.
- **Encabezado repetido o vacío:** se queda la primera columna con ese nombre; las demás no se leen.
- **Los alias de Gmail no se normalizan** (`ana.quispe@gmail.com` y `anaquispe+x@gmail.com` cuentan como dos
  personas): la app no sabe qué proveedor ignora puntos o sufijos.
- **El nombre de pila es cosmético.** El formato «APELLIDOS, NOMBRES» se reconoce por un encabezado que empieza por
  «apellido» («Apellidos y nombres» sí; «Nombres y apellidos» no) o porque la mitad o más de los valores llevan
  exactamente una coma; con cero o varias comas el saludo usa el nombre completo y se avisa. En formato «nombre», un
  valor con coma también cuenta en `names_unsplit`. Un encabezado de persona («Estudiante», «Participante»,
  «Docente»…) cuyos valores son dígitos en su mayoría es un código, no el nombre.
- **En un correo repetido gana la primera fila**, también para FNAME: el saludo usa el nombre de la primera aparición.
- **El mapeo adivinado se confirma en la muestra.** La app propone columnas por el encabezado; quien importa revisa la
  muestra y corrige el mapeo antes de exportar.
- **La primera fila es el encabezado.** Si algún encabezado tiene forma de correo, la importación se rechaza
  (`E_COLLECTION_MAIL_RECIPIENTS_NO_HEADER`) sin citar el valor: tomarlo como encabezado perdería una persona sin aviso.
- **Del XLSX se lee solo la primera hoja.** Las filas vacías al inicio o al final de la hoja que `readxl` salta por su
  cuenta no entran en `rows_blank_dropped`; solo se cuentan las vacías que quedan entre datos.
- **El separador del CSV se infiere de la primera línea** (el más frecuente entre `,`, `;` y tabulador; empate o
  ninguno → `,`).
- **El correo se compara entero y en minúsculas**: no se separan ni se normalizan la parte local y el dominio.

## Implementación de E1j, E1k y E1l (backend)

Plataforma por campaña, envíos y la importación de un HTML existente. Vive en `collection_mail_dialects.R` (tabla de
dialectos y verificación del HTML de SurveyMonkey), `collection_mail_sends.R` (envíos y plantilla efectiva),
`collection_mail_export_sm.R` (paquete de SurveyMonkey) y `collection_mail_import_html.R` (importador sobre `xml2`).
Tests: `test-collection-mail-dialects.R`, `test-collection-mail-sends.R` y `test-collection-mail-import-html.R`, con
fixtures en `tests/testthat/fixtures/mail-import/`.

- **Un solo render con dialecto (E1j).** `collection_mail_render(template, mode = preview|export, dialect =
  mailchimp|surveymonkey)`; `mode = "mailchimp"` sigue siendo el alias de export en Mailchimp. Lo que antes estaba
  cableado a Mailchimp (etiquetas, condicional, pie, `src`) lo pide el render a `.CMAIL_DIALECTS`. La huella SHA256 del
  HTML de Mailchimp se capturó antes del cambio (`paridad-mailchimp-sha256.json`, cinco casos con los dos presets) y el
  test exige que no se mueva un byte.
- **SurveyMonkey.** `{{nombre}}` → `[FirstName]`; cada campo declara `fields[].sm` (`SurveyLink`, `LastName`,
  `CustomData1..50`, única); sin condicionales (el respaldo no existe: aviso `sm_fallback`); imágenes solo por URL https
  (`images_public_url`); pie con `[PrivacyLink]` y `[OptOutLink]`. La revisión agrega `survey_link`, `footer_optout`,
  `sm_fields_mapped` (con `targets`) y `sm_custom_limit` (aviso sobre CustomData6), y no tiene chequeos de audiencia.
  El export es `<campaign_id>_<send_id>_surveymonkey_<stamp>.zip` (HTML para «HTML personalizado», LEEME y manifest,
  `sensitivity: none`), verificado por `.cmail_sm_html_verify`. `scope = completo` con SurveyMonkey es 422
  `E_COLLECTION_MAIL_PLATFORM`; el alcance por defecto es `plantilla`.
- **Destinatarios.** Pasar una campaña a SurveyMonkey purga su carpeta de destinatarios (`recipients_purged: true`) e
  importar destinatarios en ella responde 422 `E_COLLECTION_MAIL_PLATFORM`: los contactos viven en el recopilador.
- **Envíos (E1k).** `campaign.sends` (1 a 6): la invitación primero e imborrable; los recordatorios con
  `recordatorio-<k>` asignado por el servidor, estable y nunca reutilizado (`campaign.send_seq`). La plantilla efectiva
  (`.cmail_template_for_send`) cambia asunto y preheader y suma la apertura como párrafo `__apertura` tras el saludo;
  los `block_id` con `__` quedan reservados en las plantillas del usuario. `PUT mail-template` guarda plantilla y
  envíos en una sola revisión. Los exports de Mailchimp llevan el `send_id` en el nombre y el manifest suma `platform`
  y `send` (aditivo en `collection_mail_export/v1`).
- **Importar un HTML (E1l).** `POST mail-template/import-html` es lectura pura: devuelve una plantilla v2 validada, el
  informe y la plataforma detectada. El HTML crudo no se guarda en ninguna parte; la huella, la fecha, la plataforma y el
  informe enmascarado (hasta 50 ítems, extractos de 160) quedan en memoria del proceso por sesión (hasta 5) y pasan a
  `campaign.imported_from` al escribir con `import_id`. El golden es la invitación real de PULSO en SurveyMonkey.

### Supuestos y desvíos documentados (E1j-E1l)

- **v2 ampliada sin cambio de esquema.** `fields[].sm` y `theme.band` se suman a `collection_mail_template/v2` porque
  la v2 no se había publicado. Una app anterior vería esas claves como `unknown_key`.
- **El preset de capacitación no mapea su enlace a `[SurveyLink]`.** Es el enlace a una sala virtual, no a la encuesta;
  mandarlo como `[SurveyLink]` llevaría a la persona a otro sitio. Solo el preset de recuperación lo declara.
- **Sin campaña.** Con dos o más campañas, la vista previa y la revisión con la plantilla en el cuerpo y sin
  `campaign_id` trabajan sin campaña (miniaturas de presets): dialecto Mailchimp y sin destinatarios.
- **La caché de importaciones no vive en `session$…`** sino en un entorno del proceso por `sid`: una clave de sesión
  nueva viajaría en el `state.rds` del `.pulso`.
- **Texto literal con forma de HTML.** En lo importado, un «<» seguido de letra se cambia por «‹» (separarlo con un
  espacio no basta para el contrato) y una entidad literal se separa: «& nbsp;». Se informa como `text_escaped`.
- **Heurísticas del importador.** Además de los dos valores de estilo leídos (fondo del botón o separador, y
  `text-align`), la presencia de un fondo o de un borde izquierdo en una celda solo se usa para reconocer un recuadro;
  nunca se copia. Funcionan con el patrón de PULSO y con lo que la app exporta (ida y vuelta en los dos presets y los dos
  dialectos); fuera de eso, lo no reconocido queda como párrafo y en el informe.
- **Pendiente de verificar en un recopilador real:** que SurveyMonkey acepte imágenes por URL en «HTML personalizado»
  (no documenta subirlas) y que el plan de PULSO tenga ese formato (Enterprise).

## Notas

Relacionado con [ADR 0046](0046-recopiladores-despliegue-recoleccion.md), [ADR 0005](0005-secretos-fuera-del-proyecto.md)
y [ADR 0019](0019-monitoreo-aulas-universitarias.md).
