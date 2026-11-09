// Modelo de la Estructura. Mata: una pregunta que se dibuja fuera de su sección, un cierre que reaparece como fila,
// un filtro que pierde la sección de sus resultados o que cuenta mal «N de M», una búsqueda sensible a tildes, un
// hueco que cae dentro de la sección equivocada y un plan que mueve una sección dentro de sí misma.
import { describe, expect, test } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { applyRowMove } from "./outlineUtils";
import type { BuilderNode, XlsformEditorSheet } from "../types";
import {
  construirArbol,
  filtrarArbol,
  huecoEntre,
  lineaVecina,
  lineasVisibles,
  planMoverA,
  siguienteBajoPuntero,
  siguienteBajoPunteroEn,
  subtituloEstructura,
  textoDestino,
  type HechosFila,
  type NodoArbol,
} from "./modeloEstructura";

function hoja(rows: string[][]): XlsformEditorSheet {
  return { name: "survey", columns: ["type", "name", "label", "relevant"], rows };
}

// 0 q0 · 1 begin A · 2 a1 · 3 a2 · 4 begin B (anidada) · 5 b1 · 6 end B · 7 end A · 8 begin C · 9 end C · 10 q9
const filas = [
  ["text", "q0", "Antes"],
  ["begin_group", "A", "Educación", "${q0} = '1'"],
  ["integer", "a1", "Edad"],
  ["text", "a2", "Nombre de la institución"],
  ["begin_repeat", "B", "Miembros"],
  ["text", "b1", "Nombre del miembro"],
  ["end_repeat", "", ""],
  ["end_group", "", ""],
  ["begin_group", "C", "Vacía"],
  ["end_group", "", ""],
  ["text", "q9", "Después"],
];
const survey = hoja(filas);
const s = parseBuilderStructure(survey);
const arbol = construirArbol(s);

const forma = (hijos: readonly NodoArbol[]): unknown[] =>
  hijos.map((h) => (h.tipo === "fila" ? h.nodo.name : { [h.nodo.name]: forma(h.hijos) }));

describe("construirArbol", () => {
  test("las secciones contienen a sus hijos y los cierres no son filas", () => {
    expect(forma(arbol.hijos)).toEqual(["q0", { A: ["a1", "a2", { B: ["b1"] }] }, { C: [] }, "q9"]);
  });
  test("fin de cada contenedor: la fila de su cierre; el del formulario, después del último bloque", () => {
    const A = arbol.hijos[1];
    const C = arbol.hijos[2];
    expect(A.tipo === "seccion" && A.finSlot).toBe(7);
    expect(C.tipo === "seccion" && C.finSlot).toBe(9);
    expect(arbol.finSlot).toBe(11);
  });
});

