import type { ReactNode } from "react";

export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="dash-empty-state">
      {icon && (
        <div className="dash-empty-state-icon">{icon}</div>
      )}
      <div className="dash-empty-state-title">{title}</div>
      {subtitle && <div className="dash-empty-state-subtitle">{subtitle}</div>}
    </div>
  );
}
