/**
 * El caso completo de la última auditoría (`GET /caso`, M4), para el panel
 * `panel=caso&foco=<id_caso>`. Se pide al abrir y al pasar a otro caso; el
 * pedido anterior se cancela.
 */
import { useEffect, useState } from "react";
import { apiCaso, type CasoCompleto } from "../../../api/validacionAuditoria";

export type LecturaDelCaso =
  | { fase: "inactiva" }
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; caso: CasoCompleto };

export function useCaso(idCaso: string | null, baseNombre: string | null): LecturaDelCaso & { reintentar: () => void } {
  const [lectura, setLectura] = useState<LecturaDelCaso>({ fase: "inactiva" });
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (!idCaso) {
      setLectura({ fase: "inactiva" });
      return undefined;
    }
    const control = new AbortController();
    setLectura({ fase: "cargando" });
    apiCaso(idCaso, baseNombre, { signal: control.signal }).then(
      (caso) => { if (!control.signal.aborted) setLectura({ fase: "lista", caso }); },
      (e) => { if (!control.signal.aborted) setLectura({ fase: "error", mensaje: (e as Error).message }); },
    );
    return () => control.abort();
  }, [baseNombre, idCaso, intento]);
  return { ...lectura, reintentar: () => setIntento((n) => n + 1) };
}
