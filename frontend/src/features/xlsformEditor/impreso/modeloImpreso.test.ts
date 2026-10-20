import { afterEach, describe, expect, test, vi } from "vitest";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import type { BuilderNode, BuilderStructure } from "../types";
import { DEFAULT_PDF_DIALOG_STATE, buildPaperExportOptions, matrixSignature } from "../shell/pdfExportPreference";
import {
  candidatasSugeribles,
  conSugerenciasApagadas,
  contarPaginasPdf,
  filasConPapel,
  rotuloAjustesPapel,
  resumenCabecera,
  resumenDeParte,
  separarCandidatas,
} from "./modeloImpreso";
import { generarPrevia, previaVieja, usePreviaImpreso } from "./storePrevia";
import { opcionesLayoutImpreso } from "../canvas/paperLayout";

function candidata(id: string, count: number): MatrixCandidate {
  return {
    id,
    sectionLabel: "Sección",
    listName: `escala_${id}`,
    count,
    memberNames: Array.from({ length: count }, (_, i) => `${id}_${i + 1}`),
    questionLabels: Array.from({ length: count }, (_, i) => `Pregunta ${i + 1}`),
    scaleOptions: [{ code: "1", label: "Nada" }, { code: "5", label: "Mucho" }],
  };
}

function nodo(rowIndex: number, name: string, extra: Partial<BuilderNode> = {}): BuilderNode {
  return {
    rowIndex, depth: 0, kind: "question", label: `Texto ${name}`, name, sectionId: "root",
    typeInfo: { raw: "text", base: "text", listName: "" }, required: false, relevant: "", constraint: "",
    calculation: "", choiceFilter: "", hint: "", appearance: "", ...extra,
  };
}

const estado = { ...DEFAULT_PDF_DIALOG_STATE, matrices: {} };

describe("matrices del impreso", () => {
  test("las de 2+ preguntas van primero en su orden; las de una sola, aparte", () => {
    const todas = [candidata("a", 1), candidata("b", 4), candidata("c", 1), candidata("d", 6), candidata("e", 1)];
    const { matrices, sueltas } = separarCandidatas(todas);
    expect(matrices.map((c) => c.id)).toEqual(["b", "d"]);
    expect(sueltas.map((c) => c.id)).toEqual(["a", "c", "e"]);
  });

  test("el resumen cuenta las activas sobre el total (las sugerencias nacen apagadas)", () => {
    const todas = [candidata("a", 1), candidata("b", 4), candidata("d", 6)];
    const ctx = { candidatas: todas, consentimiento: [], filasPapel: 0 };
    // El total cuenta sólo las sugeribles (b y d): una suelta activada no suma.
    expect(resumenDeParte("matrices", estado, ctx)).toBe("0 de 2 como tabla");
    const conSuelta = { ...estado, matrices: { [matrixSignature(todas[0])]: { enabled: true } } };
    expect(resumenDeParte("matrices", conSuelta, ctx)).toBe("0 de 2 como tabla");
    const conMatriz = { ...estado, matrices: { [matrixSignature(todas[1])]: { enabled: true } } };
    expect(resumenDeParte("matrices", conMatriz, ctx)).toBe("1 de 2 como tabla");
    expect(resumenDeParte("matrices", estado, { ...ctx, candidatas: [candidata("s", 1)] })).toBe("Ninguna detectada");
    expect(resumenDeParte("matrices", estado, { ...ctx, candidatas: [] })).toBe("Ninguna detectada");
  });
});

describe("resúmenes de una línea", () => {
  const ctx = { candidatas: [], consentimiento: [{ name: "consent", label: "¿Acepta?" }], filasPapel: 3 };

  test("formato, lógica, contenido y papel dicen lo elegido", () => {
    expect(resumenDeParte("formato", estado, ctx)).toBe("Dos columnas · con N.º");
    expect(resumenDeParte("formato", { ...estado, columns: "auto", showQuestionnaireNumber: false }, ctx))
      .toBe("Columnas automáticas · sin N.º");
    expect(resumenDeParte("logica", estado, ctx)).toBe("Saltos · sin consentimiento");
    expect(resumenDeParte("logica", { ...estado, logicLanguage: "condiciones", consentVar: "consent" }, ctx))
      .toBe("Condiciones · con consentimiento");
    // Una variable que ya no está entre las candidatas no cuenta como consentimiento.
    expect(resumenDeParte("logica", { ...estado, consentVar: "ya_no_existe" }, ctx)).toBe("Saltos · sin consentimiento");
    expect(resumenDeParte("contenido", estado, ctx)).toBe("Instrucciones · 18 opciones");
    expect(resumenDeParte("papel", estado, ctx)).toBe("3 filas con ajustes");
    expect(resumenDeParte("papel", estado, { ...ctx, filasPapel: 1 })).toBe("1 fila con ajustes");
    expect(resumenDeParte("papel", estado, { ...ctx, filasPapel: 0 })).toBe("Ninguna fila con ajustes");
  });
});

