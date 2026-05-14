import type { ReactNode } from "react";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";

type Props = {
  kind?: "info" | "warn" | "error";
  children: ReactNode;
  icon?: boolean;
};

export function Alert({ kind = "info", children, icon = true }: Props) {
  const Icon = kind === "error" ? CircleAlert : kind === "warn" ? AlertTriangle : Info;
  return (
    <div className={`pulso-alert pulso-alert-${kind}`}>
      {icon && <Icon size={16} className="pulso-alert-icon" />}
      <div className="pulso-alert-content">{children}</div>
    </div>
  );
}
