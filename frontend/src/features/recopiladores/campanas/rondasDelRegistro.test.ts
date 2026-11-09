import { describe, expect, it } from "vitest";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { agruparPorPublico, procedenciaDe } from "./rondasDelRegistro";

function c(id: string, tipo: CampanaMaterial["tipo"], relacion: CampanaMaterial["relacion"] = null, name = id): CampanaMaterial {
  return { id, tipo, name, archived: false, relacion } as unknown as CampanaMaterial;
}

const CAMPANAS = [
  c("correo.r3", "correo", { publico: "egresados", ronda: 3, viene_de: "telefonica.egresados-r2" }, "Recordatorio"),
  c("telefonica.egresados-r2", "telefonica", { publico: "egresados", ronda: 2, viene_de: null }, "Acreditación telefónica"),
  c("supervision.lote-2", "supervision", { publico: null, ronda: null, viene_de: "telefonica.egresados-r2" }, "Supervisión"),
  c("correo.r1", "correo", { publico: "egresados", ronda: 1, viene_de: null }, "Invitación"),
  c("aulas.principal", "aulas"),
];

describe("el registro por público y ronda (revamp v5)", () => {
  it("ordena las rondas de cada público y cuelga la supervisión tras su telefónica", () => {
    const { grupos, sueltas } = agruparPorPublico(CAMPANAS);
    expect(grupos.map((g) => g.publico)).toEqual(["egresados"]);
    expect(grupos[0].campanas.map((x) => x.id)).toEqual(["correo.r1", "telefonica.egresados-r2", "supervision.lote-2", "correo.r3"]);
    expect(sueltas.map((x) => x.id)).toEqual(["aulas.principal"]);
  });

  it("sin relación todo queda suelto, como antes", () => {
    expect(agruparPorPublico([c("aulas.principal", "aulas")]).grupos).toEqual([]);
  });

  it("dice la ronda y de qué campaña viene", () => {
    const nombre = (id: string) => CAMPANAS.find((x) => x.id === id)?.name ?? null;
    expect(procedenciaDe(CAMPANAS[0], nombre)).toBe('Ronda 3, viene de "Acreditación telefónica"');
    expect(procedenciaDe(CAMPANAS[3], nombre)).toBe("Ronda 1, la primera");
    expect(procedenciaDe(CAMPANAS[2], nombre)).toBe('Viene de "Acreditación telefónica"');
    expect(procedenciaDe(CAMPANAS[4], nombre)).toBeNull();
  });
});
