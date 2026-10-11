// Top Two Box y Bottom Two Box en la tarjeta de un gráfico (F6.2, F-d; dirección F6 §7 A6/A14, inventario C41).
//
// Modelo puro: qué graficadores los llevan, qué lee el motor y qué patch de args se guarda. El motor es
// `graficar_barras_apiladas()` (api/R/graficador_barras_apiladas.R) y su espec nativa (`preparar_escala()`,
// graficos_espec_escala.R): la columna existe con `mostrar_barra_extra` + `barra_extra_preset = "top2box"` y sólo se
// dibuja con `top2box_labels` declaradas (`.box_decidir`); la Bottom Two Box va AL LADO con `columna_bottom2box` y
// `bottom2box_labels`. El PPT nativo y el Word salen de la misma espec.
//
// Regla de Gonzalo: «el recetario siempre manda». Lo que hereda (preset del informe y, sin él, el de fábrica del
// recetario) no se copia al gráfico: el patch sólo escribe lo que se APARTA de lo heredado y borra la clave cuando se
// vuelve a él. Así, si el recetario cambia, cambian los gráficos que no se tocaron.
//
// Dónde se escribe, según lo que el motor lee de cada graficador:
// - Barras apiladas: `p_barras_apiladas()` sólo acepta `overrides` para esto (reporte_plan_slides.R), y
//   `.render_barras_apiladas` los mezcla al final (overrides mandan). Con «Dividir por» el render delega en la
//   multiapilada modo «cruce» con los mismos overrides, y hereda también el preset `multi_apiladas`.
// - Multiapiladas (var, cruce, var_cruce): el Top Two Box es `top2box` + `top2box_labels` del plan, el mismo par que
//   escribe el constructor de bloques (`MultiApiladasBuilder` + `mergeMultiApiladasArgsPatch`, que fija
//   `overrides.mostrar_barra_extra`). Las etiquetas sólo llegan al motor con `top2box = TRUE`
//   (`.apply_top2box_alias`, reporte_plan_ppt.R). La Bottom Two Box va por overrides.
// - Multiapiladas «multilista»: cada bloque declara su Top Two Box en el editor de bloques.

import { mergeMultiApiladasArgsPatch } from "../../multiApiladasExtraBarModel";
import { categoriasDeEscala } from "../../top2boxSeleccion";

export type FormaTwoBox = "apiladas" | "multiapiladas" | "por_bloque";

type Registro = Record<string, unknown>;
type Presets = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** Lo que el recetario fija de fábrica (`.PRESETS_DEFAULT_PULSO`, graficos_metadata.R) cuando el informe no dice nada. */
export const RECETARIO_TWO_BOX = {
  mostrar_barra_extra: true,
  barra_extra_preset: "top2box",
  columna_bottom2box: false,
} as const;

/** Qué graficadores llevan Top/Bottom Two Box en la tarjeta, y cómo. `null`: el motor no los dibuja. */
export function formaTwoBox(graficador: string, args: Readonly<Registro>): FormaTwoBox | null {
  if (graficador === "p_barras_apiladas") return "apiladas";
  if (graficador === "p_barras_multiapiladas") return args.modo === "multilista" ? "por_bloque" : "multiapiladas";
  return null;
}

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});
const booleano = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const texto = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
export const etiquetas = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
const tieneLista = (r: Registro, k: string) => etiquetas(r[k]).length > 0;
const mismaLista = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** El preset que hereda el gráfico: el de apiladas y, si el motor lo pasa por la multiapilada, el de multiapiladas encima. */
export function presetHeredado(forma: FormaTwoBox, args: Readonly<Registro>, presets: Presets): Registro {
  const apiladas = registro(presets.barras_apiladas);
  const conCruce = typeof args.cruces === "string" && args.cruces.trim().length > 0;
  if (forma === "apiladas" && !conCruce) return { ...apiladas };
  return { ...apiladas, ...registro(presets.multi_apiladas) };
}

