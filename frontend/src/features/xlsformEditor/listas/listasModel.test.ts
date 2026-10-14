import { describe, expect, test } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import {
  analizarListas,
  contarEscalasRepetidas,
  nombreBaseDesdeEtiquetas,
  nombreLibre,
  renombrarLista,
  unificarListas,
  validarNombreLista,
} from "./listasModel";

const ACUERDO = [
  ["1", "Muy en desacuerdo"],
  ["2", "En desacuerdo"],
  ["3", "De acuerdo"],
  ["4", "Muy de acuerdo"],
];

function opciones(lista: string, pares: string[][]): string[][] {
  return pares.map(([code, label]) => [lista, code, label]);
}

function wb(survey: string[][], choices: string[][], extra: Partial<XlsformEditorWorkbook> = {}): XlsformEditorWorkbook {
  return {
    survey: { columns: ["type", "name", "label"], rows: survey },
    choices: { columns: ["list_name", "name", "label"], rows: choices },
    settings: { columns: ["form_title"], rows: [["X"]] },
    ...extra,
  };
}

const BASE = wb(
  [
    ["begin_group", "g1", "Grupo"],
    ["select_one p1_opts", "p1", "P1"],
    ["select_one p2_opts", "p2", "P2"],
    ["select_multiple p3_opts", "p3", "P3"],
    ["select_one sexo", "sexo", "Sexo"],
    ["text", "obs", "Obs"],
    ["end_group", "", ""],
  ],
  [
    ...opciones("p1_opts", ACUERDO),
    ...opciones("sexo", [["1", "Hombre"], ["2", "Mujer"]]),
    ...opciones("p2_opts", ACUERDO),
    ...opciones("p3_opts", ACUERDO),
  ],
);

describe("analizarListas", () => {
  test("agrupa listas idénticas y cuenta sus preguntas", () => {
    const { grupos, unicas } = analizarListas(BASE);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].listas).toEqual(["p1_opts", "p2_opts", "p3_opts"]);
    expect(grupos[0].preguntas).toEqual(["p1", "p2", "p3"]);
    expect(grupos[0].opciones[0]).toEqual({ codigo: "1", etiqueta: "Muy en desacuerdo" });
    expect(grupos[0].sugerencia).toBe("acuerdo");
    expect(unicas.map((u) => u.nombre)).toEqual(["sexo"]);
    expect(unicas[0].preguntas).toEqual(["sexo"]);
    expect(contarEscalasRepetidas(BASE)).toBe(1);
  });

  test("listas casi iguales no se agrupan (orden, etiqueta, código, largo, columna extra)", () => {
    const casi = wb(
      [["select_one a", "a", "A"], ["select_one b", "b", "B"], ["select_one c", "c", "C"],
        ["select_one d", "d", "D"], ["select_one e", "e", "E"]],
      [
        ...opciones("a", [["1", "Sí"], ["2", "No"]]),
        ...opciones("b", [["2", "No"], ["1", "Sí"]]),
        ...opciones("c", [["1", "Si"], ["2", "No"]]),
        ...opciones("d", [["1", "Sí"], ["0", "No"]]),
        ...opciones("e", [["1", "Sí"], ["2", "No"], ["3", "No sabe"]]),
      ],
    );
    expect(analizarListas(casi).grupos).toHaveLength(0);
    expect(contarEscalasRepetidas(casi)).toBe(0);

    const conFiltro: XlsformEditorWorkbook = {
      ...wb([], []),
      choices: {
        columns: ["list_name", "name", "label", "region"],
        rows: [["x", "1", "Sí", "norte"], ["y", "1", "Sí", "sur"]],
      },
    };
    expect(analizarListas(conFiltro).grupos).toHaveLength(0);
  });

  test("sin choices ni listas no hay grupos", () => {
    expect(analizarListas(wb([["text", "a", "A"]], [])).grupos).toEqual([]);
    expect(contarEscalasRepetidas(null)).toBe(0);
  });

  test("lee la lista desde select_from_list_name y etiquetas con idioma", () => {
    const w: XlsformEditorWorkbook = {
      survey: { columns: ["type", "name", "select_from_list_name"], rows: [["select_one", "q1", "l1"], ["select_one l2", "q2", ""]] },
      choices: { columns: ["list_name", "name", "label::Español (es)"], rows: [...opciones("l1", ACUERDO), ...opciones("l2", ACUERDO)] },
      settings: { columns: [], rows: [] },
    };
    const { grupos } = analizarListas(w);
    expect(grupos[0].preguntas).toEqual(["q1", "q2"]);
    expect(grupos[0].opciones[3].etiqueta).toBe("Muy de acuerdo");
  });

  test("dos grupos con la misma sugerencia reciben nombres distintos", () => {
    const otraAcuerdo = [["a", "Acuerdo"], ["b", "Desacuerdo"]];
    const w = wb(
      [["select_one a1", "q1", ""], ["select_one a2", "q2", ""], ["select_one b1", "q3", ""], ["select_one b2", "q4", ""]],
      [...opciones("a1", ACUERDO), ...opciones("a2", ACUERDO), ...opciones("b1", otraAcuerdo), ...opciones("b2", otraAcuerdo)],
    );
    const nombres = analizarListas(w).grupos.map((g) => g.sugerencia).sort();
    expect(nombres).toEqual(["acuerdo", "acuerdo_2"]);
  });
});

