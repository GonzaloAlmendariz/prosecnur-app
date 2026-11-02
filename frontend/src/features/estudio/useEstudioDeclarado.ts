// Lo que el estudio declara de sí mismo: nombre y tipo (ADR 0124). Vive en la
// clave `planner` de la sesión aunque el Planner ya no sea un módulo.
//
// Una sola lectura (`GET /api/planner`, pura) y una escritura por sección con
// la revisión vigente. Si otro guardó entre medio (409), se recarga y se dice:
// nunca se reintenta en silencio sobre un estado que el usuario no vio.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  apiPlannerDeclarar,
  apiPlannerEstado,
  type PlannerEstado,
  type PlannerSeccion,
} from "../../api/planner";
import { avisarCambioDelEstudio } from "../../lib/avisoDeCambioDelEstudio";

/** Lo emite cada declaración: Cálculo y Monitoreo releen su modo sin recargar la página. */
export const EVENTO_ESTUDIO_DECLARADO = "pulso:estudio-declarado";

export type ControlEstudio = {
  estado: PlannerEstado | null;
  cargando: boolean;
  guardando: boolean;
  error: string | null;
  /** Declara las secciones en orden, cada una sobre la revisión que dejó la anterior. */
  declarar: (pasos: ReadonlyArray<readonly [PlannerSeccion, unknown]>) => Promise<boolean>;
};

// `ApiError` suma « · E_CODIGO» al mensaje; en pantalla va sólo la frase.
function mensajeDe(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message.replace(/ · E_[A-Z0-9_]+$/, "") : porDefecto;
}

function esDesactualizado(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "E_PLANNER_DESACTUALIZADO";
}

export function useEstudioDeclarado(): ControlEstudio {
  const [estado, setEstado] = useState<PlannerEstado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef<number | null>(null);

  const recibir = useCallback((e: PlannerEstado) => {
    revision.current = e.revision;
    setEstado(e);
  }, []);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      recibir(await apiPlannerEstado());
      setError(null);
    } catch (err) {
      setError(mensajeDe(err, "No se pudo leer la ficha del estudio."));
    } finally {
      setCargando(false);
    }
  }, [recibir]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const declarar = useCallback(async (pasos: ReadonlyArray<readonly [PlannerSeccion, unknown]>) => {
    if (revision.current === null) return false;
    setGuardando(true);
    try {
      for (const [seccion, valor] of pasos) {
        recibir(await apiPlannerDeclarar(seccion, valor, revision.current));
      }
      setError(null);
      window.dispatchEvent(new Event(EVENTO_ESTUDIO_DECLARADO));
      // El nombre declarado es el del chip y el del Home: que relean ya, sin
      // esperar al sondeo de 30 s.
      window.dispatchEvent(new Event("pulso:project-status-changed"));
      avisarCambioDelEstudio("ficha-del-estudio");
      return true;
    } catch (err) {
      if (esDesactualizado(err)) {
        await recargar();
        setError("La ficha cambió mientras la editabas. Se recargó: revisa y vuelve a guardar.");
      } else {
        setError(mensajeDe(err, "No se pudo guardar."));
      }
      return false;
    } finally {
      setGuardando(false);
    }
  }, [recargar, recibir]);

  return { estado, cargando, guardando, error, declarar };
}
