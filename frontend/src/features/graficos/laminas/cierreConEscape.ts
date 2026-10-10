// Un panel no modal de Láminas (Avisos) se cierra con Escape aunque el foco no esté dentro: abrirlo no le pasa el foco,
// así que escuchar sólo en su raíz lo dejaba sordo (D5). Al cerrar, el foco vuelve a quien lo abrió o a un respaldo.

type ObjetivoTeclado = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type Enfocable = { focus: () => void; isConnected?: boolean };

/**
 * Escucha Escape en `documento` mientras el panel vive. Un Escape cierra sólo la capa superior: no cierra si otra capa
 * ya lo atendió (defaultPrevented) ni si hay una capa abierta por encima (`hayCapaEncima`, p. ej. el popover de
 * Cobertura), que se cierra con su propio Escape.
 */
export function escucharEscape(documento: ObjetivoTeclado, cerrar: () => void, hayCapaEncima: () => boolean = () => false): () => void {
  const onKey = (e: Event) => {
    if ((e as KeyboardEvent).key !== "Escape" || e.defaultPrevented || hayCapaEncima()) return;
    e.preventDefault();
    cerrar();
  };
  documento.addEventListener("keydown", onKey);
  return () => documento.removeEventListener("keydown", onKey);
}

/** A quién vuelve el foco: al disparador si sigue en el documento; si no, al respaldo. */
export function destinoDelFoco(disparador: Enfocable | null, respaldo: Enfocable | null): Enfocable | null {
  if (disparador && disparador.isConnected !== false) return disparador;
  return respaldo;
}

const CAPAS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** Hay otra capa visible (diálogo, menú, lista) fuera de `propio`: esa está encima y el Escape es suyo. */
export function capaVisibleFuera(documento: Pick<Document, "querySelectorAll">, propio: Element | null): boolean {
  for (const el of documento.querySelectorAll(CAPAS)) {
    if (propio && (propio.contains(el) || el.contains(propio))) continue;
    if (typeof el.checkVisibility === "function" ? el.checkVisibility({ visibilityProperty: true, opacityProperty: false }) : el.getClientRects().length > 0) return true;
  }
  return false;
}
