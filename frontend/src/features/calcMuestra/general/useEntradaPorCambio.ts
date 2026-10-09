import { useState } from "react";

/**
 * Fase de la entrada de un bloque que NO se re-monta al cambiar lo que
 * muestra (el cuerpo de una pestaña de la mesa).
 *
 * Aulas anima la pestaña re-montándola; aquí re-montar el cuerpo tiraría el
 * estado local de sus hijos (el formulario del sorteo, el catálogo de
 * parámetros ya leído). En su lugar el CSS alterna entre dos keyframes
 * idénticos con nombre distinto: cambiar `animation-name` reinicia la
 * animación sin tocar el árbol. `montaje` es la primera pintura; cada cambio
 * de clave alterna `a`/`b`. Un re-render con la misma clave no cambia la fase,
 * así que nada se anima por render.
 */
export type FaseEntrada = "montaje" | "a" | "b";

export type EstadoEntrada = { clave: string; fase: FaseEntrada };

/** Transición pura: misma clave, mismo estado (misma referencia). */
export function siguienteEntrada(actual: EstadoEntrada, clave: string): EstadoEntrada {
  if (actual.clave === clave) return actual;
  return { clave, fase: actual.fase === "b" ? "a" : "b" };
}

export function useEntradaPorCambio(clave: string): FaseEntrada {
  const [estado, setEstado] = useState<EstadoEntrada>(() => ({ clave, fase: "montaje" }));
  const siguiente = siguienteEntrada(estado, clave);
  // Estado derivado de una prop (patrón documentado de React): se ajusta
  // durante el render, sin efecto ni pintura intermedia.
  if (siguiente !== estado) setEstado(siguiente);
  return siguiente.fase;
}