export type Heredado = { mostrar: boolean; preset: string; bottom: boolean; top: string[]; bottomEtiquetas: string[] };

export function heredado(pre: Registro): Heredado {
  return {
    mostrar: booleano(pre.mostrar_barra_extra) ?? RECETARIO_TWO_BOX.mostrar_barra_extra,
    preset: texto(pre.barra_extra_preset) ?? RECETARIO_TWO_BOX.barra_extra_preset,
    bottom: booleano(pre.columna_bottom2box) ?? RECETARIO_TWO_BOX.columna_bottom2box,
    top: etiquetas(pre.top2box_labels),
    bottomEtiquetas: etiquetas(pre.bottom2box_labels),
  };
}

export type Caja = {
  activa: boolean;
  etiquetas: string[];
  /** Las categorías vienen del estilo del informe, no de este gráfico. */
  delInforme: boolean;
};

export type EstadoTwoBox = { forma: "apiladas" | "multiapiladas"; top: Caja; bottom: Caja };

/** Lo que el motor va a dibujar con estos args y este estilo de informe. */
export function leerTwoBox(graficador: string, args: Readonly<Registro>, presets: Presets): EstadoTwoBox | null {
  const forma = formaTwoBox(graficador, args);
  if (forma !== "apiladas" && forma !== "multiapiladas") return null;
  const ov = registro(args.overrides);
  const h = heredado(presetHeredado(forma, args, presets));
  const mostrar = booleano(ov.mostrar_barra_extra) ?? h.mostrar;
  const preset = texto(ov.barra_extra_preset) ?? h.preset;
  let topActiva: boolean;
  let topEtiquetas: string[];
  let topDelInforme: boolean;
  if (forma === "apiladas") {
    topActiva = mostrar && preset === "top2box";
    topDelInforme = !tieneLista(ov, "top2box_labels") && h.top.length > 0;
    topEtiquetas = topDelInforme ? h.top : etiquetas(ov.top2box_labels);
  } else {
    // Sin `top2box` el plan nunca pasó por el constructor: manda lo heredado (y sin etiquetas el motor la omite).
    topActiva = args.top2box === true || (args.top2box === undefined && mostrar && preset === "top2box");
    topDelInforme = !tieneLista(args, "top2box_labels") && h.top.length > 0;
    topEtiquetas = topDelInforme ? h.top : etiquetas(args.top2box_labels);
  }
  const bottomDelInforme = !tieneLista(ov, "bottom2box_labels") && h.bottomEtiquetas.length > 0;
  return {
    forma,
    top: { activa: topActiva, etiquetas: topEtiquetas, delInforme: topDelInforme },
    bottom: {
      activa: topActiva && (booleano(ov.columna_bottom2box) ?? h.bottom),
      etiquetas: bottomDelInforme ? h.bottomEtiquetas : etiquetas(ov.bottom2box_labels),
      delInforme: bottomDelInforme,
    },
  };
}

export type CambioTwoBox =
  | { caja: "top" | "bottom"; activa: boolean }
  | { caja: "top" | "bottom"; etiquetas: string[] };

/** `overrides` sin claves vacías, o `null` para borrarlos (mergeSlotArgsPatch borra lo `null`). */
const cerrar = (ov: Registro): Registro | null => (Object.keys(ov).length ? ov : null);

/** Escribe `valor` en `ov[clave]` sólo si se aparta de lo heredado; si coincide, borra la clave. */
function apartar(ov: Registro, clave: string, valor: unknown, hereda: unknown) {
  const igual = Array.isArray(valor) && Array.isArray(hereda) ? mismaLista(valor, hereda) : valor === hereda;
  if (igual || (Array.isArray(valor) && valor.length === 0)) delete ov[clave];
  else ov[clave] = valor;
}

