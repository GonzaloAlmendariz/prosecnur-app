// modeloTrato.ts — el saludo según la persona (C8; ADR 0110 §«Saludo por sexo»).
//
// Pedido de Gonzalo: «¿Podemos hacer que este estimado pase a estimado o
// estimada?», con la decisión «columna de sexo, la app traduce». El saludo
// lleva `trato`: fijo, o por sexo con una columna de la lista. La palabra que
// cambia es la de respaldo dentro del texto del saludo. Aquí vive lo que puede
// equivocarse sin pantalla: el trato vigente de un bloque, cómo se cambia, qué
// dice la línea de resultado con sus cifras y cómo se lee «M» en palabras.

import {
  MAIL_TRATO_PALABRAS,
  type MailGreetingBlock,
  type MailProblem,
  type MailRecipientsTrato,
  type MailTrato,
  type MailTratoLectura,
} from "../../../api/materialMail";

/** El trato del saludo; un saludo sin trato se lee como «igual para todos». */
export function tratoDelSaludo(block: Pick<MailGreetingBlock, "trato">): MailTrato {
  return block.trato ?? { modo: "fijo", ...MAIL_TRATO_PALABRAS };
}

export type CambioDeTrato =
  | { modo: MailTrato["modo"] }
  | { columna: string | null }
  | { palabra: "masculino" | "femenino" | "respaldo"; valor: string };

export function conTrato(block: MailGreetingBlock, cambio: CambioDeTrato): MailGreetingBlock {
  const actual = tratoDelSaludo(block);
  if ("modo" in cambio) {
    // Volver a «igual para todos» conserva la columna: se recupera al volver.
    return { ...block, trato: { ...actual, modo: cambio.modo } };
  }
  if ("columna" in cambio) {
    const { columna: _vieja, ...sinColumna } = actual;
    void _vieja;
    return { ...block, trato: cambio.columna ? { ...sinColumna, columna: cambio.columna } : sinColumna };
  }
  return { ...block, trato: { ...actual, [cambio.palabra]: cambio.valor } };
}

/** ¿La palabra de respaldo está en el saludo? Sin ella el trato no cambia nada. */
export function respaldoEnElSaludo(block: Pick<MailGreetingBlock, "text" | "fallback" | "trato">): boolean {
  const respaldo = tratoDelSaludo(block).respaldo;
  return block.text.includes(respaldo) || (block.fallback ?? "").includes(respaldo);
}

/**
 * «Estimado a 3 · Estimada a 2 · Estimado(a) a 1 sin dato». El denominador son
 * los destinatarios efectivos; un valor que no se reconoce va aparte.
 */
export function lineaDelTrato(t: MailRecipientsTrato, trato: MailTrato): string | null {
  const c = t.counts;
  if (!t.presente || !c) return null;
  const partes = [`${trato.masculino} a ${c.masculino}`, `${trato.femenino} a ${c.femenino}`];
  if (c.sin_dato) partes.push(`${trato.respaldo} a ${c.sin_dato} sin dato`);
  if (c.no_reconocido) partes.push(`${trato.respaldo} a ${c.no_reconocido} con un valor que no se reconoce`);
  return partes.join(" · ");
}

/** Cómo se leyó «M» en la columna, en palabras. */
export function lecturaEnPalabras(lectura: MailTratoLectura | null, trato: MailTrato): string | null {
  switch (lectura) {
    case "m_f": return "«M» se lee como masculino: la columna trae «F» y no «H».";
    case "h_m": return "«M» se lee como mujer: la columna trae «H» y no «F».";
    case "m_ambigua": return `«M» no se puede leer: la columna trae «H» y «F», o ninguna de las dos. Quien tenga «M» recibe «${trato.respaldo}».`;
    case "sin_m": return "La columna no trae «M»: se lee directo.";
    default: return null;
  }
}

/** Rótulos es-PE de los problemas de validación del trato (el detalle lo da el backend). */
export const ROTULO_DE_PROBLEMA_TRATO: Readonly<Record<string, string>> = {
  unknown_key: "Un dato que el saludo no conoce",
  bad_trato_mode: "Modo del saludo",
  trato_has_field: "La palabra no admite campos",
  trato_bad_word: "La palabra no lleva negrita",
  missing_text: "Falta la palabra",
  text_too_long: "Palabra demasiado larga",
  bad_column: "Columna de sexo",
  bad_sm: "Etiqueta de SurveyMonkey del saludo",
  duplicate_sm: "Etiqueta de SurveyMonkey repetida",
  trato_tag_taken: "La etiqueta SALUDO ya la usa otro campo",
};

export function esProblemaDelTrato(p: Pick<MailProblem, "path">): boolean {
  return /\.trato(\.|$)/.test(p.path);
}

export function rotuloDeProblemaDelTrato(p: Pick<MailProblem, "code" | "detail">): string {
  const rotulo = ROTULO_DE_PROBLEMA_TRATO[p.code];
  return rotulo ? `${rotulo}: ${p.detail}` : p.detail;
}

export const LARGO_PALABRA_TRATO = 40;

/**
 * Qué paquete pide el envío. Mailchimp tiene sus dos botones; en SurveyMonkey
 * hay uno: con la lista cargada es `completo` (trae contactos_surveymonkey.csv
 * con el saludo listo para el recopilador) y sin ella, la plantilla.
 */
export function alcanceDelPaqueteSM(plataforma: string, conLista: boolean): "completo" | "plantilla" {
  return plataforma === "surveymonkey" && conLista ? "completo" : "plantilla";
}
