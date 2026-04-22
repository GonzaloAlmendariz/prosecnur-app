// =============================================================================
// useAutosave — autoguardado del proyecto cada 5 minutos
// =============================================================================
// Pollea cada 5 min: si el proyecto está abierto Y dirty, dispara un save
// silencioso. No interrumpe al usuario (sin dialogs). Si falla, deja el
// flag dirty para que el siguiente intervalo o un Cmd+S manual lo levante.
//
// El intervalo arranca cuando hay proyecto y se limpia cuando se cierra
// (re-render por cambio de dependencias).

import { useEffect, useRef } from "react";
import type { UseProjectReturn } from "./useProject";

const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;

export function useAutosave(project: UseProjectReturn) {
  const lastSaveRef = useRef<number>(0);

  useEffect(() => {
    if (!project.status.has_project) return undefined;

    const tick = async () => {
      // Doble-check: si el proyecto se cerró entre intervalos, no guardar.
      if (!project.status.has_project) return;
      if (!project.status.dirty) return;
      // Throttle defensivo: ignora si guardamos hace menos de 30s
      // (por si el user disparó save manual recién).
      if (Date.now() - lastSaveRef.current < 30_000) return;

      const r = await project.save();
      if (r) lastSaveRef.current = Date.now();
    };

    const id = setInterval(() => { void tick(); }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [project]);
}
