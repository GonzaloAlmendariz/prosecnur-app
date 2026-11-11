// "Agregar base" (Carga › Bases, R2): un solo recorrido por pasos. Primero el
// origen, después lo que ese origen pide. Qué orígenes se ofrecen depende de la
// relación entre las bases: con una base, los cuatro de la carga simple; con
// bases separadas, los seis de "Bases del estudio"; con una base integrada o
// bases independientes, el asistente de varias fuentes o varias encuestas que
// ya existía, más Monitoreo y el archivo .sav.
//
// El paso vive en la dirección: `panel=agregar-base` elige el origen y
// `panel=agregar-base&foco=<origen>` abre ese origen. Así cada origen se enlaza
// y se audita sin pulsar nada.

import { conNivel } from "../../../../lib/navegacion/direccion";
import type { MultiBaseStrategy } from "../../store";
import { PANEL_AGREGAR_BASE, PANEL_AGREGAR_FUENTE, PANEL_RELACION } from "../../panelesCarga";
import { PANEL_COMPARAR_FUENTES, focoAlCerrar } from "../../fuentes/compararFuentesModel";

export type OrigenDeAlta = "formulario" | "surveymonkey" | "kobo" | "archivos" | "sav" | "monitoreo" | "varias";

export const ORIGENES_DE_ALTA: readonly OrigenDeAlta[] = ["formulario", "surveymonkey", "kobo", "archivos", "sav", "monitoreo", "varias"];

export type OpcionDeOrigen = { id: OrigenDeAlta; rotulo: string; ayuda: string };

const OPCION: Record<Exclude<OrigenDeAlta, "varias">, OpcionDeOrigen> = {
  formulario: { id: "formulario", rotulo: "Formulario publicado", ayuda: "Un formulario de Formularios con sus respuestas" },
  surveymonkey: { id: "surveymonkey", rotulo: "SurveyMonkey", ayuda: "Una encuesta de tu cuenta" },
  kobo: { id: "kobo", rotulo: "KoboToolbox", ayuda: "Un proyecto de tu cuenta" },
  archivos: { id: "archivos", rotulo: "Archivos", ayuda: "Formulario y respuestas desde tu equipo" },
  sav: { id: "sav", rotulo: "Archivo .sav", ayuda: "Solo el .sav, sin formulario" },
  monitoreo: { id: "monitoreo", rotulo: "Monitoreo", ayuda: "El trabajo de campo que sigue el proyecto" },
};

/** El asistente que monta varias bases o fuentes a la vez, según la relación. */
const VARIAS: Record<MultiBaseStrategy, OpcionDeOrigen> = {
  separate: { id: "varias", rotulo: "Varias bases desde archivos", ayuda: "Un formulario y sus respuestas por base" },
  integrated: { id: "varias", rotulo: "Varias fuentes en una base", ayuda: "Formularios compatibles que se leen juntos" },
  independent: { id: "varias", rotulo: "Varias encuestas a la vez", ayuda: "Encuestas de SurveyMonkey con reglas comunes" },
};

export function origenesDeAlta({
  varias,
  estrategia,
  hayPublicados,
}: {
  varias: boolean;
  estrategia: MultiBaseStrategy;
  hayPublicados: boolean;
}): OpcionDeOrigen[] {
  if (!varias) return [OPCION.archivos, OPCION.surveymonkey, OPCION.kobo, OPCION.monitoreo];
  if (estrategia === "separate") {
    return [
      ...(hayPublicados ? [OPCION.formulario] : []),
      OPCION.surveymonkey,
      OPCION.kobo,
      OPCION.archivos,
      OPCION.sav,
      OPCION.monitoreo,
      VARIAS.separate,
    ];
  }
  return [VARIAS[estrategia], OPCION.monitoreo, OPCION.sav];
}

/** El rótulo y el tope del número previsto, según el asistente (topes de `CargaSourcesPlan`). */
export function entradasPrevistasDe(estrategia: MultiBaseStrategy): { rotulo: string; maximo: number } {
  if (estrategia === "integrated") return { rotulo: "Fuentes previstas", maximo: 16 };
  if (estrategia === "independent") return { rotulo: "Bases previstas", maximo: 10 };
  return { rotulo: "Bases previstas", maximo: 16 };
}

/** Un número tecleado, entero y dentro de los topes. */
export function acotarEntradas(valor: number, minimo: number, maximo: number): number {
  if (!Number.isFinite(valor)) return minimo;
  return Math.min(maximo, Math.max(minimo, Math.trunc(valor)));
}

function params(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

/** El origen que pide la dirección, o `null` si el recorrido está en el primer paso o cerrado. */
export function origenDeLaDireccion(search: string): OrigenDeAlta | null {
  const p = params(search);
  if (p.get("panel") !== PANEL_AGREGAR_BASE.id) return null;
  const foco = (p.get("foco") ?? "").trim();
  return (ORIGENES_DE_ALTA as readonly string[]).includes(foco) ? (foco as OrigenDeAlta) : null;
}

/**
 * La base del inspector: el `foco`, salvo cuando un panel lo usa para su propio
 * objeto. El recorrido de alta lo usa para el origen (sin inspector); "Comparar
 * fuentes" para el par `a~b`, y entonces la base es la que estaba enfocada al
 * abrirlo (estado de la navegación), para que el inspector siga abierto debajo.
 */
export function focoDelInspector(panel: string | null, foco: string | null, estado?: unknown): string | null {
  if (panel === PANEL_AGREGAR_BASE.id) return null;
  if (panel === PANEL_COMPARAR_FUENTES.id) return focoAlCerrar(estado);
  return foco?.trim() || null;
}

/** Abre el recorrido de alta, en el primer paso o en un origen. */
export function searchConAgregarBase(search: string, origen: OrigenDeAlta | null): string {
  return conNivel(conNivel(search, "panel", PANEL_AGREGAR_BASE.id), "foco", origen);
}

/** Abre el inspector de una base (o lo cierra con `null`). */
export function searchConInspector(search: string, base: string | null): string {
  const p = params(search);
  const sinPanel = p.get("panel") === PANEL_AGREGAR_BASE.id ? conNivel(search, "panel", null) : search;
  return conNivel(sinPanel, "foco", base);
}

/** Cierra un panel que usa `foco` para su propio objeto (el origen del alta). */
export function searchSinPanelNiFoco(search: string): string {
  return conNivel(conNivel(search, "panel", null), "foco", null);
}

/** Abre "Agregar una fuente" para una base; el inspector de esa base queda debajo. */
export function searchConAgregarFuente(search: string, base: string): string {
  return conNivel(conNivel(search, "panel", PANEL_AGREGAR_FUENTE.id), "foco", base);
}

/** Abre la relación entre las bases sin tocar la base enfocada. */
export function searchConRelacion(search: string): string {
  return conNivel(search, "panel", PANEL_RELACION.id);
}
