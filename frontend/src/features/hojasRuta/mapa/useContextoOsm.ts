import { useEffect, useState } from "react";
import { apiHojasRutaContextMap } from "../../../api/hojasRuta";
import { piezasDeContexto, type PiezaContexto } from "./lienzo/contextoOsm";

// Un pedido por distrito por sesión de la página: el contexto OSM no cambia con el estudio.
const cache = new Map<string, Promise<PiezaContexto[]>>();

function delDistrito(ubigeo: string): Promise<PiezaContexto[]> {
  let p = cache.get(ubigeo);
  if (!p) {
    p = apiHojasRutaContextMap(ubigeo)
      .then((r) => piezasDeContexto(r.geojson?.features ?? []))
      .catch(() => {
        cache.delete(ubigeo);
        return [];
      });
    cache.set(ubigeo, p);
  }
  return p;
}

/** P9: los parques, plazas y agua (OSM) de los distritos dados, para la capa de contexto del lienzo. */
export function useContextoOsm(ubigeos: readonly string[]): PiezaContexto[] {
  const [piezas, setPiezas] = useState<PiezaContexto[]>([]);
  const clave = [...ubigeos].sort().join(",");
  useEffect(() => {
    let vivo = true;
    if (!clave) {
      setPiezas([]);
      return;
    }
    void Promise.all(clave.split(",").map(delDistrito)).then((todas) => vivo && setPiezas(todas.flat()));
    return () => {
      vivo = false;
    };
  }, [clave]);
  return piezas;
}
