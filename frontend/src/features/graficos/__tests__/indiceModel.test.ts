import { describe, expect, test } from "vitest";
import {
  INDICE_ICONOS_DEFAULT,
  moverSeccion,
  parseIndicePayload,
  serializeIndiceModel,
} from "../indiceModel";

describe("indiceModel (B47/G-5)", () => {
  test("parsea payload plano a jerarquia con iconos por orden", () => {
    const model = parseIndicePayload({
      secciones: "Objetivo\nMetodología\nResultados",
      iconos_focos: "target-arrow\nclipboard-list",
      subindices: "Resultados: Identidad institucional\nResultados: Servicios",
      subtemas: "",
    });
    expect(model.secciones).toHaveLength(3);
    expect(model.secciones[0]).toMatchObject({ titulo: "Objetivo", icono: "target-arrow" });
    expect(model.secciones[2].icono).toBeNull();
    expect(model.secciones[2].subtemas).toEqual(["Identidad institucional", "Servicios"]);
  });

  test("subtemas sueltos cuelgan de la ultima seccion sin duplicar los asociados", () => {
    const model = parseIndicePayload({
      secciones: "A\nB",
      subindices: "B: uno",
      subtemas: "uno\ndos",
    });
    expect(model.secciones[1].subtemas).toEqual(["uno", "dos"]);
  });

  test("serializa de vuelta al contrato del motor", () => {
    const out = serializeIndiceModel({
      secciones: [
        { titulo: "Objetivo", icono: "bullseye", subtemas: [] },
        { titulo: "Resultados", icono: null, subtemas: ["Identidad", "Servicios"] },
      ],
    });
    expect(out.secciones).toBe("Objetivo\nResultados");
    expect(out.subindices).toBe("Resultados: Identidad\nResultados: Servicios");
    expect(out.subtemas).toBe("Identidad\nServicios");
    // El hueco de la segunda seccion usa el default de su posicion.
    expect(out.iconos_focos).toBe(`bullseye\n${INDICE_ICONOS_DEFAULT[1]}`);
  });

  test("sin ningun icono elegido no fuerza iconos_focos (manda el default del motor)", () => {
    const out = serializeIndiceModel({
      secciones: [
        { titulo: "A", icono: null, subtemas: [] },
        { titulo: "B", icono: null, subtemas: [] },
      ],
    });
    expect(out.iconos_focos).toBe("");
  });

  test("round-trip estable", () => {
    const payload = {
      secciones: "Uno\nDos",
      iconos_focos: "lightbulb\nchart-column",
      subindices: "Dos: x",
      subtemas: "x",
    };
    const out = serializeIndiceModel(parseIndicePayload(payload));
    expect(out.secciones).toBe("Uno\nDos");
    expect(out.iconos_focos).toBe("lightbulb\nchart-column");
    expect(out.subindices).toBe("Dos: x");
  });

  test("moverSeccion reordena sin mutar", () => {
    const model = {
      secciones: [
        { titulo: "A", icono: null, subtemas: [] },
        { titulo: "B", icono: null, subtemas: [] },
      ],
    };
    const movido = moverSeccion(model, 1, -1);
    expect(movido.secciones.map((s) => s.titulo)).toEqual(["B", "A"]);
    expect(model.secciones.map((s) => s.titulo)).toEqual(["A", "B"]);
    expect(moverSeccion(model, 0, -1)).toBe(model);
  });
});
