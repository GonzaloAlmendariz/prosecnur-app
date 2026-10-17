import { useCallback, useEffect, useRef, useState } from "react";

import { apiRecopiladoresOrigen, type CollectionOrigen } from "../../api/recopiladores";

/**
 * Carga de `GET /api/recopiladores/origen?nivel=diferencias`.
 *
 * Una sola máquina de estados. Se relee cuando cambia la revisión del estado
 * (rehacer el plan la sube) y cuando el diálogo pide reponerse de un 409 de
 * origen. Al releer conserva lo último leído: la pestaña no parpadea a vacío.
 */
export type CargaDelOrigen =
  | { estado: "cargando"; origen: CollectionOrigen | null }
  | { estado: "listo"; origen: CollectionOrigen }
  | { estado: "error"; mensaje: string; origen: CollectionOrigen | null };

export function useOrigen(stateRevision: number | null): {
  carga: CargaDelOrigen;
  recargar: () => Promise<void>;
} {
  const [carga, setCarga] = useState<CargaDelOrigen>({ estado: "cargando", origen: null });
  // La última petición manda: una respuesta vieja no pisa a una nueva.
  const turno = useRef(0);

  const recargar = useCallback(async () => {
    turno.current += 1;
    const mio = turno.current;
    setCarga((previa) => ({ estado: "cargando", origen: previa.origen }));
    try {
      const origen = await apiRecopiladoresOrigen("diferencias");
      if (mio === turno.current) setCarga({ estado: "listo", origen });
    } catch (cause) {
      if (mio !== turno.current) return;
      setCarga((previa) => ({
        estado: "error",
        mensaje: cause instanceof Error ? cause.message : "No se pudo leer el origen de las unidades.",
        origen: previa.origen,
      }));
    }
  }, []);

  useEffect(() => { void recargar(); }, [recargar, stateRevision]);

  return { carga, recargar };
}
