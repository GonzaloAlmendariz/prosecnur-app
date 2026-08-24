import { describe, expect, it } from "vitest";

import { getFormWorkflowView } from "./formWorkflowView";
import type { XlsformFormPublication } from "../../../api/xlsform";

/**
 * **Un formulario vacío no tiene la lógica lista: no tiene lógica.**
 *
 * `logicNeedsReview` mira si hay bloqueadores de lógica que confirmar, y un
 * instrumento sin preguntas no tiene ninguno — así que el hito salía en verde
 * «Lista · La estructura lógica no tiene revisiones pendientes».
 *
 * Visto en pantalla el 2026-08-23: la tarjeta «Nuevo formulario» decía eso con
 * **0 preguntas y 0 secciones**, tres centímetros encima de su propio aviso
 * «Instrumento sin preguntas sustantivas». Los tres hitos de la tarjeta existen
 * para decir de un vistazo qué falta; uno en verde dice que eso ya está.
 */
const publicacion = (blockers: Array<{ id: string; title?: string }>): XlsformFormPublication =>
  ({ blockers, latest_revision: null } as unknown as XlsformFormPublication);

describe("el hito de lógica con un formulario vacío", () => {
  it("no dice «Lista» cuando no hay preguntas", () => {
    const view = getFormWorkflowView(
      publicacion([{ id: "no_substantive_questions" }]), [], null, false,
    );
    expect(view.logic.label).toBe("Sin preguntas");
    expect(view.logic.tone).toBe("neutral");
    expect(view.logic.detail).not.toContain("no tiene revisiones pendientes");
  });

  it("con preguntas y sin bloqueadores sí está lista", () => {
    const view = getFormWorkflowView(publicacion([]), [], null, false);
    expect(view.logic.label).toBe("Lista");
    expect(view.logic.tone).toBe("success");
  });

  it("y un bloqueador de lógica REAL sigue pidiendo revisión", () => {
    // El id sale de `CONFIRMABLE_LOGIC_BLOCKER_IDS`, no de la imaginación: la
    // primera versión de este test invento «logic_needs_confirmation» y pasó en
    // verde por el motivo equivocado —ningún id desconocido dispara el aviso—.
    const view = getFormWorkflowView(
      publicacion([{ id: "logic_pending_manual_confirmation" }]), [], null, false,
    );
    expect(view.logic.tone).toBe("warning");
    expect(view.logic.label).toBe("Revisión necesaria");
  });

  it("con preguntas ausentes Y lógica pendiente manda el vacío", () => {
    // No hay saltos que revisar si no hay preguntas: pedir una revisión que no
    // se puede hacer es peor que decir qué falta.
    const view = getFormWorkflowView(
      publicacion([
        { id: "no_substantive_questions" },
        { id: "logic_pending_manual_confirmation" },
      ]), [], null, false,
    );
    expect(view.logic.label).toBe("Sin preguntas");
  });
});
