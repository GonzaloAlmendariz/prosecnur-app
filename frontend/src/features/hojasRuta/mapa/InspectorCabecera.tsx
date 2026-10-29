import type { ReactNode } from "react";
import type { LucideIcon } from "../../../vendor/lucide-react";

/**
 * Cabecera del inspector del lienzo (brecha B14, artefacto `.hm-ins-cab`): un ícono
 * de 40 px en el tono del módulo, la etiqueta de la sección en versalitas y el título
 * de lo que se está mirando. Una UMP lleva su número en vez del ícono y se tiñe según
 * su estado de revisión.
 */
type Props = {
  icono?: LucideIcon;
  /** En lugar del ícono: un texto corto (el número de la UMP). */
  marca?: string;
  sobre: string;
  titulo: ReactNode;
  estado?: "ok" | "aviso" | "error";
  /** Acciones a la derecha (pasos, cerrar). */
  derecha?: ReactNode;
};

export function InspectorCabecera({ icono: Icono, marca, sobre, titulo, estado = "ok", derecha }: Props) {
  return (
    <header className="hr-ins-cab">
      <span className="hr-ins-icono" data-estado={estado} aria-hidden="true">
        {Icono ? <Icono size={18} strokeWidth={2.2} /> : marca}
      </span>
      <div className="hr-ins-textos">
        <div className="hr-ins-sobre">{sobre}</div>
        <h2 className="hr-ins-titulo">{titulo}</h2>
      </div>
      {derecha ? <div className="hr-ins-derecha">{derecha}</div> : null}
    </header>
  );
}
