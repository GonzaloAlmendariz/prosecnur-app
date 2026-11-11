// Estado del cálculo de pesos y su lectura para el panel "Efecto de ponderar".
//
// El panel leía un solo valor (`preview | null`) y, con él, cuatro situaciones
// distintas terminaban en el mismo texto: todavía calculando, la llamada falló,
// el motor se detuvo sin mensaje y no hay variables con metas. Aquí cada una
// tiene su nombre. No se calcula nada: solo se clasifica lo que el motor devuelve.

import type { PonderPreview } from "../../../api/analitica";

export type CalculoDePonderacion =
  /** No se pide: la ponderación está apagada o el peso viene de una columna. */
  | { fase: "inactivo" }
  /** Pedido en curso. `previo` es el último resultado, si lo hubo. */
  | { fase: "calculando"; previo: PonderPreview | null }
  | { fase: "listo"; preview: PonderPreview }
  /** La llamada no volvió (red, error del servidor). */
  | { fase: "error"; mensaje: string };

export type LecturaDelEfecto =
  | { tipo: "inactivo" }
  | { tipo: "calculando" }
  | { tipo: "error"; causa: string; reintentable: boolean }
  /** El cálculo corrió y no hay peso base ni variables con metas que aplicar. */
  | { tipo: "sin-efecto" }
  | { tipo: "efecto"; preview: PonderPreview; recalculando: boolean };

const CAUSA_SIN_CASOS = "La base preparada no tiene casos.";
const CAUSA_DESCONOCIDA = "El cálculo se detuvo sin informar la causa.";

function lecturaDelResultado(preview: PonderPreview, recalculando: boolean): LecturaDelEfecto {
  if (!preview.ok) {
    // Un error declarado del motor (peso base inválido, imputación sobre el
    // umbral, expansión sin total) trae su mensaje: es lo que hay que corregir.
    if (preview.message) return { tipo: "error", causa: preview.message, reintentable: false };
    return {
      tipo: "error",
      causa: preview.reason === "no_data" ? CAUSA_SIN_CASOS : CAUSA_DESCONOCIDA,
      reintentable: preview.reason !== "no_data",
    };
  }
  if (!preview.rake_applied && !preview.design_applied) return { tipo: "sin-efecto" };
  return { tipo: "efecto", preview, recalculando };
}

export function lecturaDelEfecto(calculo: CalculoDePonderacion): LecturaDelEfecto {
  if (calculo.fase === "inactivo") return { tipo: "inactivo" };
  if (calculo.fase === "error") return { tipo: "error", causa: calculo.mensaje, reintentable: true };
  if (calculo.fase === "listo") return lecturaDelResultado(calculo.preview, false);
  // Calculando: lo que había sigue a la vista solo si era un efecto calculado.
  // Un error o un vacío anteriores no se arrastran: puede que ya no apliquen.
  if (calculo.previo) {
    const previa = lecturaDelResultado(calculo.previo, true);
    if (previa.tipo === "efecto") return previa;
  }
  return { tipo: "calculando" };
}

/** El último resultado utilizable de un cálculo, para no vaciar la vista mientras se recalcula. */
export function ultimoResultado(calculo: CalculoDePonderacion): PonderPreview | null {
  if (calculo.fase === "listo") return calculo.preview;
  if (calculo.fase === "calculando") return calculo.previo;
  return null;
}
