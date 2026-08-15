/**
 * El bloque de calidad de campo, leído del state de Monitoreo.
 *
 * Se resuelve acá y no en cada perfil por dos razones: la señal es
 * independiente del perfil —depende de la data y del rol declarado, no de si el
 * estudio es telefónico o territorial— y los page-files de los perfiles están
 * congelados a crecimiento. Un hook propio deja que la chrome compartida la
 * muestre en los cuatro.
 *
 * Pide el state ligero y con `warmupCache`, que reusa el valor que el perfil ya
 * trajo en vez de consumirlo. Si la lectura falla, el bloque no se muestra: una
 * señal nueva no puede romper el módulo.
 */

import { useEffect, useState } from "react";

import { apiMonitoreoState, type MonitoreoCalidadCampo } from "../../../api/monitoreo";

export function useCalidadDeCampo(recargarCon?: string) {
  const [calidad, setCalidad] = useState<MonitoreoCalidadCampo | null>(null);

  useEffect(() => {
    let vivo = true;
    apiMonitoreoState({ includeReports: false, warmupCache: true })
      .then((state) => {
        if (vivo) setCalidad(state.calidad_campo ?? null);
      })
      .catch(() => {
        if (vivo) setCalidad(null);
      });
    return () => {
      vivo = false;
    };
  }, [recargarCon]);

  return calidad;
}
