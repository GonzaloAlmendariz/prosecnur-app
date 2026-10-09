import { describe, expect, it } from "vitest";

import { coincideCursoHorario, filtraSenales, normalizaBusqueda } from "./filtroDeCursoHorario";
import type { AulaMedida, SenalesPorAula } from "./senalesPorAula";

const aula = (p: Partial<AulaMedida>): AulaMedida => ({
  clave: p.codigo ?? "x", codigo: "CH 1", facultad: "DERECHO", estadoOperativo: null,
  elegibles: null, efectivas: null, numerador: null, tasaPrevista: null,
  tasaFacultad: null, tasaObservada: null, banda: null, senal: "bajo", ...p,
});

type Medido = Extract<SenalesPorAula, { estado: "medido" }>;

const medido = (p: Partial<Medido>): Medido => ({
  estado: "medido", senalados: [], descuadres: [], conformes: [], sinMedir: [],
  pendientes: [], retiradas: [], desconocidos: [], criterio: {}, ...p,
} as Medido);

describe("normalizaBusqueda", () => {
  it("quita tildes y mayúsculas para que «ingenieria» encuentre «INGENIERÍA»", () => {
    expect(normalizaBusqueda("  INGENIERÍA ")).toBe("ingenieria");
  });
});

describe("coincideCursoHorario", () => {
  const a = aula({ codigo: "CH 74", facultad: "CIENCIAS E INGENIERÍA", estadoOperativo: "agendada" });

  it("busca en código, facultad y estado", () => {
    expect(coincideCursoHorario(a, "74")).toBe(true);
    expect(coincideCursoHorario(a, "ingenieria")).toBe(true);
    expect(coincideCursoHorario(a, "agendada")).toBe(true);
  });

  it("es AND: «ingenieria 74» no devuelve la facultad entera", () => {
    expect(coincideCursoHorario(a, "ingenieria 74")).toBe(true);
    expect(coincideCursoHorario(aula({ codigo: "CH 12", facultad: "CIENCIAS E INGENIERÍA" }), "ingenieria 74")).toBe(false);
  });

  it("la consulta vacía no descarta a nadie", () => {
    expect(coincideCursoHorario(a, "   ")).toBe(true);
  });
});

describe("filtraSenales", () => {
  const res = medido({
    senalados: [aula({ codigo: "CH 74", facultad: "DERECHO" })],
    conformes: [aula({ codigo: "CH 12", facultad: "LETRAS" })],
    pendientes: [aula({ codigo: "CH 741", facultad: "LETRAS" })],
    sinMedir: [{ senal: "sin_banda", motivo: "sin banda", aulas: [aula({ codigo: "CH 9", facultad: "ARTE" })] }],
  });

  it("sin consulta devuelve todo y no se declara filtrado", () => {
    const r = filtraSenales(res, "");
    expect(r.filtrado).toBe(false);
    expect(r.total).toBe(4);
    expect(r.encontrados).toBe(4);
    expect(r.sinMedir).toHaveLength(1);
  });

  it("cruza TODOS los grupos: la respuesta es el grupo que queda con filas", () => {
    const r = filtraSenales(res, "letras");
    expect(r.senalados).toHaveLength(0);
    expect(r.conformes.map((a) => a.codigo)).toEqual(["CH 12"]);
    expect(r.pendientes.map((a) => a.codigo)).toEqual(["CH 741"]);
    expect(r.sinMedir).toHaveLength(0);
    expect(r.encontrados).toBe(2);
    expect(r.total).toBe(4);
    expect(r.filtrado).toBe(true);
  });

  it("un grupo de «sin contrastar» sin filas desaparece en vez de decir 0", () => {
    expect(filtraSenales(res, "arte").sinMedir.map((g) => g.aulas.length)).toEqual([1]);
    expect(filtraSenales(res, "derecho").sinMedir).toEqual([]);
  });

  it("una consulta sin resultados deja 0 encontrados sobre el total original", () => {
    const r = filtraSenales(res, "medicina");
    expect(r.encontrados).toBe(0);
    expect(r.total).toBe(4);
    expect(r.filtrado).toBe(true);
  });
});
