// La configuración de la campaña telefónica (P10): se lee al abrir y se guarda con la
// revisión leída; tras un 409 se relee para no pisar un cambio ajeno.

import { useCallback, useEffect, useState } from "react";

import {
  apiMaterialTelefonicaConfig,
  apiMaterialTelefonicaGuardarConfig,
  type CambioTelefonico,
  type ConfigTelefonica,
} from "../../../api/materialTelefonica";

function mensaje(e: unknown, porDefecto: string): string {
  return e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : porDefecto;
}

export function useConfigTelefonica(campaignId: string) {
  const [config, setConfig] = useState<ConfigTelefonica | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setConfig(await apiMaterialTelefonicaConfig(campaignId));
      setError("");
    } catch (e: unknown) {
      setError(mensaje(e, "No se pudo leer la campaña telefónica."));
    } finally {
      setCargando(false);
    }
  }, [campaignId]);

  useEffect(() => { void recargar(); }, [recargar]);

  const guardar = useCallback(async (cambio: CambioTelefonico): Promise<boolean> => {
    if (!config) return false;
    setGuardando(true);
    setError("");
    try {
      setConfig(await apiMaterialTelefonicaGuardarConfig(campaignId, cambio, config.revision));
      return true;
    } catch (e: unknown) {
      setError(mensaje(e, "No se pudo guardar la configuración."));
      void apiMaterialTelefonicaConfig(campaignId).then(setConfig).catch(() => undefined);
      return false;
    } finally {
      setGuardando(false);
    }
  }, [campaignId, config]);

  return { config, cargando, guardando, error, recargar, guardar };
}
