// Adónde se arregla lo que falta en Seguimiento: los Contactos o los Envíos de
// una campaña de correo. Direcciones canónicas, escritas con la gramática de
// campañas (nunca a mano), y un enlace con piel de botón que navega sin
// recargar la app.

import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { PulsoButtonEnlace } from "../../../components/PulsoButton";
import { ArrowRight } from "../../../vendor/lucide-react";
import { RUTA_MATERIAL_CAMPO, searchDeCampanas } from "../campanas/direccionDeCampanas";
import { idDeCorreo } from "../campanas/modeloRegistro";
import { PANEL_CORREO_ENVIOS } from "../correos/panelesCorreos";

export function hrefDeContactos(campaignId: string): string {
  return `${RUTA_MATERIAL_CAMPO}${searchDeCampanas("", { modo: "correo", campana: idDeCorreo(campaignId), seccion: "correo", pestana: "contactos" })}`;
}

export function hrefDeEnvios(campaignId: string): string {
  return `${RUTA_MATERIAL_CAMPO}${searchDeCampanas("", { modo: "correo", campana: idDeCorreo(campaignId), seccion: "correo", pestana: "editor", panel: PANEL_CORREO_ENVIOS.id })}`;
}

export function IrA({ href, children }: { href: string; children: ReactNode }) {
  const navegar = useNavigate();
  return (
    <PulsoButtonEnlace variant="secondary" size="sm" href={href} onClick={(e) => { e.preventDefault(); navegar(href); }}>
      {children} <ArrowRight size={14} aria-hidden />
    </PulsoButtonEnlace>
  );
}