describe("sugerencia de nombre", () => {
  const casos: Array<[string, string[]]> = [
    ["acuerdo", ["Totalmente de acuerdo", "En desacuerdo"]],
    ["satisfaccion", ["Muy satisfecho", "Insatisfecho"]],
    ["si_no", ["Sí", "No"]],
    ["si_no", ["Sí", "No", "No sabe / No responde"]],
    ["conocimiento", ["Lo conoce", "No lo conoce"]],
    ["frecuencia", ["Siempre", "A veces", "Nunca"]],
    ["calidad", ["Muy buena", "Buena", "Mala"]],
    ["rojo_verde", ["Rojo", "Verde", "Azul"]],
    ["lista_2019_2020", ["2019", "2020"]],
  ];
  test.each(casos)("%s ← %j", (esperado, etiquetas) => {
    expect(nombreBaseDesdeEtiquetas(etiquetas.map((etiqueta, i) => ({ codigo: String(i), etiqueta })))).toBe(esperado);
  });

  test("nombreLibre agrega sufijo si está ocupado", () => {
    expect(nombreLibre("acuerdo", new Set())).toBe("acuerdo");
    expect(nombreLibre("acuerdo", new Set(["acuerdo", "acuerdo_2"]))).toBe("acuerdo_3");
  });

  test("la sugerencia no choca con una lista ajena", () => {
    const w = wb(
      [["select_one p1", "p1", ""], ["select_one p2", "p2", ""], ["select_one acuerdo", "p3", ""]],
      [...opciones("p1", ACUERDO), ...opciones("p2", ACUERDO), ...opciones("acuerdo", [["1", "De acuerdo"]])],
    );
    expect(analizarListas(w).grupos[0].sugerencia).toBe("acuerdo_2");
  });
});

describe("validarNombreLista", () => {
  test("formato XLSForm", () => {
    expect(validarNombreLista(BASE, "")).toMatch(/Escribe/);
    expect(validarNombreLista(BASE, "1escala")).toMatch(/número/);
    expect(validarNombreLista(BASE, "escala acuerdo")).toMatch(/guion bajo/);
    expect(validarNombreLista(BASE, "satisfacción")).toMatch(/tildes/);
    expect(validarNombreLista(BASE, "_ok_1")).toBeNull();
  });
  test("nombre propuesto para otra escala pendiente", () => {
    expect(validarNombreLista(BASE, "si_no", ["p1_opts"], ["si_no", "frecuencia"])).toMatch(/propuesto para otra escala/);
    expect(validarNombreLista(BASE, "p1_opts", ["p1_opts"], ["p1_opts"])).toBeNull();
  });
  test("nombre en uso por otra lista, salvo que sea propia", () => {
    expect(validarNombreLista(BASE, "sexo")).toMatch(/Ya existe/);
    expect(validarNombreLista(BASE, "p1_opts", ["p1_opts", "p2_opts"])).toBeNull();
  });
});

