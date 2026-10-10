// Movimiento reducido = sin desplazamientos, con fundidos y cambios de color (decisión de Gonzalo, 2026-10-10).
//
// La primera versión lo hacía en CSS reescribiendo `transition-property` de todo elemento con una lista fija. Eso
// desalinea por posición las listas de duración y retardo que cada regla declara: un panel con
// `transform 280ms, opacity 160ms` acababa fundiendo la opacidad en 280 ms (D6). En CSS no hay forma de quitar una
// propiedad de una lista ajena sin reescribirla, así que el filtro se hace aquí: cada transición que arranca sobre una
// propiedad que mueve algo se termina en el acto; las demás corren tal cual las declaró su regla.
// Las animaciones por keyframes siguen cortándose en `theme.css`.

/** Propiedades cuya transición no desplaza nada: se conservan con su duración, retardo y curva. */
const QUIETAS = /^(opacity|visibility|fill|stroke|box-shadow|filter|backdrop-filter|-webkit-backdrop-filter|.*-?color)$/;

export function transicionMueve(propiedad: string): boolean {
  return !QUIETAS.test(propiedad);
}

type Transicion = { transitionProperty: string; finish: () => void; effect: { target?: unknown; pseudoElement?: string | null } | null };

/** Termina las transiciones de `propiedad` sobre `objetivo` (y su pseudo-elemento, si lo hay). Devuelve cuántas. */
export function terminarTransiciones(animaciones: readonly Transicion[], objetivo: unknown, propiedad: string, pseudo: string): number {
  let n = 0;
  for (const a of animaciones) {
    if (a.transitionProperty !== propiedad || !a.effect || a.effect.target !== objetivo) continue;
    if ((a.effect.pseudoElement ?? "") !== pseudo) continue;
    a.finish();
    n += 1;
  }
  return n;
}

/** Instala el filtro en el documento. Sólo actúa mientras la preferencia esté activa (se re-evalúa en cada evento). */
export function instalarMovimientoReducido(win: Window = window): () => void {
  const consulta = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (!consulta || typeof CSSTransition === "undefined") return () => undefined;
  const onRun = (e: TransitionEvent) => {
    if (!consulta.matches || !transicionMueve(e.propertyName)) return;
    const el = e.target;
    if (!(el instanceof Element)) return;
    const propias = el.getAnimations({ subtree: true }).filter((a): a is CSSTransition => a instanceof CSSTransition);
    terminarTransiciones(
      propias.map((a) => ({
        transitionProperty: a.transitionProperty,
        finish: () => a.finish(),
        effect: a.effect instanceof KeyframeEffect ? { target: a.effect.target, pseudoElement: a.effect.pseudoElement } : null,
      })),
      el,
      e.propertyName,
      e.pseudoElement,
    );
  };
  win.document.addEventListener("transitionrun", onRun, true);
  return () => win.document.removeEventListener("transitionrun", onRun, true);
}
