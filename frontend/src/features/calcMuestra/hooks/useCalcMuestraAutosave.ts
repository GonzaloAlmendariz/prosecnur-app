import { useEffect, useRef } from "react";
import {
  apiCalcMuestraState,
  apiCalcMuestraEstudioPut,
  type CalcMuestraEstudio,
  type CalcMuestraState,
} from "../../../api/client";
import { useCalcMuestraStore } from "../store/calcMuestraStore";

/**
 * Cuerpo del autosave (exportado para test). PUT del estudio vigente y
 * markClean SOLO si el estudio del store sigue siendo el enviado (comparación
 * por referencia: cada mutación del store crea un objeto nuevo).
 *
 * F7: antes el markClean era incondicional tras el await; si el usuario
 * editaba DURANTE el PUT in-flight, esas ediciones quedaban marcadas como
 * "limpias" sin haberse persistido — y no se guardaban nunca si no llegaba
 * otra mutación. Con la condición, dirty sigue true y el debounce que ya se
 * re-armó con la edición nueva hace el PUT correcto.
 */
export async function autosaveEstudioActual(
  put: (estudio: CalcMuestraEstudio) => Promise<unknown> = apiCalcMuestraEstudioPut,
): Promise<void> {
  const enviado = useCalcMuestraStore.getState().estudio;
  try {
    await put(enviado);
    if (useCalcMuestraStore.getState().estudio === enviado) {
      useCalcMuestraStore.getState().markClean();
    }
  } catch (e) {
    console.warn("[calc-muestra] autosave fallo:", e);
  }
}

// Hidrata el estudio desde el backend al montar y autosave con debounce 2s.
// Patrón espejo de `useMuestraAulasAutosave.ts`.
export function useCalcMuestraAutosave(onState?: (state: CalcMuestraState) => void) {
  const { estudio, dirty, hydrated, hydrate } = useCalcMuestraStore();
  const timerRef = useRef<number | null>(null);

  // Hidratar al montar
  useEffect(() => {
    let alive = true;
    apiCalcMuestraState()
      .then((s) => {
        if (alive) {
          hydrate(s.estudio);
          onState?.(s);
        }
      })
      .catch((e) => {
        console.warn("[calc-muestra] hydrate fallo:", e);
        if (alive) hydrate(useCalcMuestraStore.getState().estudio);
      });
    return () => {
      alive = false;
    };
  }, [hydrate, onState]);

  // Autosave con debounce
  useEffect(() => {
    if (!hydrated || !dirty) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void autosaveEstudioActual();
    }, 2000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [estudio, dirty, hydrated]);

  // Escuchar cambios globales de sesión
  useEffect(() => {
    const onSessionChange = () => {
      apiCalcMuestraState()
        .then((s) => {
          hydrate(s.estudio);
          onState?.(s);
        })
        .catch(() => undefined);
    };
    window.addEventListener("pulso:session-changed", onSessionChange);
    return () => window.removeEventListener("pulso:session-changed", onSessionChange);
  }, [hydrate, onState]);
}
