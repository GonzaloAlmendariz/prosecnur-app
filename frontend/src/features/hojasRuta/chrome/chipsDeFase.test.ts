import { describe, expect, test } from "vitest";
import { chipsDeFase } from "./chipsDeFase";

const ids = (c: ReturnType<typeof chipsDeFase>) => c.map((x) => x.id);
const base = { hayPiloto: true, campoConMuestra: true, evitaPiloto: true };

describe("la etapa es la corrida de Hojas y el Planner propone (P1, ADR 0123 §6)", () => {
  test("el chip de fase abre la otra corrida; sin piloto, Campo real no ofrece nada", () => {
    const c = chipsDeFase({ ...base, fase: "field", etapa: { fase: "field", planner: null, alineada: true } });
    expect(ids(c)).toEqual(["fase"]);
    expect(c[0].accion).toEqual({ tipo: "ver", fase: "pilot" });
    expect(chipsDeFase({ ...base, fase: "pilot", etapa: null })[0].accion).toEqual({ tipo: "ver", fase: "field" });
    expect(chipsDeFase({ ...base, hayPiloto: false, fase: "field", etapa: null })[0].accion).toBeUndefined();
  });

  test("si el Planner propone otra etapa, se ve la diferencia y Alinear la abre", () => {
    const c = chipsDeFase({ ...base, fase: "field", etapa: { fase: "field", planner: "pilot", alineada: false } });
    const alinear = c.find((x) => x.id === "alinear");
    expect(alinear?.accion).toEqual({ tipo: "ver", fase: "pilot" });
    expect(alinear?.detail).toContain("nada cambia sin ese clic");
    // Alineado no hay chip; una propuesta de piloto sin corrida piloto no se puede alinear.
    expect(ids(chipsDeFase({ ...base, fase: "pilot", etapa: { fase: "pilot", planner: "pilot", alineada: true } }))).toEqual(["fase"]);
    expect(ids(chipsDeFase({ ...base, hayPiloto: false, fase: "field", etapa: { fase: "field", planner: "pilot", alineada: false } }))).toEqual(["fase"]);
  });

  test("un planner que no es una fase (el `{}` de un NULL serializado) no es una propuesta", () => {
    const etapa = { fase: "field" as const, planner: {} as unknown as null, alineada: true };
    expect(ids(chipsDeFase({ ...base, fase: "field", etapa }))).toEqual(["fase"]);
  });

  test("Crear Campo real sólo con piloto y un campo sin muestra ni envío", () => {
    expect(ids(chipsDeFase({ ...base, campoConMuestra: false, fase: "pilot", etapa: null }))).toEqual(["fase", "crear-campo"]);
    expect(ids(chipsDeFase({ ...base, campoConMuestra: true, fase: "pilot", etapa: null }))).toEqual(["fase"]);
    expect(ids(chipsDeFase({ ...base, hayPiloto: false, campoConMuestra: false, fase: "field", etapa: null }))).toEqual(["fase"]);
  });
});
