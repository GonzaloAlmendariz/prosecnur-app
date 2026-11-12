// Lo que dice la franja "Auditando la base" (ADR 0142, etapa P7; `prog` del
// prototipo `validacion-hallazgos-auditando`). El prototipo pide "Regla 60 de
// 97, de la familia Saltos. Empezó hace 14 s." con su porcentaje: el motor de
// la auditoría hoy no publica el avance por regla (PENDIENTE_AVANCE, M6), así
// que la franja usa lo que el trabajo sí trae. Si un día el motor escribe su
// progreso, el mensaje y el porcentaje se muestran sin tocar la vista.

import type { JobProgress } from "../../../api/jobs";

export type FranjaDeAuditoria = {
  detalle: string | null;
  porcentaje: number | null;
};

function tiempoDesde(inicioIso: string | null | undefined, ahora: number): string | null {
  if (!inicioIso) return null;
  const inicio = Date.parse(inicioIso);
  if (!Number.isFinite(inicio)) return null;
  const segundos = Math.max(0, Math.floor((ahora - inicio) / 1000));
  if (segundos < 60) return `Empezó hace ${segundos} s.`;
  const minutos = Math.floor(segundos / 60);
  return `Empezó hace ${minutos} min.`;
}

function porcentajeDe(progreso: Partial<JobProgress>): number | null {
  if (typeof progreso.percent === "number" && Number.isFinite(progreso.percent)) {
    // Al terminar, jobs.R escribe 100 aunque el trabajo no midiera nada: no es avance.
    return progreso.phase === "done" ? null : Math.max(0, Math.min(100, progreso.percent));
  }
  if (typeof progreso.current === "number" && typeof progreso.total === "number" && progreso.total > 0) {
    return Math.max(0, Math.min(100, (progreso.current / progreso.total) * 100));
  }
  return null;
}

export function franjaDeAuditoria(
  inicioIso: string | null | undefined,
  progreso: Partial<JobProgress> | null | undefined,
  ahora: number,
): FranjaDeAuditoria {
  const p = progreso ?? {};
  const mensaje = typeof p.message === "string" ? p.message.trim() : "";
  const desde = tiempoDesde(inicioIso, ahora);
  const detalle = [mensaje ? (/[.!?]$/.test(mensaje) ? mensaje : `${mensaje}.`) : "", desde ?? ""].filter(Boolean).join(" ");
  return { detalle: detalle || null, porcentaje: porcentajeDe(p) };
}

/** Lo que sigue a la vista mientras se audita: el resultado anterior, con su fecha si se conoce. */
export function notaDelResultadoAnterior(fecha: string | null | undefined): string {
  return fecha ? `Abajo sigue el resultado del ${fecha}, solo para leer.` : "Abajo sigue el resultado anterior, solo para leer.";
}
