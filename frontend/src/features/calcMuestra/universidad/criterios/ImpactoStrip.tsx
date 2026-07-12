/**
 * Franja de impacto EN VIVO de la selección de criterios: estudiantes (población
 * alcanzada), docentes distintos y aulas del marco. La cifra grande es la
 * ESTIMACIÓN cliente que reacciona al instante al togglear (patrón "estimación
 * previa"); debajo, la cifra dura del último build como referencia autoritativa.
 * El cálculo vive en el dominio (`computeImpactoMarco`); aquí solo se presenta.
 */
import type { ReactNode } from "react";
import { GraduationCap, School, Users } from "lucide-react";
import type { ImpactoMarco } from "../../dominio";
import { fmtInt } from "../../sharedCore";

function Metric({
  icon,
  label,
  live,
  hard,
  nota,
}: {
  icon: ReactNode;
  label: string;
  live: number | null;
  hard: number | null;
  nota?: string;
}) {
  const bajo = live != null && hard != null && live < hard;
  return (
    <div className="cmv2-crit-impact-metric">
      <span className="cmv2-crit-impact-icon" aria-hidden="true">{icon}</span>
      <div className="cmv2-crit-impact-body">
        <span className="cmv2-crit-impact-label">{label}</span>
        <span className="cmv2-crit-impact-value" data-reduced={bajo}>
          {live != null ? fmtInt(live) : hard != null ? fmtInt(hard) : "—"}
        </span>
        <span className="cmv2-crit-impact-ref">
          {hard != null ? (
            <>
              último marco <strong>{fmtInt(hard)}</strong>
              {bajo ? <> · <span className="cmv2-crit-impact-delta">−{fmtInt(hard - (live ?? 0))}</span></> : null}
            </>
          ) : (
            "sin marco construido"
          )}
          {nota ? <> · {nota}</> : null}
        </span>
      </div>
    </div>
  );
}

export function ImpactoStrip({ impacto }: { impacto: ImpactoMarco }) {
  if (!impacto.hasFrame && impacto.estudiantesHard == null && impacto.aulasHard == null) return null;
  const pend = impacto.pendingAlumnoVars.length;
  return (
    <section className="cmv2-crit-impact" aria-label="Impacto en vivo del marco">
      <Metric
        icon={<Users size={16} aria-hidden="true" />}
        label="Estudiantes (población)"
        live={impacto.estudiantesLive}
        hard={impacto.estudiantesHard}
        nota={pend > 0 ? "edad/condición: solo al reconstruir" : undefined}
      />
      <Metric
        icon={<GraduationCap size={16} aria-hidden="true" />}
        label="Docentes distintos"
        live={impacto.docentesLive}
        hard={impacto.docentesHard}
      />
      <Metric
        icon={<School size={16} aria-hidden="true" />}
        label="Aulas del marco"
        live={impacto.aulasLive}
        hard={impacto.aulasHard}
      />
    </section>
  );
}
