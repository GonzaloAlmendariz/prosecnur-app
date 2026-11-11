// =============================================================================
// La pestaña de Validación vive en la URL
// =============================================================================
// Las pestañas de Validación eran las únicas de Procesamiento sin dirección
// publicada: el tab activo vivía en un `activeTab` del store zustand. Eso
// rompe el contrato v3 (toda vista es enlazable) y además dejaba a
// `__pulsoNav.ir()` sin poder entrar (`runtime.ts` se niega a navegar a un
// nodo no publicado), que es la puerta por la que el QA visual recorre la app.
//
// Se usa `useSeccion`, el lector canónico, y no un séptimo `useSearchParams`.
// Las claves viejas (`instrumento`, `reglas_custom`, `limpieza`) las resuelve
// `pestanaValidacion.ts`, que también normaliza el token como la dirección
// (minúsculas, `_` a `-`).
// =============================================================================

import { useCallback, useMemo } from "react";

import { useSeccion } from "../../lib/navegacion/useDireccion";
import { resolverPestanaValidacion } from "./pestanaValidacion";
import { useValidacionStore } from "./store";
import type { ValidacionTabId } from "./types";

/**
 * La pestaña que nombra la URL, con las claves viejas resueltas, o la primera
 * si no nombra ninguna válida. `panel` decide el alias de
 * `pestana=instrumento&panel=regla`, que abre Hallazgos.
 */
export function resolverPestana(
  pedida: string | null | undefined,
  panel: string | null | undefined = null,
): ValidacionTabId {
  return resolverPestanaValidacion(pedida, panel);
}

export type PestanaDireccionable = {
  pestana: ValidacionTabId;
  /**
   * Cambia de pestaña. `prefill` es el payload que la pestaña destino lee al
   * montarse (el viejo `jumpTo` del store, que ahora sólo aporta el prefill:
   * quién manda es la dirección).
   */
  irAPestana: (tab: ValidacionTabId, prefill?: Record<string, unknown>) => void;
};

export function usePestanaValidacion(): PestanaDireccionable {
  const { pestana, panel, irA } = useSeccion("procesamiento");
  const setPrefill = useValidacionStore((s) => s.setPrefill);

  const activa = useMemo(() => resolverPestana(pestana, panel), [pestana, panel]);

  const irAPestana = useCallback(
    (tab: ValidacionTabId, prefill?: Record<string, unknown>) => {
      if (prefill) setPrefill(tab, prefill);
      irA("pestana", tab);
    },
    [irA, setPrefill],
  );

  return { pestana: activa, irAPestana };
}
