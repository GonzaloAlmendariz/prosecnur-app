import { useEffect } from "react";
import { usePlanStore } from "./store";

// Atajos de teclado globales para la página de Gráficos. Se monta desde
// `GraficosPage` para que no pisen atajos de otras rutas.
//
// Listado:
//   - Cmd/Ctrl+Z         → undo
//   - Cmd/Ctrl+Shift+Z   → redo
//   - Ctrl+Y             → redo (Windows-style)
//   - Cmd/Ctrl+D         → duplicar slide activo
//   - ? (Shift+/)        → abrir modal de ayuda
//
// Ignora el evento si el foco está dentro de input/textarea/select/
// contenteditable — el usuario está tipeando texto y espera el comportamiento
// nativo (Cmd+Z deshace el último carácter, etc.).
//
// Atajos destructivos (Delete/Backspace del slide activo, etc.) NO se
// incluyen a propósito: son muy fáciles de disparar sin querer. El
// analista usa los botones del timeline.

export function useGraficosShortcuts({
  onOpenHelp,
}: {
  onOpenHelp: () => void;
}) {
  const undo = usePlanStore((s) => s.undo);
  const redo = usePlanStore((s) => s.redo);
  const duplicateSlide = usePlanStore((s) => s.duplicateSlide);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && isEditable(target)) return;

      const mod = e.metaKey || e.ctrlKey;

      // `?` — modal de ayuda (no requiere mod key)
      if (e.key === "?" && !mod) {
        e.preventDefault();
        onOpenHelp();
        return;
      }

      if (!mod) return;

      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      } else if (e.key === "d" || e.key === "D") {
        // Duplicar slide activo. Si no hay slide seleccionado, no-op
        // (el browser a veces usa Cmd+D para bookmark — si no hay slide
        // seleccionado dejamos que el browser haga lo suyo).
        if (!selectedSlideId) return;
        e.preventDefault();
        duplicateSlide(selectedSlideId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, duplicateSlide, selectedSlideId, onOpenHelp]);
}

function isEditable(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}
