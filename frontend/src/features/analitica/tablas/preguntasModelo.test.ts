import { describe, expect, it } from "vitest";

import { opcionesDeCifras } from "./ConmutadorDeCifras";
import { respuestaReal, respuestaRecortada } from "./ejemploDeVistaPrevia.test-util";
import {
  anchoDeCodigos, contarPreguntas, esLaElegida, filtrarPreguntas, GRUPO_DEL_FORMULARIO, gruposDePreguntas, hayCodigosLargos, preguntaQueSeVe,
} from "./preguntasModelo";
import { codigoDeLaTabla } from "./vistaPreviaModelo";
import { CIFRAS_INICIALES, seVenCasos, seVePorcentaje } from "./vistaDeTablasStore";

const tabla = (variable: string, seccion: string, etiqueta = `Pregunta ${variable}`) => ({ variable, etiqueta, seccion: { nombre: seccion } });
const porVariable = (t: { variable: string }) => t.variable;

describe("la lista de preguntas sale de la hoja del servicio", () => {
  it("agrupa por sección en el orden en que llegan, sin reordenar", () => {
    const grupos = gruposDePreguntas([tabla("p1", "A"), tabla("p2", "A"), tabla("p3", "B"), tabla("p4", "A")], porVariable);
    expect(grupos.map((g) => [g.nombre, g.preguntas.map((p) => p.variable)])).toEqual([
      ["A", ["p1", "p2"]], ["B", ["p3"]], ["A", ["p4"]],
    ]);
  });

  it("una pregunta que sale en dos secciones se lista una vez, en la primera", () => {
    const grupos = gruposDePreguntas([tabla("p1", "A"), tabla("p1", "B"), tabla("p2", "B")], porVariable);
    expect(contarPreguntas(grupos)).toBe(2);
    expect(grupos[1].preguntas.map((p) => p.variable)).toEqual(["p2"]);
  });

  it("con la hoja real: el código que se lee es el de la pregunta, y las secciones son las del archivo", () => {
    const real = respuestaReal();
    const grupos = gruposDePreguntas(real.tablas, codigoDeLaTabla);
    expect(contarPreguntas(grupos)).toBe(real.tablas.length);
    expect(grupos.map((g) => g.nombre)).toEqual([...new Set(real.tablas.map((t) => t.seccion.nombre))]);
    const recod = gruposDePreguntas([{ ...real.tablas[1], variable: "x_recod", variable_origen: "x" }], codigoDeLaTabla);
    expect(recod[0].preguntas[0]).toMatchObject({ variable: "x_recod", codigo: "x" });
  });

  it("recortada: las del catálogo que la hoja no trae van al final, en su grupo; sin recorte no se agregan", () => {
    const catalogo = [{ name: "p1", label: "Uno" }, { name: "q99", label: "Ingresos del hogar" }, { name: "hijos", label: "" }];
    const conRecorte = gruposDePreguntas([tabla("p1", "A")], porVariable, catalogo, true);
    expect(conRecorte.map((g) => g.nombre)).toEqual(["A", GRUPO_DEL_FORMULARIO]);
    expect(conRecorte[1].preguntas).toEqual([
      { variable: "q99", codigo: "q99", etiqueta: "Ingresos del hogar" },
      { variable: "hijos", codigo: "hijos", etiqueta: "hijos" },
    ]);
    expect(gruposDePreguntas([tabla("p1", "A")], porVariable, catalogo, false).map((g) => g.nombre)).toEqual(["A"]);
    // La hoja recortada de verdad.
    const recortada = respuestaRecortada(3, 120);
    expect(gruposDePreguntas(recortada.tablas, codigoDeLaTabla, catalogo, recortada.recortado).at(-1)?.nombre).toBe(GRUPO_DEL_FORMULARIO);
  });
});

