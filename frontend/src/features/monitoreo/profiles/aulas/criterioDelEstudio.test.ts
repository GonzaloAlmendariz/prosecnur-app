import { describe, expect, it } from "vitest";

import { contrasteDeValidadores } from "./criterioDelEstudio";

const fila = (v: Partial<Record<"validator_1" | "validator_2" | "validator_3", string>>) => v;

describe("contrasteDeValidadores", () => {
  it("cuenta las columnas con DATO, no las que la hoja declara", () => {
    // Una columna vacía en las 152 filas es una cabecera, no un validador que
    // el equipo use. Contarla diría que hay tres criterios donde hay dos.
    const r = contrasteDeValidadores(
      { filtros: ["sexo", "p01"] },
      [fila({ validator_1: "1", validator_2: "0", validator_3: "" }), fila({ validator_1: "1" })],
    );
    expect(r).toEqual({ declarados: ["sexo", "p01"], columnas: 2, sinDeclarar: false });
  });

  it("el caso que motiva todo: 2 filtros declarados contra 3 columnas", () => {
    const r = contrasteDeValidadores(
      { filtros: ["sexo", "p01"] },
      [fila({ validator_1: "1", validator_2: "1", validator_3: "1" })],
    );
    expect(r.declarados).toHaveLength(2);
    expect(r.columnas).toBe(3);
  });

  it("sin filtros declarados lo dice, en vez de aparentar que los tres son tuyos", () => {
    // «ni siquiera he configurado mi sistema de filtros»: ahí la pantalla no
    // puede insinuar que las columnas del Excel son el criterio del estudio.
    const r = contrasteDeValidadores(null, [fila({ validator_1: "1" })]);
    expect(r).toEqual({ declarados: [], columnas: 1, sinDeclarar: true });
  });

  it("un filtro suelto que no viene en lista también cuenta", () => {
    expect(contrasteDeValidadores({ filtros: "sexo" }, []).declarados).toEqual(["sexo"]);
  });
});
