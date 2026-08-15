// =============================================================================
// La pestaña de Validación vive en la URL
// =============================================================================
// Las cuatro pestañas de Validación eran las únicas de Procesamiento sin
// dirección publicada: el tab activo vivía en un `activeTab` del store zustand
// y `/validacion?pestana=limpieza` aterrizaba en Explorar. Eso rompe el
// contrato v3 —toda vista es enlazable— y además dejaba a `__pulsoNav.ir()`
// sin poder entrar (`runtime.ts` se niega a navegar a un nodo no publicado),
// que es la puerta por la que el QA visual recorre la app.
//
// Se usa `useSeccion`, el lector canónico, y no un séptimo `useSearchParams`.
// La única costura: `parsearDireccion` normaliza el token (minúsculas, `_` a
// `-`), así que `reglas_custom` vuelve como `reglas-custom` y la comparación
// tiene que normalizar los dos lados.
// =============================================================================

import { useCallback, useMemo } from "react";

import { PROCESAMIENTO_PESTANAS } from "../../lib/navegacion/catalogos/procesamiento";
import { normalizarToken } from "../../lib/navegacion/direccion";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import { useValidacionStore } from "./store";
import type { ValidacionTabId } from "./types";

const TABS = PROCESAMIENTO_PESTANAS.validacion;
const PESTANA_POR_DEFECTO: ValidacionTabId = TABS[0].key;

/** La pestaña que nombra la URL, o la primera si no nombra ninguna válida. */
export function resolverPestana(pedida: string | null | undefined): ValidacionTabId {
  if (!pedida) return PESTANA_POR_DEFECTO;
  const buscada = normalizarToken(pedida);
  return TABS.find((tab) => normalizarToken(tab.key) === buscada)?.key ?? PESTANA_POR_DEFECTO;
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
  const { pestana, irA } = useSeccion("procesamiento");
  const setPrefill = useValidacionStore((s) => s.setPrefill);

  const activa = useMemo(() => resolverPestana(pestana), [pestana]);

  const irAPestana = useCallback(
    (tab: ValidacionTabId, prefill?: Record<string, unknown>) => {
      if (prefill) setPrefill(tab, prefill);
      irA("pestana", tab);
    },
    [irA, setPrefill],
  );

  return { pestana: activa, irAPestana };
}
