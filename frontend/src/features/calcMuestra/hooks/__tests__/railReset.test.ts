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

  describe("aterrizaje con dirección profunda", () => {
    it("no pisa la sección que pidió un enlace (prevDesk null = primer render)", () => {
      // Regresión de la migración a direcciones enlazables: en el aterrizaje
      // `prevDesk` es null, lo que contaba como cambio de mesa, y el default se
      // aplicaba SIEMPRE. Con `?seccion=aulas` en la URL, todo deep-link caía en
      // "Datos" — verificado en la app antes del fix.
      expect(
        debeResetearRailSection({
          prevDesk: null,
          desk: "opinion_universitaria",
          recoveredAulasDesk: null,
          deskOverride: null,
          direccionPideSeccion: true,
        }),
      ).toBe(false);
    });

    it("sin sección en la dirección, el aterrizaje sí cae al default", () => {
      expect(
        debeResetearRailSection({
          prevDesk: null,
          desk: "opinion_universitaria",
          recoveredAulasDesk: null,
          deskOverride: null,
          direccionPideSeccion: false,
        }),
      ).toBe(true);
    });

    it("la mesa pasa de sin_definir a la real al hidratar y NO pisa la sección pedida", () => {
      // El caso que rompía de verdad: en el aterrizaje el desk transiciona
      // sin_definir → opinion_universitaria, que es un cambio de mesa legítimo,
      // y el default se aplicaba después del primer render. Verificado en la
      // app: `?seccion=aulas` acababa en "Datos".
      expect(
        debeResetearRailSection({
          prevDesk: "sin_definir",
          desk: "opinion_universitaria",
          recoveredAulasDesk: null,
          deskOverride: null,
          direccionPideSeccion: true,
        }),
      ).toBe(false);
    });

    it("cambio de mesa con una sección que la nueva no tiene → resetea", () => {
      // `direccionPideSeccion` se calcula contra las secciones de la mesa
      // vigente, así que una sección de la mesa vieja llega aquí como false.
      expect(
        debeResetearRailSection({
          prevDesk: "opinion_universitaria",
          desk: "acreditacion",
          recoveredAulasDesk: null,
          deskOverride: null,
          direccionPideSeccion: false,
        }),
      ).toBe(true);
    });
  });
});
