// «Revisar emparejado» (ADR 0135 §7): estados por pregunta, filtros, confirmar/cambiar/descartar/quitar en la lámina y
// la unión con la matriz sin duplicar ni perder filas.
import { describe, expect, it } from "vitest";
import type { EquivalenciaFila } from "../../../../api/equivalencias";
import { normalizarEmparejado, type Emparejado, type PreguntaEmparejado } from "../../../../api/graficosEmparejado";
import type { TemaPublicos } from "../../multiapiladas/temasPublicos";
import {
  avisoUnion, confirmadosDe, confirmarPar, contarEstados, filasEmparejado, filtrarFilas, hayCambiosEnUnion, paresDeLamina,
  quitarPar, resumenEmparejado, rotuloFiltro, unirConMatriz,
} from "./modeloEmparejado";

const B = ["docentes", "estudiantes"] as const;

const P = (base: string, v: string, extra: Partial<PreguntaEmparejado> = {}): PreguntaEmparejado => ({
  base, var: v, etiqueta: `Texto ${v}`, tema: `Texto ${v}`, estado: "sin_par", par: null, sugerencias: [], ...extra,
});

const DATOS: Emparejado = {
  bases: [...B],
  preguntas: [
    P("docentes", "p1", { estado: "matriz", tema: "Clima", par: { base: "estudiantes", var: "q1", etiqueta: "Texto q1" } }),
    P("docentes", "p2", { sugerencias: [
      { base: "estudiantes", var: "q2", etiqueta: "Texto q2", puntaje: 0.8 },
      { base: "estudiantes", var: "q3", etiqueta: "Texto q3", puntaje: 0.4 },
    ] }),
    P("docentes", "p3"),
    P("estudiantes", "q2", { sugerencias: [{ base: "docentes", var: "p2", etiqueta: "Texto p2", puntaje: 0.8 }] }),
    P("estudiantes", "q3"),
  ],
};

const sinDescartes = new Set<string>();

describe("normalizarEmparejado", () => {
  it("descarta filas sin base o variable, cae a sin_par sin par y acota el puntaje", () => {
    const d = normalizarEmparejado({
      bases: ["docentes", "estudiantes"],
      preguntas: [
        { base: "docentes", var: "p1", etiqueta: ["Clima"], estado: "matriz" },
        { base: "", var: "x" },
        { base: ["docentes"], var: "p2", estado: "raro", sugerencias: [{ base: "estudiantes", var: "q2", puntaje: "7" }, { var: "q9" }] },
      ],
    });
    expect(d.preguntas).toHaveLength(2);
    expect(d.preguntas[0]).toMatchObject({ estado: "sin_par", par: null, etiqueta: "Clima", tema: "Clima" });
    expect(d.preguntas[1].sugerencias).toEqual([{ base: "estudiantes", var: "q2", etiqueta: "q2", puntaje: 1 }]);
    expect(normalizarEmparejado(null)).toEqual({ bases: [], preguntas: [] });
  });
});