/** El patch de args (para `updateSlotArgs`) que expresa el cambio en lo que lee el motor. */
export function patchTwoBox(graficador: string, args: Readonly<Registro>, presets: Presets, cambio: CambioTwoBox): Registro {
  const forma = formaTwoBox(graficador, args);
  if (forma !== "apiladas" && forma !== "multiapiladas") return {};
  const h = heredado(presetHeredado(forma, args, presets));
  const ov: Registro = { ...registro(args.overrides) };

  if (cambio.caja === "bottom") {
    if ("activa" in cambio) apartar(ov, "columna_bottom2box", cambio.activa, h.bottom);
    else apartar(ov, "bottom2box_labels", [...cambio.etiquetas], h.bottomEtiquetas);
    return { overrides: cerrar(ov) };
  }

  if (forma === "apiladas") {
    if ("activa" in cambio) {
      // `barra_extra_preset = "top2box"` se conserva al apagar: con `mostrar_barra_extra = TRUE` es también lo que lleva
      // el Top Two Box al Word (twoBoxWord.ts), y volver a encender la columna lo recupera entero.
      delete ov.mostrar_barra_extra;
      if (cambio.activa) {
        if (h.preset !== "top2box") ov.barra_extra_preset = "top2box";
        if (!h.mostrar || ov.barra_extra_preset === "top2box") ov.mostrar_barra_extra = true;
      } else {
        if (ov.barra_extra_preset !== "top2box") delete ov.barra_extra_preset;
        if (h.mostrar) ov.mostrar_barra_extra = false;
      }
    } else {
      apartar(ov, "top2box_labels", [...cambio.etiquetas], h.top);
    }
    return { overrides: cerrar(ov) };
  }

  // Multiapiladas: el mismo par que escribe el constructor de bloques, con su `overrides.mostrar_barra_extra`.
  const actual: Registro = { ...args, overrides: ov };
  if ("activa" in cambio) {
    const next = mergeMultiApiladasArgsPatch(actual, { top2box: cambio.activa });
    return { top2box: next.top2box, overrides: next.overrides };
  }
  const lista = [...cambio.etiquetas];
  if (!lista.length) return { top2box_labels: null };
  // Las etiquetas sólo llegan al motor con `top2box = TRUE`: declararlas es encender la columna.
  const next = mergeMultiApiladasArgsPatch(actual, { top2box: true, top2box_labels: lista });
  return { top2box: true, top2box_labels: lista, overrides: next.overrides };
}

/** Pregunta de la que salen las categorías de la escala (la primera de la multiapilada). */
export function preguntaDeEscala(graficador: string, args: Readonly<Registro>): string {
  const forma = formaTwoBox(graficador, args);
  if (!forma || forma === "por_bloque") return "";
  const v = texto(args.var);
  if (forma === "apiladas" || args.modo === "cruce") return v ?? "";
  const vars = args.vars;
  if (Array.isArray(vars)) return etiquetas(vars)[0] ?? v ?? "";
  if (vars && typeof vars === "object") {
    for (const grupo of Object.values(vars as Registro)) {
      const primera = Array.isArray(grupo) ? etiquetas(grupo)[0] : texto(grupo);
      if (primera) return primera;
    }
  }
  return v ?? "";
}

/**
 * Categorías elegibles: las de la escala menos las que nunca entran a un box (SIN INF, NS/NR, no aplica: el mismo
 * criterio que el constructor de bloques, `categoriasDeEscala`), las residuales del endpoint y las que el gráfico
 * excluye.
 */
export function categoriasElegibles(
  categorias: readonly { codigo: string; etiqueta: string; residual: boolean }[],
  excluir: unknown,
): string[] {
  const fuera = new Set(etiquetas(excluir).map((x) => x.toLowerCase()));
  const visibles = categorias.filter((c) => !c.residual && !fuera.has(c.codigo.toLowerCase()) && !fuera.has(c.etiqueta.toLowerCase()));
  return categoriasDeEscala(["escala"], () => ({ name: "escala", choices: visibles.map((c) => ({ name: c.codigo, label: c.etiqueta })) }));
}
