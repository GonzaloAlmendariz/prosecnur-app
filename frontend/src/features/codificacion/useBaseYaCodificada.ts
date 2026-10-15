// ¿La base de Codificación viene ya codificada? (ADR 0106, punto 3). Si lo está,
// Adaptar dice por qué no se aplica en vez de ofrecer el botón. Si la consulta
// falla (estudio de una sola base, base sin meta), no se bloquea: el backend
// sigue respondiendo 409 si hiciera falta y el error se muestra con su mensaje.

import { useEffect, useState } from "react";
import { getBaseVariables } from "../../api/baseVariables";

export function useBaseYaCodificada(base: string | null | undefined): boolean {
  const [marcada, setMarcada] = useState<{ base: string; ya: boolean } | null>(null);
  const nombre = (base ?? "").trim();
  useEffect(() => {
    if (!nombre) return undefined;
    let vigente = true;
    getBaseVariables(nombre)
      .then((d) => { if (vigente) setMarcada({ base: nombre, ya: d.ya_codificada }); })
      // Sin respuesta no hay marca que respetar; el 409 del backend sigue cubriendo.
      .catch(() => { if (vigente) setMarcada({ base: nombre, ya: false }); });
    return () => { vigente = false; };
  }, [nombre]);
  return Boolean(nombre && marcada?.base === nombre && marcada.ya);
}
