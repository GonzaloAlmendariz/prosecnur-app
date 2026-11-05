import { ChevronRight } from "../../../../vendor/lucide-react";
import type { GrupoAjustesId } from "./gruposAjustes";
import { useAbrirAjustes } from "./useAjustesDiseno";
import "./ajustes.css";

/**
 * El acceso que queda en una sección cuando su configuración se muda a «Ajustes del diseño» (maqueta
 * aprobada, accesos contextuales): el valor vigente en una línea y «Ajustar ›», que abre la ventana en su
 * grupo (`?panel=ajustes&foco=<grupo>`).
 */
export function AccesoAjustes({ grupo, titulo, valor, accion = "Ajustar" }: { grupo: GrupoAjustesId; titulo: string; valor: string; accion?: "Ajustar" | "Editar" | "Cambiar" }) {
  const { abrir } = useAbrirAjustes();
  return (
    <div className="hr-acceso-ajustes">
      <span className="hr-acceso-ajustes-texto">
        <small>{titulo}</small>
        <b>{valor}</b>
      </span>
      <button type="button" className="hr-acceso-ajustes-boton" onClick={() => abrir(grupo)} aria-label={`${accion} ${titulo.toLowerCase()}`}>
        {accion} <ChevronRight size={13} aria-hidden />
      </button>
    </div>
  );
}
