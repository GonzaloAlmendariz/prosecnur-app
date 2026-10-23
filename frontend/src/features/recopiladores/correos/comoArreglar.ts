// comoArreglar.ts — la salida de cada error de la revisión, en una línea.
//
// El backend dice QUÉ falla (`detail`); esto dice QUÉ HACER, en la voz de la
// vista y sin repetir el detalle. Un código que esta versión no conoce no
// inventa consejo: devuelve `null` y queda el detalle del backend.

const ARREGLO: Readonly<Record<string, string>> = {
  subject: "Escríbelo en «Asunto y vista previa» o en el envío.",
  preheader: "Escribe una frase corta en «Asunto y vista previa».",
  html_weight: "Quita bloques o acorta textos largos.",
  images_hosted: "Sube la imagen como archivo o ponle su dirección web.",
  images_available: "Sube su PNG o JPEG: va dentro del archivo para Mailchimp.",
  images_alt: "Describe la imagen en una frase: qué muestra.",
  placeholders_pending: "Reemplaza cada texto entre corchetes por el dato real; «Ir al bloque» te lleva al primero.",
  banner_size: "Sube un banner de al menos 1200 px de ancho, idealmente 1200 × 600.",
  footer_unsub: "Deja el bloque de pie: la app le agrega el enlace de baja.",
  recipients: "Importa la lista en Personas.",
  tags_have_columns: "Elige en Personas la columna de cada campo.",
  fields_empty: "Completa el dato en la lista o escribe un respaldo para el campo.",
  names_unsplit: "Elige el formato «Apellidos, Nombres» en Personas.",
  duplicates_conflicting: "Corrige los correos repetidos en el archivo y vuelve a importarlo.",
  import_zip_weight: "Reduce el peso de las imágenes.",
  accent_contrast: "Elige un color de acento más oscuro en Identidad.",
  image_width: "Sube la imagen al doble del ancho con que sale en el correo.",
  image_weight: "Vuelve a subir la imagen: al subirla se reduce sola a menos de 1 MB.",
  survey_link: "Pon en el botón el campo del enlace y elige [SurveyLink] en Personas › «Para SurveyMonkey».",
  footer_optout: "Deja el bloque de pie: la app le agrega el enlace de baja.",
  images_public_url: "Ponle a la imagen su dirección web (https): SurveyMonkey no la lleva dentro.",
  sm_fields_mapped: "Elige su etiqueta en Personas, en «Para SurveyMonkey».",
  sm_fallback: "Asegura que todos tengan el dato en Contactos de SurveyMonkey.",
  sm_custom_limit: "Usa sólo [CustomData1] a [CustomData6] si el plan no es Team o Enterprise.",
  sm_link_field_empty: "Revisa que cada contacto tenga su enlace en SurveyMonkey.",
  sm_destination_mismatch: "Responde en Personas › «Para SurveyMonkey» si el enlace es la encuesta.",
  send_dates: "Pon cada recordatorio después del envío anterior, en Envíos.",
  reminder_audience: "Elige a quién va el recordatorio en Envíos.",
  greeting_trato: "Elige la columna de sexo de la lista en «Saludo según la persona».",
  greeting_trato_word: "Escribe en el saludo la palabra de respaldo, o cámbiala en «Saludo según la persona».",
  sm_trato_blank: "Importa en el recopilador el archivo de contactos que exporta la app: trae el saludo ya escrito.",
  campana_text_contrast: "Elige en Identidad › Estilo un fondo de página más oscuro o más claro.",
  campana_button_contrast: "Elige en Identidad › Estilo otro relleno para el botón.",
  campana_footer_contrast: "Elige en Identidad › Estilo un fondo de página más oscuro o más claro.",
  paragraph_accent_contrast: "Elige un acento más oscuro en Identidad, o deja esos párrafos en tono Normal.",
  piezas_contrast: "Elige para la pieza un color que resalte sobre el fondo, en Bloque › Color.",
  icon_text_sm_icon: "Pon en el bloque la dirección web (https) del ícono; si no, el texto sale solo, sin ícono.",
  logos_duplicados: "Quita la franja de logos o marca que el banner no los trae.",
};

export function comoArreglar(code: string): string | null {
  return ARREGLO[code] ?? null;
}

/**
 * Chequeos cuyo botón ya es el arreglo («Elegir columna»): una línea más
 * repetiría la causa con otras palabras.
 */
const ARREGLO_EN_EL_BOTON: ReadonlySet<string> = new Set(["greeting_trato"]);

/** Con la columna de sexo ya elegida, lo que falta es el dato de algunas personas. */
const ARREGLO_CON_COLUMNA = "Completa o corrige el sexo de esas personas en la lista y vuelve a importarla.";

/**
 * La línea de arreglo que acompaña al chequeo en la Revisión; `null` si el
 * botón ya la dice. Con la columna del saludo ya elegida (#4 del re-QA
 * e10-2), no se pide elegirla otra vez.
 */
export function arregloEnLaRevision(code: string, contexto: { columnaElegida?: boolean } = {}): string | null {
  if (code === "greeting_trato" && contexto.columnaElegida) return ARREGLO_CON_COLUMNA;
  return ARREGLO_EN_EL_BOTON.has(code) ? null : comoArreglar(code);
}

/**
 * La causa en una frase y en la voz del equipo, cuando el detalle del backend
 * repite el arreglo o nombra etiquetas de plataforma. `null` deja el detalle.
 */
export function causaDelChequeo(check: { code: string; status: string; detail: string }): string | null {
  if (check.status === "ok") return null;
  switch (check.code) {
    case "recipients":
      return /^Importa/i.test(check.detail) ? "Todavía no hay lista de personas." : null;
    case "tags_have_columns":
      return "A algunos campos les falta su columna de la lista.";
    case "greeting_trato": {
      // #11: «1 de 6 destinatarios recibirán «Estimado(a)»: 1 sin dato y 0 con…
      // (la columna trae…).» → sólo la primera frase, sin ceros ni paréntesis.
      const reparto = check.detail.match(/^(\d+ de \d+ destinatarios? recibir[áa]n? «[^»]*»):/);
      if (reparto) return `${reparto[1]}.`;
      // «El saludo dirá «Estimado(a)» a todos: declara la columna de sexo.» → sólo la causa.
      const causa = check.detail.replace(/:\s*declara.*$/i, ".").trim();
      return causa || null;
    }
    case "sm_trato_blank":
      return "SurveyMonkey no elige el saludo: lo toma del dato de cada contacto.";
    default:
      return null;
  }
}

/** `data-foco` del selector de la columna de sexo del saludo (Bloque › Saludo). */
export const FOCO_COLUMNA_DEL_TRATO = "trato-columna";

/** La pestaña del inspector donde se corrige un chequeo que no vive en un bloque. */
export type PestanaDelChequeo = "destinatarios" | "envios";

const EN_PESTANA: Readonly<Record<string, PestanaDelChequeo>> = {
  recipients: "destinatarios",
  tags_have_columns: "destinatarios",
  fields_empty: "destinatarios",
  names_unsplit: "destinatarios",
  sm_fields_mapped: "destinatarios",
  sm_destination_mismatch: "destinatarios",
  send_dates: "envios",
  reminder_audience: "envios",
};

/**
 * Adónde lleva el botón de un chequeo sin bloque: Personas o Envíos, que es
 * donde su arreglo dice que se corrige. `null` si no hay pestaña propia.
 */
export function pestanaDelChequeo(check: { code: string; status: string }): PestanaDelChequeo | null {
  if (check.status === "ok") return null;
  return EN_PESTANA[check.code] ?? null;
}

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