describe("filtrarArbol", () => {
  const nada: HechosFila = { cond: false, oblig: false, regla: false, sinLista: false, aviso: false };
  const hechos = (n: BuilderNode): HechosFila => ({ ...nada, cond: !!n.relevant, aviso: n.name === "b1" });
  const texto = (n: BuilderNode) => n.label;

  test("sin criterios devuelve el árbol entero y cuenta las piezas", () => {
    const r = filtrarArbol(arbol, { consulta: "  ", filtro: "todas" }, hechos, texto);
    expect(r.activo).toBe(false);
    expect(r).toMatchObject({ coinciden: 5, total: 5 });
  });
  test("la búsqueda ignora tildes y mayúsculas y conserva la sección del resultado", () => {
    const r = filtrarArbol(arbol, { consulta: "institucion", filtro: "todas" }, hechos, texto);
    expect(forma(r.arbol.hijos)).toEqual([{ A: ["a2"] }]);
    expect(r).toMatchObject({ coinciden: 1, total: 5, activo: true });
  });
  test("busca también por código", () => {
    const r = filtrarArbol(arbol, { consulta: "B1", filtro: "todas" }, hechos, texto);
    expect(forma(r.arbol.hijos)).toEqual([{ A: [{ B: ["b1"] }] }]);
  });
  test("con búsqueda de texto, una sección que casa trae todo su contenido", () => {
    const r = filtrarArbol(arbol, { consulta: "educacion", filtro: "todas" }, hechos, texto);
    expect(forma(r.arbol.hijos)).toEqual([{ A: ["a1", "a2", { B: ["b1"] }] }]);
    expect(r).toMatchObject({ coinciden: 3, porMarca: false });
  });
  test("con un filtro rápido, la sección marcada NO arrastra su contenido y cuenta líneas marcadas", () => {
    const r = filtrarArbol(arbol, { consulta: "", filtro: "cond" }, hechos, texto);
    expect(forma(r.arbol.hijos)).toEqual([{ A: [] }]);
    expect(r).toMatchObject({ coinciden: 1, porMarca: true });
  });
  test('"Con aviso" cuenta exactamente las líneas con punto, secciones incluidas', () => {
    const conAviso = (n: BuilderNode): HechosFila => ({ ...nada, aviso: n.name === "b1" || n.name === "A" || n.name === "q9" });
    const r = filtrarArbol(arbol, { consulta: "", filtro: "aviso" }, conAviso, texto);
    expect(forma(r.arbol.hijos)).toEqual([{ A: [{ B: ["b1"] }] }, "q9"]);
    // A, b1 y q9 llevan punto; B sólo aparece como contenedor de b1.
    expect(r.coinciden).toBe(3);
  });
  test("búsqueda y filtro se combinan", () => {
    const r = filtrarArbol(arbol, { consulta: "nombre", filtro: "aviso" }, hechos, texto);
    expect(forma(r.arbol.hijos)).toEqual([{ A: [{ B: ["b1"] }] }]);
  });
  test('"N de M" cuenta con el mismo criterio que el subtítulo', () => {
    const soloTexto = (n: BuilderNode) => n.typeInfo.base === "text";
    const r = filtrarArbol(arbol, { consulta: "nombre", filtro: "todas" }, hechos, texto, soloTexto);
    // q0, a2, b1, q9 son texto; casan «Nombre de la institución» y «Nombre del miembro».
    expect(r).toMatchObject({ coinciden: 2, total: 4 });
  });
  test("sin resultados", () => {
    const r = filtrarArbol(arbol, { consulta: "zzz", filtro: "todas" }, hechos, texto);
    expect(r.arbol.hijos).toEqual([]);
    expect(r.coinciden).toBe(0);
  });
});

describe("lineasVisibles y teclado", () => {
  test("las secciones plegadas esconden su contenido", () => {
    const l = lineasVisibles(arbol, (f) => f === 4);
    expect(l.map((x) => x.fila)).toEqual([0, 1, 2, 3, 4, 8, 10]);
    expect(l.find((x) => x.fila === 2)?.contenedor).toBe(1);
  });
  test("excluir saca el bloque arrastrado con todo su contenido", () => {
    expect(lineasVisibles(arbol, () => false, 1).map((x) => x.fila)).toEqual([0, 8, 10]);
  });
  test("vecinas para las flechas", () => {
    const l = lineasVisibles(arbol, () => false);
    expect(lineaVecina(l, 3, 1)?.fila).toBe(4);
    expect(lineaVecina(l, 0, -1)).toBeNull();
    expect(lineaVecina(l, 99, 1)?.fila).toBe(0);
  });
});

