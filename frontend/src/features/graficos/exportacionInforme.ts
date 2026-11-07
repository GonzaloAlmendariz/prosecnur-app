// Exportación del informe (PowerPoint y Word) sobre el kit de entregables (ADR 0133, fase 4): el título de cada
// generación, la causa legible de un fallo con la lámina que lo provocó y los avisos que el motor devuelve con el
// archivo. Puro: lo usa GraficosPage y se prueba sin montar la página.

import type { PlanJson } from "../../api/graficos";
import type { ErrorLegible } from "../../components/entregables/generacionModelo";
import { splitErrorDetail } from "../../components/errorPresentation";
import { humanizeGraficosExportError, type HumanizedError } from "./humanizeExportError";

export type FormatoInforme = "ppt" | "word";

/** Un error ya redactado para el usuario (el compartido no está listo, por ejemplo): no se vuelve a humanizar. */
export class ErrorDeInforme extends Error {
  readonly humanizado: HumanizedError;
  constructor(humanizado: HumanizedError) {
    super(humanizado.message);
    this.name = "ErrorDeInforme";
    this.humanizado = humanizado;
  }
}

export function tituloDeExportacion(formato: FormatoInforme, compartido: boolean): string {
  if (formato === "word") return "Informe en Word";
  return compartido ? "Informe compartido en PowerPoint" : "Informe en PowerPoint";
}

/** Formato del archivo que sale, para el ícono del contenedor mientras se genera o si falla. */
export function formatoDeExportacion(formato: FormatoInforme): "pptx" | "docx" {
  return formato === "word" ? "docx" : "pptx";
}

export type FalloDeInforme = {
  legible: ErrorLegible;
  /** La lámina que detuvo la exportación, si el error la nombra. */
  lamina: { id: string; label: string } | null;
};

/** Causa legible (mensaje y cómo seguir) y código `E_*` de un fallo al exportar, con la lámina si se sabe. */
export function describirFalloDeInforme(e: unknown, plan: PlanJson): FalloDeInforme {
  const h = e instanceof ErrorDeInforme
    ? e.humanizado
    : humanizeGraficosExportError(e instanceof Error ? e.message : String(e ?? ""), plan);
  const crudo = e instanceof Error ? e.message : "";
  return {
    legible: { causa: h.hint ? `${h.message} ${h.hint}` : h.message, codigo: splitErrorDetail(crudo).code },
    lamina: h.slideRef ?? null,
  };
}

/** Arreglos automáticos que el motor aplicó al renderizar (`avisos` del resultado); ausentes en backends viejos. */
export function avisosDelResultado(datos: unknown): string[] {
  const avisos = datos && typeof datos === "object" ? (datos as { avisos?: unknown }).avisos : undefined;
  return Array.isArray(avisos) ? avisos.filter((a): a is string => typeof a === "string" && a.trim() !== "") : [];
}
