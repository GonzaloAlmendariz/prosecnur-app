import { describe, expect, it } from "vitest";
import type { Pregunta, Seccion } from "../../../../api/client";
import {
  SIN_SECCION,
  TODAS_LAS_SECCIONES,
  conteoPorSeccion,
  rotuloDeSeccion,
  seccionesVisibles,
  tituloDePregunta,
  apareceDePregunta,
  apareceSeccion,
  buscar,
  cifrasDeFormulario,
  conteoPorFiltro,
  preguntaElegida,
  preguntasDeSeccion,
  preguntasQueAbre,
  tonoDeTipo,
} from "./formularioModel";

const q = (name: string, cambios: Partial<Pregunta> = {}): Pregunta => ({
  name, label: name.toUpperCase(), tipo: "text", seccion: "s1", required: false, relevant: false, constraint: false, calculate: false, ...cambios,
});
const SI_NO = [{ name: "1", label: "Sí" }, { name: "2", label: "No" }];
const preguntas: Pregunta[] = [
  q("p8", { tipo: "select_one", required: true, choices: SI_NO }),
  q("p9", { relevant: true, relevant_expr: "${p8} = '1'", required: true }),
  q("p10", { tipo: "integer", relevant: true, relevant_expr: "${p8} = '2'", seccion: "s2", constraint: true }),
  q("calc", { tipo: "calculate", calculate: true, seccion: "s2", calculation_expr: "${p10} * 2" }),
  q("nota", { tipo: "note", seccion: "s2" }),
];
const seccion = (name: string, cambios: Partial<Seccion> = {}): Seccion => ({ name, label: name, is_repeat: false, is_conditional: false, relevant: null, prefix: "", ...cambios });

describe("Formulario", () => {
  it("lee la condición con la etiqueta de la opción, cruzada por código", () => {
    expect(apareceDePregunta(preguntas[1], preguntas)).toBe("Si p8 es Sí");
    expect(apareceDePregunta(preguntas[2], preguntas)).toBe("Si p8 es No");
    expect(apareceDePregunta(preguntas[0], preguntas)).toBe("Siempre");
  });

  it("dice cuándo aparece una sección, también si se repite", () => {
    expect(apareceSeccion(seccion("a", { relevant: "${p8} = '1'" }), preguntas)).toBe("Si p8 es Sí");
    expect(apareceSeccion(seccion("b", { is_repeat: true, repeat_count_vars: ["hogar_n"] }), preguntas)).toBe("Se repite según hogar_n");
    expect(apareceSeccion(seccion("c"), preguntas)).toBe("Siempre");
  });

  it("encuentra las preguntas que abre una pregunta", () => {
    expect(preguntasQueAbre(preguntas[0], preguntas).map((p) => p.name)).toEqual(["p9", "p10"]);
    expect(preguntasQueAbre(preguntas[1], preguntas)).toEqual([]);
  });

  it("cuenta preguntas sin cálculos ni notas, y las condicionadas sobre esa base", () => {
    expect(cifrasDeFormulario({ secciones: [seccion("s1"), seccion("s2")], preguntas })).toEqual({ preguntas: 3, secciones: 2, conCondicion: 2, calculadas: 1 });
  });

  it("filtra por sección, por regla y por texto", () => {
    expect(preguntasDeSeccion(preguntas, "s2").map((p) => p.name)).toEqual(["p10", "calc", "nota"]);
    expect(preguntasDeSeccion(preguntas, TODAS_LAS_SECCIONES)).toHaveLength(5);
    const conteo = conteoPorFiltro(preguntas);
    expect(conteo).toMatchObject({ todas: 5, condicion: 2, obligatorias: 2, restriccion: 1, calculadas: 1, "filtro-opciones": 0 });
    expect(buscar(preguntas, "P9").map((p) => p.name)).toEqual(["p9"]);
    expect(buscar(preguntas, "* 2").map((p) => p.name)).toEqual(["calc"]);
  });

  it("el inspector muestra la pregunta de la dirección si está a la vista; si no, la primera", () => {
    expect(preguntaElegida(preguntas, "p9")?.name).toBe("p9");
    expect(preguntaElegida(preguntas, "otra")?.name).toBe("p8");
    expect(preguntaElegida([], "p9")).toBeNull();
  });

  it("da a cada tipo su color de la casa", () => {
    expect(preguntas.map(tonoDeTipo)).toEqual(["so", "text", "int", "otro", "otro"]);
  });

  it("una sola definición de pregunta: la lista suma lo mismo que la cabecera", () => {
    const secciones = [seccion("s1"), seccion("s2")];
    const conHuerfana = [...preguntas, q("suelta", { seccion: "" }), q("perdida", { seccion: "no_existe", tipo: "integer" })];
    const visibles = seccionesVisibles(secciones, conHuerfana);
    expect(visibles.map((s) => s.name)).toEqual(["s1", "s2", SIN_SECCION]);
    const conteo = conteoPorSeccion(visibles, conHuerfana);
    const cabecera = cifrasDeFormulario({ secciones, preguntas: conHuerfana }).preguntas;
    expect(conteo.get(TODAS_LAS_SECCIONES)).toBe(cabecera);
    expect(visibles.reduce((suma, s) => suma + (conteo.get(s.name) ?? 0), 0)).toBe(cabecera);
    expect(conteo.get(SIN_SECCION)).toBe(2);
    expect(preguntasDeSeccion(conHuerfana, SIN_SECCION, secciones).map((p) => p.name)).toEqual(["suelta", "perdida"]);
  });

  it("el rótulo de una sección no muestra marcadores del formulario", () => {
    expect(rotuloDeSeccion(seccion("acc", { label: "Acceso al Espacio de Protección de ${sede_ppl}" }))).toBe("Acceso al Espacio de Protección");
    expect(rotuloDeSeccion(seccion("solo", { label: "${sede_ppl}" }))).toBe("solo");
  });

  it("el título del inspector no repite el código cuando la etiqueta es el código", () => {
    expect(tituloDePregunta(q("p9", { label: "Ocupación" }))).toBe("p9, Ocupación");
    expect(tituloDePregunta(q("start", { label: "start" }))).toBe("start");
    expect(tituloDePregunta(q("end", { label: "" }))).toBe("end");
  });
});
