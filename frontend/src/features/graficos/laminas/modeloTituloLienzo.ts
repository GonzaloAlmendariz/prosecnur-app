// Título de la lámina editado sobre el lienzo (auditoría de Arte, hallazgo 12): un clic en el título de la maqueta o de
// la vista previa lo vuelve un campo en el mismo lugar; Enter guarda, Escape cancela. «Siguiente sin título» (⌘↵ / Ctrl+↵)
// lleva a la próxima lámina sin título escrito y abre ahí el campo.
//
// No se proponen títulos: el campo nace con lo ESCRITO (vacío si no hay), con el marcador «Título», nunca con la pregunta
// del gráfico que el motor usaría de respaldo.

import { useCallback } from "react";
import { create } from "zustand";
import type { Slide } from "../../../api/graficos";
import { usePlanStore } from "../store";

/** El título escrito en el payload, tal cual (con su «(cont.)» si lo trae); "" sin título. Acepta `{ text }`. */
export function tituloEscrito(payload: Slide["payload"] | null | undefined): string {
  const t: unknown = payload?.titulo;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && !Array.isArray(t)) {
    const texto = (t as Record<string, unknown>).text;
    return typeof texto === "string" ? texto : "";
  }
  return "";
}

/** El parche del payload que deja `texto` como título; un título con forma `{ text, … }` conserva lo demás. */
export function parcheTitulo(payload: Slide["payload"] | null | undefined, texto: string): Record<string, unknown> {
  const t: unknown = payload?.titulo;
  const limpio = texto.trim();
  if (t && typeof t === "object" && !Array.isArray(t)) return { titulo: { ...(t as Record<string, unknown>), text: limpio } };
  return { titulo: limpio };
}

/**
 * La posición (1-based) de la próxima lámina sin título escrito después de `desde`, dando la vuelta; `null` si no queda
 * ninguna. Sólo cuentan las que tienen título editable (`conTitulo`): una portada sin cabecera no es «sin título».
 */
export function siguienteSinTitulo(slides: readonly Slide[], desde: number | null, conTitulo: (s: Slide) => boolean): number | null {
  const n = slides.length;
  if (!n) return null;
  const inicio = desde ?? 0;
  for (let paso = 1; paso <= n; paso++) {
    const i = (inicio - 1 + paso + n) % n;
    const s = slides[i]!;
    if (conTitulo(s) && !tituloEscrito(s.payload).trim()) return i + 1;
  }
  return null;
}

/** Cuántas láminas con título editable no lo tienen escrito. */
export function cuantasSinTitulo(slides: readonly Slide[], conTitulo: (s: Slide) => boolean): number {
  return slides.filter((s) => conTitulo(s) && !tituloEscrito(s.payload).trim()).length;
}

type TituloLienzoUi = {
  /** La lámina cuyo título se está editando sobre el lienzo; `null` ninguna. */
  editando: string | null;
  abrir: (slideId: string) => void;
  cerrar: () => void;
};

export const useTituloLienzo = create<TituloLienzoUi>((set) => ({
  editando: null,
  abrir: (editando) => set({ editando }),
  cerrar: () => set({ editando: null }),
}));

export type ControlTituloLienzo = {
  valor: string;
  editando: boolean;
  onEditar: () => void;
  onGuardar: (texto: string) => void;
  onCancelar: () => void;
};

/** Lo que el campo del lienzo necesita para la lámina: lo escrito, si está abierto y cómo guardar o cancelar. */
export function useTituloEnLienzo(slide: Slide): ControlTituloLienzo {
  const editando = useTituloLienzo((s) => s.editando === slide.id);
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const id = slide.id;
  const payload = slide.payload;
  const valor = tituloEscrito(payload);
  const onEditar = useCallback(() => useTituloLienzo.getState().abrir(id), [id]);
  const onCancelar = useCallback(() => useTituloLienzo.getState().cerrar(), []);
  const onGuardar = useCallback((texto: string) => {
    useTituloLienzo.getState().cerrar();
    // Sin cambio no se edita el plan: no ensucia el proyecto ni pide otra vista previa.
    if (texto.trim() === valor.trim()) return;
    updatePayload(id, parcheTitulo(payload, texto));
  }, [id, payload, updatePayload, valor]);
  return { valor, editando, onEditar, onGuardar, onCancelar };
}
