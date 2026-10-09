import { useCallback, useEffect } from "react";

import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { autosaveEstudioActual } from "../hooks/useCalcMuestraAutosave";
import { useCalcMuestraStore } from "../store";
import { useMuestraGeneralStore } from "./store";

/**
 * Marco y corrida del componente, rehidratados al montar desde `/state` y
 * `GET /general/corrida`. Se relee al cambiar de sesión (otro `.pulso`).
 */
export function useMuestraGeneral(componenteId: string | null) {
  const cargado = useMuestraGeneralStore((s) => s.cargado);
  const error = useMuestraGeneralStore((s) => s.error);
  const marco = useMuestraGeneralStore((s) => (componenteId ? s.marcos[componenteId] ?? null : null));
  const corrida = useMuestraGeneralStore((s) => (componenteId ? s.corridas[componenteId] ?? null : null));
  const cargar = useMuestraGeneralStore((s) => s.cargar);
  const cargarListado = useMuestraGeneralStore((s) => s.cargarListado);

  useEffect(() => {
    void cargar();
    const alCambiarSesion = () => void cargar({ forzar: true });
    window.addEventListener("pulso:session-changed", alCambiarSesion);
    return () => window.removeEventListener("pulso:session-changed", alCambiarSesion);
  }, [cargar]);

  const faltaListado = Boolean(corrida && corrida.unidades === null);
  useEffect(() => {
    if (componenteId && faltaListado) void cargarListado(componenteId);
  }, [cargarListado, componenteId, faltaListado]);

  return { cargado, error, marco, corrida };
}

/**
 * Las rutas del motor leen el estudio de la SESIÓN. Si el store tiene cambios
 * sin guardar —un componente recién creado, un n recién ajustado— se guardan
 * antes de pedirle nada al motor, o respondería sobre el estudio viejo.
 */
export async function guardarEstudioPendiente(): Promise<void> {
  if (useCalcMuestraStore.getState().dirty) await autosaveEstudioActual();
}

/** Salto a otra sección del modo, escrito en la dirección. */
export function useIrASeccionGeneral() {
  const nav = useSeccion("calc-muestra");
  return useCallback((seccion: string) => nav.irA("seccion", seccion), [nav]);
}
