// Atajos de teclado de la pestaña Láminas (C21 del retiro del Editor anterior): los que la barra de acciones anuncia
// (AccionesLamina) y que hasta ahora sólo daba `v2/shortcuts/useShortcutsV2.ts`, montado en GraficosPage para TODAS
// las pestañas.
//   J / K        lámina siguiente / anterior
//   Alt+↑ / ↓    mueve la lámina activa un lugar antes / después
//   /            enfoca la búsqueda de la Estructura (si la Estructura está oculta, la abre primero)
//
// Una sola vez por tecla. `useShortcutsV2` sigue escuchando en `window` (fase de burbuja) mientras exista el Editor
// anterior. Este hook escucha en `document`, también en burbuja: el recorrido de un `keydown` es
// destino → … → raíz de React → body → html → document → window, así que corre DESPUÉS de los manejadores de React y
// ANTES que los de `window`. Cuando reconoce una de sus teclas la consume con `stopPropagation()` y el listener de
// `window` no llega a verla. Por qué no en captura: en captura correría antes que la fila «Orden» de un gráfico y que el
// índice, que ya detienen la propagación de Alt+↑/↓ para mover una categoría o un capítulo; en burbuja, si ellos la
// detuvieron, la tecla nunca llega a `document` y este hook no mueve la lámina.
//
// Las teclas se ignoran (sin consumirlas) mientras se escribe en un input, textarea, select o campo editable.

import { useEffect, useRef } from "react";

/** Id del buscador de la Estructura: lo pone EstructuraInforme y lo enfoca «/». */
export const ID_BUSQUEDA_ESTRUCTURA = "pulso-f6-estructura-busqueda";

export type TeclaAtajo = { key: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };

export type IntencionAtajo =
  | { tipo: "navegar"; delta: 1 | -1 }
  | { tipo: "mover"; dir: "up" | "down" }
  | { tipo: "buscar" };

export function intencionAtajoLaminas(e: TeclaAtajo): IntencionAtajo | null {
  if (e.ctrlKey || e.metaKey) return null;
  if (e.altKey) {
    if (e.shiftKey) return null;
    if (e.key === "ArrowUp") return { tipo: "mover", dir: "up" };
    if (e.key === "ArrowDown") return { tipo: "mover", dir: "down" };
    return null;
  }
  if (e.key === "j" || e.key === "J") return { tipo: "navegar", delta: 1 };
  if (e.key === "k" || e.key === "K") return { tipo: "navegar", delta: -1 };
  // «/» llega con o sin Mayús según la distribución del teclado (en español es Mayús+7): se mira la tecla resultante.
  if (e.key === "/") return { tipo: "buscar" };
  return null;
}

/** Lo mínimo de un destino de evento para saber si es un campo donde se escribe (así se prueba sin DOM). */
type DestinoTecla = { tagName?: unknown; isContentEditable?: unknown };

export function esDestinoEditable(destino: unknown): boolean {
  if (!destino || typeof destino !== "object") return false;
  const d = destino as DestinoTecla;
  const tag = typeof d.tagName === "string" ? d.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || d.isContentEditable === true;
}

/** Posición (1-based) a la que lleva J/K; `null` si no hay adónde ir. Sin selección, J/K van a la primera. */
export function posicionDestino(posicion: number | null, total: number, delta: 1 | -1): number | null {
  if (total <= 0) return null;
  if (posicion === null) return 1;
  const destino = Math.min(total, Math.max(1, posicion + delta));
  return destino === posicion ? null : destino;
}

export type AccionesAtajos = {
  /** Con `false` (un selector abierto encima) las teclas se consumen sin actuar: nada se mueve detrás del diálogo. */
  activo: boolean;
  posicion: number | null;
  total: number;
  onIr: (posicion: number) => void;
  onMover: (dir: "up" | "down") => void;
  onBuscar: () => void;
};

export type EventoAtajo = TeclaAtajo & {
  target: unknown;
  defaultPrevented: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
};

/** Atiende un `keydown`. Devuelve si lo consumió (entonces ningún listener de `window` lo ve). */
export function atenderAtajoLaminas(e: EventoAtajo, a: AccionesAtajos): boolean {
  if (esDestinoEditable(e.target)) return false;
  const intencion = intencionAtajoLaminas(e);
  if (!intencion) return false;
  e.stopPropagation();
  // Otro manejador ya la usó sin detenerla (o hay un diálogo encima): se consume para que nadie más actúe, sin actuar.
  if (e.defaultPrevented || !a.activo) return true;
  e.preventDefault();
  switch (intencion.tipo) {
    case "navegar": {
      const destino = posicionDestino(a.posicion, a.total, intencion.delta);
      if (destino !== null) a.onIr(destino);
      return true;
    }
    case "mover": {
      if (a.posicion === null) return true;
      if (intencion.dir === "up" ? a.posicion > 1 : a.posicion < a.total) a.onMover(intencion.dir);
      return true;
    }
    case "buscar":
      a.onBuscar();
      return true;
  }
}

/** Dónde se instala el listener (ver la cabecera: `document` en burbuja). Exportado para fijarlo en el test. */
export const FASE_ATAJOS = { captura: false } as const;

type Escucha = {
  addEventListener: (tipo: "keydown", fn: (e: KeyboardEvent) => void, captura: boolean) => void;
  removeEventListener: (tipo: "keydown", fn: (e: KeyboardEvent) => void, captura: boolean) => void;
};

export function instalarAtajosLaminas(objetivo: Escucha, acciones: () => AccionesAtajos): () => void {
  const fn = (e: KeyboardEvent) => { atenderAtajoLaminas(e, acciones()); };
  objetivo.addEventListener("keydown", fn, FASE_ATAJOS.captura);
  return () => objetivo.removeEventListener("keydown", fn, FASE_ATAJOS.captura);
}

/** Enfoca el buscador de la Estructura y reintenta hasta que el foco quede de verdad en él: recién abierta, la
 *  Estructura puede no estar montada o seguir con `visibility:hidden`, y ahí `focus()` no surte efecto (QA qa-f6-4). */
export function enfocarBusquedaEstructura(intentos = 30): void {
  const input = document.getElementById(ID_BUSQUEDA_ESTRUCTURA);
  if (input instanceof HTMLInputElement) {
    input.focus();
    if (document.activeElement === input) { input.select(); return; }
  }
  if (intentos > 0) requestAnimationFrame(() => enfocarBusquedaEstructura(intentos - 1));
}

/** Monta los atajos de Láminas mientras viva el componente. Lee siempre las acciones vigentes (ref, sin re-suscribir). */
export function useAtajosLaminas(acciones: AccionesAtajos): void {
  const vigente = useRef(acciones);
  vigente.current = acciones;
  useEffect(() => instalarAtajosLaminas(document, () => vigente.current), []);
}
