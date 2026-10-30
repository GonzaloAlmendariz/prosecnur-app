import { useEffect, useState } from "react";
import type { MonitoreoAssistedReviewCandidate } from "../../../../../../api/client";
import { apiMonitoreoAcreditacionAssignmentPool } from "../../../../../../api/client";
import { getSession, registerMonitoreoMutationInvalidator } from "../../../../../../api/core";
import { normalizarPersonasAsignables } from "../../../../internalQueries";

/**
 * Personas del padrón a las que se puede asignar una respuesta, por público.
 * Ya no viajan con `queries_summary` (4.6 MB a 45 mil personas): el panel del
 * caso las pide al abrirse y quedan en caché por sesión y `assignment_pool_key`
 * (dos proyectos suelen tener públicos homónimos, como «docentes»). Toda
 * mutación de Monitoreo (sincronizar, guardar configuración) vacía la caché, y
 * el corte nuevo que llega después las vuelve a pedir.
 */
export type PersonasAsignables =
  | { estado: "sin-publico"; personas: MonitoreoAssistedReviewCandidate[] }
  | { estado: "cargando"; personas: MonitoreoAssistedReviewCandidate[] }
  | { estado: "listo"; personas: MonitoreoAssistedReviewCandidate[] }
  | { estado: "error"; personas: MonitoreoAssistedReviewCandidate[]; mensaje: string };

const NINGUNA: MonitoreoAssistedReviewCandidate[] = [];
const PREPARANDO = "Monitoreo está recalculando el cruce del corte; el padrón aparece cuando termine.";

const cache = new Map<string, Promise<MonitoreoAssistedReviewCandidate[]>>();
registerMonitoreoMutationInvalidator(() => cache.clear());
if (typeof window !== "undefined") {
  window.addEventListener("pulso:session-changed", () => cache.clear());
  window.addEventListener("pulso:project-closed", () => cache.clear());
}

/** Sólo para tests: la caché es de módulo y sobrevive entre casos. */
export function vaciarPersonasAsignables() {
  cache.clear();
}

function pedir(clave: string): Promise<MonitoreoAssistedReviewCandidate[]> {
  const llave = `${getSession() ?? ""}\u0000${clave}`;
  const previa = cache.get(llave);
  if (previa) return previa;
  const pedido = apiMonitoreoAcreditacionAssignmentPool(clave).then((respuesta) => {
    if (respuesta.preparando) throw new Error(PREPARANDO);
    return normalizarPersonasAsignables(respuesta.personas);
  });
  cache.set(llave, pedido);
  // Un fallo (o «preparando») no se guarda: el siguiente caso lo reintenta.
  pedido.catch(() => {
    if (cache.get(llave) === pedido) cache.delete(llave);
  });
  return pedido;
}

/**
 * `corte` es el objeto de consultas que pinta la página: cuando llega uno
 * nuevo se vuelve a leer la caché (que sólo pide de nuevo si una mutación la
 * vació). `activo` en falso no pide nada: el panel sin decisión no asigna.
 */
export function usePersonasAsignables(clave: string | undefined, corte: object, activo = true): PersonasAsignables {
  const [resultado, setResultado] = useState<{ clave: string; valor: PersonasAsignables } | null>(null);
  const pedirAhora = Boolean(activo && clave);
  useEffect(() => {
    if (!pedirAhora || !clave) return;
    let vigente = true;
    pedir(clave).then(
      (personas) => { if (vigente) setResultado({ clave, valor: { estado: "listo", personas } }); },
      (error: unknown) => {
        if (!vigente) return;
        const mensaje = error instanceof Error && error.message ? error.message : "No se pudo leer el padrón de este público.";
        setResultado({ clave, valor: { estado: "error", personas: NINGUNA, mensaje } });
      },
    );
    return () => { vigente = false; };
  }, [clave, corte, pedirAhora]);
  if (!pedirAhora) return { estado: "sin-publico", personas: NINGUNA };
  // Con un corte nuevo se sigue mostrando la lista del público mientras se relee.
  if (resultado && resultado.clave === clave) return resultado.valor;
  return { estado: "cargando", personas: NINGUNA };
}
