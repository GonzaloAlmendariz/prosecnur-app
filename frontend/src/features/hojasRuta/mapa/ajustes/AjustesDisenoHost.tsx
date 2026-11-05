import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import type { ResultadoTamano } from "../muestra/motorTamano";
import { AjustesDiseno } from "./AjustesDiseno";
import type { SeccionOrigen } from "./gruposAjustes";
import { useAjustesDiseno } from "./useAjustesDiseno";

/**
 * Monta «Ajustes del diseño» sobre el lienzo con lo que la página ya tiene (config, fase, tamaño). Vive en
 * su archivo para no hacer crecer `HojasRutaMapaPage.tsx`, que ya pasa de mil líneas.
 */
export function AjustesDisenoHost({ config, fase, tamano }: { config: HojasRutaIntegratedConfig | null; fase: string; tamano: ResultadoTamano | null }) {
  const { abierto, grupo, cerrar, irAGrupo } = useAjustesDiseno();
  const location = useLocation();
  const navigate = useNavigate();
  const irSeccion = useCallback((s: SeccionOrigen) => {
    const p = new URLSearchParams(location.search);
    p.delete("panel");
    p.delete("foco");
    p.set("seccion", s);
    navigate({ pathname: location.pathname, search: `?${p.toString()}` });
  }, [location.pathname, location.search, navigate]);
  if (!config) return null;
  const k = config.entrevistas_por_manzana;
  const n = tamano?.nUsado ?? null;
  return (
    <AjustesDiseno
      abierto={abierto}
      grupo={grupo}
      config={config}
      fase={fase}
      vista={{ n, rutas: n != null && k > 0 ? Math.floor(n / k) : null, distritos: config.territorios.length, margen: tamano?.margenTotal ?? null }}
      onGrupo={irAGrupo}
      onCerrar={cerrar}
      onIrSeccion={irSeccion}
    />
  );
}
