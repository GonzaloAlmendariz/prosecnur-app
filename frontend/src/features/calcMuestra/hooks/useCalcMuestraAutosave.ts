import { useEffect, useRef } from "react";
import { apiCalcMuestraState, apiCalcMuestraEstudioPut } from "../../../api/client";
import { useCalcMuestraStore } from "../store/calcMuestraStore";

// Hidrata el estudio desde el backend al montar y autosave con debounce 2s.
// Patrón espejo de `useMuestraAulasAutosave.ts`.
export function useCalcMuestraAutosave() {
  const { estudio, dirty, hydrated, hydrate, markClean } = useCalcMuestraStore();
  const timerRef = useRef<number | null>(null);

  // Hidratar al montar
  useEffect(() => {
    let alive = true;
    apiCalcMuestraState()
      .then((s) => {
        if (alive) hydrate(s.estudio);
      })
      .catch((e) => {
        console.warn("[calc-muestra] hydrate fallo:", e);
        if (alive) hydrate(useCalcMuestraStore.getState().estudio);
      });
    return () => {
      alive = false;
    };
  }, [hydrate]);

  // Autosave con debounce
  useEffect(() => {
    if (!hydrated || !dirty) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        await apiCalcMuestraEstudioPut(estudio);
        markClean();
      } catch (e) {
        console.warn("[calc-muestra] autosave fallo:", e);
      }
    }, 2000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [estudio, dirty, hydrated, markClean]);

  // Escuchar cambios globales de sesión
  useEffect(() => {
    const onSessionChange = () => {
      apiCalcMuestraState()
        .then((s) => hydrate(s.estudio))
        .catch(() => undefined);
    };
    window.addEventListener("pulso:session-changed", onSessionChange);
    return () => window.removeEventListener("pulso:session-changed", onSessionChange);
  }, [hydrate]);
}
