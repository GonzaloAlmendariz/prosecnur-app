import { describe, expect, test } from "vitest";
import type { XlsformEditorWorkbook } from "../types";
import { buildXlsformIndex } from "./buildIndex";
import { buildDiagnostics } from "./diagnostics";

function workbookFromSurvey(rows: string[][]): XlsformEditorWorkbook {
  return {
    survey: {
      name: "survey",
      columns: ["type", "name", "label"],
      rows,
    },
    choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [] },
    settings: {
      name: "settings",
      columns: ["form_title", "form_id", "version", "default_language"],
      rows: [["Demo", "demo", "1", "es"]],
    },
  };
}

describe("buildDiagnostics — estructura de secciones", () => {
  test("una sección anidada dentro de otra genera un aviso informativo", () => {
    const workbook = workbookFromSurvey([
      ["begin_group", "externa", "Sección externa"],
      ["begin_group", "interna", "Sección interna"],
      ["text", "campo", "Un campo"],
      ["end_group", "", ""],
      ["end_group", "", ""],
    ]);
    const index = buildXlsformIndex(workbook);
    const diagnostics = buildDiagnostics(workbook, index);

    const nested = diagnostics.find((d) => d.id.startsWith("nested-section-"));
    expect(nested).toBeTruthy();
    expect(nested?.level).toBe("info");
    expect(nested?.title).toContain("Sección interna");
    expect(nested?.title).toContain("Sección externa");
  });

  test("dos secciones al mismo nivel (raíz) NO generan aviso de anidamiento", () => {
    const workbook = workbookFromSurvey([
      ["begin_group", "a", "Sección A"],
      ["text", "c1", "Campo 1"],
      ["end_group", "", ""],
      ["begin_group", "b", "Sección B"],
      ["text", "c2", "Campo 2"],
      ["end_group", "", ""],
    ]);
    const index = buildXlsformIndex(workbook);
    const diagnostics = buildDiagnostics(workbook, index);

    expect(diagnostics.some((d) => d.id.startsWith("nested-section-"))).toBe(false);
  });

  test("una sección abierta sin cierre genera aviso de sección abierta", () => {
    // Escenario del desacople abrir/cerrar: un begin_group sin su end.
    const workbook = workbookFromSurvey([
      ["begin_group", "abierta", "Sección abierta"],
      ["text", "c1", "Campo 1"],
    ]);
    const index = buildXlsformIndex(workbook);
    const diagnostics = buildDiagnostics(workbook, index);

    const unclosed = diagnostics.find((d) => d.id.startsWith("unclosed-"));
    expect(unclosed).toBeTruthy();
    expect(unclosed?.level).toBe("warn");
    expect(unclosed?.title).toContain("Sección abierta");
  });

  test("un cierre sin apertura previa genera aviso de cierre suelto", () => {
    const workbook = workbookFromSurvey([
      ["text", "c1", "Campo 1"],
      ["end_group", "", ""],
    ]);
    const index = buildXlsformIndex(workbook);
    const diagnostics = buildDiagnostics(workbook, index);

    const unmatched = diagnostics.find((d) => d.id.startsWith("unmatched-end-"));
    expect(unmatched).toBeTruthy();
    expect(unmatched?.level).toBe("warn");
  });
});

describe("comillas tipográficas en expresiones", () => {
  test("una relevant con “OK” es error con arreglo, y rectificar la deja limpia", async () => {
    const { buildXlsformIndex } = await import("./buildIndex");
    const { rectificarComillas, columnaDeIdComillas } = await import("./comillas");
    const workbook = {
      survey: { columns: ["type", "name", "label", "relevant"], rows: [["text", "a", "A", ""], ["text", "b", "B", "${a} = “OK”"]] },
      choices: { columns: ["list_name", "name", "label"], rows: [] },
      settings: { columns: ["form_title", "form_id"], rows: [["T", "t"]] },
    };
    const diags = buildDiagnostics(workbook, buildXlsformIndex(workbook));
    const d = diags.find((x) => x.id.startsWith("comillas-"));
    expect(d?.level).toBe("error");
    expect(d?.rowIndex).toBe(1);
    expect(columnaDeIdComillas(d!.id)).toBe("relevant");
    expect(rectificarComillas("${a} = “OK” or ${a} = ‘6’")).toBe(`\${a} = "OK" or \${a} = '6'`);
  });
});

