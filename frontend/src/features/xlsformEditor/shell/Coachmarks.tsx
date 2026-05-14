// =============================================================================
// shell/Coachmarks.tsx — tooltips contextuales de primer uso
// =============================================================================
// Aparecen la primera vez que el usuario abre el editor con un workbook
// que tiene contenido editable. Tres pasos secuenciales (no todos a la
// vez) que enseñan los gestos clave del editor:
//
//   1. "Hacé clic en cualquier card para editarla aquí mismo."
//   2. "Los botones + entre tarjetas agregan preguntas o secciones."
//   3. "Acá a la derecha configurás detalles avanzados."
//
// Controlado por `localStorage.pulso.xlsformEditor.firstUseDone`. Tras
// cerrar el último coachmark, el flag se setea y no vuelven a aparecer.
// =============================================================================

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const FIRST_USE_FLAG = "pulso.xlsformEditor.firstUseDone";

type CoachStep = {
  selector: string;
  /** Anclaje relativo al elemento target (cómo posicionar el callout). */
  placement: "top" | "bottom" | "left" | "right";
  title: string;
  body: string;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

const STEPS: CoachStep[] = [
  {
    selector: ".pulso-canvas-card.is-selected, .pulso-canvas-card",
    placement: "top",
    title: "Edición en el lienzo",
    body: "Haz clic en el texto, la pista o las opciones de cada tarjeta para modificarlas. No hace falta abrir un panel.",
  },
  {
    // Apuntamos al botón "+ Agregar elemento" del final del lienzo
    // (variant trailing = siempre visible). Los `+` entre tarjetas
    // existen pero solo aparecen en hover — apuntar a uno de ellos
    // dejaría al spotlight sobre un elemento de opacity:0.
    selector: ".pulso-canvas-addbetween-trailing .pulso-canvas-addbetween-trigger",
    placement: "top",
    title: "Agregar preguntas y secciones",
    body: "Este botón inserta una pregunta, sección o nota al final. Entre tarjetas aparecen botones + cuando pasas el cursor para insertar en posiciones intermedias.",
  },
  {
    selector: ".pulso-context-panel",
    placement: "left",
    title: "Detalles de la pregunta",
    body: "Tipo, lógica condicional, validación y catálogo. Cada sección se expande al hacer clic en su título.",
  },
];

export type CoachmarksProps = {
  /** Si true, fuerza el tour aunque el flag esté seteado (útil para
   *  un futuro botón "ver tour de nuevo"). */
  forceShow?: boolean;
  /** Llamado cuando el usuario completa o salta el tour. */
  onDone?: () => void;
};

export function Coachmarks({ forceShow, onDone }: CoachmarksProps) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Decidir si arrancar el tour. Solo si flag NO seteado (o forzado).
  useEffect(() => {
    if (forceShow) {
      setActive(true);
      setStepIndex(0);
      return;
    }
    try {
      const done = localStorage.getItem(FIRST_USE_FLAG) === "true";
      if (!done) setActive(true);
    } catch {
      // localStorage puede fallar en contextos restringidos — no es crítico.
    }
  }, [forceShow]);

  // Buscar el elemento target del paso actual y obtener sus coordenadas.
  // useLayoutEffect evita que al cambiar de paso se pinte un frame con el
  // texto nuevo pero el foco del paso anterior.
  useLayoutEffect(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    if (!step) return;
    function compute() {
      const el = document.querySelector(step.selector);
      if (!el) {
        setTargetRect(null);
        return;
      }
      setTargetRect(el.getBoundingClientRect());
    }
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    const interval = setInterval(compute, 800);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
      clearInterval(interval);
    };
  }, [active, stepIndex]);

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    setActive(false);
    try {
      localStorage.setItem(FIRST_USE_FLAG, "true");
    } catch {
      // ignored
    }
    onDone?.();
  };

  if (!active || !targetRect) return null;

  const step = STEPS[stepIndex]!;
  const spotlightRect = computeSpotlightRect(targetRect);
  const calloutPos = computeCalloutPos(spotlightRect, step.placement);

  return createPortal(
    <div className="pulso-coachmarks-overlay" role="dialog" aria-label={step.title}>
      {/* Halo alrededor del target. El overlay no pinta fondo global:
          la sombra del spotlight crea el dimmer y deja el target limpio. */}
      <div
        className="pulso-coachmarks-spotlight"
        style={{
          top: spotlightRect.top,
          left: spotlightRect.left,
          width: spotlightRect.width,
          height: spotlightRect.height,
        }}
      />
      {/* Callout */}
      <div
        className="pulso-coachmarks-callout"
        style={{ top: calloutPos.top, left: calloutPos.left }}
      >
        <header className="pulso-coachmarks-callout-header">
          <span>
            Paso {stepIndex + 1} de {STEPS.length}
          </span>
        </header>
        <h4 className="pulso-coachmarks-callout-title">{step.title}</h4>
        <p className="pulso-coachmarks-callout-body">{step.body}</p>
        <div className="pulso-coachmarks-callout-actions">
          <button
            type="button"
            className="pulso-coachmarks-skip"
            onClick={finish}
          >
            Saltar tour
          </button>
          <button
            type="button"
            className="pulso-coachmarks-next"
            onClick={handleNext}
          >
            {stepIndex < STEPS.length - 1 ? "Siguiente" : "Entendido"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** El target puede ser una tarjeta muy alta. El coachmark no debe crear
 * una ventana gigante: resalta una porción visible y representativa. */
function computeSpotlightRect(rect: DOMRect): SpotlightRect {
  const margin = 18;
  const pad = 8;
  const maxW = Math.min(760, window.innerWidth - margin * 2);
  const maxH = Math.min(420, window.innerHeight - margin * 2);
  const width = Math.max(120, Math.min(rect.width + pad * 2, maxW));
  const height = Math.max(72, Math.min(rect.height + pad * 2, maxH));
  const centerX = rect.left + rect.width / 2;
  const left = Math.max(margin, Math.min(centerX - width / 2, window.innerWidth - width - margin));
  const top = Math.max(margin, Math.min(rect.top - pad, window.innerHeight - height - margin));

  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

/** Calcula posición del callout relativa al target rect. Garantiza que
 *  no se salga del viewport. */
function computeCalloutPos(
  rect: SpotlightRect,
  placement: CoachStep["placement"],
): { top: number; left: number } {
  const calloutW = Math.min(360, window.innerWidth - 24);
  const calloutH = 204;
  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;
  if (placement === "right") {
    top = rect.top + rect.height / 2 - calloutH / 2;
    left = rect.right + gap;
  } else if (placement === "left") {
    top = rect.top + rect.height / 2 - calloutH / 2;
    left = rect.left - calloutW - gap;
  } else if (placement === "bottom") {
    top = rect.bottom + gap;
    left = rect.left + rect.width / 2 - calloutW / 2;
  } else {
    // top
    top = rect.top - calloutH - gap;
    left = rect.left + rect.width / 2 - calloutW / 2;
  }

  // Clamp al viewport.
  top = Math.max(12, Math.min(top, vh - calloutH - 12));
  left = Math.max(12, Math.min(left, vw - calloutW - 12));
  return { top, left };
}
