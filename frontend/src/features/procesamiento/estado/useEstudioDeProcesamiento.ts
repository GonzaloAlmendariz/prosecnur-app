// Lectura del estudio para "Estado del estudio" y cambio de base activa.
//
// El cambio de base sigue el mismo protocolo que `components/ChromeBaseSelector`:
// la API canónica del estudio, refresco de la sesión y el evento
// `pulso:active-base-changed`, que es el que hace recargar a las secciones su
// estado por base.

import { useCallback, useEffect, useRef, useState } from "react";

import { apiEstudioActiveBaseSet, apiEstudioGet, type EstudioPayload } from "../../../api/estudio";
import { useSession } from "../../../lib/SessionContext";

export type LecturaDelEstudio =
  | { fase: "cargando" }
  | { fase: "lista"; estudio: EstudioPayload }
  | { fase: "error"; detalle: string };

export type EstudioDeProcesamiento = {
  lectura: LecturaDelEstudio;
  recargar: () => Promise<void>;
  /** Nombre de la base a la que se está cambiando; `null` si no hay cambio en curso. */
  activandoA: string | null;
  /** Por qué falló el último cambio de base; `null` si no falló. */
  errorDeActivar: string | null;
  activar: (nombre: string) => Promise<void>;
};

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useEstudioDeProcesamiento(): EstudioDeProcesamiento {
  const { refresh } = useSession();
  const [lectura, setLectura] = useState<LecturaDelEstudio>({ fase: "cargando" });
  const [activandoA, setActivandoA] = useState<string | null>(null);
  const [errorDeActivar, setErrorDeActivar] = useState<string | null>(null);
  const montado = useRef(true);

  const recargar = useCallback(async () => {
    try {
      const estudio = await apiEstudioGet();
      if (montado.current) setLectura({ fase: "lista", estudio });
    } catch (error) {
      if (montado.current) setLectura({ fase: "error", detalle: mensaje(error) });
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    void recargar();
    const alCambiar = () => void recargar();
    window.addEventListener("pulso:active-base-changed", alCambiar);
    window.addEventListener("pulso:session-changed", alCambiar);
    return () => {
      montado.current = false;
      window.removeEventListener("pulso:active-base-changed", alCambiar);
      window.removeEventListener("pulso:session-changed", alCambiar);
    };
  }, [recargar]);

  const activar = useCallback(
    async (nombre: string) => {
      if (!nombre || activandoA !== null) return;
      setActivandoA(nombre);
      setErrorDeActivar(null);
      try {
        const resultado = await apiEstudioActiveBaseSet(nombre);
        await refresh();
        window.dispatchEvent(
          new CustomEvent("pulso:active-base-changed", {
            detail: { active: resultado.active, processing_mode: resultado.processing_mode },
          }),
        );
        await recargar();
      } catch (error) {
        if (montado.current) setErrorDeActivar(mensaje(error));
      } finally {
        if (montado.current) setActivandoA(null);
      }
    },
    [activandoA, recargar, refresh],
  );

  return { lectura, recargar, activandoA, errorDeActivar, activar };
}
