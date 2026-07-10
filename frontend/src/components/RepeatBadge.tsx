import { Repeat } from "lucide-react";
import { repeatBadgeLabel } from "../lib/repeatIdentity";
import "./repeat-identity.css";

// Badge de identidad de un grupo repeat (ADR 0030 Fase 5).
//
// Marcador semántico transversal en naranja suave (`--pulso-repeat-*`):
// distingue una base hija / estructura repetida de las bases normales, con la
// MISMA apariencia y semántica en Carga y Analítica. Componente compartido
// para no reimplementar el chip por módulo.

type RepeatBadgeProps = {
  /** Nombre del begin_repeat; produce "Repetible · <grupo>". */
  repeatGroup?: string | null;
  /** Variante densa (menos padding) para filas apretadas. */
  compact?: boolean;
  /** Tooltip opcional (p.ej. base madre). */
  title?: string;
  className?: string;
};

export function RepeatBadge({ repeatGroup, compact = false, title, className }: RepeatBadgeProps) {
  const label = repeatBadgeLabel(repeatGroup);
  return (
    <span
      className={`pulso-repeat-badge${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      title={title ?? label}
      data-repeat-badge="true"
    >
      <span className="pulso-repeat-badge-icon" aria-hidden="true">
        <Repeat size={compact ? 11 : 12} />
      </span>
      <span className="pulso-repeat-badge-label">{label}</span>
    </span>
  );
}