describe("buildDiagnostics — fila rota (M6)", () => {
  function conReglas(filas: string[][]): XlsformEditorWorkbook {
    const wb = workbookFromSurvey([]);
    wb.survey.columns = ["type", "name", "label", "relevant", "constraint", "calculation", "choice_filter", "required", "constraint_message"];
    wb.survey.rows = filas;
    return wb;
  }

  test("todas las columnas de regla repiten el name de la fila → aviso", () => {
    const n = "REG02_Other_recod";
    const wb = conReglas([["select_multiple docs", n, "Otro documento", n, n, n, n, n, n]]);
    const d = buildDiagnostics(wb, buildXlsformIndex(wb)).find((x) => x.id === "fila-rota-0");
    expect(d?.level).toBe("warn");
    expect(d?.rowIndex).toBe(0);
    expect(d?.title).toBe("Fila rota: las reglas repiten el nombre");
  });

  test("una regla real, o una sola columna con el nombre, no avisa", () => {
    const wb = conReglas([
      ["integer", "edad", "Edad", "", ". >= 0", "", "", "yes", ""],
      ["text", "x", "X", "x", "", "", "", "", ""],
      ["text", "y", "Y", "y", ". != ''", "", "", "", ""],
    ]);
    expect(buildDiagnostics(wb, buildXlsformIndex(wb)).some((x) => x.id.startsWith("fila-rota-"))).toBe(false);
  });
});

// I1 (2026-10-17): el punto de aviso, el filtro «Con aviso» y la cabecera leen UNA lista. Mata: «Pregunta de selección
// sin catálogo» en una pregunta cuya lista vive en la columna `list_name` (Tipo 1), «Catálogo "${x}" no existe» en una
// lista dinámica del roster, y un conteo que cambia cuando llega la respuesta del servidor.
import { acnur } from "../reglas/acnurEs.fixture";
import { estadoLista, fusionarDiagnosticos } from "./diagnostics";
import type { BuilderDiagnostic } from "../types";

describe("buildDiagnostics — listas leídas como el resto del editor (I1)", () => {
  const conListas = (survey: XlsformEditorWorkbook["survey"]): XlsformEditorWorkbook => ({
    survey,
    choices: { name: "choices", columns: ["list_name", "name", "label"], rows: [["lst_p1", "1", "Sí"], ["lst_p1", "2", "No"]] },
    settings: { name: "settings", columns: ["form_title", "form_id"], rows: [["Demo", "demo"]] },
  });
  const deCatalogo = (ds: BuilderDiagnostic[]) => ds.filter((d) => d.id.startsWith("catalog-missing-") || d.id.startsWith("catalog-empty-"));

  test("la lista en una columna `list_name` aparte cuenta como lista (Tipo 1)", () => {
    const wb = conListas({ name: "survey", columns: ["type", "list_name", "name", "label"], rows: [["select_one", "lst_p1", "p1", "¿Trabaja?"]] });
    expect(deCatalogo(buildDiagnostics(wb, buildXlsformIndex(wb)))).toEqual([]);
  });

  test("`or_other` no es parte del nombre de la lista", () => {
    const wb = conListas({ name: "survey", columns: ["type", "name", "label"], rows: [["select_one lst_p1 or_other", "p1", "¿Trabaja?"]] });
    expect(deCatalogo(buildDiagnostics(wb, buildXlsformIndex(wb)))).toEqual([]);
  });

  test("las listas dinámicas no piden catálogo: respuestas de la repetición, archivo y búsqueda", () => {
    const wb = conListas({
      name: "survey",
      columns: ["type", "name", "label", "appearance"],
      rows: [
        ["select_one ${nombres}", "quien", "¿Quién?", ""],
        ["select_one_from_file distritos.csv", "distrito", "Distrito", ""],
        ["select_one colegios", "colegio", "Colegio", "search('colegios')"],
      ],
    });
    expect(deCatalogo(buildDiagnostics(wb, buildXlsformIndex(wb)))).toEqual([]);
  });

  test("una selección sin lista o con una lista que choices no tiene sigue siendo un error", () => {
    const wb = conListas({
      name: "survey",
      columns: ["type", "name", "label"],
      rows: [["select_one", "a", "A"], ["select_one no_existe", "b", "B"]],
    });
    const ds = deCatalogo(buildDiagnostics(wb, buildXlsformIndex(wb)));
    expect(ds.map((d) => [d.id, d.level])).toEqual([["catalog-missing-0", "error"], ["catalog-empty-1", "error"]]);
  });

  test("ACNUR: select_one ${HH01_2_aux} sin aviso de catálogo", () => {
    const A = acnur();
    const n = A.nodo("respondent");
    expect(estadoLista(n, new Set(A.idx.catalogs.map((c) => c.listName)))).toBe("dinamica");
    expect(buildDiagnostics(A.workbook, A.idx).filter((d) => d.rowIndex === n.rowIndex && /^catalog-/.test(d.id))).toEqual([]);
  });

  test("nombre inválido con el mismo id y nivel que el servidor, también en una fila de cierre", () => {
    const wb = conListas({
      name: "survey",
      columns: ["type", "name", "label"],
      rows: [["text", "1mal", "Mal"], ["begin_group", "g", "G"], ["end_group", "S1.child_edu_group", ""]],
    });
    const ids = buildDiagnostics(wb, buildXlsformIndex(wb)).filter((d) => d.id.startsWith("name-invalid-"));
    expect(ids.map((d) => [d.id, d.level])).toEqual([["name-invalid-0", "error"], ["name-invalid-2", "error"]]);
  });
});

