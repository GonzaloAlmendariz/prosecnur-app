// Las listas de respuestas de la tarjeta (U14 del checklist de mandos del mazo, 2026-11-05): si el estudio declara el
// rótulo corto de una respuesta (`plan.rotulos_cortos`, Identidad › Rótulos cortos) la lista muestra el corto, como la
// lámina, y deja el completo en el `title`. Sólo cambia lo que se ve: el plan sigue guardando códigos o el rótulo completo.
// El job reemplaza el rótulo ENTERO (api/R/graficos_inclusivo.R), así que aquí también se compara el rótulo entero. Puro.

export type RotuloVisible = {
  /** Lo que se escribe en la lista. */
  texto: string;
  /** El rótulo completo cuando se muestra el corto; `null` si se muestra el completo. */
  completo: string | null;
};

const plano = (t: string) => t.replace(/\s+/g, " ").trim();

export function rotuloVisible(mapa: Readonly<Record<string, string>> | undefined, rotulo: string): RotuloVisible {
  if (!mapa || !rotulo) return { texto: rotulo, completo: null };
  const directo = Object.hasOwn(mapa, rotulo) ? mapa[rotulo] : undefined;
  const clave = plano(rotulo);
  const corto = directo ?? Object.entries(mapa).find(([k]) => plano(k) === clave)?.[1];
  const c = typeof corto === "string" ? corto.trim() : "";
  return c && c !== clave ? { texto: c, completo: rotulo } : { texto: rotulo, completo: null };
}