describe("unificarListas", () => {
  test("reescribe types, deja una copia y borra las duplicadas", () => {
    const res = unificarListas(BASE, ["p1_opts", "p2_opts", "p3_opts"], "acuerdo");
    if (!res.ok) throw new Error(res.motivo);
    const w = res.workbook;
    expect(w.survey.rows.map((r) => r[0])).toEqual([
      "begin_group", "select_one acuerdo", "select_one acuerdo", "select_multiple acuerdo",
      "select_one sexo", "text", "end_group",
    ]);
    expect(w.choices.rows).toEqual([...opciones("acuerdo", ACUERDO), ...opciones("sexo", [["1", "Hombre"], ["2", "Mujer"]])]);
    // Inmutable.
    expect(BASE.survey.rows[1][0]).toBe("select_one p1_opts");
    expect(BASE.choices.rows).toHaveLength(14);
    expect(analizarListas(w).grupos).toHaveLength(0);
  });

  test("conserva el sufijo or_other y puede reutilizar un nombre propio", () => {
    const w = wb(
      [["select_one a or_other", "q1", ""], ["select_one b", "q2", ""]],
      [...opciones("a", ACUERDO), ...opciones("b", ACUERDO)],
    );
    const res = unificarListas(w, ["a", "b"], "b");
    if (!res.ok) throw new Error(res.motivo);
    expect(res.workbook.survey.rows.map((r) => r[0])).toEqual(["select_one b or_other", "select_one b"]);
    expect(res.workbook.choices.rows).toEqual(opciones("b", ACUERDO));
  });

  test("idempotente", () => {
    const uno = unificarListas(BASE, ["p1_opts", "p2_opts", "p3_opts"], "acuerdo");
    if (!uno.ok) throw new Error(uno.motivo);
    const dos = unificarListas(uno.workbook, ["acuerdo"], "acuerdo");
    if (!dos.ok) throw new Error(dos.motivo);
    expect(dos.workbook).toBe(uno.workbook);
  });

  test("rechaza nombre en uso, nombre inválido, listas distintas o inexistentes", () => {
    expect(unificarListas(BASE, ["p1_opts", "p2_opts"], "sexo")).toEqual({ ok: false, motivo: "Ya existe otra lista llamada «sexo»." });
    expect(unificarListas(BASE, ["p1_opts", "p2_opts"], "mi escala").ok).toBe(false);
    expect(unificarListas(BASE, ["p1_opts", "sexo"], "x").ok).toBe(false);
    expect(unificarListas(BASE, ["p1_opts", "nada"], "x").ok).toBe(false);
    expect(unificarListas(BASE, [], "x").ok).toBe(false);
  });

  test("actualiza el list_name descriptivo de los mapas de códigos sin tocar sus mappings", () => {
    const mapping = { source_code: "1", source_column: "p1", source_label: "Muy en desacuerdo", xls_code: "1", xls_label: "Muy en desacuerdo", match: "label" };
    const conMapas: XlsformEditorWorkbook = {
      ...BASE,
      surveyMonkeyLogic: {
        advanced_rules: [],
        visual_rules: [],
        choice_order_overrides: {},
        choice_code_maps: [
          { variable: "p1", label: "P1", type: "select_one", list_name: "p1_opts", status: "ok", high_confidence: true, requires_confirmation: false, mappings: [mapping] },
          { variable: "sexo", label: "Sexo", type: "select_one", list_name: "sexo", status: "ok", high_confidence: true, requires_confirmation: false, mappings: [] },
        ],
      },
    };
    const res = unificarListas(conMapas, ["p1_opts", "p2_opts", "p3_opts"], "acuerdo");
    if (!res.ok) throw new Error(res.motivo);
    const maps = res.workbook.surveyMonkeyLogic?.choice_code_maps ?? [];
    expect(maps.map((m) => [m.variable, m.list_name])).toEqual([["p1", "acuerdo"], ["sexo", "sexo"]]);
    expect(maps[0].mappings).toEqual([mapping]);
    expect(maps[1]).toBe(conMapas.surveyMonkeyLogic?.choice_code_maps?.[1]);
  });

  test("reescribe select_from_list_name", () => {
    const w: XlsformEditorWorkbook = {
      survey: { columns: ["type", "name", "select_from_list_name"], rows: [["select_one", "q1", "l1"], ["select_one l2", "q2", ""]] },
      choices: { columns: ["list_name", "name", "label"], rows: [...opciones("l1", ACUERDO), ...opciones("l2", ACUERDO)] },
      settings: { columns: [], rows: [] },
    };
    const res = unificarListas(w, ["l1", "l2"], "acuerdo");
    if (!res.ok) throw new Error(res.motivo);
    expect(res.workbook.survey.rows).toEqual([["select_one", "q1", "acuerdo"], ["select_one acuerdo", "q2", ""]]);
  });
});

describe("renombrarLista", () => {
  test("renombra choices y preguntas", () => {
    const res = renombrarLista(BASE, "sexo", "sexo_resp");
    if (!res.ok) throw new Error(res.motivo);
    expect(res.workbook.survey.rows[4][0]).toBe("select_one sexo_resp");
    expect(res.workbook.choices.rows.filter((r) => r[0] === "sexo_resp")).toHaveLength(2);
    expect(res.workbook.choices.rows.filter((r) => r[0] === "sexo")).toHaveLength(0);
  });
  test("mismo nombre devuelve el mismo workbook; choque o inexistente fallan", () => {
    const igual = renombrarLista(BASE, "sexo", "sexo");
    expect(igual.ok && igual.workbook).toBe(BASE);
    expect(renombrarLista(BASE, "sexo", "p1_opts").ok).toBe(false);
    expect(renombrarLista(BASE, "nada", "x").ok).toBe(false);
  });
});
