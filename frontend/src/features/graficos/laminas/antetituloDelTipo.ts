// Qué antetítulo lleva cada tipo de lámina, como lo dibuja el motor (api/R/lamina_identidad.R). Gonzalo, 2026-10-13:
// el índice y el objetivo «vuelven a pedir antetítulo» y no deben llevarlo. La portada tampoco lo dibuja, y las láminas
// de ayuda traen uno fijo del estándar («Cómo leer este informe», «Metodología»): ofrecer un campo que el motor ignora
// es prometer algo que no sale.

export type AntetituloDelTipo =
  | { modo: "editable" }
  | { modo: "ninguno" }
  | { modo: "fijo"; texto: string }
  | { modo: "capitulo" };

const SIN_ANTETITULO = new Set(["p_slide_portada", "p_slide_indice", "p_slide_objetivo_icono", "p_slide_cierre"]);

const FIJO: Record<string, string> = {
  p_slide_top_two_box: "Cómo leer este informe",
  p_slide_redondeo: "Cómo leer este informe",
  p_slide_tabla_tecnica: "Metodología",
};

export function antetituloDelTipo(tipo: string): AntetituloDelTipo {
  if (tipo === "p_slide_seccion") return { modo: "capitulo" };
  if (SIN_ANTETITULO.has(tipo)) return { modo: "ninguno" };
  const fijo = FIJO[tipo];
  return fijo ? { modo: "fijo", texto: fijo } : { modo: "editable" };
}
