import { create } from "zustand";
import type { GraficadorRef, PlanJson, Slide, SlideType } from "../../api/client";

type PlanStore = {
  plan: PlanJson;
  presets: Record<string, Record<string, unknown>>;
  wPresets: Record<string, Record<string, unknown>>;
  selectedSlideId: string | null;

  addSlide: (tipo: SlideType) => void;
  removeSlide: (id: string) => void;
  moveSlide: (id: string, direction: "up" | "down") => void;
  updateSlidePayload: (id: string, patch: Record<string, unknown>) => void;
  setSlot: (id: string, slot: string, graf: GraficadorRef | null) => void;
  updateSlotArgs: (id: string, slot: string, patch: Record<string, unknown>) => void;
  select: (id: string | null) => void;
  loadPlan: (plan: PlanJson) => void;
  reset: () => void;
};

const DEFAULT_PAYLOADS: Record<SlideType, Record<string, unknown>> = {
  p_slide_title: { title: "Informe", subtitle: "" },
  p_slide_section: { title: "Sección", subtitle: "" },
  p_slide_1: { title: "", plot: null, base: "", footer: "" },
  p_slide_2: { title: "", left: null, right: null, base: "", footer: "" },
  p_slide_text_l: { title: "", plot: null, text: "", base: "", footer: "" },
  p_slide_text_r: { title: "", plot: null, text: "", base: "", footer: "" },
};

function newId() {
  return `s-${Math.random().toString(36).slice(2, 10)}`;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  plan: { slides: [] },
  presets: {},
  wPresets: {},
  selectedSlideId: null,

  addSlide: (tipo) => {
    const s: Slide = { id: newId(), tipo, payload: { ...DEFAULT_PAYLOADS[tipo] } };
    set((state) => ({
      plan: { slides: [...state.plan.slides, s] },
      selectedSlideId: s.id,
    }));
  },

  removeSlide: (id) => {
    set((state) => {
      const slides = state.plan.slides.filter((s) => s.id !== id);
      const nextSelected = state.selectedSlideId === id ? (slides[0]?.id ?? null) : state.selectedSlideId;
      return { plan: { slides }, selectedSlideId: nextSelected };
    });
  },

  moveSlide: (id, direction) => {
    set((state) => {
      const i = state.plan.slides.findIndex((s) => s.id === id);
      if (i < 0) return state;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= state.plan.slides.length) return state;
      const slides = [...state.plan.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { plan: { slides } };
    });
  },

  updateSlidePayload: (id, patch) => {
    set((state) => ({
      plan: {
        slides: state.plan.slides.map((s) =>
          s.id === id ? { ...s, payload: { ...s.payload, ...patch } } : s
        ),
      },
    }));
  },

  setSlot: (id, slot, graf) => {
    set((state) => ({
      plan: {
        slides: state.plan.slides.map((s) =>
          s.id === id
            ? { ...s, payload: { ...s.payload, [slot]: graf ?? undefined } }
            : s
        ),
      },
    }));
  },

  updateSlotArgs: (id, slot, patch) => {
    set((state) => ({
      plan: {
        slides: state.plan.slides.map((s) => {
          if (s.id !== id) return s;
          const current = s.payload[slot] as GraficadorRef | undefined;
          if (!current) return s;
          const merged: GraficadorRef = { graficador: current.graficador, args: { ...current.args, ...patch } };
          return { ...s, payload: { ...s.payload, [slot]: merged } };
        }),
      },
    }));
  },

  select: (id) => set({ selectedSlideId: id }),

  loadPlan: (plan) => set({ plan, selectedSlideId: plan.slides[0]?.id ?? null }),

  reset: () => set({ plan: { slides: [] }, selectedSlideId: null, presets: {}, wPresets: {} }),
}));
