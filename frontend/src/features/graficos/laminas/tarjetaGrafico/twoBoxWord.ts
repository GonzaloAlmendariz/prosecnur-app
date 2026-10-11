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
// Por gráfico, el único canal que el motor lee son los `overrides`, compartidos con la lámina: fijar
// `mostrar_barra_extra = TRUE` + `barra_extra_preset = "top2box"` la lleva al Word cuando sus ajustes la quitan, y borrar
// esas claves vuelve a lo heredado. No hay clave que la apague SÓLO en el Word (ni `.word_ajustar_el` ni
// `.word_conservar_barra_extra_pedida` leen una): cuando el Word la da solo, apagarla es un pedido de motor y aquí se
// informa con `motivo = "word_lo_da"`, sin fingir un control que el motor ignoraría.
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

// `multi_apiladas` del Word de R (`mostrar_barra_extra = FALSE`) todavía no tiene espejo en DEFAULT_WORD_PRESETS; hasta
// que lo tenga, éste es el suelo y el espejo lo pisa en cuanto lo declare.
const MULTI_APILADAS_SIN_ESPEJO: Registro = { mostrar_barra_extra: false };

/** Lo que fija de fábrica el Word para cada familia, derivado de DEFAULT_WORD_PRESETS (espejo de R). */
export const WORD_FABRICA: Readonly<Record<string, Readonly<Registro>>> = {
  barras_apiladas: columnaDe(registro(chartFabrica.barras_apiladas)),
  multi_apiladas: { ...MULTI_APILADAS_SIN_ESPEJO, ...columnaDe(registro(chartFabrica.multi_apiladas)) },
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

/**
 * Por qué el Word saca o no la columna, y si se puede cambiar desde el gráfico:
 * - `fijado`: el gráfico la fija para el Word (se vuelve a lo heredado borrando las claves);
 * - `word_lo_da`: los ajustes Word la dan solos; apagarla sólo en el Word no tiene canal en el motor;
 * - `lamina_lo_necesita`: las fijaciones del gráfico son las que encienden la lámina; quitarlas la apagaría también;
 * - `word_la_quita`: lo heredado en el Word no la lleva (ajustes Word del informe, o el informe la apagó y el Word lo
 *   respeta); el gráfico puede fijarla.
 */
export type MotivoTopEnWord = "fijado" | "word_lo_da" | "lamina_lo_necesita" | "word_la_quita";

/** La nota que acompaña al control «También en el Word» según su motivo. */
export const NOTA_TOP_EN_WORD: Readonly<Record<MotivoTopEnWord, string>> = {
  fijado: "Este gráfico la lleva al Word aunque los ajustes Word no la den; apagarla vuelve a lo del informe.",
  word_lo_da: "El Word la lleva por defecto, como el recetario. Para quitarla del Word, apágala en los ajustes Word del informe: este gráfico no puede quitarla sólo del Word.",
  lamina_lo_necesita: "Este gráfico la enciende también para la lámina, y el Word lee lo mismo: no se puede quitar sólo del Word.",
  word_la_quita: "Lo que el Word hereda no la lleva (sus ajustes, o el informe la apagó). Encenderla aquí la lleva al Word sólo para este gráfico.",
};

export type TopEnWord = {
  /** Sólo se decide aparte en las barras apiladas con el Top Two Box encendido. */
  aplica: boolean;
  sale: boolean;
  /** Se puede cambiar sin tocar la lámina. */
  editable: boolean;
  motivo?: MotivoTopEnWord;
};

export function leerTopEnWord(graficador: string, args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>): TopEnWord {
  const estado = leerTwoBox(graficador, args, presets);
  if (formaTwoBox(graficador, args) !== "apiladas" || !estado?.top.activa) return { aplica: false, sale: false, editable: false };
  const ov = registro(args.overrides);
  const w = heredadoEnWord(args, presets, wPresets);
  const mostrar = typeof ov.mostrar_barra_extra === "boolean" ? ov.mostrar_barra_extra : w.mostrar;
  const preset = texto(ov.barra_extra_preset) ?? w.preset;
  const sale = mostrar && preset === "top2box";
  const wordLoDaSolo = w.mostrar && w.preset === "top2box";
  if (!sale) return { aplica: true, sale, editable: true, motivo: "word_la_quita" };
  if (wordLoDaSolo) return { aplica: true, sale, editable: false, motivo: "word_lo_da" };
  // Sale por las fijaciones del gráfico: quitarlas sólo es posible si la lámina no las necesita.
  const laminaLasNecesita = !(w.hereda.mostrar && w.hereda.preset === "top2box");
  return laminaLasNecesita
    ? { aplica: true, sale, editable: false, motivo: "lamina_lo_necesita" }
    : { aplica: true, sale, editable: true, motivo: "fijado" };
}

/** Patch de args: fija o quita en el gráfico el par que el Word lee. */
export function patchTopEnWord(graficador: string, args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>, sale: boolean): Registro {
  const actual = leerTopEnWord(graficador, args, presets, wPresets);
  if (!actual.aplica || !actual.editable || actual.sale === sale) return {};
  const ov: Registro = { ...registro(args.overrides) };
  if (sale) {
    ov.mostrar_barra_extra = true;
    ov.barra_extra_preset = "top2box";
  } else {
    delete ov.mostrar_barra_extra;
    delete ov.barra_extra_preset;
  }
  return { overrides: Object.keys(ov).length ? ov : null };
}
