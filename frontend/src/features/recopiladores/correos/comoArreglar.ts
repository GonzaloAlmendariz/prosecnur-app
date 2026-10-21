// comoArreglar.ts — la salida de cada error de la revisión, en una línea.
//
// El backend dice QUÉ falla (`detail`); esto dice QUÉ HACER, en la voz de la
// vista y sin repetir el detalle. Un código que esta versión no conoce no
// inventa consejo: devuelve `null` y queda el detalle del backend.

const ARREGLO: Readonly<Record<string, string>> = {
  subject: "Escríbelo en «Asunto y vista previa» o en el envío.",
  preheader: "Escribe una frase corta en «Asunto y vista previa».",
  html_weight: "Quita bloques o acorta textos largos.",
  images_hosted: "Sube la imagen como archivo o ponle una URL pública.",
  images_available: "Sube su PNG o JPEG: viaja dentro del ZIP del correo.",
  images_alt: "Describe la imagen en una frase: qué muestra.",
  banner_size: "Sube un banner de al menos 1200 px de ancho, idealmente 1200 × 600.",
  footer_unsub: "Deja el bloque de pie: la app agrega la baja.",
  recipients: "Importa la lista en Personas.",
  tags_have_columns: "Elige en Personas la columna de cada campo.",
  fields_empty: "Completa el dato en la lista o escribe un respaldo para el campo.",
  names_unsplit: "Elige el formato «Apellidos, Nombres» en Personas.",
  duplicates_conflicting: "Corrige los correos repetidos en el archivo y vuelve a importarlo.",
  import_zip_weight: "Reduce el peso de las imágenes.",
  accent_contrast: "Elige un color de acento más oscuro en Identidad.",
  image_width: "Sube la imagen al doble de su ancho en el correo.",
  image_weight: "Reduce la imagen a menos de 1 MB.",
  survey_link: "Pon en el botón el campo del enlace y dale [SurveyLink] en la tabla de SurveyMonkey.",
  footer_optout: "Deja el bloque de pie: la app agrega [OptOutLink].",
  images_public_url: "SurveyMonkey sólo muestra imágenes alojadas: ponle una URL https.",
  sm_fields_mapped: "Elige su etiqueta en Personas, en «Para SurveyMonkey».",
  sm_fallback: "Asegura que todos tengan el dato en Contactos de SurveyMonkey.",
  sm_custom_limit: "Usa [CustomData1] a [CustomData6] si el plan no es Team o Enterprise.",
  sm_link_field_empty: "Revisa que cada contacto tenga su enlace en SurveyMonkey.",
  sm_destination_mismatch: "Di a dónde lleva el enlace antes de darle [SurveyLink].",
  send_dates: "Pon cada recordatorio después del envío anterior, en Envíos.",
  reminder_audience: "Elige a quién va el recordatorio en Envíos.",
  greeting_trato: "En el saludo, elige la columna de sexo de la lista en «Saludo según la persona».",
  greeting_trato_word: "Escribe en el saludo la palabra de respaldo, o cámbiala en «Saludo según la persona».",
  sm_trato_blank: "Importa contactos_surveymonkey.csv en el recopilador: trae el saludo ya escrito.",
  campana_text_contrast: "Elige en Identidad › Estilo un fondo de página más oscuro o más claro.",
  campana_button_contrast: "Elige en Identidad › Estilo otro relleno para el botón.",
  campana_footer_contrast: "Elige en Identidad › Estilo un fondo de página más oscuro o más claro.",
};

export function comoArreglar(code: string): string | null {
  return ARREGLO[code] ?? null;
}

/** `data-foco` del selector de la columna de sexo del saludo (Bloque › Saludo). */
export const FOCO_COLUMNA_DEL_TRATO = "trato-columna";

/** Chequeos sin bloque que viven en «Asunto y vista previa». */
const DEL_SOBRE: ReadonlySet<string> = new Set(["subject", "preheader"]);

/**
 * A dónde lleva «Ir al bloque»: el primer bloque que el backend señala; el
 * asunto y la vista previa, al sobre. `null` si el chequeo no tiene lugar en
 * el correo (la lista de destinatarios, el peso del paquete).
 */
export function destinoDelChequeo(check: { code: string; status: string; targets: readonly { block_id: string }[] }, sobre: string): string | null {
  if (check.status === "ok") return null;
  return check.targets[0]?.block_id ?? (DEL_SOBRE.has(check.code) ? sobre : null);
}