describe("papel por pregunta", () => {
  test("lista las filas con algún paper_* y qué columnas usan", () => {
    const outline = [
      nodo(3, "p1"),
      nodo(4, "p2", { paperNumber: "108", paperSubgroup: "D.4" }),
      nodo(5, "p3", { paperLayout: "  " }),
      nodo(6, "p4", { paperOnly: "yes" }),
    ];
    const structure = { outline } as unknown as BuilderStructure;
    expect(filasConPapel(structure)).toEqual([
      { rowIndex: 4, name: "p2", label: "Texto p2", columnas: ["paper_number", "paper_subgroup"] },
      { rowIndex: 6, name: "p4", label: "Texto p4", columnas: ["paper_only"] },
    ]);
    expect(filasConPapel(null)).toEqual([]);
  });
});

describe("cifras de la previa", () => {
  const pdf = (cuerpo: string) => new TextEncoder().encode(`%PDF-1.7\n${cuerpo}`);

  test("cuenta /Type /Page y no /Pages; un archivo que no es PDF no da cifra", async () => {
    expect(await contarPaginasPdf(pdf("<< /Type /Pages /Count 3 >> << /Type /Page >> << /Type/Page >> << /Type /Page/Parent 2 0 R >>"))).toBe(3);
    expect(await contarPaginasPdf(new TextEncoder().encode("<html>no</html>"))).toBeNull();
    expect(await contarPaginasPdf(pdf("<< /Type /Pages >>"))).toBeNull();
  });

  test("también cuenta las páginas guardadas en flujos de objetos comprimidos (/ObjStm)", async () => {
    // Así sale el PDF del motor (cairo): los diccionarios de página van dentro de un /ObjStm con FlateDecode.
    const objetos = new TextEncoder().encode("5 0 6 30 << /Type /Page /Parent 2 0 R >> << /Type /Page /Parent 2 0 R >> << /Type /Pages /Count 2 >>");
    const comprimido = new Uint8Array(await new Response(
      new Blob([objetos]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer());
    const cabeza = new TextEncoder().encode(`%PDF-1.7\n9 0 obj\n<< /Type /ObjStm /N 3 /First 8 /Filter /FlateDecode /Length ${comprimido.length} >>\nstream\n`);
    const cola = new TextEncoder().encode("\nendstream\nendobj\n%%EOF");
    const archivo = new Uint8Array(cabeza.length + comprimido.length + cola.length);
    archivo.set(cabeza, 0);
    archivo.set(comprimido, cabeza.length);
    archivo.set(cola, cabeza.length + comprimido.length);
    expect(await contarPaginasPdf(archivo)).toBe(2);
  });

  test("la cabecera no inventa cifras sin previa", () => {
    expect(resumenCabecera(null)).toBe("A4");
    expect(resumenCabecera({ paginas: 12, preguntas: 87 })).toBe("A4 · 12 páginas · 87 preguntas");
    expect(resumenCabecera({ paginas: null, preguntas: 1 })).toBe("A4 · 1 pregunta");
  });
});

describe("previa", () => {
  afterEach(() => usePreviaImpreso.setState({
    formId: null, fase: "inactiva", detalle: "", url: null, cifras: null, firma: null, workbook: null, error: "",
  }));

  const workbook = { survey: { columns: [], rows: [] } } as never;
  const opciones = buildPaperExportOptions(estado, [], []);

  test("genera con el job de export-pdf, cuenta páginas y caduca al cambiar opciones o formulario", async () => {
    const fases: string[] = [];
    const unsub = usePreviaImpreso.subscribe((s) => fases.push(s.fase));
    await generarPrevia({ formId: "f1", workbook, filename: "x.pdf", opciones }, {
      exportar: vi.fn(async () => ({ ok: true as const, job_id: "j1" })) as never,
      esperar: vi.fn(async (_id, o) => {
        o?.onFase?.("Dibujando");
        return { ok: true as const, file_id: "file1", original_name: "x.pdf", size: 10, warnings: [],
          summary: { n_blocks: 4, n_questions: 87, n_sections: 3, n_matrices: 1 } };
      }),
      descargar: async () => new TextEncoder().encode("%PDF-1.7 /Type /Page /Type /Page"),
      crearUrl: () => "blob:previa",
    });
    unsub();
    const s = usePreviaImpreso.getState();
    expect(fases).toContain("generando");
    expect(fases).toContain("descargando");
    expect(s.fase).toBe("lista");
    expect(s.url).toBe("blob:previa");
    expect(s.cifras).toEqual({ paginas: 2, preguntas: 87 });
    expect(previaVieja(s, opciones, workbook)).toBe(false);
    expect(previaVieja(s, { ...opciones, columns: 1 }, workbook)).toBe(true);
    expect(previaVieja(s, opciones, { ...(workbook as object) } as never)).toBe(true);
  });

  test("un error del job queda dicho, no se traga", async () => {
    await generarPrevia({ formId: "f1", workbook, filename: "x.pdf", opciones }, {
      exportar: vi.fn(async () => ({ ok: true as const, job_id: "j1" })) as never,
      esperar: vi.fn(async () => { throw new Error("El worker murió."); }),
      descargar: async () => new Uint8Array(),
      crearUrl: () => "",
    });
    expect(usePreviaImpreso.getState()).toMatchObject({ fase: "error", error: "El worker murió." });
  });
});

describe("layout impreso", () => {
  test("sólo lo que el motor respeta, y automático; un valor ajeno de la fila se conserva", () => {
    expect(opcionesLayoutImpreso("wide").map((o) => o.valor)).toEqual(["", "full", "wide", "all_choices"]);
    expect(opcionesLayoutImpreso(undefined)).toHaveLength(4);
    expect(opcionesLayoutImpreso("matrix").at(-1)).toEqual({ valor: "matrix", rotulo: "matrix (valor de la fila)" });
    expect(opcionesLayoutImpreso("horizontal").at(-1)).toEqual({ valor: "horizontal", rotulo: "horizontal (valor de la fila)" });
  });
});

describe("sugerencias de matriz (E7)", () => {
  test("una lista larga (Country) no se sugiere; 7 opciones o menos sí", () => {
    const corta = candidata("corta", 3);
    const larga = { ...candidata("pais", 2), listName: "Country",
      scaleOptions: Array.from({ length: 250 }, (_, i) => ({ code: String(i), label: `País ${i}` })) };
    const siete = { ...candidata("siete", 2),
      scaleOptions: Array.from({ length: 7 }, (_, i) => ({ code: String(i), label: `${i}` })) };
    expect(candidatasSugeribles([corta, larga, siete]).map((c) => c.id)).toEqual(["corta", "siete"]);
  });

  test("nacen apagadas, salvo lo que ya se eligió; no viajan al motor apagadas", () => {
    const a = candidata("a", 3);
    const b = candidata("b", 2);
    const matrices = conSugerenciasApagadas([a, b], { [matrixSignature(b)]: { enabled: true, tenor: "T" } });
    expect(matrices[matrixSignature(a)]).toEqual({ enabled: false });
    expect(matrices[matrixSignature(b)]).toEqual({ enabled: true, tenor: "T" });
    const opciones = buildPaperExportOptions({ ...estado, matrices }, [a, b], []);
    expect(opciones.matrix_groups.map((g) => g.members)).toEqual([b.memberNames]);
  });
});

describe("rótulo de ajustes de papel", () => {
  test("con palabras, no con columnas", () => {
    expect(rotuloAjustesPapel([])).toBe("Sin ajustes todavía");
    expect(rotuloAjustesPapel(["paper_number"])).toBe("Número");
    expect(rotuloAjustesPapel(["paper_number", "paper_skip", "paper_layout"])).toBe("Número, salto y ancho");
  });
});
