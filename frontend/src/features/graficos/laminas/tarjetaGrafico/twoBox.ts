// Barra extra (Top Two Box, Bottom Two Box, Conteos) en la tarjeta de un gráfico (F6.2, F-d; dirección F6 §7 A6/A14).
//
// Modelo puro: qué graficadores llevan la barra extra, qué lee el motor y qué patch de args se guarda. El valor es
// `barra_extra` (`false` o un arreglo de `top2box | bottom2box | conteos`; reglas en `barraExtra.ts`) y el motor lo
// resuelve bloque > lámina > preset. Las categorías de cada box siguen en `top2box_labels` y `bottom2box_labels`; sin
// ellas el motor omite la columna y lo avisa (`.box_decidir`). El frontend ya no escribe las claves viejas
// (`mostrar_barra_extra`, `barra_extra_preset`, `top2box`, `columna_bottom2box`).
//
// Regla de Gonzalo: «el recetario siempre manda». Lo que hereda (preset del informe y, sin él, el de fábrica del
// recetario) no se copia al gráfico: el patch sólo escribe lo que se APARTA de lo heredado y borra la clave cuando se
// vuelve a él. Así, si el recetario cambia, cambian los gráficos que no se tocaron.
//
// Dónde se escribe, según lo que el motor lee de cada graficador:
// - Barras apiladas: sólo acepta `overrides` (reporte_plan_slides.R). Con «Dividir por» el render delega en la
//   multiapilada modo «cruce» con los mismos overrides, y hereda también el preset `multi_apiladas`.
// - Multiapiladas (var, cruce, var_cruce): `overrides.barra_extra` y, para las categorías, `top2box_labels` del plan.
// - Multiapiladas «multilista»: la decisión es de cada bloque (editor de bloques); en la tarjeta sólo se escribe el valor
//   de la lámina, que los bloques sin barra propia heredan. Las láminas de varios bloques (multilista) o de varios
//   gráficos (mixtas, paneles) todavía no dibujan la segunda columna en nativo (`.lam_escala_en_filas`): ahí el Bottom
//   Two Box no se enciende, sólo se quita (`bottomDisponible`).

import {
  barraExtraDePreset,
  barraExtraDeTarjeta,
  mismaBarraExtra,
  normalizarBarraExtra,
  opcionesActivas,
  resolverBarraExtra,
  type BarraExtra,
  type OrigenBarraExtra,
} from "../../barraExtra";
import { categoriasDeEscala } from "../../top2boxSeleccion";

export type FormaTwoBox = "apiladas" | "multiapiladas" | "por_bloque";

type Registro = Record<string, unknown>;
type Presets = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** Lo que el recetario fija de fábrica (`.PRESETS_DEFAULT_PULSO`, graficos_metadata.R) cuando el informe no dice nada. */
export const RECETARIO_BARRA_EXTRA: BarraExtra = ["top2box"];

/** Qué graficadores llevan barra extra en la tarjeta, y cómo. `null`: el motor no la dibuja. */
export function formaTwoBox(graficador: string, args: Readonly<Registro>): FormaTwoBox | null {
  if (graficador === "p_barras_apiladas") return "apiladas";
  if (graficador === "p_barras_multiapiladas") return args.modo === "multilista" ? "por_bloque" : "multiapiladas";
  return null;
}

const registro = (v: unknown): Registro => (v && typeof v === "object" && !Array.isArray(v) ? (v as Registro) : {});
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

export type Heredado = { valor: BarraExtra; origen: OrigenBarraExtra; top: string[]; bottomEtiquetas: string[] };

/**
 * Lo que hereda el gráfico del preset. Sin `barra_extra` en el preset manda el recetario (Top Two Box), salvo en la
 * multilista: allí cada bloque declara la suya y el que no la declara sale sin barra (como antes, el motor no la dibuja).
 */
