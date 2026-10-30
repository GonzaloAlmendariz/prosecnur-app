import { useEffect, useMemo, useState } from "react";
import { apiHojasRutaContornos } from "../../../../api/hojasRuta";
import { contornosDeCobertura, type ContornoDistrito } from "../lienzo/capas";

// Una promesa por región para toda la sesión de la app: abrir y cerrar una ciudad no vuelve a pedirla.
const cache = new Map<string, Promise<ContornoDistrito[]>>();
function pedir(region: string): Promise<ContornoDistrito[]> {
  let p = cache.get(region);
  if (!p) {
    p = apiHojasRutaContornos(region).then((r) => contornosDeCobertura(r.distritos));
    p.catch(() => cache.delete(region));
    cache.set(region, p);
  }
  return p;
}

/**
 * Contornos de distritos de las regiones pedidas, a medida que llegan. Sólo se cargan las regiones de
 * las ciudades en juego: el lienzo ya no trae 1,67 MB de geometría de golpe.
 */
export function useContornosRegiones(regiones: readonly string[]) {
  const clave = [...regiones].sort().join(",");
  const [listas, setListas] = useState<Record<string, ContornoDistrito[]>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => {
    let vivo = true;
    for (const r of clave ? clave.split(",") : []) {
      pedir(r)
        .then((cs) => vivo && setListas((prev) => (prev[r] ? prev : { ...prev, [r]: cs })))
        .catch((e: unknown) => vivo && setErrores((prev) => ({ ...prev, [r]: e instanceof Error ? e.message : "No se pudo cargar el mapa" })));
    }
    return () => {
      vivo = false;
    };
  }, [clave]);
  const pedidas = useMemo(() => (clave ? clave.split(",") : []), [clave]);
  const contornos = useMemo(() => pedidas.flatMap((r) => listas[r] ?? []), [pedidas, listas]);
  const cargando = pedidas.filter((r) => !listas[r] && !errores[r]);
  return { contornos, cargando, errores };
}
