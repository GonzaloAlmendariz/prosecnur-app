import { Database } from "lucide-react";

import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PulsoButton } from "../../../../components/PulsoButton";

export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cmv2-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ClassroomEmptyState({
  icon: Icon,
  title,
  detail,
  actionLabel,
  onAction,
  disabled,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <EstadoVacio
      tamano="normal"
      icono={<Icon size={18} aria-hidden="true" />}
      titulo={title}
      descripcion={detail}
      accion={actionLabel && onAction ? (
        <PulsoButton variant="secondary" size="sm" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </PulsoButton>
      ) : undefined}
    />
  );
}
