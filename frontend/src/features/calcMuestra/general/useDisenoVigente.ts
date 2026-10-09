import { useEffect } from "react";

import { useMuestraGeneralStore } from "./store";

/**
 * Marcos y corridas para la cabecera de la mesa (estado + banda «Diseño
 * vigente»). Lee `/state` una vez por sesión, como la Selección, pero sin
 * pedir el listado de unidades: la cabecera no lo necesita.
 */
export function useDisenoVigente() {
  const cargado = useMuestraGeneralStore((s) => s.cargado);
  const marcos = useMuestraGeneralStore((s) => s.marcos);
  const corridas = useMuestraGeneralStore((s) => s.corridas);
  const cargar = useMuestraGeneralStore((s) => s.cargar);

  useEffect(() => {
    void cargar();
    const alCambiarSesion = () => void cargar({ forzar: true });
    window.addEventListener("pulso:session-changed", alCambiarSesion);
    return () => window.removeEventListener("pulso:session-changed", alCambiarSesion);
  }, [cargar]);

  return { cargado, marcos, corridas };
}
