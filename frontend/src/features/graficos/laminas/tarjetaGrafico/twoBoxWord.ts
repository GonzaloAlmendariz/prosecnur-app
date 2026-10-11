// ¿Sale el Top Two Box de las barras apiladas también en el Word? (F6.2, F-d; «En el Word»).
//
// El Word re-dibuja cada gráfico con los ajustes Word del informe encima del preset de la lámina
// (`.apply_word_chart_presets`, reporte_plan_word.R) y después los `overrides` del gráfico, que mandan igual en la
// lámina y en el Word. Los ajustes Word de fábrica (`.WORD_CHART_PRESETS_DEFAULT_PULSO`, espejo DEFAULT_WORD_PRESETS)
// llevan la columna en las barras apiladas (`mostrar_barra_extra = TRUE`, `barra_extra_preset = "top2box"`), como el
// recetario Word. Dos reglas del motor recortan ese patch antes de aplicarlo:
// - `.word_patch_conservar_barra_extra`: si el preset PPT del informe pide otra columna que la de fábrica, el Word no
//   toca la columna.
// - `.word_patch_respetar_apagado` (sólo `barras_apiladas`): si el preset PPT del informe la apagó
//   (`mostrar_barra_extra = FALSE` o `barra_extra_preset = "ninguno"`), el Word no la enciende.
//
// Por gráfico, el Word lee los `overrides`, que mandan igual en la lámina, y además una clave que sólo lee el Word:
// `overrides.word_mostrar_barra_extra` (`.word_barra_extra_solo_word`, reporte_plan_word.R). `FALSE` apaga la columna
// sólo en el Word; `TRUE` la enciende sólo en el Word (sin preset de columna en los overrides, `top2box`); ausente
// hereda lo de la lámina. La lámina PPT no la lee. El Top Two Box sigue exigiendo sus categorías declaradas. El control
// «También en el Word» escribe sólo esa clave, y la borra cuando lo pedido coincide con lo heredado.
//
// Antes de esa clave, la tarjeta llevaba la columna al Word fijando el par `mostrar_barra_extra = TRUE` +
// `barra_extra_preset = "top2box"` en los overrides. Ese par sólo se limpia cuando es redundante para la lámina (la
// lámina hereda igual el Top Two Box): borrarlo no cambia la lámina, y una elección de la lámina nunca se toca.
//
// En la multiapilada el constructor de bloques ya fija `overrides.mostrar_barra_extra` con `top2box`, y su ajuste Word
// no cambia el preset: el Top Two Box llega al Word sin control aparte.

import { DEFAULT_WORD_PRESETS } from "../../../../api/graficosConfigNormalizer";
import { RECETARIO_TWO_BOX, formaTwoBox, heredado, leerTwoBox, presetHeredado } from "./twoBox";

type Registro = Record<string, unknown>;
type Presets = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});
const texto = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const CLAVES_COLUMNA = ["mostrar_barra_extra", "barra_extra_preset"] as const;

function columnaDe(fuente: Registro): Registro {
  const out: Registro = {};
  for (const k of CLAVES_COLUMNA) if (k in fuente) out[k] = fuente[k];
  return out;
}

const chartFabrica = registro(DEFAULT_WORD_PRESETS.chart_presets);

/** Lo que fija de fábrica el Word para cada familia, derivado de DEFAULT_WORD_PRESETS (espejo de R). */
export const WORD_FABRICA: Readonly<Record<string, Readonly<Registro>>> = {
  barras_apiladas: columnaDe(registro(chartFabrica.barras_apiladas)),
  multi_apiladas: columnaDe(registro(chartFabrica.multi_apiladas)),
};

function familias(args: Readonly<Registro>): string[] {
  const conCruce = typeof args.cruces === "string" && args.cruces.trim().length > 0;
  return conCruce ? ["barras_apiladas", "multi_apiladas"] : ["barras_apiladas"];
}

/** `.word_patch_conservar_barra_extra`: el informe pide otra columna que la de fábrica y el Word no la toca. */
function informePideOtra(ppt: Registro): boolean {
  const pedido = texto(ppt.barra_extra_preset);
  return !!pedido && pedido !== "ninguno" && pedido !== RECETARIO_TWO_BOX.barra_extra_preset;
}

/** `.word_patch_respetar_apagado`: el informe apagó la columna de las barras apiladas. */
export function informeLaApago(presets: Presets): boolean {
  const ppt = registro(presets.barras_apiladas);
  return ppt.mostrar_barra_extra === false || texto(ppt.barra_extra_preset) === "ninguno";
}

/** El patch de columna que el Word aplica sobre el preset PPT de la familia `f`, tras las dos reglas del motor. */
function patchColumnaWord(f: string, presets: Presets, wPresets: Readonly<Registro>): Registro {
  const ppt = registro(presets[f]);
  const patch = { ...WORD_FABRICA[f], ...columnaDe(registro(registro(wPresets.chart_presets)[f])) };
  if (informePideOtra(ppt)) return {};
  if (f === "barras_apiladas" && informeLaApago(presets) && patch.mostrar_barra_extra === true) return {};
  return patch;
}

/** El preset que el Word deja para el gráfico, antes de sus overrides. */
function heredadoEnWord(args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>) {
  const h = heredado(presetHeredado("apiladas", args, presets));
  let mostrar = h.mostrar;
  let preset = h.preset;
  for (const f of familias(args)) {
    const w = patchColumnaWord(f, presets, wPresets);
    if (typeof w.mostrar_barra_extra === "boolean") mostrar = w.mostrar_barra_extra;
    const p = texto(w.barra_extra_preset);
    if (p) preset = p;
  }
  return { mostrar, preset, hereda: h };
}

