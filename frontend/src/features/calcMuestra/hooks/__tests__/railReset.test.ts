import { describe, expect, it } from "vitest";
import { debeResetearRailSection } from "../railReset";

describe("debeResetearRailSection — F9 (bug QA #4)", () => {
  it("mesa sin cambio real → NO resetea (flip transitorio de recovery tras un job)", () => {
    // Escenario del bug: al terminar un job, aulasState pasa por null y
    // recoveredAulasDesk flipea op_uni → null → op_uni; la mesa NO cambió.
    expect(
      debeResetearRailSection({
        prevDesk: "opinion_universitaria",
        desk: "opinion_universitaria",
        recoveredAulasDesk: null,
        deskOverride: "opinion_universitaria",
      }),
    ).toBe(false);
  });

  it("override vigente oculta la mesa por un flip (desk ≠ override) → NO resetea", () => {
    // Mesa solo-recovery (inferredDesk sin_definir): el flip de aulasState
    // hace caer desk a sin_definir aunque la mesa elegida siga siendo la
    // override. No hay cambio de mesa del usuario.
    expect(
      debeResetearRailSection({
        prevDesk: "opinion_universitaria",
        desk: "sin_definir",
        recoveredAulasDesk: null,
        deskOverride: "opinion_universitaria",
      }),
    ).toBe(false);
  });

  it("mesa recuperada activa → NO resetea (la sección la fija el flujo de recovery)", () => {
    expect(
      debeResetearRailSection({
        prevDesk: "sin_definir",
        desk: "opinion_universitaria",
        recoveredAulasDesk: "opinion_universitaria",
        deskOverride: "opinion_universitaria",
      }),
    ).toBe(false);
  });

  it("cambio real de mesa sin recovery → SÍ resetea", () => {
    expect(
      debeResetearRailSection({
        prevDesk: "sin_definir",
        desk: "marco_disponible",
        recoveredAulasDesk: null,
        deskOverride: null,
      }),
    ).toBe(true);
  });

  it("primer render (prev null) → SÍ resetea a la sección por defecto", () => {
    expect(
      debeResetearRailSection({
        prevDesk: null,
        desk: "opinion_universitaria",
        recoveredAulasDesk: null,
        deskOverride: null,
      }),
    ).toBe(true);
  });

  it("abrir/cerrar el chooser (desk ↔ sin_definir sin override) → SÍ resetea, como antes", () => {
    expect(
      debeResetearRailSection({
        prevDesk: "opinion_universitaria",
        desk: "sin_definir",
        recoveredAulasDesk: null,
        deskOverride: null,
      }),
    ).toBe(true);
  });
});
