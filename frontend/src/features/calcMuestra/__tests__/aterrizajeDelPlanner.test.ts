import { describe, expect, it } from "vitest";

import { normalizarPlannerModos } from "../../../api/planner";
import { decidirAterrizaje } from "../AterrizajeDelPlanner";

// ADR 0122 P2: Cálculo de muestra ya no pregunta el tipo de estudio; lo lee
// del perfil declarado en el Planner.

const modos = (calc: Record<string, unknown>) => normalizarPlannerModos({ perfiles: [], calc, monitoreo: {}, material: {}, hojas_ruta: {} });

describe("decidirAterrizaje", () => {
  it("mientras carga no decide nada", () => {
    expect(decidirAterrizaje(null, "sin_definir", false)).toEqual({ tipo: "cargando" });
    expect(decidirAterrizaje(null, "sin_definir", false, "sin red")).toEqual({ tipo: "error", mensaje: "sin red" });
  });

  it("sin perfil: el vacío del Planner; con la muestra del cliente, lo dice", () => {
    expect(decidirAterrizaje(modos({}), "sin_definir", false).tipo).toBe("sin-perfil");
    expect(decidirAterrizaje(modos({ del_cliente: ["telefonico"] }), "sin_definir", false))
      .toEqual({ tipo: "del-cliente", perfiles: ["telefonico"] });
  });

  it("con un perfil y sin escenario: empezar en su modo, sin elegir", () => {
    expect(decidirAterrizaje(modos({ modo: "opinion-universitaria", perfil: "aulas" }), "sin_definir", false))
      .toMatchObject({ tipo: "empezar", desk: "opinion_universitaria" });
  });

  it("con un escenario de otro modo pide cambiar; del mismo, está al día", () => {
    const m = modos({ modo: "acreditacion", perfil: "acreditacion" });
    expect(decidirAterrizaje(m, "opinion_universitaria", true)).toMatchObject({ tipo: "cambiar", desk: "acreditacion" });
    expect(decidirAterrizaje(m, "acreditacion", true)).toEqual({ tipo: "al-dia", desk: "acreditacion" });
  });
});