describe("huecoEntre", () => {
  // Arrastrando q9 (fila 10): las líneas sin ella.
  const l = lineasVisibles(arbol, () => false, 10);
  const idx = (fila: number) => l.findIndex((x) => x.fila === fila);

  test("sobre una pregunta cae antes de ella, en su sección", () => {
    expect(huecoEntre(s, l, idx(3))).toEqual({ indice: 3, contenedor: 1 });
  });
  test("sobre la cabecera de una sección cae al final de la sección anterior", () => {
    // Antes de C: la línea anterior es b1, dentro de B.
    expect(huecoEntre(s, l, idx(8))).toEqual({ indice: 6, contenedor: 4 });
  });
  test("debajo de todo cae dentro de la sección vacía si es la última abierta", () => {
    expect(huecoEntre(s, l, l.length)).toEqual({ indice: 9, contenedor: 8 });
  });
  test("después de una sección plegada cae fuera de ella", () => {
    const lp = lineasVisibles(arbol, (f) => f === 8, 10);
    expect(huecoEntre(s, lp, lp.length)).toEqual({ indice: 10, contenedor: null });
  });
  test("arriba de todo cae antes de la primera línea", () => {
    expect(huecoEntre(s, l, 0)).toEqual({ indice: 0, contenedor: null });
  });
  test("siguienteBajoPuntero", () => {
    expect(siguienteBajoPuntero([10, 30, 50], 5)).toBe(0);
    expect(siguienteBajoPuntero([10, 30, 50], 31)).toBe(2);
    expect(siguienteBajoPuntero([10, 30, 50], 99)).toBe(3);
  });
});

describe("planMoverA", () => {
  const mover = (desde: number, indice: number) => {
    const plan = planMoverA(s, desde, indice);
    if (!plan) return null;
    const copia = hoja(filas.map((f) => [...f]));
    applyRowMove(copia, plan);
    return copia.rows.map((r) => r[1] || r[0]);
  };
  test("una pregunta de afuera entra a otra sección", () => {
    expect(mover(10, 9)).toEqual(["q0", "A", "a1", "a2", "B", "b1", "end_repeat", "end_group", "C", "q9", "end_group"]);
  });
  test("una pregunta sube a la sección anterior", () => {
    expect(mover(0, 3)).toEqual(["A", "a1", "q0", "a2", "B", "b1", "end_repeat", "end_group", "C", "end_group", "q9"]);
  });
  test("una sección se mueve con todo su bloque", () => {
    expect(mover(4, 2)).toEqual(["q0", "A", "B", "b1", "end_repeat", "a1", "a2", "end_group", "C", "end_group", "q9"]);
  });
  test("no se mueve donde ya está ni dentro de sí misma", () => {
    expect(planMoverA(s, 2, 2)).toBeNull();
    expect(planMoverA(s, 2, 3)).toBeNull();
    expect(planMoverA(s, 1, 5)).toBeNull();
    expect(planMoverA(s, 1, 8)).toBeNull();
  });
});

describe("subtituloEstructura", () => {
  test("preguntas en secciones, con singular", () => {
    expect(subtituloEstructura(31, 13)).toBe("31 preguntas en 13 secciones");
    expect(subtituloEstructura(1, 1)).toBe("1 pregunta en 1 sección");
  });
});

describe("textoDestino (M3)", () => {
  const t = (n: BuilderNode) => n.label;
  test("debajo de una pregunta, después de una sección plegada, al inicio de una sección o del formulario", () => {
    expect(textoDestino(s, { despuesDeFila: 2, seccionFila: 1 }, t)).toBe('Se agrega debajo de "Edad"');
    expect(textoDestino(s, { despuesDeFila: 8, seccionFila: null }, t)).toBe('Se agrega después de "Vacía"');
    expect(textoDestino(s, { despuesDeFila: null, seccionFila: 1 }, t)).toBe('Se agrega al inicio de "Educación"');
    expect(textoDestino(s, { despuesDeFila: null, seccionFila: null }, t)).toBe("Se agrega al inicio del formulario");
  });
});

describe("siguienteBajoPunteroEn (búsqueda binaria del arrastre)", () => {
  test("da lo mismo que recorrer todos los centros, leyendo pocos", () => {
    const centros = Array.from({ length: 824 }, (_, i) => 20 + i * 44);
    for (const y of [-5, 0, 19, 20, 21, 500, 8000, 36000, 99999]) {
      let lecturas = 0;
      const r = siguienteBajoPunteroEn(centros.length, (i) => { lecturas += 1; return centros[i]!; }, y);
      expect(r).toBe(siguienteBajoPuntero(centros, y));
      expect(lecturas).toBeLessThanOrEqual(11);
    }
  });
});