export function heredado(pre: Registro, forma: FormaTwoBox = "apiladas"): Heredado {
  const delPreset = barraExtraDePreset(pre);
  return {
    valor: delPreset ?? (forma === "por_bloque" ? false : RECETARIO_BARRA_EXTRA),
    origen: delPreset === undefined ? "ninguno" : "preset",
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

export type EstadoTwoBox = {
  forma: FormaTwoBox;
  /** Lo que el motor va a dibujar y de dónde sale (la lámina o el estilo del informe). */
  valor: BarraExtra;
  origen: OrigenBarraExtra;
  top: Caja;
  bottom: Caja;
  conteos: boolean;
};

/** Lo que el motor va a dibujar con estos args y este estilo de informe. */
export function leerTwoBox(graficador: string, args: Readonly<Registro>, presets: Presets): EstadoTwoBox | null {
  const forma = formaTwoBox(graficador, args);
  if (!forma) return null;
  const ov = registro(args.overrides);
  const h = heredado(presetHeredado(forma, args, presets), forma);
  const { valor, origen } = resolverBarraExtra(
    { lamina: barraExtraDeTarjeta(args), preset: h.origen === "preset" ? h.valor : undefined },
    h.valor,
  );
  const activas = opcionesActivas(valor);
  // Apiladas: las categorías son del gráfico (`overrides`). Multiapiladas: del plan (`args`).
  const fuenteTop = forma === "apiladas" ? ov : args;
  const topDelInforme = !tieneLista(fuenteTop, "top2box_labels") && h.top.length > 0;
  const bottomDelInforme = !tieneLista(ov, "bottom2box_labels") && h.bottomEtiquetas.length > 0;
  return {
    forma,
    valor,
    origen,
    conteos: activas.includes("conteos"),
    top: { activa: activas.includes("top2box"), etiquetas: topDelInforme ? h.top : etiquetas(fuenteTop.top2box_labels), delInforme: topDelInforme },
    bottom: { activa: activas.includes("bottom2box"), etiquetas: bottomDelInforme ? h.bottomEtiquetas : etiquetas(ov.bottom2box_labels), delInforme: bottomDelInforme },
  };
}

/** Lo que hereda el gráfico del estilo del informe (o del recetario): a lo que vuelve «Volver a la del informe». */
export function valorHeredado(graficador: string, args: Readonly<Registro>, presets: Presets): BarraExtra | null {
  const forma = formaTwoBox(graficador, args);
  return forma ? heredado(presetHeredado(forma, args, presets), forma).valor : null;
}

export type CambioTwoBox =
  | { valor: BarraExtra }
  | { caja: "top" | "bottom"; etiquetas: string[] };

/** `overrides` sin claves vacías, o `null` para borrarlos (mergeSlotArgsPatch borra lo `null`). */
const cerrar = (ov: Registro): Registro | null => (Object.keys(ov).length ? ov : null);

/** Escribe `valor` en `ov[clave]` sólo si se aparta de lo heredado; si coincide, borra la clave. */
function apartar(ov: Registro, clave: string, valor: string[], hereda: string[]) {
  if (valor.length === 0 || mismaLista(valor, hereda)) delete ov[clave];
  else ov[clave] = valor;
}

/** El patch de args (para `updateSlotArgs`) que expresa el cambio en lo que lee el motor. */
export function patchTwoBox(
  graficador: string,
  args: Readonly<Registro>,
  presets: Presets,
  cambio: CambioTwoBox,
  composicion: Composicion = "sola",
): Registro {
  const forma = formaTwoBox(graficador, args);
  if (!forma) return {};
  const h = heredado(presetHeredado(forma, args, presets), forma);
  const ov: Registro = { ...registro(args.overrides) };

  if ("valor" in cambio) {
    const pedido = normalizarBarraExtra(cambio.valor) ?? false;
    // Donde la lámina nativa no dibuja la segunda columna no se ofrece encenderla (`bottomDisponible`); quitarla sí.
    if (opcionesActivas(pedido).includes("bottom2box") && !bottomDisponible(graficador, args, presets, composicion).editable) return {};
    delete ov.barra_extra;
    if (!mismaBarraExtra(pedido, h.valor)) ov.barra_extra = pedido === false ? false : [...pedido];
    // Un `barra_extra` suelto en los args de la lámina (planes migrados) lo taparían los overrides: se retira.
    return "barra_extra" in args ? { barra_extra: null, overrides: cerrar(ov) } : { overrides: cerrar(ov) };
  }

  if (forma === "por_bloque") return {};   // las categorías son de cada bloque

  if (cambio.caja === "bottom") {
    apartar(ov, "bottom2box_labels", [...cambio.etiquetas], h.bottomEtiquetas);
    return { overrides: cerrar(ov) };
  }
  if (forma === "apiladas") {
    apartar(ov, "top2box_labels", [...cambio.etiquetas], h.top);
    return { overrides: cerrar(ov) };
  }
  // Multiapiladas: las categorías del Top Two Box son del plan.
  const propias = mismaLista(cambio.etiquetas, h.top) ? [] : [...cambio.etiquetas];
  return { top2box_labels: propias.length ? propias : null, overrides: cerrar(ov) };
}

export type BottomDisponible = { ofrecer: boolean; editable: boolean; activa: boolean; nota?: string };

/** Cómo compone la lámina al gráfico: solo, o junto a otros (mixtas y paneles: láminas de 2 o más gráficos). */
export type Composicion = "sola" | "varios";

/** Láminas de varios gráficos: las de 2 a 6 ranuras y la de cifras con gráficos (`SlideType`, api/graficos.ts). */
export function composicionDeLamina(tipo: string | undefined): Composicion {
  return tipo && (/^p_slide_[2-9]_graficos/.test(tipo) || tipo === "p_slide_cifras_y_graficos") ? "varios" : "sola";
}

export const NOTA_BOTTOM_NO_NATIVO = "En esta composición el Bottom Two Box todavía no sale en la lámina.";

/**
 * ¿La lámina nativa dibuja la Bottom Two Box de este gráfico? Barras apiladas, siempre (como hasta ahora); la
 * multiapilada (var, cruce, var_cruce) sola en su lámina, sí. La multilista y las láminas de varios gráficos no:
 * `.lam_escala_en_filas` las saca de la ruta nativa (lamina_multilista.R, lamina_mixtas.R, lamina_compositor.R).
 */
function bottomNativo(forma: FormaTwoBox, args: Readonly<Registro>, composicion: Composicion): boolean {
  // Paneles y mixtas mandan a la ruta anterior toda escala con Bottom Two Box (`.lam_escala_en_filas`,
  // lamina_compositor.R / lamina_mixtas.R): tampoco una apilada la dibuja nativa en una lámina de varios gráficos.
  if (composicion !== "sola") return false;
  if (forma === "apiladas") return true;
  return !(forma === "por_bloque" || args.modo === "multilista");
}

/**
 * Si se puede elegir «Bottom Two Box». Donde la lámina nativa no la dibuja no se ofrece encenderla, pero si el
 * gráfico ya la tiene (o la pide el estilo del informe) se muestra y se deja quitar y volver a poner.
 */
export function bottomDisponible(
  graficador: string,
  args: Readonly<Registro>,
  presets: Presets,
  composicion: Composicion = "sola",
): BottomDisponible {
  const forma = formaTwoBox(graficador, args);
  const estado = leerTwoBox(graficador, args, presets);
  if (!forma || !estado) return { ofrecer: false, editable: false, activa: false };
  const activa = estado.bottom.activa;
  if (bottomNativo(forma, args, composicion)) return { ofrecer: true, editable: true, activa };
  // Encender sólo se deja si es volver a lo que el estilo del informe ya pide (borrar el apagado del gráfico).
  const heredaBottom = opcionesActivas(heredado(presetHeredado(forma, args, presets), forma).valor).includes("bottom2box");
  return { ofrecer: true, editable: activa || heredaBottom, activa, nota: NOTA_BOTTOM_NO_NATIVO };
}

/** Pregunta de la que salen las categorías de la escala (la primera de la multiapilada). */
export function preguntaDeEscala(graficador: string, args: Readonly<Registro>): string {
  const forma = formaTwoBox(graficador, args);
  if (!forma || forma === "por_bloque") return "";
  const texto = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
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
