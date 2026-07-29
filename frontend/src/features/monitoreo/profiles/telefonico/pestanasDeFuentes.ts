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

import { ContactRound, ListChecks, PlugZap, Table2 } from "../../../../vendor/lucide-react";

/**
 * Cada pestaña se nombra por la pregunta que responde, no por el servicio que
 * trae el dato: «Bases en Sheets» y «SurveyMonkey/Kobo» describían el proveedor,
 * que es de dónde viene y no qué es. El equivalente en Acreditación
 * (`fuentes/pestanas.ts`) ya estaba así y los dos perfiles quedaban desalineados
 * leyendo lo mismo.
 *
 * «barrido» se conserva: es vocabulario del estudio, no de la implementación.
 */
export const ACREDITACION_SOURCE_TABS = [
  { key: "survey", label: "Encuestas", detail: "Quién responde y qué cuenta", icon: ListChecks },
  { key: "sheets", label: "Universo", detail: "La base de cada actor", icon: Table2 },
  { key: "collectors", label: "Recopiladores", detail: "Inclusión y alias", icon: ContactRound },
  { key: "activas", label: "Fuentes activas", detail: "Estado del paquete", icon: PlugZap },
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