// C5 (elección por pares, 2026-11-07). Mata: cálculos del sorteo que se ven sueltos, un sorteo que junta dos pares o
// cálculos no seguidos, un sorteo plegado cuyo contenido sigue en las líneas del teclado, y un hueco que cae dentro
// del sorteo plegado.
describe("sorteo de un par", () => {
  // 0 q0 · 1 begin P1 · 2 r1 · 3 n1 · 4 t1 · 5 tabla · 6 end · 7 r2 · 8 n2 · 9 q9
  const s = parseBuilderStructure(hoja([
    ["text", "q0", "Antes"],
    ["begin_group", "P1", "Par 1 de 2"],
    ["calculate", "t1A_r_x", ""],
    ["calculate", "t1A_x", ""],
    ["calculate", "t1A_x_txt", ""],
    ["note", "t1_tabla", "Tabla"],
    ["end_group", "", ""],
    ["calculate", "t2A_r_x", ""],
    ["calculate", "t2A_x", ""],
    ["text", "q9", "Después"],
  ]));
  const tarea = (f: number) => (f >= 2 && f <= 4 ? 1 : f >= 7 && f <= 8 ? 2 : undefined);
  const arbol = construirArbol(s, tarea);

  test("los cálculos seguidos de un par se juntan en una línea, dentro de su grupo o sueltos", () => {
    const par1 = arbol.hijos[1]!;
    expect(par1.tipo).toBe("seccion");
    if (par1.tipo !== "seccion") return;
    expect(par1.hijos.map((h) => h.tipo)).toEqual(["sorteo", "fila"]);
    const suelto = arbol.hijos[2]!;
    expect(suelto.tipo === "sorteo" && suelto.tarea === 2 && suelto.hijos.length === 2 && suelto.finSlot === 9).toBe(true);
  });

  test("plegado no deja sus cálculos en las líneas; abierto, sí", () => {
    const plegado = lineasVisibles(arbol, () => true).map((l) => l.fila);
    expect(plegado).not.toContain(7);
    expect(lineasVisibles(arbol, () => false).map((l) => l.fila)).toContain(7);
  });

  test("el hueco después de un sorteo plegado cae tras su último cálculo", () => {
    const ls = lineasVisibles(arbol, (f) => f < 0);
    const i = ls.findIndex((l) => l.tipo === "sorteo" && l.inicio === 7);
    expect(huecoEntre(s, ls, i + 1)).toEqual({ indice: 9, contenedor: null });
    expect(huecoEntre(s, ls, i)).toEqual({ indice: 7, contenedor: null });
  });
});

