import { describe, expect, it } from "vitest";

import { normalizarPlannerModos } from "../../../api/planner";
import { decidirAterrizajeDeMonitoreo } from "./aterrizajeDeMonitoreo";

// ADR 0122 P2: Monitoreo no pregunta el tipo de estudio; abre en el que fija el
// Planner, y nunca escribe sólo por abrir.

const modos = (perfiles: string[], familias: string[]) =>
  normalizarPlannerModos({ perfiles, calc: {}, monitoreo: { familias, modos: familias }, material: {}, hojas_ruta: {} });

describe("decidirAterrizajeDeMonitoreo", () => {
  it("mientras lee el Planner espera; si no puede leerlo, se comporta como antes", () => {
    expect(decidirAterrizajeDeMonitoreo(null, null, null)).toEqual({ tipo: "cargando" });
    expect(decidirAterrizajeDeMonitoreo(null, "sin red", "territorial")).toEqual({ tipo: "respaldo" });
  });

  it("sin perfiles: el vacío del Planner", () => {
    expect(decidirAterrizajeDeMonitoreo(modos([], []), null, null)).toEqual({ tipo: "sin-perfil" });
  });

  it("la config ya en una familia declarada: abre sin preguntar", () => {
    expect(decidirAterrizajeDeMonitoreo(modos(["aulas"], ["aulas_universitarias"]), null, "aulas_universitarias")).toEqual({ tipo: "abrir" });
  });

  it("una familia declarada que la config no tiene: un solo modo para alinear", () => {
    const d = decidirAterrizajeDeMonitoreo(modos(["territorial"], ["territorial"]), null, null);
    expect(d.tipo).toBe("alinear");
    if (d.tipo === "alinear") expect(d.modo.family).toBe("territorial");
    // Con la config en OTRA familia, también se alinea al Planner.
    expect(decidirAterrizajeDeMonitoreo(modos(["territorial"], ["territorial"]), null, "acreditacion").tipo).toBe("alinear");
  });

  it("varias declaradas: se elige sólo entre ellas", () => {
    const d = decidirAterrizajeDeMonitoreo(modos(["aulas", "telefonico"], ["aulas_universitarias", "telefonico"]), null, null);
    expect(d.tipo).toBe("elegir");
    if (d.tipo === "elegir") expect(d.modos.map((m) => m.family)).toEqual(["aulas_universitarias", "telefonico"]);
  });
});
