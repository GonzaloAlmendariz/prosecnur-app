import { describe, expect, it } from "vitest";
import type { OrigenExterno } from "../../api/cargaOrigenExterno";
import { PANELES_POR_MODULO } from "../../lib/navegacion/manifiesto";
import { panelAbiertoEn, searchConPanel } from "../../lib/navegacion/paneles";
import { PANEL_VARIABLES_EXCLUIDAS } from "./panelesAnalitica";
import {
  configAnaliticaPorBase,
  conVariable,
  conteoExclusion,
  filasExcluidas,
  motivosDesdeOrigen,
  rotuloExcluidas,
  rotuloIncluidas,
  sinVariable,
  variablesIncluidas,
} from "./variablesExcluidasModel";

const VARIABLES = [
  { name: "v1", label: "Edad" },
  { name: "v2", label: "Región de residencia" },
  { name: "v3", label: "Satisfacción" },
];

function origen(base: string, retiradas: Array<{ variable: string; motivo: "metadato" | "no_va_al_cliente" | "otra" }> | null): OrigenExterno {
  return {
    base,
    estado: retiradas ? "vigente" : "",
    bloque: retiradas
      ? {
        script: "",
        version: "",
        n_recibidas: null,
        n_recibidas_deducida: false,
        n_entregadas: null,
        n_excluidas: 0,
        data_file_id: "",
        declarado_at: "",
        enabled: true,
        variables_retiradas: retiradas.map((r) => ({ ...r, tipo: "text" })),
        n_variables_retiradas: retiradas.length,
      }
      : null,
    resumen: null,
    variables_faltantes: [],
    avisos: [],
    variables_excluidas_agregadas: [],
  };
}

describe("conteoExclusion (U5)", () => {
  it("cuenta como excluida una variable que no está en los datos", () => {
    // El defecto: «265/265 incluidas» con 2 excluidas, porque las dos se
    // contaban sobre las columnas presentes y ninguna estaba en la base.
    expect(conteoExclusion(VARIABLES, ["ausente_a", "ausente_b"])).toEqual({ incluidas: 3, excluidas: 2 });
  });

  it("descuenta de las incluidas solo las presentes", () => {
    expect(conteoExclusion(VARIABLES, ["v2", "ausente"])).toEqual({ incluidas: 2, excluidas: 2 });
  });

  it("no cuenta dos veces un nombre repetido en la lista", () => {
    expect(conteoExclusion(VARIABLES, ["v1", "v1"])).toEqual({ incluidas: 2, excluidas: 1 });
  });

  it("rotula en singular y plural", () => {
    expect(rotuloIncluidas(1)).toBe("1 incluida");
    expect(rotuloIncluidas(265)).toBe("265 incluidas");
    expect(rotuloExcluidas(0)).toBe("0 excluidas");
    expect(rotuloExcluidas(1)).toBe("1 excluida");
  });
});

describe("configAnaliticaPorBase — espejo de ADR 0061", () => {
  it("bases hermanas independientes: por base", () => {
    expect(configAnaliticaPorBase({ modoProcesamiento: "independent_siblings", topologiaDeclarada: null, nBases: 4 })).toBe(true);
  });

  it("bases separadas o independientes, con más de una: por base", () => {
    expect(configAnaliticaPorBase({ modoProcesamiento: "multibase", topologiaDeclarada: "separate", nBases: 3 })).toBe(true);
    expect(configAnaliticaPorBase({ modoProcesamiento: "multibase", topologiaDeclarada: "independent", nBases: 2 })).toBe(true);
  });

  it("una sola base o bases integradas: compartida", () => {
    expect(configAnaliticaPorBase({ modoProcesamiento: "multibase", topologiaDeclarada: "separate", nBases: 1 })).toBe(false);
    expect(configAnaliticaPorBase({ modoProcesamiento: "multibase", topologiaDeclarada: "integrated", nBases: 3 })).toBe(false);
    expect(configAnaliticaPorBase({ modoProcesamiento: null, topologiaDeclarada: null, nBases: null })).toBe(false);
  });
});

describe("motivosDesdeOrigen", () => {
  it("toma el motivo declarado en Carga y la base que lo declaró", () => {
    const motivos = motivosDesdeOrigen([
      origen("base_a", [{ variable: "start", motivo: "metadato" }, { variable: "nota", motivo: "no_va_al_cliente" }]),
    ]);
    expect(motivos.get("start")).toEqual({ motivo: "metadato", base: "base_a" });
    expect(motivos.get("nota")).toEqual({ motivo: "no_va_al_cliente", base: "base_a" });
  });

  it("sin declaración no inventa motivo", () => {
    expect(motivosDesdeOrigen([origen("base_a", null)]).size).toBe(0);
  });

  it("con dos bases que declaran la misma variable gana la primera", () => {
    const motivos = motivosDesdeOrigen([
      origen("base_a", [{ variable: "x", motivo: "metadato" }]),
      origen("base_b", [{ variable: "x", motivo: "otra" }]),
    ]);
    expect(motivos.get("x")).toEqual({ motivo: "metadato", base: "base_a" });
  });
});

describe("filas del panel", () => {
  const motivos = motivosDesdeOrigen([origen("base_a", [{ variable: "ausente", motivo: "metadato" }])]);

  it("lista cada excluida una vez, con su motivo si lo hay y si está en los datos", () => {
    expect(filasExcluidas(["v2", "ausente", "v2"], VARIABLES, motivos)).toEqual([
      { name: "v2", label: "Región de residencia", motivo: null, enLosDatos: true },
      { name: "ausente", label: "", motivo: { motivo: "metadato", base: "base_a" }, enLosDatos: false },
    ]);
  });

  it("el buscador casa nombre o etiqueta sin tildes ni mayúsculas", () => {
    expect(filasExcluidas(["v2", "ausente"], VARIABLES, motivos, "region").map((f) => f.name)).toEqual(["v2"]);
    expect(variablesIncluidas(VARIABLES, ["v2"], "SATISFACCIÓN").map((v) => v.name)).toEqual(["v3"]);
    expect(variablesIncluidas(VARIABLES, ["v2"], "  ").map((v) => v.name)).toEqual(["v1", "v3"]);
  });

  it("agregar y quitar no duplican ni pierden el resto", () => {
    expect(conVariable(["a"], "a")).toEqual(["a"]);
    expect(conVariable(["a"], "b")).toEqual(["a", "b"]);
    expect(sinVariable(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("dirección del panel", () => {
  it("está declarado en el manifiesto de Procesamiento", () => {
    expect(PANELES_POR_MODULO.procesamiento).toEqual(expect.arrayContaining([PANEL_VARIABLES_EXCLUIDAS]));
  });

  it("se abre con ?panel=excluidas y conserva la pestaña", () => {
    expect(searchConPanel("?pestana=datos", PANEL_VARIABLES_EXCLUIDAS)).toBe("?pestana=datos&panel=excluidas");
    expect(panelAbiertoEn("?pestana=datos&panel=excluidas", PANEL_VARIABLES_EXCLUIDAS)).toBe(true);
    expect(panelAbiertoEn("?pestana=codebook", PANEL_VARIABLES_EXCLUIDAS)).toBe(false);
  });
});