describe("filasEmparejado", () => {
  it("cuatro estados: matriz, sugerido con la de mayor puntaje, sin par; el par espejo sale una vez", () => {
    const filas = filasEmparejado(DATOS, [], B, sinDescartes);
    expect(filas.map((f) => [f.clave, f.estado])).toEqual([
      ["docentes$p1", "matriz"], ["docentes$p2", "sugerido"], ["docentes$p3", "sin_par"],
      ["estudiantes$q3", "sin_par"],
    ]);
    expect(filas[1].par?.var).toBe("q2");
    expect(filas[1].puntaje).toBe(0.8);
    expect(filas[1].otraBase).toBe("estudiantes");
  });

  it("un par confirmado en la lámina: una sola fila «confirmado» y la otra pregunta no se repite", () => {
    const temas: TemaPublicos[] = [{ key: "t", title: "T", vars: ["docentes$p2", "estudiantes$q2"] }];
    const filas = filasEmparejado(DATOS, temas, B, sinDescartes);
    expect(filas.find((f) => f.clave === "docentes$p2")).toMatchObject({ estado: "confirmado", par: { var: "q2", etiqueta: "Texto q2" } });
    expect(filas.some((f) => f.clave === "estudiantes$q2")).toBe(false);
    expect(contarEstados(filas)).toEqual({ matriz: 1, confirmado: 1, sugerido: 0, sin_par: 2, total: 4 });
  });

  it("la sugerencia que apunta a una pregunta ya emparejada pasa a la siguiente", () => {
    const temas: TemaPublicos[] = [{ key: "t", title: "T", vars: ["docentes$p3", "estudiantes$q2"] }];
    const filas = filasEmparejado(DATOS, temas, B, sinDescartes, (r) => (r === "estudiantes$q2" ? "Rótulo q2" : undefined));
    expect(filas.find((f) => f.clave === "docentes$p2")).toMatchObject({ estado: "sugerido", par: { var: "q3" } });
    expect(filas.find((f) => f.clave === "docentes$p3")).toMatchObject({ estado: "confirmado", par: { etiqueta: "Rótulo q2" } });
  });

  it("E1: el par espejo (A sugiere B y B sugiere A) cuenta una vez; una cara que sugiere otra cosa sigue listada", () => {
    const datos: Emparejado = {
      bases: [...B],
      preguntas: [
        P("docentes", "a1", { sugerencias: [{ base: "estudiantes", var: "b1", etiqueta: "Texto b1", puntaje: 1 }] }),
        P("docentes", "a2", { sugerencias: [{ base: "estudiantes", var: "b2", etiqueta: "Texto b2", puntaje: 1 }] }),
        P("estudiantes", "b1", { sugerencias: [{ base: "docentes", var: "a1", etiqueta: "Texto a1", puntaje: 1 }] }),
        P("estudiantes", "b2", { sugerencias: [{ base: "docentes", var: "a2", etiqueta: "Texto a2", puntaje: 1 }] }),
        P("estudiantes", "b3", { sugerencias: [{ base: "docentes", var: "a1", etiqueta: "Texto a1", puntaje: 0.6 }] }),
      ],
    };
    const filas = filasEmparejado(datos, [], B, sinDescartes);
    expect(filas.map((f) => f.clave)).toEqual(["docentes$a1", "docentes$a2", "estudiantes$b3"]);
    expect(contarEstados(filas)).toMatchObject({ sugerido: 3, total: 3 });
    // Descartar la cara que queda descarta el par: la otra no vuelve a proponerlo.
    const sinA1 = filasEmparejado(datos, [], B, new Set(["docentes$a1"]));
    expect(sinA1.find((f) => f.clave === "docentes$a1")).toMatchObject({ estado: "sin_par" });
    expect(sinA1.find((f) => f.clave === "estudiantes$b1")).toMatchObject({ estado: "sin_par", par: null });
    // Confirmar desde la fila que queda escribe el par en el orden de las bases.
    expect(confirmarPar([], B, filas[0].pregunta, filas[0].par!, "T")[0].vars).toEqual(["docentes$a1", "estudiantes$b1"]);
  });

  it("descartar deja la fila sin par; la sugerencia no entra a la lámina mientras no se confirma", () => {
    const filas = filasEmparejado(DATOS, [], B, new Set(["docentes$p2"]));
    expect(filas.find((f) => f.clave === "docentes$p2")).toMatchObject({ estado: "sin_par", par: null });
    expect(paresDeLamina([], B).size).toBe(0);
  });

  it("los temas por nombre (`base$*`) o de una sola base no cuentan como par confirmado", () => {
    const temas: TemaPublicos[] = [
      { key: "a", title: "", vars: ["docentes$*", "estudiantes$*"] },
      { key: "b", title: "", vars: ["docentes$p3"] },
    ];
    expect(paresDeLamina(temas, B).size).toBe(0);
  });
});

