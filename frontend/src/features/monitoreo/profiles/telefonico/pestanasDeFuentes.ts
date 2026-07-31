/**
 * Catálogo de pestañas de Fuentes del perfil Telefónico.
 *
 * Vive fuera del page-file porque ese archivo está congelado a crecimiento, y
 * porque el acceso por clave necesita una función: el rail tomaba las pestañas
 * por posición (`const [survey, sheets, , active] = ...`), y eso se rompe en
 * silencio en cuanto alguien inserta o reordena una entrada —las etiquetas se
 * corren una casilla y siguen renderizando tan campantes—. Ya pasó una vez con
 * el rail de Teléfono en Acreditación.
 */

import {
  MONITOREO_PESTANAS,
  MONITOREO_PESTANAS_COMPATIBILIDAD_TELEFONICO,
} from "../../../../lib/navegacion/catalogos/monitoreo";

/**
 * Cada pestaña se nombra por la pregunta que responde, no por el servicio que
 * trae el dato: «Bases en Sheets» y «SurveyMonkey/Kobo» describían el proveedor,
 * que es de dónde viene y no qué es. El equivalente en Acreditación
 * (`fuentes/pestanas.ts`) ya estaba así y los dos perfiles quedaban desalineados
 * leyendo lo mismo.
 *
 * «barrido» se conserva: es vocabulario del estudio, no de la implementación.
 */
const [activas, sheets, survey] = MONITOREO_PESTANAS.telefonico.fuentes;

// Conserva el orden histórico que todavía consume la rama de compatibilidad
// del clon, pero cada objeto viene del catálogo común. El perfil telefónico
// público usa únicamente `activas`, `sheets` y `survey`.
export const ACREDITACION_SOURCE_TABS = [
  survey,
  sheets,
  MONITOREO_PESTANAS_COMPATIBILIDAD_TELEFONICO.fuentes.collectors,
  activas,
] as const;

export type AcreditacionSourceTab = typeof ACREDITACION_SOURCE_TABS[number]["key"];

export function pestanasDeFuentesPorClave() {
  const porClave = (key: AcreditacionSourceTab) => {
    const tab = ACREDITACION_SOURCE_TABS.find((item) => item.key === key);
    if (!tab) throw new Error(`Pestaña de fuentes desconocida: ${key}`);
    return tab;
  };
  return {
    survey: porClave("survey"),
    sheets: porClave("sheets"),
    collectors: porClave("collectors"),
    activas: porClave("activas"),
  };
}
