// =============================================================================
// shell/editorHeaderStatus.ts — el estado que la cabecera del editor anuncia
// =============================================================================
// U10: la cabecera decía «Sin avisos» en verde mientras la tarjeta del mismo
// formulario decía «Lógica: revisión necesaria». Eran dos fuentes: la cabecera
// sólo miraba los diagnósticos del workbook y la tarjeta la publicación que
// devuelve el backend. Aquí se juntan con una precedencia fija:
//
//   1. un diagnóstico de nivel `error` (lo que se arregla en el editor);
//   2. una corrección que el backend exige para publicar;
//   3. un paso pendiente (confirmar la lógica) — aviso, no error;
//   4. avisos e informaciones del workbook;
//   5. la lógica declarada fuera de Prosecnur — neutro, informa dónde quedó;
//   6. «Sin avisos», sólo si no queda nada de lo anterior.
//
// Con la lógica declarada fuera (`external_declared`) la cabecera nunca pide
// revisar la lógica, aunque la publicación cargada sea anterior a declararla.
//
// El backend sigue siendo la autoridad de la publicación: esto sólo decide qué
// se pinta, sin estado propio.
// =============================================================================

import type { XlsformFormPublication } from "../../../api/xlsformEditor";
import type { XlsformFormSource } from "../../../api/multiIntegrado";
import { leerLogicaExterna, type LogicaExterna } from "../../../api/xlsformLogicaExterna";
import { CONSECUENCIA_LOGICA_EXTERNA, rotuloLogicaExterna } from "./logicaExternaModel";
import type { BuilderDiagnostic } from "../types";
import { getFormPublicationView } from "./formPublicationView";

export type EditorHeaderTone = "ok" | "neutral" | "info" | "warn" | "error";

export type EditorHeaderStatus = {
  tone: EditorHeaderTone;
  label: string;
  title: string;
  /** El paso de publicación pendiente que se resuelve revisando la lógica. */
  logicStepPending: boolean;
  /** La lógica y la limpieza se declararon hechas fuera de Prosecnur. */
  logicaExterna: LogicaExterna | null;
  /** Correcciones que el backend exige y que no son diagnósticos locales. */
  publicationErrors: Array<{ id: string; title: string; detail: string; rowIndex?: number }>;
};

/**
 * Red de seguridad: la `publication` llega del índice del backend y puede no
 * estar cargada todavía (recién importado, recién creado). La procedencia del
 * formulario ya dice si la lógica espera confirmación; con eso basta para no
 * anunciar «Sin avisos».
 */
export function sourceLogicPending(source: XlsformFormSource | null | undefined): boolean {
  if (!source) return false;
  if (source.logic_confirmed_at) return false;
  if (leerLogicaExterna(source)) return false;
  return source.logic_status === "pending_manual_confirmation";
}

export function deriveEditorHeaderStatus(
  diagnostics: BuilderDiagnostic[],
  publication: XlsformFormPublication | null | undefined,
  source?: XlsformFormSource | null,
): EditorHeaderStatus {
  const errorCount = diagnostics.filter((d) => d.level === "error").length;
  const warnCount = diagnostics.filter((d) => d.level === "warn").length;
  const infoCount = diagnostics.filter((d) => d.level === "info").length;
  const total = diagnostics.length;

  const view = publication ? getFormPublicationView(publication) : null;
  const blockers = view?.blockers ?? [];
  const logicaExterna = leerLogicaExterna(source);
  const logicStepPending = !logicaExterna
    && (blockers.some((b) => b.kind === "step") || sourceLogicPending(source));
  // Un blocker remoto que ya está como diagnóstico local no se cuenta dos veces.
  const localIds = new Set(diagnostics.map((d) => d.id));
  const publicationErrors = blockers
    .filter((b) => b.kind === "error" && !localIds.has(b.id))
    .map((b) => ({ id: b.id, title: b.title, detail: b.detail, rowIndex: b.rowIndex }));

  const base = { logicStepPending, logicaExterna, publicationErrors };

  if (errorCount > 0) {
    return {
      ...base,
      tone: "error",
      label: `${errorCount} sin resolver`,
      title: `${errorCount} ${errorCount === 1 ? "problema impide" : "problemas impiden"} publicar`,
    };
  }
  if (publicationErrors.length > 0) {
    const n = publicationErrors.length;
    return {
      ...base,
      tone: "error",
      label: n === 1 ? "1 corrección pendiente" : `${n} correcciones pendientes`,
      title: n === 1 ? "Falta 1 corrección para publicar" : `Faltan ${n} correcciones para publicar`,
    };
  }
  if (logicStepPending) {
    return {
      ...base,
      tone: "warn",
      label: "Revisa la lógica",
      title: "Falta confirmar la lógica para publicar una revisión",
    };
  }
  if (warnCount > 0 || infoCount > 0) {
    return {
      ...base,
      tone: warnCount > 0 ? "warn" : "info",
      label: `${total} aviso${total === 1 ? "" : "s"}`,
      title: `${total} ${total === 1 ? "sugerencia" : "sugerencias"} (${warnCount} a revisar)`,
    };
  }
  if (logicaExterna) {
    return {
      ...base,
      tone: "neutral",
      label: rotuloLogicaExterna(logicaExterna),
      title: CONSECUENCIA_LOGICA_EXTERNA,
    };
  }
  return {
    ...base,
    tone: "ok",
    label: "Sin avisos",
    title: "Todo en orden — no hay sugerencias ni pasos pendientes",
  };
}
