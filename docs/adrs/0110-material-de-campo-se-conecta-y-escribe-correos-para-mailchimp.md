# ADR 0110: Material de campo se conecta con sus vecinos y escribe correos para Mailchimp

Estado: Aceptado

Implementacion: No iniciada

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

## Notas

Relacionado con [ADR 0046](0046-recopiladores-despliegue-recoleccion.md), [ADR 0005](0005-secretos-fuera-del-proyecto.md)
y [ADR 0019](0019-monitoreo-aulas-universitarias.md).
