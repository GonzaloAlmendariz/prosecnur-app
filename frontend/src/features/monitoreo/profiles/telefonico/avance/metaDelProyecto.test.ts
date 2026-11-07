import { describe, expect, it } from "vitest";
import type { MonitoreoState } from "../../../../../api/client";
import { metaDelProyecto } from "./metaDelProyecto";

const conGoals = (goals: unknown[], objetivo_total: number | null = null) =>
  ({ config: { goals, objetivo_total } } as unknown as MonitoreoState);

describe("metaDelProyecto (ADR 0126 §6)", () => {
  it("sexo y edad declarados no cuentan dos veces la misma muestra", () => {
    const state = conGoals([
      { filters: { Sexo: "Mujer" }, meta: 60 }, { filters: { Sexo: "Hombre" }, meta: 40 },
      { filters: { Edad: "18-29" }, meta: 50 }, { filters: { Edad: "30+" }, meta: 50 },
    ]);
    expect(metaDelProyecto(state)).toBe(100);
  });

  it("las metas por actor y las referenciales no suman", () => {
    const state = conGoals([
      { filters: { Sede: "SJL" }, meta: 60 },
      { filters: { Sede: "SMP" }, meta: 40 },
      { filters: { Sede: "PL" }, meta: 30, caracter: "referencial" },
      { filters: { Actor: "Egresados" }, meta: 100 },
      { filters: { Actor: "Egresados", Sede: "SJL" }, meta: 20 },
    ]);
    expect(metaDelProyecto(state)).toBe(100);
  });

  it("el objetivo total declarado manda", () => {
    expect(metaDelProyecto(conGoals([{ filters: { Sede: "SJL" }, meta: 60 }], 400))).toBe(400);
    expect(metaDelProyecto(conGoals([]))).toBeNull();
  });
});
