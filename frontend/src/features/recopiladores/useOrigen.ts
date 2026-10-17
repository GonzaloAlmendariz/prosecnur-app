import { useCallback, useEffect, useRef, useState } from "react";

import { apiRecopiladoresOrigen, type CollectionOrigen } from "../../api/recopiladores";

/**
 * Carga de `GET /api/recopiladores/origen`, compartida entre Unidades › Lista
 * y Unidades › Origen.
 *
 * Una sola máquina de estados. Se relee cuando cambia la revisión del estado
 * (rehacer el plan la sube) y cuando el diálogo pide reponerse de un 409 de
 * origen. Al releer conserva lo último leído: la pestaña no parpadea a vacío.
 *
 * Las dos pestañas leen la MISMA respuesta: la vigencia es una sola (por
 * huella) en los dos niveles, así que la Lista no pide otra si Origen acaba de
 * leer la de esta revisión. Origen siempre relee al montarse —la fuente vive en
 * otro módulo y pudo cambiar sin tocar esta revisión—; la Lista reusa lo leído
 * hace poco y, si no hay, pide el `resumen`, que no trae listas.
 */
export type CargaDelOrigen =
  | { estado: "cargando"; origen: CollectionOrigen | null }
  | { estado: "listo"; origen: CollectionOrigen }
  | { estado: "error"; mensaje: string; origen: CollectionOrigen | null };

export type NivelDelOrigen = "diferencias" | "resumen";

type OpcionesDelOrigen = {
  nivel?: NivelDelOrigen;
  /** Acepta lo leído para esta revisión hace menos de `VIGENCIA_DE_LO_LEIDO_MS`. */
  reusar?: boolean;
  /** `false` = no leer (p. ej., la Lista sin plan). */
  activo?: boolean;
};

/** Cuánto vale una lectura para quien acepta reusarla. */
export const VIGENCIA_DE_LO_LEIDO_MS = 60_000;

type Leido = { revision: number | null; nivel: NivelDelOrigen; origen: CollectionOrigen; en: number };

let ultimoLeido: Leido | null = null;
const enVuelo = new Map<string, Promise<CollectionOrigen>>();

function claveDe(revision: number | null, nivel: NivelDelOrigen): string {
  return `${revision ?? "-"}:${nivel}`;
}

/** Lo leído para esta revisión que sirve al nivel pedido (`diferencias` sirve a `resumen`). */
export function origenReusable(
  revision: number | null,
  nivel: NivelDelOrigen,
  ahora: number = Date.now(),
): CollectionOrigen | null {
  const leido = ultimoLeido;
  if (!leido || leido.revision !== revision) return null;
  if (ahora - leido.en > VIGENCIA_DE_LO_LEIDO_MS) return null;
  if (nivel === "diferencias" && leido.nivel !== "diferencias") return null;
  return leido.origen;
}

/** Una lectura por revisión y nivel a la vez: dos montajes no duplican el fetch. */
export function leerOrigen(revision: number | null, nivel: NivelDelOrigen): Promise<CollectionOrigen> {
  const clave = claveDe(revision, nivel);
  const pendiente = enVuelo.get(clave);
  if (pendiente) return pendiente;
  const promesa = apiRecopiladoresOrigen(nivel)
    .then((origen) => {
      // Un `resumen` no pisa unas `diferencias` de la misma revisión.
      const previo = ultimoLeido;
      const pisa = !previo || previo.revision !== revision || nivel === "diferencias" || previo.nivel === "resumen";
      if (pisa) ultimoLeido = { revision, nivel, origen, en: Date.now() };
      return origen;
    })
    .finally(() => { enVuelo.delete(clave); });
  enVuelo.set(clave, promesa);
  return promesa;
}

/** Sólo para tests y para el cambio de proyecto. */
export function olvidarOrigenLeido(): void {
  ultimoLeido = null;
  enVuelo.clear();
}

// Otro proyecto no hereda la lectura del anterior (misma guarda que el store).
let origenLastSid: string | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("pulso:session-changed", (ev) => {
    const detail = (ev as CustomEvent).detail as { new_sid?: string } | undefined;
    const newSid = detail?.new_sid;
    if (!newSid) return;
    if (origenLastSid !== null && origenLastSid !== newSid) olvidarOrigenLeido();
    origenLastSid = newSid;
  });
}

export function useOrigen(stateRevision: number | null, opciones: OpcionesDelOrigen = {}): {
  carga: CargaDelOrigen;
  recargar: () => Promise<void>;
} {
  const { nivel = "diferencias", reusar = false, activo = true } = opciones;
  const [carga, setCarga] = useState<CargaDelOrigen>(() => {
    const previo = reusar ? origenReusable(stateRevision, nivel) : null;
    return previo ? { estado: "listo", origen: previo } : { estado: "cargando", origen: null };
  });
  // La última petición manda: una respuesta vieja no pisa a una nueva.
  const turno = useRef(0);

  const leer = useCallback(async (aceptaLoLeido: boolean) => {
    turno.current += 1;
    const mio = turno.current;
    const previo = aceptaLoLeido ? origenReusable(stateRevision, nivel) : null;
    if (previo) {
      setCarga({ estado: "listo", origen: previo });
      return;
    }
    setCarga((anterior) => ({ estado: "cargando", origen: anterior.origen }));
    try {
      const origen = await leerOrigen(stateRevision, nivel);
      if (mio === turno.current) setCarga({ estado: "listo", origen });
    } catch (cause) {
      if (mio !== turno.current) return;
      setCarga((anterior) => ({
        estado: "error",
        mensaje: cause instanceof Error ? cause.message : "No se pudo leer el origen de las unidades.",
        origen: anterior.origen,
      }));
    }
  }, [stateRevision, nivel]);

  const recargar = useCallback(() => leer(false), [leer]);

  useEffect(() => {
    if (!activo) return;
    void leer(reusar);
  }, [leer, reusar, activo]);

  return { carga, recargar };
}
