import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { etiquetaSinRepetir, facultadesDelRegistro } from "./registroPorFacultad";

const aula = (operational_code: string, faculty: string) => ({ operational_code, faculty });

describe("facultadesDelRegistro", () => {
  it("ordena por lo que falta por registrar, no por tamaño", () => {
    // Derecho tiene más aulas pero casi todas registradas; a Letras le queda
    // más trabajo. La lista existe para elegir a dónde ir.
    const filas = [
      aula("A1", "Derecho"), aula("A2", "Derecho"), aula("A3", "Derecho"),
      aula("B1", "Letras"), aula("B2", "Letras"),
    ];
    const r = facultadesDelRegistro(filas, new Set(["A1", "A2", "A3"]));
    expect(r.map((f) => f.facultad)).toEqual(["Letras", "Derecho"]);
    expect(r[0]).toEqual({ facultad: "Letras", aulas: 2, conParte: 0 });
    expect(r[1]).toEqual({ facultad: "Derecho", aulas: 3, conParte: 3 });
  });

  it("un aula sin facultad no crea una entrada vacía", () => {
    expect(facultadesDelRegistro([aula("A1", "  ")], new Set())).toEqual([]);
  });
});

describe("etiquetaSinRepetir", () => {
  it("no dice dos veces el código cuando el curso ya lo lleva", () => {
    // El caso real que se veía en pantalla: «CH 1 · Curso CH 1».
    expect(etiquetaSinRepetir("CH 1", "Curso CH 1")).toBe("Curso CH 1");
    expect(etiquetaSinRepetir("CH 1", "CH 1 - Cálculo")).toBe("CH 1 - Cálculo");
  });

  it("cuando el curso NO lo lleva, se dicen los dos", () => {
    // El control: si siempre devolviera el curso, un estudio con nombres
    // propios perdería el código, que es por lo que el equipo busca.
    expect(etiquetaSinRepetir("CH 1", "Cálculo 1")).toBe("CH 1 · Cálculo 1");
  });

  it("con uno solo de los dos, ese", () => {
    expect(etiquetaSinRepetir("CH 9", "")).toBe("CH 9");
    expect(etiquetaSinRepetir("", "Cálculo")).toBe("Cálculo");
    expect(etiquetaSinRepetir("", "")).toBe("Curso-horario sin identificar");
  });
});

describe("el filtro llega a la lista", () => {
  const src = readFileSync(path.join(__dirname, "RegistroDeCampo.tsx"), "utf8");

  it("la lista pinta las filas VISIBLES, no todas", () => {
    // El filtro más fácil de romper es el que se calcula y no se usa: la lista
    // seguiría pintando las 196 y el selector parecería no hacer nada.
    expect(src).toContain("{visibles.map((row)");
    expect(src).not.toContain("{filas.map((row)");
  });

  it("el contador del panel sigue hablando del total, no de lo filtrado", () => {
    // `filas.length` en la cabecera: con «Gestión» puesto, decir «12
    // cursos-horario» convertiría el filtro en el denominador del panel.
    expect(src).toContain("${filas.length} cursos-horario");
  });
});

