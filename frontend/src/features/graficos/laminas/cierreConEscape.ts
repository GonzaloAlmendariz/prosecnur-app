// Un panel no modal de Láminas (Avisos) se cierra con Escape aunque el foco no esté dentro: abrirlo no le pasa el foco,
// así que escuchar sólo en su raíz lo dejaba sordo (D5). Al cerrar, el foco vuelve a quien lo abrió o a un respaldo.

type ObjetivoTeclado = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type Enfocable = { focus: () => void; isConnected?: boolean };

/** Escucha Escape en `documento` mientras el panel vive; un Escape ya atendido (defaultPrevented) no cierra. */
export function escucharEscape(documento: ObjetivoTeclado, cerrar: () => void): () => void {
  const onKey = (e: Event) => {
    if ((e as KeyboardEvent).key !== "Escape" || e.defaultPrevented) return;
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
