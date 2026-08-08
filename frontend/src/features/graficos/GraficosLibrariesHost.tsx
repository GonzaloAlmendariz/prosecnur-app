import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { GraficadorMetadata, GraficadorRef } from "../../api/client";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import GraficadorPicker from "./GraficadorPicker";
import {
  PANEL_BIBLIOTECA_GRAFICADORES,
  PANEL_BIBLIOTECA_SLIDES,
} from "./panelesGraficos";
import { SLIDE_GRAF_SLOTS, usePlanStore } from "./store";
import { SlidePicker } from "./v2/timeline/SlidePicker";

export type GraficadorLibraryTarget = {
  slideId: string;
  slotName: string;
  slotLabel: string;
  returnFocusRef: RefObject<HTMLButtonElement>;
};

type GraficosLibrariesContextValue = {
  openSlidesLibrary: () => void;
  slidesReturnFocusRef: RefObject<HTMLButtonElement>;
  openGraficadoresLibrary: (target: GraficadorLibraryTarget) => void;
};

const GraficosLibrariesContext = createContext<GraficosLibrariesContextValue | null>(null);

export function useGraficosLibraries(): GraficosLibrariesContextValue {
  const context = useContext(GraficosLibrariesContext);
  if (!context) {
    throw new Error("useGraficosLibraries debe usarse dentro de GraficosLibrariesHost");
  }
  return context;
}

export function compatibleGraficadorRef(
  meta: GraficadorMetadata,
  previous: GraficadorRef | null,
): GraficadorRef {
  const args: Record<string, unknown> = {};
  const previousArgs = previous?.args ?? {};
  for (const arg of meta.args) {
    if (previousArgs[arg.name] !== undefined) {
      args[arg.name] = previousArgs[arg.name];
    }
  }
  return { graficador: meta.name, args };
}

export function GraficosLibrariesHost({ children }: { children: ReactNode }) {
  const slidesPanel = usePanelDireccionable(PANEL_BIBLIOTECA_SLIDES);
  const graficadoresPanel = usePanelDireccionable(PANEL_BIBLIOTECA_GRAFICADORES);
  const [graficadorTarget, setGraficadorTarget] = useState<GraficadorLibraryTarget | null>(null);
  const slidesReturnFocusRef = useRef<HTMLButtonElement>(null);
  const hostFocusAnchorRef = useRef<HTMLSpanElement>(null);

  const openGraficadoresLibrary = useCallback((target: GraficadorLibraryTarget) => {
    setGraficadorTarget(target);
    graficadoresPanel.abrir();
  }, [graficadoresPanel.abrir]);

  const closeGraficadoresLibrary = useCallback(() => {
    setGraficadorTarget(null);
    graficadoresPanel.cerrar();
  }, [graficadoresPanel.cerrar]);

  useEffect(() => {
    if (!graficadoresPanel.abierto) setGraficadorTarget(null);
  }, [graficadoresPanel.abierto]);

  const commitGraficador = useCallback((meta: GraficadorMetadata) => {
    const target = graficadorTarget;
    if (!target) return;

    const state = usePlanStore.getState();
    const slide = state.plan.slides.find((item) => item.id === target.slideId);
    const validSlot = slide
      ? SLIDE_GRAF_SLOTS[slide.tipo].includes(target.slotName)
      : false;
    if (!slide || !validSlot) {
      closeGraficadoresLibrary();
      return;
    }

    const previous = slide.payload[target.slotName] as GraficadorRef | undefined;
    state.setSlot(
      target.slideId,
      target.slotName,
      compatibleGraficadorRef(meta, previous ?? null),
    );
    closeGraficadoresLibrary();
  }, [closeGraficadoresLibrary, graficadorTarget]);

  const context = useMemo<GraficosLibrariesContextValue>(() => ({
    openSlidesLibrary: slidesPanel.abrir,
    slidesReturnFocusRef,
    openGraficadoresLibrary,
  }), [openGraficadoresLibrary, slidesPanel.abrir]);

  return (
    <GraficosLibrariesContext.Provider value={context}>
      {children}
      <span
        ref={hostFocusAnchorRef}
        className="pulso-sr-only"
        tabIndex={-1}
      >
        Editor de gráficos
      </span>
      <SlidePicker
        open={slidesPanel.abierto}
        onClose={slidesPanel.cerrar}
        panel={slidesPanel}
        returnFocusRef={slidesReturnFocusRef}
        fallbackFocusRef={hostFocusAnchorRef}
      />
      <GraficadorPicker
        open={graficadoresPanel.abierto}
        onPick={graficadorTarget ? commitGraficador : undefined}
        onCancel={closeGraficadoresLibrary}
        panel={graficadoresPanel}
        returnFocusRef={graficadorTarget?.returnFocusRef}
        fallbackFocusRef={hostFocusAnchorRef}
      />
    </GraficosLibrariesContext.Provider>
  );
}
