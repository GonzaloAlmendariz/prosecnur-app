// Barra extra del gráfico en el Word (F6.2, F-d; «En el Word»).
//
// El Word usa la misma barra extra que el PPT salvo que el gráfico diga otra cosa. Esa excepción es una sola clave que
// sólo lee el Word: `overrides.word_barra_extra` (mismo tipo que `barra_extra`: `false` o un arreglo de
// `top2box | bottom2box | conteos`). La lámina PPT no la lee. Ausente, el Word hereda lo que dibuja la lámina; al pedir
// lo mismo que la lámina, la clave se borra, así que si la lámina cambia el Word la sigue. Las categorías de los boxes
// son las del gráfico (`top2box_labels`, `bottom2box_labels`): se eligen en la tarjeta, no aparte para el Word.

import {
  mismaBarraExtra,
  normalizarBarraExtra,
  type BarraExtra,
} from "../../barraExtra";
import { formaTwoBox, leerTwoBox } from "./twoBox";

type Registro = Record<string, unknown>;
type Presets = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});

/** La clave que sólo lee el Word. */
export const CLAVE_SOLO_WORD = "word_barra_extra";

export const NOTA_WORD_IGUAL = "El Word usa la misma barra extra que el PPT salvo que la cambies aquí.";
export const NOTA_WORD_PROPIA = "Este gráfico lleva en el Word una barra extra distinta de la del PPT; la lámina no cambia.";

export type BarraExtraWord = {
  /** El Word decide solo (mismo valor que el PPT) o el gráfico lo cambió. */
  propia: boolean;
  /** Lo que sale en el Word. */
  valor: BarraExtra;
  /** Lo que dibuja la lámina PPT. */
  ppt: BarraExtra;
};

/** `null`: este graficador no lleva barra extra. */
export function leerBarraExtraWord(graficador: string, args: Readonly<Registro>, presets: Presets): BarraExtraWord | null {
  const estado = leerTwoBox(graficador, args, presets);
  if (!estado) return null;
  const propio = normalizarBarraExtra(registro(args.overrides)[CLAVE_SOLO_WORD]);
  return propio === undefined ? { propia: false, valor: estado.valor, ppt: estado.valor } : { propia: true, valor: propio, ppt: estado.valor };
}

/** Patch de args: decide la barra extra sólo para el Word, o borra la clave cuando lo pedido coincide con el PPT. */
export function patchBarraExtraWord(graficador: string, args: Readonly<Registro>, presets: Presets, valor: BarraExtra): Registro {
  const actual = leerBarraExtraWord(graficador, args, presets);
  if (!actual || !formaTwoBox(graficador, args)) return {};
  const pedido = normalizarBarraExtra(valor) ?? false;
  const ov: Registro = { ...registro(args.overrides) };
  delete ov[CLAVE_SOLO_WORD];
  if (!mismaBarraExtra(pedido, actual.ppt)) ov[CLAVE_SOLO_WORD] = pedido === false ? false : [...pedido];
  return { overrides: Object.keys(ov).length ? ov : null };
}
