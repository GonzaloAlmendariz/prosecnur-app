// Atajos con modificador de la pestaña Láminas (auditoría de Arte, hallazgos 12 y 13). Existían ⌘1 y ⌘. sin que nada los
// mostrara; ahora cada botón los dice en su globo con `<kbd>` (BotonConTecla) y se suman ⌘K (abrir «¿Qué quieres contar?»
// para insertar) y ⌘↵ («Siguiente sin título»). En Windows, Ctrl en lugar de ⌘ (lib/teclado.ts).
//
// Se escuchan en `document` (burbuja): corre antes que los listeners de `window`, así que la paleta de comandos de la app
// (⌘K) y el salto a un módulo (⌘1) ven `defaultPrevented` y ceden dentro de Láminas.

import { useEffect, useRef } from "react";
import { conModificador, esMac, nombreDeAtajo } from "../../../lib/teclado";

export type AccionVisor = "estructura" | "ajustes" | "insertar" | "siguienteSinTitulo";

/** La tecla de cada acción (con el modificador del sistema) y el nombre con que la dicen el globo y la ayuda. */
export const ATAJOS_VISOR: Readonly<Record<AccionVisor, { tecla: string; nombre: string }>> = {
  estructura: { tecla: "1", nombre: "Estructura" },
  ajustes: { tecla: ".", nombre: "Ajustes" },
  insertar: { tecla: "K", nombre: "Insertar una lámina" },
  siguienteSinTitulo: { tecla: "↵", nombre: "Siguiente sin título" },
};

/** «⌘1» en macOS, «Ctrl+1» en Windows. */
export function teclaDeAccion(accion: AccionVisor, mac: boolean = esMac()): string {
  return nombreDeAtajo(ATAJOS_VISOR[accion].tecla, mac);
}

/** El valor de `aria-keyshortcuts` («Meta+1» / «Control+1»). */
export function ariaDeAccion(accion: AccionVisor, mac: boolean = esMac()): string {
  const t = ATAJOS_VISOR[accion].tecla;
  return `${mac ? "Meta" : "Control"}+${t === "↵" ? "Enter" : t}`;
}

export type TeclaVisor = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean };

export function accionDeTecla(e: TeclaVisor, mac: boolean = esMac()): AccionVisor | null {
  if (!conModificador(e, mac) || e.altKey || e.shiftKey) return null;
  if (e.key === "1") return "estructura";
  if (e.key === ".") return "ajustes";
  if (e.key === "k" || e.key === "K") return "insertar";
  if (e.key === "Enter") return "siguienteSinTitulo";
  return null;
}

export type AccionesVisor = Record<AccionVisor, () => void> & {
  /** Con `false` (un selector o diálogo encima) las teclas no actúan ni se consumen. */
  activo: boolean;
};

/** Atiende un `keydown`; devuelve si lo consumió. */
export function atenderAtajoVisor(
  e: TeclaVisor & { defaultPrevented: boolean; preventDefault: () => void },
  a: AccionesVisor,
  mac: boolean = esMac(),
): boolean {
  if (!a.activo || e.defaultPrevented) return false;
  const accion = accionDeTecla(e, mac);
  if (!accion) return false;
  e.preventDefault();
  a[accion]();
  return true;
}

/** Monta los atajos mientras viva el componente; lee siempre las acciones vigentes. */
export function useAtajosVisor(acciones: AccionesVisor): void {
  const vigente = useRef(acciones);
  vigente.current = acciones;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { atenderAtajoVisor(e, vigente.current); };
    document.addEventListener("keydown", fn, false);
    return () => document.removeEventListener("keydown", fn, false);
  }, []);
}
