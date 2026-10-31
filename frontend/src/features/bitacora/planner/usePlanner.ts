// El estado del Planner para sus cuatro secciones nuevas (ADR 0122).
//
// Una sola lectura (`GET /api/planner`, pura) y una escritura por sección con
// la revisión vigente. Si otro guardó entre medio (409), se recarga y se dice:
// nunca se reintenta en silencio sobre un estado que el usuario no vio.

import { useCallback, useEffect, useState } from "react";

import {
  apiPlannerDeclarar,
  apiPlannerEstado,
  type PlannerEstado,
  type PlannerSeccion,
} from "../../../api/planner";

export type ControlPlanner = {
  estado: PlannerEstado | null;
  cargando: boolean;
  guardando: PlannerSeccion | null;
  error: string | null;
  recargar: () => Promise<void>;
  declarar: (seccion: PlannerSeccion, valor: unknown) => Promise<boolean>;
};

// `ApiError` suma « · E_CODIGO» al mensaje; en pantalla va sólo la frase.
function mensajeDe(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message.replace(/ · E_[A-Z0-9_]+$/, "") : porDefecto;
}

function esDesactualizado(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "E_PLANNER_DESACTUALIZADO";
}

export function usePlanner(): ControlPlanner {
  const [estado, setEstado] = useState<PlannerEstado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<PlannerSeccion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setEstado(await apiPlannerEstado());
      setError(null);
    } catch (err) {
      setError(mensajeDe(err, "No se pudo leer el Planner."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const declarar = useCallback(async (seccion: PlannerSeccion, valor: unknown) => {
    if (!estado) return false;
    setGuardando(seccion);
    try {
      setEstado(await apiPlannerDeclarar(seccion, valor, estado.revision));
      setError(null);
      return true;
    } catch (err) {
      if (esDesactualizado(err)) {
        await recargar();
        setError("El Planner cambió mientras lo editabas. Se recargó: revisa y vuelve a guardar.");
      } else {
        setError(mensajeDe(err, "No se pudo guardar."));
      }
      return false;
    } finally {
      setGuardando(null);
    }
  }, [estado, recargar]);

  return { estado, cargando, guardando, error, recargar, declarar };
}
