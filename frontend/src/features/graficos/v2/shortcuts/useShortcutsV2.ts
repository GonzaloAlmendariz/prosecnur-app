import { useEffect } from "react";
import { usePlanStore } from "../../store";

// Atajos extendidos del editor V2. Se monta junto a (no en lugar de)
// useGraficosShortcuts: este hook agrega navegación entre slides (J/K),
// foco a búsqueda (/), cambio de modo (V/T), y tabs del inspector (1-4).
//
// Filtra eventos cuando el foco está dentro de input/textarea/select/
// contenteditable para no pisar la escritura.

export function useShortcutsV2() {
  const slides = usePlanStore((s) => s.plan.slides);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const select = usePlanStore((s) => s.select);
  const moveSlide = usePlanStore((s) => s.moveSlide);
  const viewMode = usePlanStore((s) => s.viewMode);
  const setViewMode = usePlanStore((s) => s.setViewMode);
  const setInspectorTab = usePlanStore((s) => s.setInspectorTab);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && isEditable(target)) return;

      // Alt+ArrowUp / Alt+ArrowDown → mover slide activo (sin importar el modo)
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        if (selectedSlideId) {
          e.preventDefault();
          moveSlide(selectedSlideId, e.key === "ArrowUp" ? "up" : "down");
        }
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod) return; // estos atajos son sin modificador

      // Navegación entre slides
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        navigateSlide(slides, selectedSlideId, +1, select);
        return;
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        navigateSlide(slides, selectedSlideId, -1, select);
        return;
      }

      // Foco a búsqueda del timeline
      if (e.key === "/") {
        const search = document.getElementById("pulso-gv2-timeline-search") as HTMLInputElement | null;
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }

      // Cambio de modo: V (canvas), T (timeline)
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        setViewMode("canvas");
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setViewMode("timeline");
        return;
      }

      // Tabs del inspector (solo aplica en modo timeline)
      if (viewMode === "timeline") {
        if (e.key === "1") { e.preventDefault(); setInspectorTab("content"); return; }
        if (e.key === "2") { e.preventDefault(); setInspectorTab("data"); return; }
        if (e.key === "3") { e.preventDefault(); setInspectorTab("style"); return; }
        if (e.key === "4") { e.preventDefault(); setInspectorTab("filters"); return; }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides, selectedSlideId, viewMode, select, moveSlide, setViewMode, setInspectorTab]);
}

function isEditable(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

function navigateSlide(
  slides: { id: string }[],
  selectedId: string | null,
  delta: 1 | -1,
  select: (id: string | null) => void,
) {
  if (slides.length === 0) return;
  const i = slides.findIndex((s) => s.id === selectedId);
  let next = i < 0 ? 0 : i + delta;
  if (next < 0) next = 0;
  if (next >= slides.length) next = slides.length - 1;
  const s = slides[next];
  if (s) select(s.id);
}
