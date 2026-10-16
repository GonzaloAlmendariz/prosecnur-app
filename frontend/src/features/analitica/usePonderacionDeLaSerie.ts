// Lee la ponderación declarada de la base activa y arma la de toda la serie
// (las demás bases, «sin leer»: ver `api/ponderacionBases.ts`). Relee cuando
// cambia la base activa.

import { useEffect, useMemo, useState } from "react";
import { getPonderacionBaseActiva, type PonderacionDeBase } from "../../api/ponderacionBases";
import { useOptionalSession } from "../../lib/SessionContext";
import { ponderacionDeLaSerie, type PonderacionEnSerie } from "./ponderacionSerieModel";

export type LecturaPonderacionSerie =
  | { tipo: "cargando" }
  | { tipo: "listo"; serie: PonderacionEnSerie[] };

export function usePonderacionDeLaSerie(bases: readonly string[]): LecturaPonderacionSerie {
  const activa = useOptionalSession()?.state?.active_base ?? null;
  // `null` mientras lee; `false` si la lectura falló (ninguna base se supone).
  const [lectura, setLectura] = useState<PonderacionDeBase | false | null>(null);

  useEffect(() => {
    let vivo = true;
    const leer = () => {
      getPonderacionBaseActiva()
        .then((p) => { if (vivo) setLectura(p); })
        .catch(() => { if (vivo) setLectura(false); });
    };
    leer();
    window.addEventListener("pulso:active-base-changed", leer);
    return () => {
      vivo = false;
      window.removeEventListener("pulso:active-base-changed", leer);
    };
  }, [activa]);

  const clave = bases.join("|");
  return useMemo((): LecturaPonderacionSerie => {
    if (lectura === null) return { tipo: "cargando" };
    const lista = clave ? clave.split("|") : [];
    return { tipo: "listo", serie: ponderacionDeLaSerie(lista, activa, lectura || null) };
  }, [lectura, clave, activa]);
}
