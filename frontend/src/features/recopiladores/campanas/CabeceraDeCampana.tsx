// Cabecera de la campaña abierta, en la zona de contexto de la barra del módulo
// (ADR 0111): volver a la lista, qué campaña es y su menú. Es navegación de
// ruta —un enlace a la lista— y no una pestaña.

import { Link } from "react-router-dom";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { ArrowLeft } from "../../../vendor/lucide-react";
import type { AccionDeCampana, IdDeAccion } from "./accionesDeCampana";
import { MenuDeCampana } from "./MenuDeCampana";
import { ROTULO_DEL_TIPO } from "./modeloRegistro";
import { ICONO_DEL_TIPO } from "./TarjetaDeCampana";
import "./campanas.css";

type Props = {
  campana: CampanaMaterial;
  acciones: readonly AccionDeCampana[];
  onAccion: (accion: IdDeAccion, campana: CampanaMaterial) => void;
};

export function CabeceraDeCampana({ campana, acciones, onAccion }: Props) {
  const Icono = ICONO_DEL_TIPO[campana.tipo];
  return (
    <nav className="rec-campana-cabecera" aria-label="Campaña abierta">
      <Link className="rec-campana-volver" to="/material-campo">
        <ArrowLeft size={14} aria-hidden /> Campañas
      </Link>
      <span className="rec-campana-cabecera-sep" aria-hidden>/</span>
      <Icono size={14} aria-hidden />
      <span className="rec-campana-cabecera-nombre" title={`${ROTULO_DEL_TIPO[campana.tipo]} · ${campana.name}`}>
        {campana.name}
      </span>
      <MenuDeCampana campana={campana} acciones={acciones} onAccion={onAccion} />
    </nav>
  );
}
