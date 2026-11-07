import type { ReactNode } from "react";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import "./alert.css";

type Props = {
  kind?: "info" | "warn" | "error";
  children: ReactNode;
  icon?: boolean;
  /**
   * Lo que el aviso deja hacer (6 nov 2026). Va al costado del texto cuando el aviso tiene ancho, y debajo
   * cuando no: antes cada módulo lo resolvía con su propio CSS (Cálculo, Formularios, Material, Gráficos)
   * y el resto dejaba la acción en una fila aparte que alargaba el aviso.
   */
  acciones?: ReactNode;
};

export function Alert({ kind = "info", children, icon = true, acciones }: Props) {
  const Icon = kind === "error" ? CircleAlert : kind === "warn" ? AlertTriangle : Info;
  return (
    <div className={`pulso-alert pulso-alert-${kind}${acciones ? " has-acciones" : ""}`}>
      {icon && <Icon size={16} className="pulso-alert-icon" />}
      <div className="pulso-alert-content">{children}</div>
      {acciones ? <div className="pulso-alert-acciones">{acciones}</div> : null}
    </div>
  );
}
