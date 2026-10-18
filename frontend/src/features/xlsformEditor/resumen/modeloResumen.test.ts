import { describe, expect, test } from "vitest";
import type { BuilderNode, BuilderStructure, CatalogSummary, SectionMeta } from "../types";
import {
  minutos,
  marcasDeMinutos,
  ordenarSecciones,
  pendientesParaPublicar,
  porcentaje,
  resumirFormulario,
  rotuloMinutos,
  siguienteOrden,
  type EntradaPendientes,
} from "./modeloResumen";

function nodo(rowIndex: number, sectionId: string, base: string, extra: Partial<BuilderNode> = {}): BuilderNode {
  return {
    rowIndex, depth: 1, kind: "question", label: `P${rowIndex}`, name: `p${rowIndex}`, sectionId,
    typeInfo: { raw: base, base, listName: base.startsWith("select") ? "escala" : "" },
    required: false, relevant: "", constraint: "", calculation: "", choiceFilter: "", hint: "", appearance: "",
    ...extra,
  };
}

function seccion(id: string, name: string, rowIndex: number): SectionMeta {
  return { id, rowIndex, endRowIndex: null, depth: 1, kind: "section", label: name, name, parentId: "root", itemCount: 0 };
}

const catalogos: CatalogSummary[] = [
  { listName: "escala", title: "escala", items: Array.from({ length: 7 }, (_, i) => ({ rowIndex: i, name: String(i), label: String(i) })) as never },
];

function estructura(outline: BuilderNode[], secciones: SectionMeta[]): BuilderStructure {
  return {
    outline,
    byRow: new Map(outline.map((n) => [n.rowIndex, n])),
    sections: new Map([["root", { ...seccion("root", "", 0), kind: "root" as const }], ...secciones.map((s) => [s.id, s] as const)]),
    rowToSectionId: new Map(),
    firstSelectableRow: null,
    spans: new Map(),
    unmatchedEndRows: [],
    unclosedSectionIds: [],
  };
}

describe("resumen del formulario", () => {
  const outline = [
    nodo(2, "s1", "select_one", { required: true }),
    nodo(3, "s1", "text", { relevant: "${p2} = '1'" }),
    nodo(4, "s1", "note", { kind: "note" }),
    nodo(6, "s2", "integer", { required: true }),
    nodo(7, "s2", "select_multiple", { typeInfo: { raw: "select_multiple nada", base: "select_multiple", listName: "nada" } }),
  ];
  const r = resumirFormulario(estructura(outline, [seccion("s1", "Pag1", 1), seccion("s2", "Pag2", 5)]), catalogos);

  test("cifras en lenguaje llano y duración con la regla de siempre", () => {
    expect(r).toMatchObject({ preguntas: 4, notas: 1, secciones: 2, obligatorias: 2, conCondiciones: 1, cerradas: 2, abiertas: 2, listas: 1 });
    // select_one de 7 opciones obligatoria = 30+10; text = 20; integer obligatoria = 30; select_multiple sin lista = 20.
    expect(r.segundos).toBe(40 + 20 + 30 + 20);
    expect(r.tipos.map((t) => t.base)).toEqual(["integer", "select_multiple", "select_one", "text"]);
  });

  test("una fila por sección, con su peso y lo que la distingue", () => {
    expect(r.filasSecciones.map((f) => [f.name, f.preguntas, f.obligatorias, f.conCondiciones, f.segundos])).toEqual([
      ["Pag1", 2, 1, 1, 60],
      ["Pag2", 2, 1, 0, 50],
    ]);
    expect(r.filasSecciones[0].peso).toBe(0.5);
    expect(r.filasSecciones.every((f) => f.pesada)).toBe(true);
  });

  test("detecta la pregunta de selección cuya lista no existe", () => {
    expect(r.sinLista).toEqual([{ rowIndex: 7, name: "p7" }]);
  });

  test("las preguntas fuera de toda sección tienen su propia fila", () => {
    const conRaiz = resumirFormulario(estructura([nodo(1, "root", "text"), ...outline], [seccion("s1", "Pag1", 1), seccion("s2", "Pag2", 5)]), catalogos);
    expect(conRaiz.filasSecciones[0]).toMatchObject({ id: "root", rotulo: "Fuera de toda sección", preguntas: 1 });
  });

  test("ordenar: primero de mayor a menor en columnas numéricas; el empate respeta el orden del formulario", () => {
    const orden = siguienteOrden({ columna: "orden", descendente: false }, "segundos");
    expect(orden).toEqual({ columna: "segundos", descendente: true });
    expect(ordenarSecciones(r.filasSecciones, orden).map((f) => f.name)).toEqual(["Pag1", "Pag2"]);
    expect(ordenarSecciones(r.filasSecciones, siguienteOrden(orden, "segundos")).map((f) => f.name)).toEqual(["Pag2", "Pag1"]);
  });

  test("formatos", () => {
    expect(minutos(0)).toBe("0");
    expect(minutos(30)).toBe("< 1");
    expect(minutos(89)).toBe("1");
    expect(minutos(2580)).toBe("43");
    expect(porcentaje(86, 87)).toBe("99 %");
    expect(porcentaje(1, 0)).toBe("0 %");
  });

  test("marcas del recorrido: cada 10 min (cada 5 si es corto), sin pasar del total", () => {
    expect(marcasDeMinutos(2580)).toEqual([0, 10, 20, 30, 40]);
    expect(marcasDeMinutos(15 * 60)).toEqual([0, 5, 10, 15]);
    expect(marcasDeMinutos(0)).toEqual([]);
  });
});

