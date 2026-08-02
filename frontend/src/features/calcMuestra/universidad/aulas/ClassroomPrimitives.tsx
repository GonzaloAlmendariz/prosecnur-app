import { Database } from "lucide-react";

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
    <div className="cmv2-classroom-empty">
      <span><Icon size={18} /></span>
      <div>
        <strong>{title}</strong>
        <em>{detail}</em>
        {actionLabel && onAction && (
          <button type="button" className="cmv2-ghost" onClick={onAction} disabled={disabled}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
