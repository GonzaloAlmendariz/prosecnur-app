// A7 H3: el 409 de revisión vieja del informe compartido no llega crudo a exportar.

import { describe, expect, it } from "vitest";
import type { PlanJson } from "../../api/graficos";
import { CODIGO_BORRADOR_STALE, ConflictoBorradorError, MENSAJE_CONFLICTO_BORRADOR } from "./conflictoBorrador";
import { humanizeGraficosExportError } from "./humanizeExportError";

const plan = { slides: [] } as unknown as PlanJson;

describe("humanizeGraficosExportError ante el conflicto del borrador compartido", () => {
  it("traduce el STALE del cliente al mensaje de la casa, con el crudo en detalle y sin el código", () => {
    const raw = `El borrador compartido cambió desde que se leyó. · ${CODIGO_BORRADOR_STALE}`;
    const h = humanizeGraficosExportError(raw, plan);

    expect(h.message).toBe(MENSAJE_CONFLICTO_BORRADOR);
    expect(h.message).not.toContain("E_");
    expect(h.hint).toContain("Recargar el informe compartido");
    expect(h.detalle).toBe("El borrador compartido cambió desde que se leyó.");
  });

  it("acepta la forma legada «[E_CODE] …»", () => {
    const h = humanizeGraficosExportError(`[${CODIGO_BORRADOR_STALE}] revisión vieja`, plan);
    expect(h.message).toBe(MENSAJE_CONFLICTO_BORRADOR);
    expect(h.detalle).toBe("revisión vieja");
  });

  it("el error del conflicto ya detectado (export con conflicto pendiente) da el mismo mensaje", () => {
    const h = humanizeGraficosExportError(new ConflictoBorradorError().message, plan);
    expect(h.message).toBe(MENSAJE_CONFLICTO_BORRADOR);
  });

  it("otro STALE (formularios) no se confunde con el del informe compartido", () => {
    const h = humanizeGraficosExportError("El borrador cambió. · E_FORM_DRAFT_STALE", plan);
    expect(h.message).not.toBe(MENSAJE_CONFLICTO_BORRADOR);
  });
});
