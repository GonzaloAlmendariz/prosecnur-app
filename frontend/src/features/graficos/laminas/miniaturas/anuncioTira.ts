// Lo que la región viva de la tira dice del lote de miniaturas (puro; lo usa TiraMiniaturas). Reglas:
// - Un mensaje por lote, no uno por lámina: con 67 láminas, «Miniaturas: k de 67 listas» eran ~67 anuncios. Mientras el
//   lote corre el texto no cambia («Dibujando 67 miniaturas»), así que el lector lo dice una vez.
// - Al terminar se dice cómo terminó («Miniaturas listas: 67 de 67», o cuántas no se pudieron dibujar). El lote vigente
//   desaparece del store al terminar, así que el anuncio recuerda los ids del último lote para contar sobre las entradas.

import type { Entradas, LoteVigente } from "./loteMiniaturas";

export type AnuncioTira = {
  /** Ids del lote que se está anunciando; null cuando no hay ninguno en curso. */
  ids: readonly string[] | null;
  texto: string;
};

export const ANUNCIO_INICIAL: AnuncioTira = { ids: null, texto: "" };

export function textoFinalLote(ids: readonly string[], entradas: Entradas): string {
  const total = ids.length;
  const errores = ids.filter((id) => entradas[id]?.estado === "error").length;
  const listas = total - errores;
  if (!errores) return `Miniaturas listas: ${listas} de ${total}`;
  return `Miniaturas listas: ${listas} de ${total}; ${errores === 1 ? "1 no se pudo dibujar" : `${errores} no se pudieron dibujar`}`;
}

/** Siguiente anuncio a partir del anterior. Idempotente: llamarlo dos veces con lo mismo devuelve el mismo texto. */
export function siguienteAnuncio(previo: AnuncioTira, vigente: LoteVigente | null, entradas: Entradas): AnuncioTira {
  if (vigente) {
    const ids = Object.keys(vigente.claves);
    const listas = ids.filter((id) => {
      const e = entradas[id];
      return !e || e.clave !== vigente.claves[id] || e.estado !== "pendiente";
    }).length;
    const texto = listas >= ids.length
      ? textoFinalLote(ids, entradas)
      : ids.length === 1 ? "Dibujando 1 miniatura" : `Dibujando ${ids.length} miniaturas`;
    return texto === previo.texto && previo.ids?.length === ids.length ? previo : { ids, texto };
  }
  if (previo.ids) return { ids: null, texto: textoFinalLote(previo.ids, entradas) };
  return previo;
}
