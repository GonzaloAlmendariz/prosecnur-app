// Los códigos que una variable trae en la data de una base, para los editores
// que mapean códigos a una escala: segmentos de cruce (ADR 0107) y «Recodificar
// una pregunta» (ADR 0106). Se piden al elegir la variable; la respuesta de
// una variable anterior que llegue tarde se descarta.

import { useEffect, useState } from "react";
import { getCodigosObservados, type CodigosObservados } from "../../api/codigosObservados";

export type LecturaCodigosObservados =
  | { tipo: "inactivo" }
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: CodigosObservados };

type Estado = { clave: string; lectura: LecturaCodigosObservados };

const INACTIVO: LecturaCodigosObservados = { tipo: "inactivo" };

export function useCodigosObservados(base: string, variable: string): LecturaCodigosObservados {
  const clave = base && variable ? `${base}\u0000${variable}` : "";
  const [estado, setEstado] = useState<Estado>({ clave: "", lectura: INACTIVO });

  useEffect(() => {
    if (!clave) return undefined;
    let vivo = true;
    setEstado({ clave, lectura: { tipo: "cargando" } });
    getCodigosObservados(base, variable)
      .then((datos) => { if (vivo) setEstado({ clave, lectura: { tipo: "listo", datos } }); })
      .catch((e: unknown) => {
        if (vivo) setEstado({ clave, lectura: { tipo: "error", mensaje: e instanceof Error ? e.message : String(e) } });
      });
    return () => { vivo = false; };
  }, [clave, base, variable]);

  if (!clave) return INACTIVO;
  // Entre el cambio de variable y el efecto, lo leído es de la anterior.
  return estado.clave === clave ? estado.lectura : { tipo: "cargando" };
}

/** Los observados si ya llegaron; `null` mientras leen o si fallaron. */
export function observadosListos(l: LecturaCodigosObservados): CodigosObservados | null {
  return l.tipo === "listo" ? l.datos : null;
}
