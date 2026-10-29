import { useCallback, useEffect, useRef, useState } from "react";

import { apiHojasRutaPersistWorkspace, apiHojasRutaState, type HojasRutaPlanSupuestos, type HojasRutaState } from "../../../api/hojasRuta";
import { apiMaterialTerritorialUnidades, type UnidadesTerritoriales } from "../../../api/materialTerritorial";

export type CargaTerritorial = "cargando" | "lista" | "error";

/**
 * Lo que la campaña territorial abierta lee del backend (ADR 0118):
 *
 * - `unidades`: la FOTO enviada (`ump_territorial_v1`); `sinFuente` si el 409
 *   dice que ya no está;
 * - `hojas`: el estado de Hojas de ruta, del que Catálogo, Paquetes y Entrega
 *   toman la configuración y la muestra con que llaman a los motores existentes.
 *
 * Nada de esto se guarda en el cliente: se relee al cambiar de proyecto.
 */
export function useCampanaTerritorial(campaignId: string) {
  const [unidades, setUnidades] = useState<UnidadesTerritoriales | null>(null);
  const [sinFuente, setSinFuente] = useState<string | null>(null);
  const [hojas, setHojas] = useState<HojasRutaState | null>(null);
  const [carga, setCarga] = useState<CargaTerritorial>("cargando");
  const [error, setError] = useState("");
  const turno = useRef(0);

  const recargar = useCallback(async () => {
    const pedido = ++turno.current;
    setCarga("cargando");
    setError("");
    try {
      const [lectura, estado] = await Promise.all([apiMaterialTerritorialUnidades(campaignId), apiHojasRutaState()]);
      if (pedido !== turno.current) return;
      setHojas(estado);
      if (lectura.ok) {
        setUnidades(lectura.datos);
        setSinFuente(null);
      } else {
        setUnidades(null);
        setSinFuente(lectura.mensaje);
      }
      setCarga("lista");
    } catch (causa) {
      if (pedido !== turno.current) return;
      setError(causa instanceof Error ? causa.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo leer la campaña territorial.");
      setCarga("error");
    }
  }, [campaignId]);

  useEffect(() => {
    void recargar();
    const alCambiar = () => {
      setUnidades(null);
      setHojas(null);
      void recargar();
    };
    window.addEventListener("pulso:session-changed", alCambiar);
    return () => {
      turno.current += 1;
      window.removeEventListener("pulso:session-changed", alCambiar);
    };
  }, [recargar]);

  /** Guarda los supuestos del plan de campo en Hojas de ruta, como lo hace su página. */
  const guardarPlan = useCallback(async (supuestos: HojasRutaPlanSupuestos) => {
    if (!hojas) return;
    await apiHojasRutaPersistWorkspace(hojas.integrated_config, { ...hojas.ui_state, plan_campo: supuestos }, hojas.workspace_outputs ?? {}, hojas.active_phase);
    setHojas(await apiHojasRutaState());
  }, [hojas]);

  return { unidades, sinFuente, hojas, carga, error, recargar, guardarPlan };
}
