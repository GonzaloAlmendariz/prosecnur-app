// Escribir la dirección de una campaña con los escritores de la gramática
// (`conNivel`, `conCampana`): nunca a mano.

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { conCampana, conNivel } from "../../../lib/navegacion/direccion";
import type { DireccionDeCampanas } from "./redirecciones";

export const RUTA_MATERIAL_CAMPO = "/material-campo";

const NIVELES = ["seccion", "pestana", "panel", "foco"] as const;

/**
 * El `search` con los seis params de campañas reemplazados; el resto se
 * conserva. El alcance va junto al modo: `?modo=correo&campana=correo.x&…`.
 */
export function searchDeCampanas(search: string, direccion: DireccionDeCampanas): string {
  // Se quitan primero los seis para que el orden sea siempre el de la gramática.
  let out = conCampana(conNivel(search, "modo", null), null);
  for (const nivel of NIVELES) out = conNivel(out, nivel, null);
  out = conNivel(out, "modo", direccion.modo || null);
  out = conCampana(out, direccion.campana || null);
  for (const nivel of NIVELES) out = conNivel(out, nivel, direccion[nivel] || null);
  return out;
}

/** Donde aterriza una campaña al abrirla desde la lista. */
export function direccionDeApertura(campana: Pick<CampanaMaterial, "id" | "tipo">): DireccionDeCampanas {
  return campana.tipo === "correo"
    ? { modo: "correo", campana: campana.id, seccion: "correo", pestana: "editor" }
    : { modo: campana.tipo, campana: campana.id, seccion: "unidades", pestana: "lista" };
}

export function hrefDeCampana(campana: Pick<CampanaMaterial, "id" | "tipo">): string {
  return `${RUTA_MATERIAL_CAMPO}${searchDeCampanas("", direccionDeApertura(campana))}`;
}
