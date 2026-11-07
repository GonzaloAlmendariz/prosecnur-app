import { useEffect, useState } from "react";
import { apiHojasRutaGeometria } from "../../../../api/hojasRuta";
import { piezasDeGeometria, type PiezasDistrito } from "../lienzo/piezas";

// Una promesa por distrito para toda la sesión de la app: la primera lectura cuesta segundos en el backend.
const cache = new Map<string, Promise<PiezasDistrito | null>>();

function pedir(ubigeo: string): Promise<PiezasDistrito | null> {
  let p = cache.get(ubigeo);
  if (!p) {
    p = apiHojasRutaGeometria(ubigeo).then((g) => (g.ok ? piezasDeGeometria(g) : null));
    p.catch(() => cache.delete(ubigeo));
    cache.set(ubigeo, p);
  }
  return p;
}

/**
 * Manzanas de UN distrito para la vista más profunda del atlas (revisión del 7 nov 2026, H21): se piden sólo al
 * entrar a él, nunca las de la ciudad entera (Lima tiene 50 distritos y la primera lectura de cada uno tarda).
 */
export function useGeometriaDistrito(ubigeo: string | null) {
  const [estado, setEstado] = useState<{ ubigeo: string; piezas: PiezasDistrito | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!ubigeo) return;
    let vivo = true;
    pedir(ubigeo).then(
      (piezas) => vivo && setEstado({ ubigeo, piezas, error: piezas ? null : "Este distrito no tiene manzanas en la cartografía." }),
      (e: unknown) => vivo && setEstado({ ubigeo, piezas: null, error: e instanceof Error ? e.message : "No se pudieron cargar sus manzanas." }),
    );
    return () => {
      vivo = false;
    };
  }, [ubigeo]);
  const actual = ubigeo && estado?.ubigeo === ubigeo ? estado : null;
  return { piezas: actual?.piezas ?? null, cargando: Boolean(ubigeo && !actual), error: actual?.error ?? null };
}
