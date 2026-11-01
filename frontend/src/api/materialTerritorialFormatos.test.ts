// El normalizador de los códigos de resultado (D1): R manda escalares como vectores de
// largo uno, NA como null y listas vacías como {}.
import { describe, expect, it } from "vitest";

import { normalizarFormatosTerritoriales } from "./materialTerritorial";

describe("normalizarFormatosTerritoriales", () => {
  it("lee el catálogo, los rótulos editables y el formato de las hojas", () => {
    const f = normalizarFormatosTerritoriales({
      codigos: [
        { codigo: "1", rotulo: "No quiso participar", grupo: "no_aplicada", editable: false },
        { codigo: ["8"], rotulo: ["Encuesta efectiva"], grupo: ["efectiva"], editable: [false] },
      ],
      editables: ["2", "3", "5", "99"],
      rotulos: { "2": "Vivienda desocupada", "99": ["Manzana no elegible"] },
      con_99: [false],
      columna_criterio: null,
      caras_ruteo: [1],
      revision: [3],
      extras_disponibles: [{ id: "nse", rotulo: "NSE" }, { rotulo: "sin id" }],
    });
    expect(f.extras_disponibles).toEqual([{ id: "nse", rotulo: "NSE" }]);
    expect(f.codigos.map((c) => c.codigo)).toEqual(["1", "8"]);
    expect(f.codigos[1].grupo).toBe("efectiva");
    expect(f.rotulos["99"]).toBe("Manzana no elegible");
    expect(f.con_99).toBe(false);
    expect(f.columna_criterio).toBe("");
    expect(f.caras_ruteo).toBe(1);
    expect(f.revision).toBe(3);
    expect(f.extras_consolidado).toEqual([]);
    expect(f.origen_codigos).toBe("material");
    expect(normalizarFormatosTerritoriales({ origen_codigos: ["planner"] }).origen_codigos).toBe("planner");
  });

  it("descarta códigos sin número y cae en valores seguros con un payload vacío", () => {
    const f = normalizarFormatosTerritoriales({ codigos: [{ rotulo: "sin código" }, { codigo: "4", grupo: "inventado" }], rotulos: {} });
    expect(f.codigos).toEqual([{ codigo: "4", rotulo: "", grupo: "no_aplicada", editable: false }]);
    expect(normalizarFormatosTerritoriales(null)).toMatchObject({ codigos: [], caras_ruteo: 2, revision: 0, rotulos: {} });
  });
});

describe("normalizarImportacionAsignacion · conteos (P2)", () => {
  it("conserva los conteos por código para que aplicar no los pierda", async () => {
    const { normalizarImportacionAsignacion } = await import("./materialTerritorial");
    const r = normalizarImportacionAsignacion({
      propuesta: [],
      problemas: [],
      estados: [{ id_manzana: "1", estado_declarado: "Finalizada", fecha_salida: "", fecha_entrega: "", conteos: { "8": [6], "4": 3, "1": -2 } }],
      resumen: { conteos_declarados: 1 },
    });
    expect(r.estados[0].conteos).toEqual({ "8": 6, "4": 3 });
    expect(r.conteos_declarados).toBe(1);
  });
});
