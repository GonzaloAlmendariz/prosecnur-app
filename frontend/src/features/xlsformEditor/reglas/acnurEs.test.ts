// Prueba de estrés con el ACNUR en español (2026-10-17): cada hallazgo S1–S8 con su caso real. Mata: que el editor
// le AFIRME al analista algo que no es cierto («Ninguna pregunta lo lee», «dependen de respuestas que dio antes»,
// «sólo se evalúan en el teléfono», un check verde de mensaje en una fila rota) y que lo técnico se lea en códigos.
import { describe, expect, test } from "vitest";
import { acnur } from "./acnurEs.fixture";
import { leerRegla } from "./leerRegla";
import { textoDePiezas, type ColumnaRegla } from "./piezas";
import { LECTURA_FILA_ROTA, separarAviso } from "./motor";
import { indiceDeUsos } from "../logic/usos";
import { causaSinPrueba, evaluarRestriccion, textoCausaSinPrueba, valoresDeEjemplo } from "../logic/probarRestriccion";
import { condicionesHeredadas, repeticionesDe, textoSeRepite } from "../logic/repeticiones";
import { buildChoiceFilterModel, clasificarFiltro } from "../choiceFilters/buildChoiceFilterModel";
import { describeChoiceFilter } from "../canvas/constructor/FiltroOpcionesPanel";
import { describeExpression, describeValidation, leerColumna } from "../canvas/reglasHumanas";
import { origenDeLista, textoOrigen } from "../opciones/opcionesModel";
import { buildDiagnostics } from "../parsing/diagnostics";

const A = acnur();
const leer = (col: ColumnaRegla, name: string) => {
  const n = A.nodo(name);
  const raw = col === "relevant" ? n.relevant : col === "constraint" ? n.constraint : col === "calculation" ? n.calculation : n.choiceFilter;
  const l = leerRegla(col, raw, n, A.scope);
  return { l, texto: l.tecnica ? "TÉCNICA" : textoDePiezas(separarAviso(l.piezas).piezas) };
};

describe("S1 · «Lo usan» cuenta las referencias dentro de los textos", () => {
  test("countryname: lo usan las etiquetas de REF10b, REF16 e IDP01 y dos opciones de listas", () => {
    const usos = indiceDeUsos(A.structure, A.catalogs).get("countryname") ?? [];
    const enEtiqueta = usos.filter((u) => u.columna === "label").map((u) => u.node.name);
    expect(enEtiqueta).toEqual(expect.arrayContaining(["REF10b", "REF16", "IDP01"]));
    const enOpcion = usos.filter((u) => u.columna === "opcion");
    expect(enOpcion.map((u) => `${u.node.name}:${u.opcion?.valor}`)).toEqual(expect.arrayContaining(["IDP01:7", "Country:91", "REF02:91"]));
  });
  test("name_ppl: lo usa la etiqueta de Registered_person_available (aunque esté entre **)", () => {
    const usos = indiceDeUsos(A.structure, A.catalogs).get("name_ppl") ?? [];
    expect(usos.map((u) => [u.node.name, u.columna])).toEqual([["Registered_person_available", "label"]]);
  });
});