describe("buscar y elegir", () => {
  const grupos = gruposDePreguntas([
    tabla("E2_sex", "Datos", "¿Cuál es su SEXO?"),
    tabla("M5_district", "Datos", "¿En qué distrito vive actualmente?"),
    tabla("A1_leg", "Actitudes", "Las personas refugiadas huyen"),
  ], porVariable);

  it("busca en la pregunta y en el código, sin tildes ni mayúsculas, y quita los grupos vacíos", () => {
    expect(filtrarPreguntas(grupos, "sexo").flatMap((g) => g.preguntas.map((p) => p.variable))).toEqual(["E2_sex"]);
    expect(filtrarPreguntas(grupos, "que distrito").flatMap((g) => g.preguntas.map((p) => p.variable))).toEqual(["M5_district"]);
    expect(filtrarPreguntas(grupos, "a1_").map((g) => g.nombre)).toEqual(["Actitudes"]);
    expect(filtrarPreguntas(grupos, "nada así")).toEqual([]);
    expect(filtrarPreguntas(grupos, "  ")).toHaveLength(2);
  });

  it("sin foco se ve la primera pregunta de la hoja; con foco, la del foco aunque la hoja no la traiga", () => {
    expect(preguntaQueSeVe(null, grupos)).toBe("E2_sex");
    expect(preguntaQueSeVe("A1_leg", grupos)).toBe("A1_leg");
    expect(preguntaQueSeVe("q99", grupos)).toBe("q99");
    expect(preguntaQueSeVe(null, [])).toBeNull();
  });

  it("la elegida se reconoce por su nombre o por el código de la pregunta que recodifica", () => {
    const p = { variable: "x_recod", codigo: "x", etiqueta: "X" };
    expect(esLaElegida(p, "x_recod")).toBe(true);
    expect(esLaElegida(p, "x")).toBe(true);
    expect(esLaElegida(p, "y")).toBe(false);
    expect(esLaElegida(p, null)).toBe(false);
  });

  it("la columna de códigos mide el código más largo, con tope; los largos van sobre la pregunta a lo angosto", () => {
    expect(anchoDeCodigos(grupos)).toBe("11ch");
    expect(anchoDeCodigos(gruposDePreguntas([tabla("p1", "A")], porVariable))).toBe("3ch");
    expect(anchoDeCodigos(gruposDePreguntas([tabla("una_variable_muy_larga", "A")], porVariable))).toBe("14ch");
    expect(hayCodigosLargos(grupos)).toBe(true);
    expect(hayCodigosLargos(gruposDePreguntas([tabla("p12", "A")], porVariable))).toBe(false);
  });
});

describe("conmutador de cifras", () => {
  it("con pesos la cifra de casos se llama N ponderado; el orden es el del prototipo", () => {
    expect(opcionesDeCifras("frecuencias", false).map((o) => o.rotulo)).toEqual(["Casos", "Porcentaje", "Ambos"]);
    expect(opcionesDeCifras("frecuencias", true).map((o) => o.rotulo)).toEqual(["N ponderado", "Porcentaje", "Ambos"]);
    expect(opcionesDeCifras("cruces", false).map((o) => o.rotulo)).toEqual(["Porcentaje", "Casos", "Ambos"]);
    expect(opcionesDeCifras("cruces", true).map((o) => o.valor)).toEqual(["porcentaje", "casos", "ambos"]);
  });

  it("qué columnas se ven con cada opción; abre como el prototipo", () => {
    expect([seVenCasos("casos"), seVePorcentaje("casos")]).toEqual([true, false]);
    expect([seVenCasos("porcentaje"), seVePorcentaje("porcentaje")]).toEqual([false, true]);
    expect([seVenCasos("ambos"), seVePorcentaje("ambos")]).toEqual([true, true]);
    expect(CIFRAS_INICIALES).toEqual({ frecuencias: "ambos", cruces: "porcentaje" });
  });
});

describe("pie de la lista y rótulo de la cifra de preguntas", () => {
  it("el pie aparece solo con una sección oculta o una variable excluida", async () => {
    const { hayPreguntasFuera } = await import("./PieDePreguntas");
    expect(hayPreguntasFuera({ modo: "instrumento" }, 0, 0)).toBe(false);
    expect(hayPreguntasFuera({ modo: "declaradas", activas: 8 }, 8, 0)).toBe(false);
    expect(hayPreguntasFuera({ modo: "declaradas", activas: 7 }, 8, 0)).toBe(true);
    expect(hayPreguntasFuera({ modo: "instrumento" }, 0, 1)).toBe(true);
  });

  it("concuerda con el número", async () => {
    const { rotuloDePreguntas } = await import("./cifrasDeFrecuencias");
    expect(rotuloDePreguntas(1, false)).toBe("pregunta en el archivo");
    expect(rotuloDePreguntas(26, false)).toBe("preguntas en el archivo");
    expect(rotuloDePreguntas(1, true)).toBe("pregunta de esta base");
    expect(rotuloDePreguntas(null, false)).toBe("preguntas en el archivo");
  });
});
