import { describe, expect, it } from "vitest";

import { filaVisibleEnAgenda } from "./filaVisibleEnAgenda";

/**
 * El caso A de punta a punta en la capa de visibilidad (dictado 2026-09-03:
 * «el otro sale y yo entro en la tarjeta»): el titular siempre se ve —con su
 * Rechazo—, la reserva dormida no, y la despierta sí.
 */
describe("filaVisibleEnAgenda", () => {
  it("el titular siempre entra, rechazado incluido", () => {
    expect(filaVisibleEnAgenda({ sample_role: "titular", sample_status: "rechazo" })).toBe(true);
    expect(filaVisibleEnAgenda({ sample_role: "", sample_status: "" })).toBe(true);
  });

  it("la reserva dormida no se ve — en cualquiera de sus vocabularios", () => {
    for (const estado of ["en reserva 1", "sin_contactar", "SIN CONTACTAR", "", "-", "planificada"]) {
      expect(filaVisibleEnAgenda({ sample_role: "chain_reserve", sample_status: estado }))
        .toBe(false);
    }
  });

  it("la reserva DESPIERTA entra: el relevo agendado es una tarjeta más", () => {
    expect(filaVisibleEnAgenda({ sample_role: "chain_reserve", sample_status: "agendada" })).toBe(true);
    expect(filaVisibleEnAgenda({ sample_role: "chain_reserve", sample_status: "en contacto" })).toBe(true);
  });

  it("el banco también: dormido oculto, usado visible (caso C)", () => {
    expect(filaVisibleEnAgenda({ sample_role: "extra_reserve_pool", sample_status: "en reserva 1" })).toBe(false);
    expect(filaVisibleEnAgenda({ sample_role: "extra_reserve_pool", sample_status: "agendada" })).toBe(true);
  });
});
