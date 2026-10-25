import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MonitoreoConfig, MonitoreoSource } from "../../../api/monitoreo";
import type { AccionDeActualizar, BarraDelModo } from "../shell/BarraDelModo";
import { ejecutarActualizacion, type AccionesDelStoreDeSync } from "./ejecutarActualizacion";
import { planDeActualizar, type EntradaDeActualizar, type PeticionDeActualizar } from "./menuDeActualizar";

/**
 * El control único «Actualizar ▾» de la barra del modo (L38, §2b), común a
 * Telefónico y Acreditación. Cada perfil le pasa su store de sync —el tick por
 * segundo vive ahí y no en la raíz del perfil— y cómo releer su estado; el
 * hook lanza el job, reporta el paso en que va y deja el recibo como aviso.
 *
 * Un sync a la vez: el chrome apaga el botón y el menú mientras el store dice
 * `syncing`, y una segunda petición que llegue igual (doble click antes del
 * render) se descarta aquí.
 */

export type { AccionesDelStoreDeSync } from "./ejecutarActualizacion";

export function useActualizarDelModo({
  familia,
  fuentes,
  config,
  deshabilitado,
  pendienteDeRecalcular = false,
  acciones,
  recargar,
  alEmpezar,
  alFallar,
}: {
  familia: string;
  fuentes: MonitoreoSource[];
  config?: Partial<MonitoreoConfig>;
  deshabilitado: boolean;
  pendienteDeRecalcular?: boolean;
  acciones: AccionesDelStoreDeSync;
  /** Vuelve a leer el estado del modo con el corte nuevo (recalcula el tablero). */
  recargar: () => Promise<void>;
  alEmpezar?: () => void;
  alFallar?: (mensaje: string) => void;
}): Pick<BarraDelModo, "actualizar" | "otrasActualizaciones"> & { ejecutarPrincipal: () => void } {
  const corriendo = useRef(false);
  const desmontado = useRef(false);
  useEffect(() => {
    desmontado.current = false;
    return () => {
      desmontado.current = true;
    };
  }, []);

  const ejecutar = useCallback(async (peticion: PeticionDeActualizar) => {
    if (corriendo.current) return;
    corriendo.current = true;
    try {
      await ejecutarActualizacion(peticion, {
        config,
        acciones,
        recargar,
        alEmpezar,
        alFallar,
        cancelado: () => desmontado.current,
      });
    } finally {
      corriendo.current = false;
    }
  }, [acciones, alEmpezar, alFallar, config, recargar]);

  const plan = useMemo(
    () => planDeActualizar({ fuentes, familia, deshabilitado, pendienteDeRecalcular }),
    [deshabilitado, familia, fuentes, pendienteDeRecalcular],
  );

  return useMemo(() => {
    const accion = (entrada: EntradaDeActualizar): AccionDeActualizar => ({
      clave: entrada.clave,
      etiqueta: entrada.etiqueta,
      detalle: entrada.detalle,
      titulo: entrada.titulo,
      grupo: entrada.grupo,
      disabled: entrada.disabled,
      onElegir: () => { void ejecutar(entrada.peticion); },
    });
    return {
      actualizar: accion(plan.principal),
      otrasActualizaciones: plan.menu.map(accion),
      ejecutarPrincipal: () => {
        if (!plan.principal.disabled) void ejecutar(plan.principal.peticion);
      },
    };
  }, [ejecutar, plan]);
}
