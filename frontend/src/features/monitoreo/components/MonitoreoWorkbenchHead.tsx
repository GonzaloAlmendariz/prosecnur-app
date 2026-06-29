import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type MonitoreoWorkbenchHeadProps = {
  icon: LucideIcon;
  eyebrow: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  pills?: readonly ReactNode[];
  pillsAriaLabel?: string;
  className?: string;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MonitoreoWorkbenchHead({
  icon: Icon,
  eyebrow,
  title,
  detail,
  pills = [],
  pillsAriaLabel = "Resumen operativo",
  className,
}: MonitoreoWorkbenchHeadProps) {
  const visiblePills = pills.filter((item) => item !== null && item !== undefined && item !== false);

  return (
    <header className={joinClasses("mon-workbench-head", className)}>
      <span aria-hidden="true" className="mon-workbench-head-icon">
        <Icon size={17} />
      </span>
      <div className="mon-workbench-head-copy">
        <span className="pulso-section-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {detail ? <p>{detail}</p> : null}
      </div>
      {visiblePills.length ? (
        <div className="mon-workbench-pills" aria-label={pillsAriaLabel}>
          {visiblePills.map((pill, index) => (
            <span key={index}>{pill}</span>
          ))}
        </div>
      ) : null}
    </header>
  );
}
