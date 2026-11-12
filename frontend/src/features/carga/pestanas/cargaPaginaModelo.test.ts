import { describe, expect, it } from "vitest";
import type { CargaReviewPayload, CargaReviewReconciliationExtra } from "../../../api/client";
import { initialIncluidas } from "../reconciliacionModel";
import { reviewReconciliationInfo } from "./cargaPaginaModelo";

const extra = (name: string, cambios: Partial<CargaReviewReconciliationExtra> = {}): CargaReviewReconciliationExtra => ({
  name, fill_pct: 100, n_fill: 1000, kind: "con_datos", incluida: false, decision: "pending", ...cambios,
});

function revision(extras: CargaReviewReconciliationExtra[]): CargaReviewPayload {
  return {
    ok: true,
    base_nombre: null,
    compatibility: { applied: true, ok: true, status: "ok", missing_columns: [], extra_columns: [], matched_columns: 34, expected_columns: 34, n_missing: 0, n_extra: 0, message: "" },
    choice_mapping: { status: "confirmed", pending: false, applied: false, requires_confirmation: false, n_questions: 0, maps: [] },
    reconciliation: {
      extra: extras,
      n_extra: extras.length,
      n_incluidas: extras.filter((e) => e.decision === "include").length,
      n_excluidas: extras.filter((e) => e.decision === "exclude").length,
      n_pendientes: extras.filter((e) => e.decision === "pending").length,
      reviewed: !extras.some((e) => e.decision === "pending"),
    },
    procedencia: null,
    orden_editor: null,
    fuentes: null,
    opciones_sin_leer: null,
    ready: true,
  };
}

const dni = { sospecha: true, causa: "Parece DNI: 8 dígitos en el 100 % de los casos con dato" };

describe("reviewReconciliationInfo", () => {
  // Ítem 32 del checklist de Validación (QA2, 2026-11-12): el diálogo no recibía
  // `personal`, así que no avisaba y el dato personal venía marcado.
  it("lleva al diálogo el aviso de dato personal y la decisión de cada columna", () => {
    const info = reviewReconciliationInfo(revision([extra("dni_c", { personal: dni }), extra("sede", { decision: "exclude" })]));
    expect(info.extra[0].personal).toEqual(dni);
    expect(info.extra[0].decision).toBe("pending");
    expect(info.extra[1].decision).toBe("exclude");
  });

  it("sin decisión previa, el dato personal viene sin marcar en el diálogo", () => {
    const info = reviewReconciliationInfo(revision([extra("dni_c", { fill_pct: 99, personal: dni }), extra("fecha", { fill_pct: 99 })]));
    expect(initialIncluidas(info)).toEqual(["fecha"]);
  });

  // Ítem 34: la decisión guardada vale para las columnas que decidió; una
  // columna nueva sigue la regla del 50 % y del dato personal.
  it("con decisión previa, una columna nueva con dato viene marcada y las decididas conservan su decisión", () => {
    const info = reviewReconciliationInfo(revision([
      extra("fecha", { decision: "include", incluida: true }),
      extra("obs", { decision: "exclude" }),
      extra("distrito_c", { fill_pct: 97 }),
      extra("telefono_c", { fill_pct: 97, personal: dni }),
      extra("p_vieja", { fill_pct: 15 }),
    ]));
    expect(initialIncluidas(info)).toEqual(["fecha", "distrito_c"]);
  });
});
