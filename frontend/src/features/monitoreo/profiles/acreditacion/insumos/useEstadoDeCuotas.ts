import { useCallback, useEffect, useRef, useState } from "react";
import type { MonitoreoCuotasEstado } from "../../../../../api/monitoreoCuotas";
import { cuotasRecientes, leerCuotas, recordarCuotas } from "./cuotasRecientes";

/**
 * El estado de cuotas del motor (`GET /api/monitoreo/cuotas`): personas y
 * variables elegibles por público, metas y cuotas declaradas. Lo leen
 * Insumos › Públicos y Modelo; si el motor todavía prepara el cruce, se vuelve
 * a pedir cada 8 s mientras la vista esté montada. Arranca con lo último leído
 * (`cuotasRecientes`) y revalida al montar.
 */
export function useEstadoDeCuotas() {
  const [estado, setEstado] = useState<MonitoreoCuotasEstado | null>(cuotasRecientes);
  const [error, setError] = useState("");
  const vivo = useRef(true);
  const leer = useCallback(async () => {
    try {
      const siguiente = await leerCuotas();
      if (!vivo.current) return;
      setEstado(siguiente);
      setError("");
    } catch (e) {
      if (vivo.current) setError(e instanceof Error ? e.message : "No se pudo leer el estado de cuotas.");
    }
  }, []);
  useEffect(() => {
    vivo.current = true;
    void leer();
    return () => { vivo.current = false; };
  }, [leer]);
  useEffect(() => {
    if (!estado?.preparando) return undefined;
    const temporizador = window.setTimeout(() => { void leer(); }, 8000);
    return () => window.clearTimeout(temporizador);
  }, [estado, leer]);
  const fijarEstado = useCallback((siguiente: MonitoreoCuotasEstado | null) => {
    recordarCuotas(siguiente);
    setEstado(siguiente);
  }, []);
  return { estado, error, releer: leer, setEstado: fijarEstado };
}
