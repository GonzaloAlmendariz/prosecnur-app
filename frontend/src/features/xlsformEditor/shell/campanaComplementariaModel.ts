// Campaña complementaria (ADR 0101): lógica pura de la tarjeta y del diálogo.
//
// La presentación vive en `CampanaComplementariaPanel.tsx`,
// `CampanaComplementariaDialog.tsx` y `CampanasDeclaradas.tsx`; aquí van las
// decisiones que se pueden equivocar —quién admite campañas, qué dice la vista
// previa, cómo se escribe la dirección del diálogo— para probarlas sin React.

import type { XlsformFormSource } from "../../../api/multiIntegrado";
import type { CampanaVistaPrevia } from "../../../api/xlsformCampanas";
import { conNivel } from "../../../lib/navegacion/direccion";
import {
  searchConPanel,
  searchSinPanel,
  type PanelDeclarado,
} from "../../../lib/navegacion/paneles";

/**
 * El diálogo de declarar una campaña. Se abre con
 * `?panel=campana-complementaria&foco=<id del formulario>`.
 */
export const PANEL_CAMPANA_COMPLEMENTARIA: PanelDeclarado = {
  id: "campana-complementaria",
  label: "Agregar campaña complementaria",
  clase: "dialogo",
};

export function searchAbrirCampana(search: string, formId: string): string {
  return conNivel(searchConPanel(search, PANEL_CAMPANA_COMPLEMENTARIA), "foco", formId);
}

export function searchCerrarCampana(search: string): string {
  return conNivel(searchSinPanel(search, PANEL_CAMPANA_COMPLEMENTARIA), "foco", null);
}

/** ID de SurveyMonkey de la encuesta principal, o `null` si no viene de allí. */
export function encuestaPrincipalDe(source: XlsformFormSource | null | undefined): string | null {
  if (!source || source.kind !== "surveymonkey") return null;
  const id = typeof source.survey_id === "string" ? source.survey_id.trim() : "";
  return id || null;
}

/** Sólo un formulario traducido de SurveyMonkey puede tener campañas. */
export function admiteCampana(source: XlsformFormSource | null | undefined): boolean {
  return encuestaPrincipalDe(source) != null;
}

export function resumenCampanas(n: number): string {
  if (n <= 0) return "Sólo la encuesta principal";
  return `Principal + ${n} ${n === 1 ? "campaña" : "campañas"}`;
}

function porcentaje(cobertura: number | null): string {
  if (cobertura == null) return "";
  // Hacia abajo: un 79,6 % no puede mostrarse como «80 %» si se bloquea.
  const decimas = Math.floor(cobertura * 1000) / 10;
  return `${decimas.toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`;
}

export function textoCobertura(cobertura: number | null, coberturaTexto: string): string {
  return coberturaTexto || porcentaje(cobertura);
}

export type LecturaVistaPrevia = {
  titular: string;
  puedeDeclarar: boolean;
  /** Mensaje de bloqueo cuando no es una campaña de este instrumento. */
  bloqueo: string | null;
  /** Bloques de preguntas a listar, sólo los que traen algo (C3). */
  grupos: Array<{ id: "faltan" | "extra" | "ambiguas"; titulo: string; preguntas: CampanaVistaPrevia["faltan"] }>;
};

export function leerVistaPrevia(vista: CampanaVistaPrevia): LecturaVistaPrevia {
  const cobertura = textoCobertura(vista.cobertura, vista.cobertura_texto);
  const titular = `Calzan ${vista.n_emparejadas} de ${vista.n_preguntas_base} preguntas`
    + (cobertura ? ` (${cobertura})` : "");
  const grupos: LecturaVistaPrevia["grupos"] = [];
  if (vista.faltan.length) {
    grupos.push({ id: "faltan", titulo: "Quedarán vacías para las respuestas de esta campaña", preguntas: vista.faltan });
  }
  if (vista.extra.length) {
    grupos.push({ id: "extra", titulo: "No entran al instrumento", preguntas: vista.extra });
  }
  if (vista.ambiguas.length) {
    grupos.push({ id: "ambiguas", titulo: "Ambiguas: no se emparejan", preguntas: vista.ambiguas });
  }
  const bloqueo = vista.instrumento_distinto
    ? "Esta encuesta calza menos del 80 % de las preguntas: no es una campaña de este instrumento. "
      + "Impórtala como un formulario propio y relaciónala con este en Equivalencias."
    : null;
  return { titular, puedeDeclarar: !vista.instrumento_distinto, bloqueo, grupos };
}

/** Por qué una encuesta del catálogo no se puede elegir como campaña. */
export function motivoNoElegible(
  surveyId: string,
  principal: string | null,
  declaradas: readonly string[],
): string | null {
  if (principal && surveyId === principal) return "Es la encuesta principal";
  if (declaradas.includes(surveyId)) return "Ya está declarada";
  return null;
}