describe("filtros y textos", () => {
  const filas = filasEmparejado(DATOS, [], B, sinDescartes);
  it("Todas, Por confirmar y Sin par", () => {
    // El par espejo docentes$p2 / estudiantes$q2 cuenta una vez (E1).
    expect(filtrarFilas(filas, "todas")).toHaveLength(4);
    expect(filtrarFilas(filas, "por_confirmar").map((f) => f.clave)).toEqual(["docentes$p2"]);
    expect(filtrarFilas(filas, "sin_par").map((f) => f.clave)).toEqual(["docentes$p3", "estudiantes$q3"]);
    const c = contarEstados(filas);
    expect(rotuloFiltro("todas", c)).toBe("Todas (4)");
    expect(rotuloFiltro("por_confirmar", c)).toBe("Por confirmar (1)");
    expect(rotuloFiltro("sin_par", c)).toBe("Sin par (2)");
  });
  it("el resumen de la tarjeta sólo nombra los estados con preguntas", () => {
    expect(resumenEmparejado(contarEstados(filas))).toBe("1 en la matriz, 1 por confirmar, 2 sin par");
    expect(resumenEmparejado({ matriz: 47, confirmado: 0, sugerido: 0, sin_par: 6, total: 53 })).toBe("47 en la matriz, 6 sin par");
    expect(resumenEmparejado(contarEstados([]))).toBe("Sin preguntas de escala");
  });
});

describe("confirmar, cambiar y quitar en la lámina", () => {
  const p2 = DATOS.preguntas[1];
  const q2 = { base: "estudiantes", var: "q2", etiqueta: "Texto q2" };
  const q3 = { base: "estudiantes", var: "q3", etiqueta: "Texto q3" };

  it("confirmar agrega un tema con el par en el orden de las bases y el texto como título", () => {
    const temas = confirmarPar([], B, { base: "estudiantes", var: "q3", etiqueta: "Pregunta Q3" }, { base: "docentes", var: "p3", etiqueta: "" }, "Pregunta Q3");
    expect(temas).toEqual([{ key: "pregunta_q3", title: "Pregunta Q3", vars: ["docentes$p3", "estudiantes$q3"] }]);
  });

  it("la clave nueva no pisa una existente", () => {
    const previos: TemaPublicos[] = [{ key: "texto_p2", title: "Otro", vars: ["docentes$p9", "estudiantes$q9"] }];
    expect(confirmarPar(previos, B, p2, q2, p2.tema)[1].key).toBe("texto_p2_2");
  });

  it("cambiar reescribe el mismo tema y conserva su título", () => {
    const previos: TemaPublicos[] = [{ key: "clima", title: "Clima", vars: ["docentes$p2", "estudiantes$q2"] }];
    expect(confirmarPar(previos, B, p2, q3, p2.tema)).toEqual([{ key: "clima", title: "Clima", vars: ["docentes$p2", "estudiantes$q3"] }]);
  });

  it("elegir una pregunta ya emparejada la mueve: el tema que pierde su pareja sale", () => {
    const previos: TemaPublicos[] = [
      { key: "a", title: "A", vars: ["docentes$p3", "estudiantes$q2"] },
      { key: "b", title: "B", vars: ["docentes$p5", "docentes$p6", "estudiantes$q2"] },
    ];
    const temas = confirmarPar(previos, B, p2, q2, p2.tema);
    expect(temas.map((t) => t.key)).toEqual(["a"]);
    expect(temas[0].vars).toEqual(["docentes$p2", "estudiantes$q2"]);
  });

  it("quitar saca el tema que nombra a la pregunta y deja los demás", () => {
    const previos: TemaPublicos[] = [
      { key: "a", title: "A", vars: ["docentes$p2", "estudiantes$q2"] },
      { key: "b", title: "B", vars: ["docentes$p1", "estudiantes$q1"] },
    ];
    expect(quitarPar(previos, "docentes$p2").map((t) => t.key)).toEqual(["b"]);
  });
});