// C7 (elección por pares, 2026-11-07). Mata: pares que se ven como secciones sueltas, una cabecera que se traga una
// pregunta ajena puesta entre dos pares, y un experimento plegado cuyos pares siguen en las líneas del teclado.
describe("experimento de elección por pares", () => {
  // 0 q0 · 1 intro · 2 begin P1 · 3 r1 · 4 tabla1 · 5 end · 6 begin P2 · 7 r2 · 8 tabla2 · 9 end · 10 q9
  const filasExp = [
    ["text", "q0", "Antes"],
    ["note", "intro", "Le mostraré dos personas"],
    ["begin_group", "tarea1", "Par 1 de 2"],
    ["calculate", "t1A_r_x", ""],
    ["note", "t1_tabla", "Tabla"],
    ["end_group", "", ""],
    ["begin_group", "tarea2", "Par 2 de 2"],
    ["calculate", "t2A_r_x", ""],
    ["note", "t2_tabla", "Tabla"],
    ["end_group", "", ""],
    ["text", "q9", "Después"],
  ];
  const tarea = (f: number) => (f === 3 ? 1 : f === 7 ? 2 : undefined);
  const exp = [{ filas: new Set([1, 2, 6]), titulo: "Experimento de elección por pares", resumen: "2 pares, 1 atributos" }];

  test("la introducción y los pares quedan bajo una cabecera, con su sorteo adentro", () => {
    const a = construirArbol(parseBuilderStructure(hoja(filasExp)), tarea, exp);
    expect(a.hijos.map((h) => h.tipo)).toEqual(["fila", "experimento", "fila"]);
    const e = a.hijos[1]!;
    if (e.tipo !== "experimento") return;
    expect(e.titulo).toBe("Experimento de elección por pares");
    expect(e.hijos.map((h) => h.nodo.name)).toEqual(["intro", "tarea1", "tarea2"]);
    expect(e.finSlot).toBe(10);
    const par1 = e.hijos[1]!;
    expect(par1.tipo === "seccion" && par1.hijos[0]!.tipo === "sorteo").toBe(true);
  });

  test("con una pregunta ajena entre dos pares no se junta nada", () => {
    const con = [...filasExp.slice(0, 6), ["text", "ajena", "Otra"], ...filasExp.slice(6)];
    const a = construirArbol(parseBuilderStructure(hoja(con)), undefined, [{ filas: new Set([1, 2, 7]), titulo: "E", resumen: "" }]);
    expect(a.hijos.some((h) => h.tipo === "experimento")).toBe(false);
  });

  test("plegado, sus pares salen de las líneas; el hueco de después cae tras el último par", () => {
    const s = parseBuilderStructure(hoja(filasExp));
    const a = construirArbol(s, tarea, exp);
    const ls = lineasVisibles(a, (f) => f < 0);
    expect(ls.map((l) => l.tipo)).toEqual(["fila", "experimento", "fila"]);
    expect(huecoEntre(s, ls, 2)).toEqual({ indice: 10, contenedor: null });
  });
});

test("dos experimentos, dos cabeceras: cada una con sus piezas (C11)", () => {
  // 0 q0 · 1 begin P1 · 2 tabla · 3 end · 4 begin V1 · 5 nota · 6 end · 7 begin V2 · 8 nota · 9 end
  const s = parseBuilderStructure(hoja([
    ["text", "q0", "Antes"],
    ["begin_group", "tarea1", "Par 1 de 1"], ["note", "t1_tabla", "Tabla"], ["end_group", "", ""],
    ["begin_group", "vi_vineta1", "Viñeta 1 de 2"], ["note", "vi_v1_texto", "Escenario"], ["end_group", "", ""],
    ["begin_group", "vi_vineta2", "Viñeta 2 de 2"], ["note", "vi_v2_texto", "Escenario"], ["end_group", "", ""],
  ]));
  const a = construirArbol(s, undefined, [
    { filas: new Set([1]), titulo: "Experimento de elección por pares", resumen: "1 par" },
    { filas: new Set([4, 7]), titulo: "Experimento de viñetas", resumen: "2 viñetas" },
  ]);
  expect(a.hijos.map((h) => (h.tipo === "experimento" ? `${h.titulo}:${h.hijos.length}` : h.tipo))).toEqual([
    "fila", "Experimento de elección por pares:1", "Experimento de viñetas:2",
  ]);
});

test("una cabecera junta también un sorteo de primer nivel (versiones y lista, C14)", () => {
  // 0 q0 · 1 r · 2 version · 3 texto · 4 P5 · 5 q9
  const s = parseBuilderStructure(hoja([
    ["text", "q0", "Antes"],
    ["calculate", "vs_r", ""], ["calculate", "vs_version", ""], ["calculate", "vs_texto", ""],
    ["integer", "P5", "${vs_texto}"],
    ["text", "q9", "Después"],
  ]));
  const a = construirArbol(s, (f) => (f >= 1 && f <= 3 ? 1 : undefined), [{ filas: new Set([1, 2, 3, 4]), titulo: "Versiones al azar", resumen: "P5: 2 versiones" }]);
  expect(a.hijos.map((h) => h.tipo)).toEqual(["fila", "experimento", "fila"]);
  const e = a.hijos[1]!;
  expect(e.tipo === "experimento" && e.hijos.map((h) => h.tipo).join()).toBe("sorteo,fila");
});
