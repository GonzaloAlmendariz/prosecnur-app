// ¿Sale el Top Two Box de las barras apiladas también en el Word? (F6.2, F-d; «En el Word»).
//
// El Word re-dibuja cada gráfico con los ajustes Word del informe encima del preset de la lámina
// (`.apply_word_chart_presets`, reporte_plan_word.R). Los de fábrica (`.WORD_CHART_PRESETS_DEFAULT_PULSO`) apagan la
// columna extra de las apiladas (`mostrar_barra_extra = FALSE`, `barra_extra_preset = "ninguno"`) salvo que el preset
// PPT del informe pida otra columna que la de fábrica (`.word_patch_conservar_barra_extra`). Los `overrides` del
// gráfico se aplican después y mandan también en el Word: fijar `mostrar_barra_extra = TRUE` y
// `barra_extra_preset = "top2box"` en el gráfico es lo único que el motor lee para que su Top Two Box llegue al Word.
// Que ese default del Word contradiga al recetario (cuyas figuras Word llevan la columna) es un pedido de motor.
//
// En la multiapilada el constructor de bloques ya fija `overrides.mostrar_barra_extra` con `top2box`, y su ajuste Word
// no cambia el preset: el Top Two Box llega al Word sin control aparte.

import { RECETARIO_TWO_BOX, formaTwoBox, heredado, leerTwoBox, presetHeredado } from "./twoBox";

type Registro = Record<string, unknown>;
type Presets = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});

/** Lo que fija de fábrica el Word para cada familia (`.WORD_CHART_PRESETS_DEFAULT_PULSO`). */
export const WORD_FABRICA: Readonly<Record<string, Registro>> = {
  barras_apiladas: { mostrar_barra_extra: false, barra_extra_preset: "ninguno" },
  multi_apiladas: { mostrar_barra_extra: false },
};

function familias(args: Readonly<Registro>): string[] {
  const conCruce = typeof args.cruces === "string" && args.cruces.trim().length > 0;
  return conCruce ? ["barras_apiladas", "multi_apiladas"] : ["barras_apiladas"];
}

/** El preset que el Word deja para el gráfico, antes de sus overrides. */
function heredadoEnWord(args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>) {
  const h = heredado(presetHeredado("apiladas", args, presets));
  const chart = registro(wPresets.chart_presets);
  let mostrar = h.mostrar;
  let preset = h.preset;
  for (const f of familias(args)) {
    const pedido = registro(presets[f]).barra_extra_preset;
    const conserva = typeof pedido === "string" && pedido.trim() !== "" && pedido !== "ninguno" && pedido !== RECETARIO_TWO_BOX.barra_extra_preset;
    if (conserva) continue;
    const w = { ...WORD_FABRICA[f], ...registro(chart[f]) };
    if (typeof w.mostrar_barra_extra === "boolean") mostrar = w.mostrar_barra_extra;
    if (typeof w.barra_extra_preset === "string" && w.barra_extra_preset.trim()) preset = w.barra_extra_preset.trim();
  }
  return { mostrar, preset, hereda: h };
}

export type TopEnWord = {
  /** Sólo se decide aparte en las barras apiladas con el Top Two Box encendido. */
  aplica: boolean;
  sale: boolean;
  /** Se puede cambiar sin tocar la lámina. */
  editable: boolean;
};

export function leerTopEnWord(graficador: string, args: Readonly<Registro>, presets: Presets, wPresets: Readonly<Registro>): TopEnWord {
  const estado = leerTwoBox(graficador, args, presets);
  if (formaTwoBox(graficador, args) !== "apiladas" || !estado?.top.activa) return { aplica: false, sale: false, editable: false };
  const ov = registro(args.overrides);
  const w = heredadoEnWord(args, presets, wPresets);
  const mostrar = typeof ov.mostrar_barra_extra === "boolean" ? ov.mostrar_barra_extra : w.mostrar;
  const preset = typeof ov.barra_extra_preset === "string" && ov.barra_extra_preset ? ov.barra_extra_preset : w.preset;
  const sale = mostrar && preset === "top2box";
  // Apagarlo sólo en el Word es quitar las fijaciones del gráfico; si la lámina las necesita, no se puede.
  const laminaLasNecesita = !(w.hereda.mostrar && w.hereda.preset === "top2box");
  const wordLoDaSolo = w.mostrar && w.preset === "top2box";
  return { aplica: true, sale, editable: !sale || (!laminaLasNecesita && !wordLoDaSolo) };
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
