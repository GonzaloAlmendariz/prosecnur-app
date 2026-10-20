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
import "./nombreUnico.css";

type Props = {
  campana: CampanaMaterial;
  acciones: readonly AccionDeCampana[];
  onAccion: (accion: IdDeAccion, campana: CampanaMaterial) => void;
  /** Actor o asunto: distingue a la campaña abierta de otra del mismo nombre (F1). */
  subtitulo?: string;
};

export function CabeceraDeCampana({ campana, acciones, onAccion, subtitulo = "" }: Props) {
  const Icono = ICONO_DEL_TIPO[campana.tipo];
  return (
    <nav className="rec-campana-cabecera" aria-label="Campaña abierta">
      <Link className="rec-campana-volver" to="/material-campo">
        <ArrowLeft size={14} aria-hidden /> <span className="rec-campana-volver-rotulo">Campañas</span>
      </Link>
      <span className="rec-campana-cabecera-sep" aria-hidden>/</span>
      <Icono size={14} aria-hidden />
      <span className="rec-campana-cabecera-nombre" title={`${ROTULO_DEL_TIPO[campana.tipo]} · ${campana.name}`}>
        {campana.name}
      </span>
      {subtitulo ? <span className="rec-campana-cabecera-sub" title={subtitulo}>{subtitulo}</span> : null}
      <MenuDeCampana campana={campana} acciones={acciones} onAccion={onAccion} subtitulo={subtitulo} />
    </nav>
  );
}
