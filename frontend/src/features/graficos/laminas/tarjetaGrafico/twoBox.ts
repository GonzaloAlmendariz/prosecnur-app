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
//   escribe el constructor de bloques (`MultiApiladasBuilder`). Las etiquetas sólo llegan al motor con `top2box = TRUE`
//   (`.apply_top2box_alias`, reporte_plan_ppt.R). La Bottom Two Box va por overrides, y por ahora sólo se deja quitar
//   (`bottomDisponible`).
// - Multiapiladas «multilista»: cada bloque declara su Top Two Box en el editor de bloques.

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
    // Encender el Bottom Two Box en una multiapilada no se ofrece (`bottomDisponible`); quitarlo sí.
    // Volver a un Bottom Two Box heredado sí se deja: es borrar el apagado del gráfico.
    if ("activa" in cambio && cambio.activa && forma === "multiapiladas" && !h.bottom) return {};
    if ("activa" in cambio) apartar(ov, "columna_bottom2box", cambio.activa, h.bottom);
    else apartar(ov, "bottom2box_labels", [...cambio.etiquetas], h.bottomEtiquetas);
    return { overrides: cerrar(ov) };
  }

  const hActiva = h.mostrar && h.preset === "top2box";

  if (forma === "apiladas") {
    if ("activa" in cambio) {
      delete ov.mostrar_barra_extra;
      if (cambio.activa) {
        // Con otro preset heredado se fija el par completo: también es lo que lleva el Top Two Box al Word (twoBoxWord.ts).
        if (h.preset !== "top2box") ov.barra_extra_preset = "top2box";
        if (!h.mostrar || ov.barra_extra_preset === "top2box") ov.mostrar_barra_extra = true;
      } else {
        // Si lo heredado ya es apagado, apagar es volver a él: se borra también el preset que pidió encender. Si no, se
        // pide `mostrar_barra_extra = FALSE` y `barra_extra_preset = "top2box"` se conserva: con él, volver a encender
        // recupera entero el par que lleva el Top Two Box al Word.
        if (hActiva) ov.mostrar_barra_extra = false;
        else if (ov.barra_extra_preset === "top2box") delete ov.barra_extra_preset;
        // Sin columna en la lámina, tampoco la lleva el Word: `word_mostrar_barra_extra = TRUE` la encendería sólo allí.
        if (ov.word_mostrar_barra_extra === true) delete ov.word_mostrar_barra_extra;
      }
    } else {
      apartar(ov, "top2box_labels", [...cambio.etiquetas], h.top);
    }
    return { overrides: cerrar(ov) };
  }

  // Multiapiladas: el par `top2box` + `top2box_labels` del plan, más lo mínimo en overrides para que la lámina dibuje lo
  // pedido. No se delega en `mergeMultiApiladasArgsPatch`: el constructor fija siempre `overrides.mostrar_barra_extra`,
  // aunque coincida con lo heredado, y la tarjeta sólo escribe lo que se aparta. Cada toque re-deriva estas claves de lo
  // que se quiere dibujar, así que volver a lo heredado deja el patch vacío.
  const estado = leerTwoBox(graficador, args, presets);
  let activa = estado?.top.activa ?? hActiva;
  let propias = etiquetas(args.top2box_labels);
  if ("activa" in cambio) activa = cambio.activa;
  else {
    propias = mismaLista(cambio.etiquetas, h.top) ? [] : [...cambio.etiquetas];
    // Las etiquetas sólo llegan al motor con `top2box = TRUE`: declararlas es encender la columna.
    if (propias.length) activa = true;
  }
  return { ...multiapiladas(ov, h, activa, propias), overrides: cerrar(ov) };
}

/** Escribe en `ov` y devuelve `top2box`/`top2box_labels` (null = borrar) para que el motor dibuje `activa`. */
function multiapiladas(ov: Registro, h: Heredado, activa: boolean, propias: string[]): Registro {
  const hActiva = h.mostrar && h.preset === "top2box";
  // `.merge_args` pone el preset del informe y los overrides ENCIMA de lo que fija `top2box` (`.apply_top2box_alias`):
  // si lo heredado no dibuja la columna, hace falta pedirla en overrides.
  if (activa) {
    if (h.mostrar) delete ov.mostrar_barra_extra;
    else ov.mostrar_barra_extra = true;
    if (h.preset === "top2box") delete ov.barra_extra_preset;
    else ov.barra_extra_preset = "top2box";
  } else {
    if (hActiva) ov.mostrar_barra_extra = false;
    else delete ov.mostrar_barra_extra;
    if (ov.barra_extra_preset === "top2box" || ov.barra_extra_preset === h.preset) delete ov.barra_extra_preset;
  }
  const top2box = activa ? (propias.length > 0 || !hActiva ? true : null) : hActiva ? false : null;
  return { top2box, top2box_labels: propias.length ? propias : null };
}

export type BottomDisponible = { ofrecer: boolean; editable: boolean; nota?: string };

export const NOTA_BOTTOM_MULTIAPILADAS =
  "En esta composición el Bottom Two Box todavía no se dibuja bien en la lámina; disponible en barras apiladas.";

/**
 * Si se ofrece «Bottom Two Box al lado». En las multiapiladas el motor todavía no lo dibuja bien (la lámina pierde su
 * paginación y los rótulos de fila se solapan): no se ofrece encenderlo, pero si el gráfico ya lo tiene (o lo pide el
 * estilo del informe) se muestra y se deja quitar y volver a poner.
 */
export function bottomDisponible(graficador: string, args: Readonly<Registro>, presets: Presets): BottomDisponible {
  const estado = leerTwoBox(graficador, args, presets);
  if (!estado?.top.activa) return { ofrecer: false, editable: false };
  if (estado.forma === "apiladas") return { ofrecer: true, editable: true };
  // Encender sólo se deja si es volver a lo que el estilo del informe ya pide (borrar el apagado del gráfico).
  const heredaBottom = heredado(presetHeredado(estado.forma, args, presets)).bottom;
  return { ofrecer: true, editable: estado.bottom.activa || heredaBottom, nota: NOTA_BOTTOM_MULTIAPILADAS };
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
