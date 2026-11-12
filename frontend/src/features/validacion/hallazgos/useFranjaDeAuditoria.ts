import { useEffect, useState } from "react";

import type { JobProgress } from "../../../api/jobs";
import { franjaDeAuditoria, type FranjaDeAuditoria } from "./modeloFranjaDeAuditoria";

/** La franja de la auditoría en curso, con el tiempo transcurrido al segundo. */
export function useFranjaDeAuditoria(
  auditando: boolean,
  inicioIso: string | null,
  progreso: Partial<JobProgress> | null | Record<string, never>,
): FranjaDeAuditoria {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!auditando) return undefined;
    setAhora(Date.now());
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(reloj);
  }, [auditando]);
  return franjaDeAuditoria(inicioIso, progreso, ahora);
}
