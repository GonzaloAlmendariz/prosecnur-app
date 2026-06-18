import { useCallback, useEffect, useMemo, useState } from "react";

export type LayoutPreset =
  | "auto"
  | "large"
  | "portable"
  | "portable-compact"
  | "compact"
  | "short";

export type LayoutDensity = "auto" | "comfortable" | "balanced" | "compact" | "short";
export type LayoutMode = "auto" | "desktop" | "compact" | "short";

export type LayoutPresetOption = {
  value: LayoutPreset;
  label: string;
  size: string;
  density: LayoutDensity;
  mode: LayoutMode;
  description: string;
};

const STORAGE_KEY = "pulso.layoutPreset";
const CHANGE_EVENT = "pulso:layout-preset-changed";

export const LAYOUT_PRESET_OPTIONS: LayoutPresetOption[] = [
  {
    value: "auto",
    label: "Automático",
    size: "Ventana actual",
    density: "auto",
    mode: "auto",
    description: "Prosecnur decide con el tamaño real de la ventana.",
  },
  {
    value: "large",
    label: "Escritorio amplio",
    size: "1710x1107",
    density: "comfortable",
    mode: "desktop",
    description: "Más aire y columnas estables para escritorio amplio.",
  },
  {
    value: "portable",
    label: "Portátil amplio",
    size: "1440x1000",
    density: "balanced",
    mode: "desktop",
    description: "Densidad media para portátiles con altura cómoda.",
  },
  {
    value: "portable-compact",
    label: "Portátil compacto",
    size: "1366x768",
    density: "compact",
    mode: "compact",
    description: "Compacta shell, toolbars y rails sin apilar el workbench.",
  },
  {
    value: "compact",
    label: "Ventana compacta",
    size: "1280x720",
    density: "compact",
    mode: "compact",
    description: "Prioriza trabajo principal y reduce padding global.",
  },
  {
    value: "short",
    label: "Altura baja",
    size: "1024x600",
    density: "short",
    mode: "short",
    description: "Apila rails y preserva el panel principal en poco alto.",
  },
];

const PRESET_VALUES = new Set<LayoutPreset>(LAYOUT_PRESET_OPTIONS.map((option) => option.value));

export function isLayoutPreset(value: unknown): value is LayoutPreset {
  return typeof value === "string" && PRESET_VALUES.has(value as LayoutPreset);
}

function normalizeLayoutPreset(value: unknown): LayoutPreset {
  // Compatibilidad con presets guardados antes de neutralizar nombres.
  if (value === "thinkpad") return "portable-compact";
  if (value === "laptop") return "portable";
  return isLayoutPreset(value) ? value : "auto";
}

export function layoutPresetMeta(preset: LayoutPreset): LayoutPresetOption {
  return LAYOUT_PRESET_OPTIONS.find((option) => option.value === preset) ?? LAYOUT_PRESET_OPTIONS[0];
}

export function readLayoutPreset(): LayoutPreset {
  if (typeof window === "undefined") return "auto";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const next = normalizeLayoutPreset(value);
    if (value && value !== next) window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return "auto";
  }
}

export function writeLayoutPreset(preset: LayoutPreset) {
  if (typeof window === "undefined") return;
  const next = isLayoutPreset(preset) ? preset : "auto";
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Local storage puede estar bloqueado en algunos runtimes embebidos.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { preset: next } }));
}

export function useLayoutPreset() {
  const [preset, setPresetState] = useState<LayoutPreset>(() => readLayoutPreset());

  useEffect(() => {
    function sync(event?: Event) {
      const next = event instanceof CustomEvent
        ? normalizeLayoutPreset(event.detail?.preset)
        : readLayoutPreset();
      setPresetState(next);
    }
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setPreset = useCallback((next: LayoutPreset) => {
    writeLayoutPreset(next);
    setPresetState(next);
  }, []);

  return useMemo(() => [preset, setPreset] as const, [preset, setPreset]);
}

export function useApplyLayoutPreset() {
  const [preset] = useLayoutPreset();

  useEffect(() => {
    const meta = layoutPresetMeta(preset);
    const root = document.documentElement;
    root.dataset.pulsoLayoutPreset = meta.value;
    root.dataset.pulsoLayoutDensity = meta.density;
    root.dataset.pulsoLayoutMode = meta.mode;
    return () => {
      delete root.dataset.pulsoLayoutPreset;
      delete root.dataset.pulsoLayoutDensity;
      delete root.dataset.pulsoLayoutMode;
    };
  }, [preset]);
}
