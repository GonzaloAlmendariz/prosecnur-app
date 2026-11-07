import { useCallback } from "react";
import { useFoco } from "../../../../lib/navegacion/useFoco";
import { useSeccion } from "../../../../lib/navegacion/useDireccion";

/**
 * Selección en el lienzo, enlazable (ADR 0114 §2-§3, revisión de fase 3 I3): la
 * ruta enfocada es `&foco=<id_manzana>` y la tabla del cajón es la pestaña
 * (`&pestana=titulares|reemplazos|cuotas`), que el manifiesto ya declara. La
 * pestaña `revision` no abre cajón: la revisión vive en el inspector.
 */
export type CajonSeleccion = "titulares" | "reemplazos" | "cuotas";
const TABLAS: readonly CajonSeleccion[] = ["titulares", "reemplazos", "cuotas"];

export function useSeleccionDireccion() {
  const nav = useSeccion("hojas-ruta");
  const [umpEnfocada, setUmpEnfocada] = useFoco();
  const cajon = nav.seccion === "seleccion" && TABLAS.includes(nav.pestana as CajonSeleccion) ? (nav.pestana as CajonSeleccion) : null;
  const { irA } = nav;
  const setCajon = useCallback((c: CajonSeleccion | null) => irA("pestana", c, { replace: true }), [irA]);
  return { umpEnfocada, setUmpEnfocada, cajon, setCajon };
}
