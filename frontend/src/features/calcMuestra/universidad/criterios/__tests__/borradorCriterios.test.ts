import { describe, expect, it } from "vitest";
import type { CriteriosSeleccionMarco } from "../../../../../api/client";
import { ELEGIBLES_POR_AULA_ID } from "../../../dominio";
import { copiarVariableCriterio, reconciliarBorradorCriterios } from "../borradorCriterios";

const confirmado: CriteriosSeleccionMarco = {
  byVariable: {
    formacion: { mode: "include", categories: ["pregrado"] },
    modalidad: { mode: "include", categories: ["presencial"] },
  },
  courseLevelRanges: { derecho: [[1, 6]] },
  minEligible: { threshold: 15 },
};

const borrador: CriteriosSeleccionMarco = {
  byVariable: {
    formacion: { mode: "include", categories: ["pregrado", "maestria"] },
    modalidad: { mode: "include", categories: ["presencial", "virtual"] },
  },
  courseLevelRanges: { derecho: [[2, 8]] },
  minEligible: { threshold: 20 },
};

describe("borrador de criterios por variable", () => {
  it("confirma una variable sin arrastrar cambios de otra", () => {
    const next = copiarVariableCriterio(confirmado, borrador, "formacion", "flat");
    expect(next.byVariable.formacion.categories).toEqual(["pregrado", "maestria"]);
    expect(next.byVariable.modalidad.categories).toEqual(["presencial"]);
    expect(next.minEligible?.threshold).toBe(15);
  });

  it("trata el rango y el umbral como criterios confirmables independientes", () => {
    const conRango = copiarVariableCriterio(confirmado, borrador, "nivel_curso", "range");
    expect(conRango.courseLevelRanges?.derecho).toEqual([[2, 8]]);
    expect(conRango.minEligible?.threshold).toBe(15);

    const conUmbral = copiarVariableCriterio(
      confirmado,
      borrador,
      ELEGIBLES_POR_AULA_ID,
      "minEligible",
    );
    expect(conUmbral.minEligible?.threshold).toBe(20);
    expect(conUmbral.courseLevelRanges?.derecho).toEqual([[1, 6]]);
  });

  it("reconcilia una actualización externa preservando solo los borradores pendientes", () => {
    const externo: CriteriosSeleccionMarco = {
      ...confirmado,
      byVariable: {
        ...confirmado.byVariable,
        modalidad: { mode: "include", categories: ["semipresencial"] },
      },
    };
    const next = reconciliarBorradorCriterios(
      externo,
      borrador,
      new Set(["formacion"]),
      new Map([["formacion", "flat"]]),
    );
    expect(next.byVariable.formacion.categories).toEqual(["pregrado", "maestria"]);
    expect(next.byVariable.modalidad.categories).toEqual(["semipresencial"]);
  });
});
