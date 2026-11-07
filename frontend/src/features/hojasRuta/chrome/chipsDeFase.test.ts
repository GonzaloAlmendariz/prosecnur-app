import { describe, expect, test } from "vitest";
import { chipsDeFase } from "./chipsDeFase";

const ids = (c: ReturnType<typeof chipsDeFase>) => c.map((x) => x.id);
const base = { hayPiloto: true, campoConMuestra: true, evitaPiloto: true };

describe("la etapa es la corrida de Hojas (P1; desde el ADR 0124 sin propuesta del Planner)", () => {
  test("el chip de fase abre la otra corrida; sin piloto, Campo real no ofrece nada", () => {
    const c = chipsDeFase({ ...base, fase: "field" });
    expect(ids(c)).toEqual(["fase"]);
    expect(c[0].accion).toEqual({ tipo: "ver", fase: "pilot" });
    expect(chipsDeFase({ ...base, fase: "pilot" })[0].accion).toEqual({ tipo: "ver", fase: "field" });
    expect(chipsDeFase({ ...base, hayPiloto: false, fase: "field" })[0].accion).toBeUndefined();
  });

  test("Crear Campo real sólo con piloto y un campo sin muestra ni envío", () => {
    expect(ids(chipsDeFase({ ...base, campoConMuestra: false, fase: "pilot" }))).toEqual(["fase", "crear-campo"]);
    expect(ids(chipsDeFase({ ...base, campoConMuestra: true, fase: "pilot" }))).toEqual(["fase"]);
    expect(ids(chipsDeFase({ ...base, hayPiloto: false, campoConMuestra: false, fase: "field" }))).toEqual(["fase"]);
  });
});
