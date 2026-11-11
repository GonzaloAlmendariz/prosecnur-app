// El plan de Aplicar: lo lee al montar y lo vuelve a leer a pedido. Un solo
// estado en vez de tres: plan, error y lectura en curso cambian juntos.

import { useCallback, useEffect, useState } from "react";

import { apiCodifPlanAdaptacion, type PlanAdaptacion } from "../../../api/dashboard";

export type PlanAplicar = {
  plan: PlanAdaptacion | null;
  /** Por qué no se pudo leer. Vacío si no falló. */
  error: string;
  cargando: boolean;
  recargar: () => void;
};

type Lectura = Omit<PlanAplicar, "recargar">;

export function usePlanAplicar(): PlanAplicar {
  const [lectura, setLectura] = useState<Lectura>({ plan: null, error: "", cargando: true });

  const recargar = useCallback(() => {
    setLectura((previa) => ({ plan: previa.plan, error: "", cargando: true }));
    apiCodifPlanAdaptacion().then(
      (plan) => setLectura({ plan, error: "", cargando: false }),
      (e: unknown) => setLectura({ plan: null, error: e instanceof Error ? e.message : String(e), cargando: false }),
    );
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { ...lectura, recargar };
}