describe("S2 · un filtro fijo no «depende de respuestas previas»", () => {
  const modelo = buildChoiceFilterModel({ structure: A.structure, choicesColumns: A.workbook.choices.columns, choicesRows: A.workbook.choices.rows });
  const ficha = (name: string) => modelo.cards.find((c) => c.questionCode === name)!;
  test("REF02CO= 'kk' es un subconjunto fijo de la lista Country, con su cuenta de opciones", () => {
    const c = ficha("REF02");
    expect(c.clase).toBe("fijo");
    expect(c.opcionesFijas).toBe(3);
    expect(c.explanation).toBe("Muestra siempre las mismas 3 opciones: las marcadas con kk en la columna REF02CO de la lista Country.");
    expect(c.explanation).not.toMatch(/respuestas? (previas?|que la persona dio)/);
    expect(c.meta).toBe("siempre las mismas 3");
  });
  test("cascada, por opción y fila rota se clasifican por su forma", () => {
    expect(ficha("Spent_1st").clase).toBe("cascada");
    expect(ficha("REF16").clase).toBe("por-opcion");
    expect(ficha("REF16").explanation).toBe("Muestra solo las opciones Carné de extranjería y Permiso temporal de permanencia cuando Seleccione el país en el que se realiza la entrevista es Perú.");
    expect(ficha("REG02_Other_recod").clase).toBe("rota");
    expect(clasificarFiltro("name = '1' or name = '2'")).toBe("fijo");
    expect(clasificarFiltro("filter_P14=${P14} or name='0'")).toBe("cascada");
  });
  test("el panel del Constructor dice lo mismo: subconjunto fijo, no «Filtro técnico importado»", () => {
    const s = describeChoiceFilter("REF02CO= 'kk'", A.scope, A.workbook.choices.columns, A.nodo("REF02"));
    expect(s).toMatchObject({ tone: "ok", title: "Subconjunto fijo", detail: "Muestra siempre las mismas opciones: las marcadas con kk en la columna REF02CO." });
  });
});

describe("S3 · una lista que sale de una repetición no se ofrece para escribir", () => {
  test("select_one ${HH01_2_aux}: las opciones son las respuestas registradas en la repetición", () => {
    const o = origenDeLista("${HH01_2_aux}", A.structure);
    expect(o).toEqual({ tipo: "repeticion", variable: "HH01_2_aux", etiquetaVariable: "Nombre del miembro del hogar", repeticion: "Lista de los miembros del hogar" });
    expect(textoOrigen(o!)).toMatch(/^Las opciones son las respuestas a «Nombre del miembro del hogar», una por cada fila registrada en la repetición «Lista de los miembros del hogar»/);
    expect(origenDeLista("Country", A.structure)).toBeNull();
  });
});

describe("S4 · «Probar valores» da la causa real y evalúa bien la autorreferencia", () => {
  test("IDP01 no se prueba por las comillas tipográficas, no por «funciones del teléfono»", () => {
    const c = causaSinPrueba(A.nodo("IDP01"));
    expect(c).toEqual({ tipo: "comillas" });
    expect(textoCausaSinPrueba(c!)).toMatch(/comillas tipográficas/);
    expect(textoCausaSinPrueba(c!)).not.toMatch(/teléfono/);
  });
  test("REG02_Other_recod no se prueba porque la fila está rota", () => {
    const c = causaSinPrueba(A.nodo("REG02_Other_recod"));
    expect(c).toEqual({ tipo: "fila-rota" });
    expect(textoCausaSinPrueba(c!)).toBe(`${LECTURA_FILA_ROTA}: no hay una regla que probar.`);
  });
  test("Spent_5th acepta cada opción si las otras están vacías: ${Spent_5th} es la respuesta que se prueba", () => {
    const n = A.nodo("Spent_5th");
    expect(causaSinPrueba(n)).toBeNull();
    const vals = valoresDeEjemplo(n, ["1", "2", "3", "4", "5", "6"]);
    expect(vals.map((v) => evaluarRestriccion(n.constraint, v, {}, n.name))).toEqual(Array(6).fill("acepta"));
    expect(evaluarRestriccion(n.constraint, "2", { Spent_1st: "2" }, n.name)).toBe("rechaza");
    // Sin el nombre propio sigue el comportamiento viejo (por eso la pestaña lo pasa).
    expect(evaluarRestriccion(n.constraint, "2")).toBe("rechaza");
  });
  test("una función que el editor no evalúa se nombra", () => {
    const n = { ...A.nodo("REF10b"), constraint: "pulldata('t', 'a', 'b', .) != ''" };
    expect(textoCausaSinPrueba(causaSinPrueba(n)!)).toBe("La regla usa pulldata(), que el editor no sabe evaluar: se comprueba en el teléfono.");
  });
});

