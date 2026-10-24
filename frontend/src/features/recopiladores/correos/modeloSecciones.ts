// =============================================================================
// modeloSecciones.ts — las entradas de Pasos, Beneficios y Preguntas (L6), sin React
// =============================================================================
// Una entrada es {title, text, icon?}. Se agregan, quitan y mueven dentro del
// rango de su sección (`RANGO_DE_ENTRADAS`, el mismo que valida el render).

import { RANGO_DE_ENTRADAS, tieneEntradas, type MailBlock, type MailSectionEntry, type TipoConEntradas } from "../../../api/materialMail";

/** Cómo se llama una entrada en cada sección, y sus dos textos. */
export const ROTULOS_DE_ENTRADA: Record<TipoConEntradas, { una: string; titulo: string; texto: string; nueva: MailSectionEntry }> = {
  steps: { una: "Paso", titulo: "Qué hacer", texto: "Detalle", nueva: { title: "Nuevo paso", text: "Cuéntalo en una línea." } },
  benefits: { una: "Beneficio", titulo: "Razón", texto: "Detalle", nueva: { title: "Otra razón", text: "Cuéntala en una línea.", icon: "check" } },
  faq: { una: "Pregunta", titulo: "Pregunta", texto: "Respuesta", nueva: { title: "¿Otra pregunta?", text: "Su respuesta." } },
};

export function entradasDe(block: MailBlock): MailSectionEntry[] {
  return tieneEntradas(block.type) ? (block as { entries: MailSectionEntry[] }).entries : [];
}

function conEntradas(block: MailBlock, entries: MailSectionEntry[]): MailBlock {
  return tieneEntradas(block.type) ? ({ ...block, entries } as MailBlock) : block;
}

/** La entrada `i` con un cambio. Un texto vacío se quita (sólo el título es obligatorio). */
export function conEntrada(block: MailBlock, i: number, cambio: Partial<MailSectionEntry>): MailBlock {
  const entries = entradasDe(block).map((e, j) => {
    if (j !== i) return e;
    const next: MailSectionEntry = { ...e, ...cambio };
    if (cambio.text === "") delete next.text;
    return next;
  });
  return conEntradas(block, entries);
}

export function puedeAgregar(block: MailBlock): boolean {
  return tieneEntradas(block.type) && entradasDe(block).length < RANGO_DE_ENTRADAS[block.type][1];
}

export function puedeQuitar(block: MailBlock): boolean {
  return tieneEntradas(block.type) && entradasDe(block).length > RANGO_DE_ENTRADAS[block.type][0];
}

/** Agrega una entrada al final, con su texto de ejemplo; nunca pasa del máximo. */
export function conEntradaNueva(block: MailBlock): MailBlock {
  if (!tieneEntradas(block.type) || !puedeAgregar(block)) return block;
  return conEntradas(block, [...entradasDe(block), { ...ROTULOS_DE_ENTRADA[block.type].nueva }]);
}

/** Quita la entrada `i`; nunca deja menos del mínimo. */
export function sinEntrada(block: MailBlock, i: number): MailBlock {
  if (!puedeQuitar(block)) return block;
  return conEntradas(block, entradasDe(block).filter((_, j) => j !== i));
}

export function moverEntrada(block: MailBlock, i: number, delta: -1 | 1): MailBlock {
  const entries = [...entradasDe(block)];
  const j = i + delta;
  if (j < 0 || j >= entries.length) return block;
  [entries[i], entries[j]] = [entries[j], entries[i]];
  return conEntradas(block, entries);
}
