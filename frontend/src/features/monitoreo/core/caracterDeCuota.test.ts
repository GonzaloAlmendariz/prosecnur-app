import { describe, expect, it } from "vitest";
import type { MonitoreoGoal } from "../../../api/monitoreo";
import { caracterEfectivo, estadoDeCuota } from "./caracterDeCuota";
import { caracterDeCuotas, phoneQuotaGoalTotal, phoneQuotaSetCaracter, phoneQuotaUpsertGoal } from "./cuotasTelefonicasComunes";

describe("carácter de una cuota (ADR 0126)", () => {
  it("sin declarar: meta con número (aunque sea 0), referencial sin él", () => {
    expect(caracterEfectivo(null, 0)).toBe("meta");
    expect(caracterEfectivo(undefined, 30)).toBe("meta");
    expect(caracterEfectivo(null, null)).toBe("referencial");
  });

  it("lo declarado manda; una meta sin número queda referencial", () => {
    expect(caracterEfectivo("referencial", 30)).toBe("referencial");
    expect(caracterEfectivo("meta", null)).toBe("referencial");
    expect(caracterEfectivo("otra cosa", 30)).toBe("meta");
  });

  it("estado común igual que el motor", () => {
    expect(estadoDeCuota("meta", 10, 12, 50)).toBe("cumple");
    expect(estadoDeCuota("meta", 10, 4, 50)).toBe("falta");
    expect(estadoDeCuota("meta", 10, 4, 0)).toBe("sin_base");
    expect(estadoDeCuota("referencial", null, 4, 50)).toBe("referencial");
    expect(estadoDeCuota("referencial", null, 4, 0)).toBe("sin_comparador");
  });
});

describe("goals telefónicos con carácter", () => {
  const goals: MonitoreoGoal[] = [
    { filters: { Sede: "SJL" }, meta: 60 },
    { filters: { Sede: "PL" }, meta: 30, caracter: "referencial" },
  ];

  it("una referencial no suma al total de metas", () => {
    expect(phoneQuotaGoalTotal(goals, "Sede")).toBe(60);
  });

  it("cambiar el número conserva el carácter declarado", () => {
    const next = phoneQuotaUpsertGoal(goals, "Sede", "PL", 45);
    expect(next.find((goal) => goal.filters.Sede === "PL")).toMatchObject({ meta: 45, caracter: "referencial" });
  });

  it("declarar referencial una categoría sin goal la guarda con meta 0", () => {
    const next = phoneQuotaSetCaracter(goals, "Sede", "Ate", "referencial");
    expect(next.find((goal) => goal.filters.Sede === "Ate")).toEqual({ filters: { Sede: "Ate" }, meta: 0, caracter: "referencial" });
  });

  it("Modelo recibe lo declarado por categoría y lo guarda", () => {
    const guardados: MonitoreoGoal[][] = [];
    const { caracteres, onCaracter } = caracterDeCuotas(goals, "Sede", (g) => guardados.push(g));
    expect(caracteres).toEqual({ PL: "referencial" });
    onCaracter("SJL", "referencial");
    expect(guardados[0].find((goal) => goal.filters.Sede === "SJL")?.caracter).toBe("referencial");
  });
});
