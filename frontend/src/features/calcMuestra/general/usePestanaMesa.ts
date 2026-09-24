import { useCallback, useMemo } from "react";

import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { pestanasDeSeccion, resolverPestana, type PestanaMesa } from "./modeloPestanas";
import type { ModoMesa } from "./secciones";

/**
 * La pestaña de la sección vive en la dirección (`pestana`), no en estado
 * local: la vista es enlazable y un enlace pegado aterriza donde dice. Elegir
 * escribe la pestaña (y descarta el panel); el `foco` —el actor de
 * Acreditación— se conserva.
 */
export function usePestanaMesa(
  modo: ModoMesa,
  seccion: string,
  porDefecto?: string | null,
): { pestanas: readonly PestanaMesa[]; activa: string; elegir: (id: string) => void } {
  const nav = useSeccion("calc-muestra");
  const pestanas = useMemo(() => pestanasDeSeccion(modo, seccion), [modo, seccion]);
  const activa = resolverPestana(nav.pestana, pestanas, porDefecto);
  const { irA } = nav;
  const elegir = useCallback(
    (id: string) => {
      if (id !== activa) irA("pestana", id);
    },
    [activa, irA],
  );
  return { pestanas, activa, elegir };
}