describe("qué falta para publicar e imprimir", () => {
  const base: EntradaPendientes = {
    logica: { pendiente: false, externa: null },
    escalasRepetidas: 0,
    diagnosticos: { errores: 0, avisos: 0, primeraFila: null },
    sinLista: [],
    impreso: { estado: "sin-previa", paginas: null },
  };

  test("todo en orden sólo deja el impreso sin previa como pendiente neutro", () => {
    const items = pendientesParaPublicar(base);
    expect(items.map((i) => [i.clave, i.estado])).toEqual([
      ["logica", "listo"], ["escalas", "listo"], ["avisos", "listo"], ["sin-lista", "listo"], ["impreso", "neutro"],
    ]);
    expect(items.at(-1)?.accion?.destino).toEqual({ tipo: "impreso" });
  });

  test("cada pendiente lleva al lugar donde se resuelve", () => {
    const items = pendientesParaPublicar({
      ...base,
      logica: { pendiente: true, externa: null },
      escalasRepetidas: 3,
      diagnosticos: { errores: 1, avisos: 2, primeraFila: 12 },
      sinLista: [{ rowIndex: 7, name: "p7" }],
      impreso: { estado: "al-dia", paginas: 8 },
    });
    const por = Object.fromEntries(items.map((i) => [i.clave, i]));
    expect(por.logica).toMatchObject({ estado: "aviso", accion: { destino: { tipo: "revisar-logica" } } });
    expect(por.escalas).toMatchObject({ estado: "aviso", titulo: "3 escalas repetidas", accion: { destino: { tipo: "listas" } } });
    expect(por.avisos).toMatchObject({ estado: "error", titulo: "1 error y 2 avisos", accion: { destino: { tipo: "fila", rowIndex: 12 } } });
    expect(por["sin-lista"]).toMatchObject({ estado: "error", accion: { destino: { tipo: "pregunta", name: "p7" } } });
    expect(por.impreso).toMatchObject({ estado: "listo", detalle: "8 páginas en A4. Al día con el formulario." });
  });

  test("la lógica declarada fuera se informa en neutro, sin pedir revisión", () => {
    const [logica] = pendientesParaPublicar({ ...base, logica: { pendiente: false, externa: "Lógica: fuera de Prosecnur · SPSS" } });
    expect(logica).toMatchObject({ estado: "neutro", detalle: "Lógica: fuera de Prosecnur · SPSS" });
    expect(logica.accion).toBeUndefined();
  });
});

describe("S14: cifras que cuadran y eje legible", () => {
  test("los automáticos (inicio, fin) no son preguntas ni suman tiempo, y no abren «Fuera de toda sección»", () => {
    const outline = [
      nodo(0, "root", "start", { name: "start", label: "" }),
      nodo(1, "root", "end", { name: "end", label: "" }),
      nodo(3, "s1", "integer"),
    ];
    const r = resumirFormulario(estructura(outline, [seccion("s1", "Pag1", 2)]), catalogos);
    expect(r.preguntas).toBe(1);
    expect(r.segundos).toBe(20);
    expect(r.filasSecciones.map((f) => f.id)).toEqual(["s1"]);
  });

  test("el piso del recorrido deja fuera lo condicional, propio o heredado de la sección", () => {
    const outline = [
      { ...nodo(1, "root", "begin_group"), kind: "section" as const, relevant: "${p0} = '1'", name: "s2" },
      nodo(2, "s1", "integer"),
      nodo(3, "s1", "integer", { relevant: "${p2} > 1" }),
      nodo(5, "s2", "integer"),
    ];
    const r = resumirFormulario(estructura(outline, [seccion("s1", "Pag1", 0), seccion("s2", "Pag2", 1)]), catalogos);
    expect(r.condicionales).toBe(2);
    expect(r.segundosSinCondicion).toBe(20);
    expect(r.segundos).toBe(60);
  });

  test("301 minutos se rotulan por hora, sin amontonar", () => {
    expect(marcasDeMinutos(301 * 60)).toEqual([0, 60, 120, 180, 240, 300]);
    expect(rotuloMinutos(120)).toBe("2 h");
    expect(rotuloMinutos(90)).toBe("1 h 30");
    expect(rotuloMinutos(45)).toBe("45 min");
  });
});
