import { describe, expect, it } from "vitest";

import type { AsignacionTerritorial, UnidadesTerritoriales, UnidadTerritorial } from "../../../api/materialTerritorial";
import { armarTablero, inicialesDe, tonoDeCodigo } from "./modeloTablero";

const ump = (unit_id: string, label: string, distrito: string, role: UnidadTerritorial["role"] = "titular"): UnidadTerritorial => ({
  unit_id, label, role, titular_id: role === "titular" ? null : "x", distrito, ubigeo: "", zona: "", manzana: "", rango_inicio: null, rango_fin: null, viviendas: null,
});

const unidades = (units: UnidadTerritorial[]) => ({ kind: "ump", units } as unknown as UnidadesTerritoriales);

const asignacion = (equipo: { codigo: string; nombre: string }[], pares: [string, string][]) => ({
  equipo,
  asignacion: pares.map(([id, codigo]) => ({ id_manzana: id, label: id, role: "titular", codigo, origen: "explicita" })),
} as unknown as AsignacionTerritorial);

describe("tablero de la entrega territorial", () => {
  const units = [
    ump("u10", "UMP 10", "ATE"), ump("u2", "UMP 2", "ATE"), ump("r2", "R 2", "ATE", "reemplazo"),
    ump("u5", "UMP 5", "CHORRILLOS"),
  ];

  it("cuenta sólo titulares y reparte por distrito en orden natural", () => {
    const t = armarTablero(unidades(units), asignacion([{ codigo: "E1", nombre: "Ana Pérez" }], [["u2", "E1"]]));
    expect(t.total).toBe(3);
    expect(t.asignadas).toBe(1);
    expect(t.distritos.map((d) => [d.distrito, d.total, d.asignadas])).toEqual([["ATE", 2, 1], ["CHORRILLOS", 1, 0]]);
    expect(t.distritos[0].umps.map((u) => u.label)).toEqual(["UMP 2", "UMP 10"]);
  });

  it("la UMP asignada lleva el tono y el nombre de su encuestador; la libre, ninguno", () => {
    const t = armarTablero(unidades(units), asignacion([{ codigo: "E1", nombre: "Ana Pérez" }], [["u2", "E1"]]));
    const [dos, diez] = t.distritos[0].umps;
    expect(dos).toMatchObject({ encuestador: "Ana Pérez", tono: tonoDeCodigo("E1") });
    expect(diez).toMatchObject({ encuestador: null, tono: null });
  });

  it("muestra a todo el equipo, primero quien más carga, también quien no tiene UMP", () => {
    const t = armarTablero(
      unidades(units),
      asignacion([{ codigo: "E2", nombre: "Beto Ruiz" }, { codigo: "E1", nombre: "Ana Pérez" }], [["u2", "E1"], ["u5", "E1"]]),
    );
    expect(t.equipo.map((p) => [p.nombre, p.asignadas])).toEqual([["Ana Pérez", 2], ["Beto Ruiz", 0]]);
  });

  it("el tono es estable y cae en la paleta; las iniciales salen del nombre", () => {
    expect(tonoDeCodigo("12345678")).toBe(tonoDeCodigo("12345678"));
    expect(tonoDeCodigo("12345678")).toBeGreaterThanOrEqual(0);
    expect(tonoDeCodigo("12345678")).toBeLessThan(8);
    expect(inicialesDe("María del Pilar Quispe", "E9")).toBe("MQ");
    expect(inicialesDe("", "E09")).toBe("09");
  });

  it("sin asignación ni equipo, el tablero no inventa nada", () => {
    const t = armarTablero(unidades(units), null);
    expect(t).toMatchObject({ total: 3, asignadas: 0, equipo: [] });
  });
});