describe("unirConMatriz", () => {
  const F = (variables: Record<string, string>, extra: Partial<EquivalenciaFila> = {}): EquivalenciaFila => ({
    seccion: "S", etiqueta_estandar: "E", variables, cantidad: Object.keys(variables).length, ...extra,
  });
  const par = (a: string, b: string) => ({
    a: { base: "docentes", var: a, etiqueta: `Texto ${a}` }, b: { base: "estudiantes", var: b, etiqueta: `Texto ${b}` }, tema: `Tema ${a}`,
  });

  it("agrega, completa, reconoce lo que ya estaba y no toca lo que choca; nunca pierde filas", () => {
    const matriz = [
      F({ docentes: "p1", estudiantes: "q1" }),
      F({ docentes: "p2" }),
      F({ estudiantes: "q4" }),
      F({ docentes: "p5", estudiantes: "q5" }),
      F({ docentes: "p6", estudiantes: "q6" }, { sugerida: true }),
      F({ docentes: "p7", egresados: "e7" }, { id: "B-7" }),
    ];
    const u = unirConMatriz(matriz, [par("p1", "q1"), par("p2", "q2"), par("p3", "q4"), par("p5", "q9"), par("p6", "q6"), par("p8", "q8")]);
    expect(u.yaEstaban).toBe(1);
    expect(u.completadas).toBe(3);
    expect(u.agregadas).toBe(1);
    expect(u.enConflicto.map((p) => p.a.var)).toEqual(["p5"]);
    expect(u.filas).toHaveLength(matriz.length + 1);
    expect(u.filas[1].variables).toEqual({ docentes: "p2", estudiantes: "q2" });
    expect(u.filas[1].cantidad).toBe(2);
    expect(u.filas[2].variables).toEqual({ estudiantes: "q4", docentes: "p3" });
    expect(u.filas[3]).toEqual(matriz[3]);
    expect(u.filas[4].sugerida).toBeUndefined();
    expect(u.filas[5]).toBe(matriz[5]);
    expect(u.filas[6]).toEqual({ seccion: "", etiqueta_estandar: "Tema p8", variables: { docentes: "p8", estudiantes: "q8" }, cantidad: 2 });
    expect(u.filas[6].sugerida).toBeUndefined();
    expect(matriz[1].variables).toEqual({ docentes: "p2" });
  });

  it("guardar dos veces no duplica", () => {
    const una = unirConMatriz([], [par("p8", "q8")]);
    const dos = unirConMatriz(una.filas, [par("p8", "q8")]);
    expect(dos.filas).toHaveLength(1);
    expect(hayCambiosEnUnion(dos)).toBe(false);
    expect(avisoUnion(dos)).toBe("La matriz ya tiene estos pares.");
  });

  it("el aviso dice lo que se agrega, lo que se completa y lo que no se guarda", () => {
    const u = unirConMatriz([{ seccion: "", etiqueta_estandar: "", variables: { docentes: "p2" }, cantidad: 1 },
      { seccion: "", etiqueta_estandar: "", variables: { docentes: "p5", estudiantes: "q5" }, cantidad: 2 }],
    [par("p2", "q2"), par("p8", "q8"), par("p9", "q9"), par("p5", "q7")]);
    expect(avisoUnion(u)).toBe("Se agregan 2 filas a la matriz y se completa 1 fila. 1 par no se guarda: la matriz ya empareja esa pregunta con otra.");
  });

  it("los confirmados salen de las filas «confirmado»", () => {
    const temas: TemaPublicos[] = [{ key: "t", title: "T", vars: ["docentes$p2", "estudiantes$q2"] }];
    const pares = confirmadosDe(filasEmparejado(DATOS, temas, B, sinDescartes));
    expect(pares).toEqual([{ a: DATOS.preguntas[1], b: { base: "estudiantes", var: "q2", etiqueta: "Texto q2" }, tema: "Texto p2" }]);
  });
});
