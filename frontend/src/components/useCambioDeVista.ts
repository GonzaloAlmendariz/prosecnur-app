import { useContext, useEffect, useRef, useState } from "react";
import { UNSAFE_LocationContext } from "react-router-dom";

/**
 * Transición al cambiar de sección o de pestaña dentro de un módulo (6 nov 2026, pulido de UI: el sistema de
 * movimiento tenía entrada de RUTA pero no de sección/pestaña, que viven en la query y no re-montan nada; el
 * contenido saltaba). Devuelve "a" | "b" | null: alterna cada vez que cambian `seccion` o `pestana` (o sus
 * alias heredados), así la hoja puede reiniciar la animación cambiando de nombre de keyframe sin re-montar la
 * vista ni perder su estado. `panel` y `foco` NO cuentan: abrir un panel no es cambiar de vista.
 *
 * Fuera de un router (modo público, tests) devuelve null.
 */
export function claveDeVista(search: string): string {
  const q = new URLSearchParams(search);
  const seccion = q.get("seccion") ?? q.get("stage") ?? q.get("mesa") ?? q.get("desk") ?? "";
  const pestana = q.get("pestana") ?? q.get("tab") ?? q.get("step") ?? "";
  return `${seccion}|${pestana}`;
}

export function useCambioDeVista(): "a" | "b" | null {
  // LocationContext directo (y no useLocation) para no romper fuera de un <Router>.
  const ctx = useContext(UNSAFE_LocationContext);
  const search = ctx?.location?.search ?? null;
  const pathname = ctx?.location?.pathname ?? null;
  const previa = useRef<{ ruta: string | null; clave: string | null }>({ ruta: pathname, clave: search === null ? null : claveDeVista(search) });
  const [fase, setFase] = useState<"a" | "b" | null>(null);
  useEffect(() => {
    if (search === null) return;
    const clave = claveDeVista(search);
    const antes = previa.current;
    previa.current = { ruta: pathname, clave };
    // Un cambio de ruta ya tiene su entrada (`.pulso-route-surface`): aquí sólo la vista dentro de la ruta.
    if (antes.ruta !== pathname || antes.clave === clave) return;
    setFase((f) => (f === "a" ? "b" : "a"));
  }, [search, pathname]);
  return fase;
}
