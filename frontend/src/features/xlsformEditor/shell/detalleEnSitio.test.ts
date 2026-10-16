// Modelos puros del detalle en sitio de las pestañas del editor (ítem 50).

import { describe, expect, test } from "vitest";
import { alternarFicha } from "./detalleEnSitio";
import { armarDocumento, type PreguntaDoc } from "../cuestionario/modeloCuestionario";
import { fichaDePregunta } from "../cuestionario/modeloFicha";
import { claveSeccion, enunciadoCorto, preguntasDeSeccion } from "../resumen/preguntasDeSeccion";
import { filasPapelVisibles, filasSinPapel } from "../impreso/modeloImpreso";
import { buildChoiceFilterModel } from "../choiceFilters/buildChoiceFilterModel";
import { filtroElegido } from "../choiceFilters/seleccionFiltro";
import { CATALOGOS_SIN_SALTO, ESTRUCTURA_SIN_SALTO, WORKBOOK_SIN_SALTO } from "./pestanasSinSalto.fixture";

function preguntaDoc(name: string): PreguntaDoc {
  for (const s of armarDocumento(ESTRUCTURA_SIN_SALTO, CATALOGOS_SIN_SALTO, [])) {
    for (const b of s.bloques) if (b.tipo === "pregunta" && b.pregunta.nodo.name === name) return b.pregunta;
  }
  throw new Error(`sin ${name}`);
}

describe("una ficha abierta a la vez", () => {
  test("elegir la abierta la cierra; elegir otra la reemplaza", () => {
    expect(alternarFicha(null, "p1")).toBe("p1");
    expect(alternarFicha("p1", "p1")).toBeNull();
    expect(alternarFicha("p1", "p2")).toBe("p2");
    expect(alternarFicha<number>(3, 3)).toBeNull();
  });
});

describe("ficha de la pregunta (Vista del cuestionario)", () => {
  test("tipo, variable, obligatoriedad, condición en llano y restricción como rango", () => {
    expect(fichaDePregunta(preguntaDoc("p2"))).toMatchObject({
      numero: 2,
      variable: "p2",
      tipo: "Número entero",
      obligatoria: true,
      condicion: "P1 es «Sí»",
      lista: null,
      restriccion: { texto: "El valor va entre 18 y 99.", tecnica: false },
    });
  });

  test("una selección trae su lista y sus opciones; sin restricción ni condición lo dice", () => {
    const ficha = fichaDePregunta(preguntaDoc("p1"));
    expect(ficha.lista?.nombre).toBe("sino");
    expect(ficha.lista?.opciones.map((o) => o.etiqueta)).toEqual(["Sí", "No"]);
    expect(ficha.condicion).toBeNull();
    expect(ficha.restriccion).toBeNull();
  });
});

describe("sección desplegada (Resumen)", () => {
  test("sus preguntas con número de corrido, enunciado, tipo y segundos de la regla del resumen", () => {
    const seccion = ESTRUCTURA_SIN_SALTO.outline.find((n) => n.name === "p1")!.sectionId;
    const filas = preguntasDeSeccion(ESTRUCTURA_SIN_SALTO, CATALOGOS_SIN_SALTO, seccion);
    expect(filas.map((f) => [f.numero, f.name, f.tipo])).toEqual([
      [1, "p1", "Selección única"],
      [2, "p2", "Número entero"],
      [3, "p3", "Selección única"],
      [4, "p4", "Selección única"],
      [5, "p5", "Texto corto"],
    ]);
    expect(filas[0].segundos).toBe(30);
    expect(filas[4].segundos).toBe(20);
  });

  test("la clave de la fila es el name del grupo; la raíz va por su id", () => {
    expect(claveSeccion({ id: "x", name: "s1" })).toBe("s1");
    expect(claveSeccion({ id: "root", name: "" })).toBe("root");
  });

  test("el enunciado corto quita el marcado y corta en el largo pedido", () => {
    expect(enunciadoCorto("**Hola**   mundo")).toBe("Hola mundo");
    expect(enunciadoCorto("a".repeat(100), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("papel por pregunta (Impreso)", () => {
  test("lista las filas con ajustes y, además, la abierta aunque no tenga", () => {
    expect(filasPapelVisibles(ESTRUCTURA_SIN_SALTO, null).map((f) => f.name)).toEqual(["p5"]);
    const p2 = ESTRUCTURA_SIN_SALTO.outline.find((n) => n.name === "p2")!;
    expect(filasPapelVisibles(ESTRUCTURA_SIN_SALTO, p2.rowIndex).map((f) => [f.name, f.columnas.length]))
      .toEqual([["p2", 0], ["p5", 1]]);
  });

  test("«Ajustar otra pregunta» ofrece las filas sin ajustes", () => {
    const nombres = filasSinPapel(ESTRUCTURA_SIN_SALTO).map((f) => f.name);
    expect(nombres).toContain("p1");
    expect(nombres).not.toContain("p5");
  });
});

describe("filtro elegido (Filtros de opciones)", () => {
  const { cards } = buildChoiceFilterModel({
    structure: ESTRUCTURA_SIN_SALTO,
    choicesColumns: WORKBOOK_SIN_SALTO.choices.columns,
    choicesRows: WORKBOOK_SIN_SALTO.choices.rows,
  });

  test("el de la dirección si existe; si no, el primero; sin filtros, ninguno", () => {
    expect(cards.map((c) => c.questionCode)).toEqual(["p4"]);
    expect(filtroElegido(cards, "p4")?.questionCode).toBe("p4");
    expect(filtroElegido(cards, "no-existe")?.questionCode).toBe("p4");
    expect(filtroElegido([], "p4")).toBeNull();
  });
});
