// Los códigos que una variable trae en la data de una base, para los editores
// que mapean códigos a una escala: segmentos de cruce (ADR 0107) y «Recodificar
// una pregunta» (ADR 0106). Se piden al elegir la variable; la respuesta de
// una variable anterior que llegue tarde se descarta.

import { useEffect, useRef, useState } from "react";
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

/**
 * Lo mismo para varias bases a la vez (`base -> variable de origen`): el editor
 * de un segmento lee los códigos de todas sus bases para «Emparejar todas por
 * etiqueta» y los atajos de «Partir de…», y se los pasa a cada sección. Cada
 * par se pide una vez mientras el editor vive; volver a un origen ya leído no
 * vuelve a pedirlo.
 */
export function useCodigosObservadosPorBase(
  origenes: Readonly<Record<string, string>>,
): Record<string, LecturaCodigosObservados> {
  const pares = Object.entries(origenes).filter(([base, variable]) => base && variable);
  const firma = pares.map(([base, variable]) => `${base}\u0000${variable}`).sort().join("\u0001");
  const [leidas, setLeidas] = useState<Readonly<Record<string, LecturaCodigosObservados>>>({});
  const pedidas = useRef(new Set<string>());
  const leidasRef = useRef(leidas);
  leidasRef.current = leidas;

  useEffect(() => {
    let vivo = true;
    for (const clave of firma ? firma.split("\u0001") : []) {
      if (pedidas.current.has(clave)) continue;
      pedidas.current.add(clave);
      const [base, variable] = clave.split("\u0000");
      getCodigosObservados(base, variable)
        .then((datos) => { if (vivo) setLeidas((p) => ({ ...p, [clave]: { tipo: "listo", datos } })); })
        .catch((e: unknown) => {
          if (vivo) setLeidas((p) => ({ ...p, [clave]: { tipo: "error", mensaje: e instanceof Error ? e.message : String(e) } }));
        });
    }
    // Lo que se pidió y no llegó antes de desmontar (o de cambiar la firma) se vuelve a pedir.
    return () => {
      vivo = false;
      for (const clave of firma ? firma.split("\u0001") : []) {
        if (!leidasRef.current[clave]) pedidas.current.delete(clave);
      }
    };
  }, [firma]);

  const out: Record<string, LecturaCodigosObservados> = {};
  for (const [base, variable] of Object.entries(origenes)) {
    out[base] = base && variable ? leidas[`${base}\u0000${variable}`] ?? { tipo: "cargando" } : INACTIVO;
  }
  return out;
}
