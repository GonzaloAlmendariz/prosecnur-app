import { describe, expect, it } from "vitest";
import type { ColumnaPropia, ResumenCalculada, VariableCalculada } from "../../../../api/baseVariables";
import {
  VISTA_INICIAL,
  cifrasDeVariables,
  conDatoDeCalculada,
  escalaConCuentas,
  filaElegida,
  filtrarGrupos,
  pendientesVisibles,
  gruposDeVariables,
  reducirVista,
  tituloDeVariable,
} from "./variablesModel";

const columna = (name: string, declarada: boolean, n = 10): ColumnaPropia => ({
  name, label: name.toUpperCase(), tipo: "text", opciones: [], n_validos: n, declarada,
});

const calculada = (nombre: string): VariableCalculada => ({
  nombre,
  etiqueta: `Etiqueta ${nombre}`,
  regla: "recodificar",
  variables: ["p4"],
  codigos: [],
  mapa: {},
  escala: [{ codigo: "1", etiqueta: "Bajo" }, { codigo: "2", etiqueta: "Alto" }],
});

const resumen: ResumenCalculada = {
  // El orden del motor no es el de la escala: se cruza por código.
  por_codigo: [{ codigo: "2", etiqueta: "Alto", n: 7 }, { codigo: "1", etiqueta: "Bajo", n: 3 }],
  n_sin_dato: 2,
  n_total: 12,
  numerico: null,
};

describe("gruposDeVariables", () => {
  it("agrupa por incorporar, incorporadas y calculadas, en ese orden, y omite los grupos vacíos", () => {
    const grupos = gruposDeVariables({ extras: [columna("sede", true), columna("turno", false)], calculadas: [calculada("grupo")] }, {});
    expect(grupos.map((g) => [g.grupo, g.filas.map((f) => f.codigo)])).toEqual([
      ["pendientes", ["turno"]],
      ["incorporadas", ["sede"]],
      ["calculadas", ["grupo"]],
    ]);
    expect(gruposDeVariables({ extras: [columna("sede", true)], calculadas: [] }, {}).map((g) => g.grupo)).toEqual(["incorporadas"]);
  });

  it("la cuenta con dato de una calculada sale de su resumen; sin resumen no se inventa", () => {
    const [sin] = gruposDeVariables({ extras: [], calculadas: [calculada("g")] }, {});
    expect(sin.filas[0].conDato).toBeNull();
    const [con] = gruposDeVariables({ extras: [], calculadas: [calculada("g")] }, { g: resumen });
    expect(con.filas[0].conDato).toBe(10);
  });
});

describe("filaElegida", () => {
  const grupos = gruposDeVariables({ extras: [columna("a", true), columna("b", true)], calculadas: [] }, {});
  it("devuelve la pedida si existe y la primera si no", () => {
    expect(filaElegida(grupos, "columna:b")?.codigo).toBe("b");
    expect(filaElegida(grupos, "columna:z")?.codigo).toBe("a");
    expect(filaElegida([], null)).toBeNull();
  });
});

describe("cifrasDeVariables", () => {
  it("añadidas suma incorporadas y calculadas; las pendientes van aparte", () => {
    expect(cifrasDeVariables({ extras: [columna("a", true), columna("b", false)], calculadas: [calculada("c")] }))
      .toEqual({ anadidas: 2, porIncorporar: 1, calculadas: 1 });
  });
});

describe("escalaConCuentas", () => {
  it("cruza la cuenta por código, no por posición", () => {
    expect(escalaConCuentas(calculada("g"), resumen)).toEqual([
      { codigo: "1", etiqueta: "Bajo", n: 3 },
      { codigo: "2", etiqueta: "Alto", n: 7 },
    ]);
  });
  it("sin resumen no hay cuenta", () => {
    expect(escalaConCuentas(calculada("g"), undefined).every((e) => e.n === null)).toBe(true);
  });
});

describe("reducirVista", () => {
  it("elegir vuelve a la ficha y suelta la confirmación; guardar elige la calculada guardada", () => {
    const editando = reducirVista(VISTA_INICIAL, { tipo: "modo", modo: { tipo: "nueva" } });
    expect(reducirVista(editando, { tipo: "elegir", clave: "columna:a" })).toEqual({ elegida: "columna:a", modo: { tipo: "ver" }, confirmandoQuitar: null });
    expect(reducirVista(editando, { tipo: "guardada", nombre: "g" }).elegida).toBe("calculada:g");
  });
});

describe("rótulos", () => {
  it("título con código y etiqueta, sin repetir el código", () => {
    expect(tituloDeVariable({ codigo: "grupo_edad", etiqueta: "Grupo de edad" })).toBe("grupo_edad, Grupo de edad");
    expect(tituloDeVariable({ codigo: "x", etiqueta: "x" })).toBe("x");
  });
  it("con dato de una fórmula sale de sus válidos", () => {
    expect(conDatoDeCalculada({ ...resumen, numerico: { n_validos: 9, minimo: 0, maximo: 3 } })).toBe(9);
  });
});

describe("filtrarGrupos", () => {
  const grupos = gruposDeVariables({ extras: [columna("sede", true), columna("turno", false)], calculadas: [calculada("grupo")] }, {});
  it("busca por código o etiqueta, sin tildes ni mayúsculas, y suelta los grupos vacíos", () => {
    expect(filtrarGrupos(grupos, "TUR").map((g) => g.filas.map((f) => f.codigo))).toEqual([["turno"]]);
    expect(filtrarGrupos(grupos, "etiqueta grupo").map((g) => g.grupo)).toEqual(["calculadas"]);
    expect(filtrarGrupos(grupos, "  ")).toHaveLength(3);
  });
});

describe("pendientesVisibles", () => {
  const grupos = gruposDeVariables({ extras: [columna("sede", true), columna("turno", false), columna("ciclo", false)], calculadas: [] }, {});
  it("las por incorporar que se ven y, con elegidas, solo esas; nunca una incorporada ni una escondida", () => {
    expect(pendientesVisibles(grupos)).toEqual(["turno", "ciclo"]);
    expect(pendientesVisibles(grupos, ["ciclo", "sede"])).toEqual(["ciclo"]);
    expect(pendientesVisibles(filtrarGrupos(grupos, "turno"), ["ciclo", "turno"])).toEqual(["turno"]);
  });
});