/** ¿Lleva el Word el Top Two Box por herencia (sin los overrides del gráfico)? */
export function topHeredadoEnWord(args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>): boolean {
  const w = heredadoEnWord(args, presets, wPresets);
  return w.mostrar && w.preset === "top2box";
}

/** La clave que sólo lee el Word (`.word_barra_extra_solo_word`). */
export const CLAVE_SOLO_WORD = "word_mostrar_barra_extra";

/**
 * Por qué el Word saca o no la columna. Todos se pueden cambiar desde el gráfico sin tocar la lámina:
 * - `fijado`: el gráfico la lleva sólo al Word (`word_mostrar_barra_extra = TRUE`);
 * - `quitado`: el gráfico la quita sólo del Word (`word_mostrar_barra_extra = FALSE`);
 * - `word_lo_da`: los ajustes Word la dan solos;
 * - `lamina_lo_necesita`: las fijaciones del gráfico la encienden en la lámina y el Word las hereda;
 * - `word_la_quita`: lo heredado en el Word no la lleva (ajustes Word del informe, o el informe la apagó y el Word lo
 *   respeta).
 */
export type MotivoTopEnWord = "fijado" | "quitado" | "word_lo_da" | "lamina_lo_necesita" | "word_la_quita";

/** La nota que acompaña al control «También en el Word» según su motivo. */
export const NOTA_TOP_EN_WORD: Readonly<Record<MotivoTopEnWord, string>> = {
  fijado: "Este gráfico la lleva al Word aunque lo heredado no la dé; la lámina no cambia. Apagarla vuelve a lo heredado.",
  quitado: "Este gráfico la quita sólo del Word; la lámina la conserva. Encenderla vuelve a lo heredado.",
  word_lo_da: "El Word la lleva por defecto, como el recetario. Apagarla aquí la quita sólo del Word para este gráfico; la lámina la conserva.",
  lamina_lo_necesita: "Este gráfico la enciende en la lámina y el Word la hereda. Apagarla aquí la quita sólo del Word; la lámina la conserva.",
  word_la_quita: "Lo que el Word hereda no la lleva (sus ajustes, o el informe la apagó). Encenderla aquí la lleva al Word sólo para este gráfico; la lámina no cambia.",
};

export type TopEnWord = {
  /** Sólo se decide aparte en las barras apiladas con el Top Two Box encendido. */
  aplica: boolean;
  sale: boolean;
  /** Se puede cambiar sin tocar la lámina. */
  editable: boolean;
  motivo?: MotivoTopEnWord;
};

/** Lo que el Word saca sin la clave sólo-Word: lo heredado en el Word con los overrides del gráfico encima. */
function saleSinClaveWord(ov: Registro, w: ReturnType<typeof heredadoEnWord>) {
  const mostrar = typeof ov.mostrar_barra_extra === "boolean" ? ov.mostrar_barra_extra : w.mostrar;
  const preset = texto(ov.barra_extra_preset) ?? w.preset;
  return mostrar && preset === "top2box";
}

/** `.word_barra_extra_solo_word` con `TRUE`: sin preset de columna en los overrides (o `"ninguno"`), `top2box`. */
function presetConClaveWord(ov: Registro): string {
  const p = texto(ov.barra_extra_preset);
  return p && p !== "ninguno" ? p : "top2box";
}

export function leerTopEnWord(graficador: string, args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>): TopEnWord {
  const estado = leerTwoBox(graficador, args, presets);
  if (formaTwoBox(graficador, args) !== "apiladas" || !estado?.top.activa) return { aplica: false, sale: false, editable: false };
  const ov = registro(args.overrides);
  const clave = ov[CLAVE_SOLO_WORD];
  if (clave === false) return { aplica: true, sale: false, editable: true, motivo: "quitado" };
  if (clave === true) {
    const sale = presetConClaveWord(ov) === "top2box";
    return { aplica: true, sale, editable: true, motivo: sale ? "fijado" : "word_la_quita" };
  }
  const w = heredadoEnWord(args, presets, wPresets);
  const sale = saleSinClaveWord(ov, w);
  if (!sale) return { aplica: true, sale, editable: true, motivo: "word_la_quita" };
  if (w.mostrar && w.preset === "top2box") return { aplica: true, sale, editable: true, motivo: "word_lo_da" };
  return { aplica: true, sale, editable: true, motivo: "lamina_lo_necesita" };
}

/**
 * Patch de args: decide la columna sólo para el Word con `word_mostrar_barra_extra`, o borra la clave cuando lo pedido
 * coincide con lo heredado. El par que la tarjeta escribía antes para el Word se limpia sólo si es redundante para la
 * lámina.
 */
export function patchTopEnWord(graficador: string, args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>, sale: boolean): Registro {
  const actual = leerTopEnWord(graficador, args, presets, wPresets);
  if (!actual.aplica || !actual.editable || actual.sale === sale) return {};
  const ov: Registro = { ...registro(args.overrides) };
  const w = heredadoEnWord(args, presets, wPresets);
  const laminaHeredaTop = w.hereda.mostrar && w.hereda.preset === "top2box";
  if (laminaHeredaTop && ov.mostrar_barra_extra === true && ov.barra_extra_preset === "top2box") {
    delete ov.mostrar_barra_extra;
    delete ov.barra_extra_preset;
  }
  delete ov[CLAVE_SOLO_WORD];
  if (sale !== saleSinClaveWord(ov, w)) ov[CLAVE_SOLO_WORD] = sale;
  return { overrides: Object.keys(ov).length ? ov : null };
}
