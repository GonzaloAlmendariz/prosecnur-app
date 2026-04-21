import { useEffect } from "react";
import { usePlanStore } from "./store";

// Captura Cmd/Ctrl+Z y Cmd/Ctrl+Shift+Z (+ Ctrl+Y) y llama undo/redo
// del store de Gráficos. Se monta desde `GraficosPage` — solo funciona
// en esa ruta para no pisar atajos globales de otras páginas.
//
// Ignora el evento si el foco está dentro de un input/textarea/contenteditable:
// ahí el undo nativo del browser es lo esperado (deshacer texto tipeado).

export function useUndoRedoShortcuts() {
  const undo = usePlanStore((s) => s.undo);
  const redo = usePlanStore((s) => s.redo);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && isEditable(target)) return;

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd/Ctrl+Z → undo.  Cmd/Ctrl+Shift+Z → redo.  Ctrl+Y → redo.
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
}

function isEditable(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}
