// La miniatura real del selector de láminas (`panel=tipo-lamina`): cómo queda la tarjeta enfocada, o las dos de
// «Comparar», con los datos del estudio. Sólo esas: la galería conserva su glifo, porque pedir una lámina por tarjeta
// saturaría el motor. Se dibuja la lámina que la tarjeta insertaría (payload por defecto del tipo con el gráfico de la
// tarjeta, su regla y los `vars` de las bases del estudio). No se pide si el estudio no alcanza para el gráfico (las
// faltas de la ficha «Datos»): una lámina vacía no es la propuesta. Mismo patrón que el mazo
// (mazoResumen/modeloMiniaturasMazo.ts): ids estables, un lote del selector a la vez y siempre `reemplazar = false`.
// Pura: el hook la orquesta y los tests la prueban sola.

import type { Slide } from "../../../../api/graficos";
import { clavePreview } from "../../previewLaminaCoordinador";
import { payloadPorDefecto } from "../../store";
import type { EntradaMiniatura, LaminaClave } from "../miniaturas/loteMiniaturas";
import { cruzarConEstudio, usaDeTarjeta, type EstadoInventario } from "./fichaDatos";
import { conOpcion, presetDe, tipoDeOpcion, type EstudioDelSelector, type OpcionLamina } from "./opcionesLamina";

export type LaminaDelSelector = LaminaClave & { opcion: OpcionLamina; slide: Slide };

/** Lo que pinta el hueco: la imagen si llegó; el error va al `title` del hueco, que sigue con el glifo. */
export type MiniaturaSelector = { src: string | null; error: string | null };

/** Id estable por tarjeta («p_slide_un_grafico:brecha» → «selector-p_slide_un_grafico-brecha»). */
export function idMiniaturaSelector(op: OpcionLamina): string {
  return `selector-${op.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

/** Las tarjetas a la vista que piden: las dos de «Comparar» o, fuera de ella, sólo la enfocada. Nunca la galería. */
export function opcionesQuePiden(
  candidato: OpcionLamina | null, comparar: readonly OpcionLamina[], viendoComparacion: boolean,
): OpcionLamina[] {
  if (viendoComparacion) return [...comparar];
  return candidato ? [candidato] : [];
}

/**
 * ¿Se dibuja esta tarjeta? Sólo con gráfico de partida (sin él, la lámina saldría vacía) y con el estudio leído y
 * suficiente para ese gráfico. Mientras se lee el estudio, o si no se pudo leer, no: queda el glifo.
 */
export function puedePedir(op: OpcionLamina, inventario: EstadoInventario): boolean {
  if (!presetDe(op)?.grafico) return false;
  const usa = usaDeTarjeta(presetDe(op));
  if (!usa || inventario.estado !== "listo") return false;
  return cruzarConEstudio(usa, inventario.publicos).alcanza;
}

/** La lámina que la tarjeta insertaría, con un id estable. */
export function laminaDeOpcion(op: OpcionLamina, estudio: EstudioDelSelector): Slide {
  const tipo = tipoDeOpcion(op);
  return { id: idMiniaturaSelector(op), tipo, payload: conOpcion(op, payloadPorDefecto(tipo), estudio) };
}

/** Las láminas a pedir, con su clave (lámina + estilo global + alcance, como la tira y el mazo). */
export function laminasDelSelector(
  opciones: readonly OpcionLamina[], inventario: EstadoInventario, estudio: EstudioDelSelector, global: string,
): LaminaDelSelector[] {
  return [...new Set(opciones)].filter((op) => puedePedir(op, inventario)).map((op) => {
    const slide = laminaDeOpcion(op, estudio);
    return { id: slide.id, opcion: op, slide, clave: `${global}|${clavePreview(slide)}` };
  });
}

/** El hueco de una tarjeta: imagen de su clave vigente (o la anterior mientras se rehace) o, con error, la nota. */
export function miniaturaDeEntrada(e: EntradaMiniatura | undefined): MiniaturaSelector {
  if (!e) return { src: null, error: null };
  if (e.estado === "error") return { src: null, error: e.error ?? "No se pudo dibujar la vista previa." };
  return { src: e.src ?? e.anterior ?? null, error: null };
}

/**
 * Qué pedir. Con un lote del selector corriendo, nada: la tarjeta a la que se pasó espera a que termine (un solo lote
 * en vuelo). Sin lote: las que no tienen entrada, las que cambiaron de clave y las pendientes huérfanas. null = nada.
 * Las que ya fallaron con su clave no se repiten solas.
 */
export function planSelector(laminas: readonly LaminaClave[], entradas: Readonly<Record<string, EntradaMiniatura>>, lotesCorriendo: number): LaminaClave[] | null {
  if (lotesCorriendo > 0) return null;
  const pedir = laminas.filter((l) => {
    const e = entradas[l.id];
    return !e || e.clave !== l.clave || e.estado === "pendiente";
  });
  return pedir.length ? pedir : null;
}
