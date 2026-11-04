import { describe, expect, it } from "vitest";

import { normalizarPlannerModos } from "../../api/planner";
import { diferenciaDeTipo } from "./diferenciaDeTipo";

const territorial = (origen: "declarado" | "deducido") => normalizarPlannerModos({
  perfiles: ["territorial"],
  calc: { modo: "territorial-handoff", perfil: "territorial", macro_familia: "territorial", del_cliente: [] },
  origen,
});

describe("diferenciaDeTipo (hallazgo 11 de la auditoría visual)", () => {
  it("un estudio territorial con un escenario de aulas guardado nombra las dos fuentes", () => {
    const d = diferenciaDeTipo(territorial("deducido"), "opinion_universitaria", true);
    expect(d).toMatchObject({ desk: "territorial_handoff", tipo: "Territorial presencial", origen: "deducido" });
    expect(d?.actual).not.toBe(d?.titulo);
  });

  it("dice si el tipo lo declaró la ficha", () => {
    expect(diferenciaDeTipo(territorial("declarado"), "opinion_universitaria", true)?.origen).toBe("declarado");
  });

  it("sin diferencia, sin escenario guardado o sin tipo no avisa", () => {
    expect(diferenciaDeTipo(territorial("declarado"), "territorial_handoff", true)).toBeNull();
    expect(diferenciaDeTipo(territorial("declarado"), "opinion_universitaria", false)).toBeNull();
    expect(diferenciaDeTipo(normalizarPlannerModos({ perfiles: [], calc: {} }), "opinion_universitaria", true)).toBeNull();
    expect(diferenciaDeTipo(null, "opinion_universitaria", true)).toBeNull();
  });
});
