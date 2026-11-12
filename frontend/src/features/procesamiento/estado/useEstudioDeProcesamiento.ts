// Lectura del estudio para "Estado del estudio" y cambio de base activa.
//
// El cambio de base sigue el mismo protocolo que `components/ChromeBaseSelector`:
// la API canónica del estudio, refresco de la sesión y el evento
// `pulso:active-base-changed`, que es el que hace recargar a las secciones su
// estado por base.

import { useCallback, useEffect, useRef, useState } from "react";

import { apiEstudioActiveBaseSet, apiEstudioGet, type EstudioPayload } from "../../../api/estudio";
import { apiProcessingReleases, type ProcessingReleaseCatalog } from "../../../api/xlsformEditor";
import { useSession } from "../../../lib/SessionContext";

export type LecturaDelEstudio =
  | { fase: "cargando" }
  | { fase: "lista"; estudio: EstudioPayload }
  | { fase: "error"; detalle: string };

export type EstudioDeProcesamiento = {
  lectura: LecturaDelEstudio;
  /**
   * La aprobación para informe por base. El motor solo la calcula en estudios
   * de bases independientes: en los demás no se pide y queda `null`, igual que
   * si la lectura falla (la página no la necesita para mostrar el estudio).
   */
  catalogoDeAprobaciones: ProcessingReleaseCatalog | null;
  recargar: () => Promise<void>;
  /** Nombre de la base a la que se está cambiando; `null` si no hay cambio en curso. */
  activandoA: string | null;
  /** Por qué falló el último cambio de base; `null` si no falló. */
  errorDeActivar: string | null;
  /** `true` si la base quedó activa. */
  activar: (nombre: string) => Promise<boolean>;
};

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useEstudioDeProcesamiento(): EstudioDeProcesamiento {
  const { refresh } = useSession();
  const [lectura, setLectura] = useState<LecturaDelEstudio>({ fase: "cargando" });
  const [catalogoDeAprobaciones, setCatalogo] = useState<ProcessingReleaseCatalog | null>(null);
  const [activandoA, setActivandoA] = useState<string | null>(null);
  const [errorDeActivar, setErrorDeActivar] = useState<string | null>(null);
  const montado = useRef(true);

  const recargar = useCallback(async () => {
    try {
      const estudio = await apiEstudioGet();
      // La aprobación se lee antes de dar la vista por lista: sus cifras van en la cabecera.
      let catalogo: ProcessingReleaseCatalog | null = null;
      if (estudio.processing_mode === "independent_siblings") {
        try {
          catalogo = await apiProcessingReleases();
        } catch {
          // Sin aprobación la página sigue: la cabecera vuelve a declarar el hueco de esas cifras.
          catalogo = null;
        }
      }
      if (montado.current) {
        setCatalogo(catalogo);
        setLectura({ fase: "lista", estudio });
      }
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
      if (!nombre || activandoA !== null) return false;
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
        return true;
      } catch (error) {
        if (montado.current) setErrorDeActivar(mensaje(error));
        return false;
      } finally {
        if (montado.current) setActivandoA(null);
      }
    },
    [activandoA, recargar, refresh],
  );

  return { lectura, catalogoDeAprobaciones, recargar, activandoA, errorDeActivar, activar };
}
