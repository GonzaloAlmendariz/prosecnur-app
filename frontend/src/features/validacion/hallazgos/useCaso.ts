/**
 * El caso completo de la última auditoría (`GET /caso`, M4), para el panel
 * `panel=caso&foco=<id_caso>`. Se pide al abrir y al pasar a otro caso; el
 * pedido anterior se cancela. `releer` vuelve a pedirlo sin quitar de la vista
 * el que ya había (después de guardar una corrección); si falla, lo conserva.
 */
import { useEffect, useRef, useState } from "react";
import { apiCaso, type CasoCompleto } from "../../../api/validacionAuditoria";

export type LecturaDelCaso =
  | { fase: "inactiva" }
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; caso: CasoCompleto };

export function useCaso(idCaso: string | null, baseNombre: string | null): LecturaDelCaso & { reintentar: () => void; releer: () => void } {
  const [lectura, setLectura] = useState<LecturaDelCaso>({ fase: "inactiva" });
  const [intento, setIntento] = useState(0);
  const silenciosa = useRef(false);
  useEffect(() => {
    if (!idCaso) {
      setLectura({ fase: "inactiva" });
      return undefined;
    }
    const control = new AbortController();
    const releyendo = silenciosa.current;
    silenciosa.current = false;
    if (!releyendo) setLectura({ fase: "cargando" });
    apiCaso(idCaso, baseNombre, { signal: control.signal }).then(
      (caso) => { if (!control.signal.aborted) setLectura({ fase: "lista", caso }); },
      (e) => { if (!control.signal.aborted && !releyendo) setLectura({ fase: "error", mensaje: (e as Error).message }); },
    );
    return () => control.abort();
  }, [baseNombre, idCaso, intento]);
  return {
    ...lectura,
    reintentar: () => setIntento((n) => n + 1),
    releer: () => { silenciosa.current = true; setIntento((n) => n + 1); },
  };
}