describe("S5 · la fila rota se lee igual en todas las vistas", () => {
  const n = A.nodo("REG02_Other_recod");
  test("todas sus columnas dicen que está rota, sin dependencias inventadas", () => {
    for (const col of ["relevant", "constraint", "calculation", "choice_filter"] as const) {
      const { l, texto } = leer(col, n.name);
      expect(texto).toBe(LECTURA_FILA_ROTA);
      expect(l.depende).toEqual([]);
      expect(l.rota).toBe(true);
    }
    expect(describeValidation(n.constraint, n, A.scope)?.summary).toBe(LECTURA_FILA_ROTA);
    expect(leerColumna("choice_filter", n, n.choiceFilter, A.scope).summary).toBe(LECTURA_FILA_ROTA);
  });
  test("el diagnóstico usa la misma frase", () => {
    const d = buildDiagnostics(A.workbook, A.idx).find((x) => x.id === `fila-rota-${n.rowIndex}`);
    expect(d?.detail).toContain(LECTURA_FILA_ROTA);
  });
});

describe("S6/S7 · lecturas con etiquetas, no con códigos", () => {
  test("indexed-repeat con la fila de la repetición, citada por su etiqueta", () => {
    expect(leer("calculation", "HH01").texto).toBe("Nombre del miembro del hogar de la misma fila en Lista de los miembros del hogar");
    expect(leer("calculation", "name_selectedbelow5").texto).toBe("Nombre del miembro del hogar de la fila que indica selected_below5 en Lista de los miembros del hogar");
  });
  test("join y sum dicen de qué repetición salen", () => {
    expect(leer("calculation", "women_name_b").texto).toBe("Las respuestas de women_b en todas las filas de Lista de los miembros del hogar unidas en una sola línea");
    expect(leer("calculation", "nochild_edu_calcul").texto).toBe("La suma de child_edu_calcul_r en todas las filas de Lista de los miembros del hogar");
  });
  test("choice-name no repite la etiqueta de la pregunta", () => {
    expect(leer("calculation", "countryname").texto).toBe("El texto de la opción elegida en Seleccione el país en el que se realiza la entrevista");
  });
  test("una etiqueta en mayúsculas se lee en tipo oración dentro de la frase", () => {
    const { l, texto } = leer("relevant", "verifica");
    expect(texto).toBe("Encuestador/a: ¿quién era el o la encuestado/a principal? tiene respuesta");
    expect(l.piezas[0]).toMatchObject({ tipo: "pregunta", name: "name_respondent" });
  });
  test("el aviso de comillas tipográficas va aparte de la frase", () => {
    const n = A.nodo("IDP01");
    const v = describeValidation(n.constraint, n, A.scope)!;
    expect(v.summary).not.toMatch(/comillas/);
    expect(v.aviso).toMatch(/comillas tipográficas/);
  });
  test("Lógica lee el filtro fijo como lo lee Filtros, no como «Regla técnica importada»", () => {
    expect(describeExpression("REF02CO= 'kk'", A.scope).summary).toBe("Muestra siempre las mismas opciones: las marcadas con kk en la columna REF02CO");
    expect(leerColumna("choice_filter", A.nodo("Spent_1st"), A.nodo("Spent_1st").choiceFilter, A.scope).summary)
      .toBe("Muestra las opciones cuya columna filter_Spent está marcada en ¿En qué ha gastado el dinero recibido del ACNUR?");
  });
});

describe("S8 · repeticiones y heredadas sin duplicar", () => {
  test("HH06 se repite por cada fila de la lista de miembros (S1 sin etiqueta se nombra por lo que cuenta)", () => {
    expect(repeticionesDe(A.nodo("HH06"), A.structure).map((r) => r.etiqueta)).toEqual(["Lista de los miembros del hogar"]);
    expect(textoSeRepite(A.nodo("HH06"), A.structure)).toBe("Se repite por cada fila de «Lista de los miembros del hogar»");
    expect(textoSeRepite(A.nodo("REF02"), A.structure)).toBeNull();
  });
  test("REG02 hereda una sola vez la condición que S4 y S2 repiten", () => {
    const h = condicionesHeredadas(A.nodo("REG02"), A.structure);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ etiqueta: "S4: Documentación", raw: "${attempt1} = '1'", tambien: ["S2: Preguntas a nivel individual"] });
  });
});