describe("fusionarDiagnosticos (I1)", () => {
  const d = (id: string, level: BuilderDiagnostic["level"], rowIndex?: number): BuilderDiagnostic => ({ id, level, title: id, detail: "", rowIndex });
  const locales = [
    d("catalog-empty-3", "error", 3),
    d("duplicate-name-edad", "error", 5),
    d("missing-ref-7-relevant-q9", "warn", 7),
    d("name-invalid-9", "error", 9),
  ];
  const remotos = [
    d("select-no-list-12", "error", 12), // lista en la columna list_name: el servidor no la ve
    d("select-missing-list-14-${HH01_2_aux}", "error", 14), // lista dinámica
    d("select-missing-list-3-x", "error", 3),
    d("name-duplicate-edad", "error", 5),
    d("ast-missing-ref-relevant-7-q9", "warn", 7),
    d("name-invalid-9", "error", 9),
    d("ast-unparseable-calculation-20", "warn", 20),
    d("ast-missing-ref-calculation-22-zz", "warn", 22),
    d("ast-missing-ref-choice_filter-133-REF02CO", "warn", 133), // REF02CO es una columna de choices
    d("settings-form-id-invalid", "error"),
  ];

  test("lo que el servidor repite de lo local no entra dos veces y el conteo de errores no cambia al llegar", () => {
    const f = fusionarDiagnosticos(locales, remotos);
    const errores = (ds: BuilderDiagnostic[]) => ds.filter((x) => x.level === "error").length;
    expect(f.map((x) => x.id)).toEqual([
      "catalog-empty-3",
      "duplicate-name-edad",
      "missing-ref-7-relevant-q9",
      "name-invalid-9",
      "ast-unparseable-calculation-20",
      "ast-missing-ref-calculation-22-zz",
      "settings-form-id-invalid",
    ]);
    // Sólo suma lo que el editor no puede saber (form_id con formato inválido).
    expect(errores(f)).toBe(errores(locales) + 1);
  });

  test("descartar el duplicado del servidor no baja la severidad: el local hereda el `error`", () => {
    const loc = [d("name-4", "warn", 4), d("unmatched-end-6", "warn", 6), d("unclosed-g1", "warn", 8), d("settings-id", "warn")];
    const rem = [d("name-empty-4", "error", 4), d("orphan-end-6", "error", 6), d("unclosed-8", "error", 8), d("settings-form-id-empty", "error")];
    const f = fusionarDiagnosticos(loc, rem);
    expect(f.map((x) => x.id)).toEqual(loc.map((x) => x.id));
    expect(f.every((x) => x.level === "error")).toBe(true);
  });

  test("«no se pudo interpretar» es informativo: no marca la fila con un punto", () => {
    expect(fusionarDiagnosticos([], remotos).find((x) => x.id.startsWith("ast-unparseable-"))?.level).toBe("info");
  });
});
