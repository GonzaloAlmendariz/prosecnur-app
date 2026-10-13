import { describe, expect, it } from "vitest";
import {
  normalizeAgrupacionResponse,
  normalizeAgrupacionGuardada,
  type AgrupacionResponse,
} from "../../api/codificacion";
import {
  borradorDesdeRespuesta,
  construirSpec,
  destinoDeCodigo,
  destinoDeTexto,
  reducirBorrador,
  sugerirCodigoOtro,
  validarBorrador,
  type AccionBorrador,
  type BorradorAgrupacion,
} from "./agruparCategoriasModel";

function respuesta(over: Partial<AgrupacionResponse> = {}): AgrupacionResponse {
  return {
    base: "default",
    parent: "P5",
    parent_label: "Lugar de nacimiento",
    spec: null,
    target_sugerido: "P5_agrup",
    text_col_sugerida: null,
    nombres_ocupados: [],
    codigos: [
      { codigo: "7", etiqueta: "Callao", n: 30 },
      { codigo: "15", etiqueta: "Lima", n: 900 },
      { codigo: "4", etiqueta: "Arequipa", n: 50 },
      { codigo: "27", etiqueta: "Fuera del Perú", n: 12 },
    ],
    textos_otro: [],
    ...over,
  };
}

function aplicar(b: BorradorAgrupacion, ...acciones: AccionBorrador[]): BorradorAgrupacion {
  return acciones.reduce(reducirBorrador, b);
}

describe("agruparCategoriasModel", () => {
  it("caso P5: 15 y 7 a Lima y Callao, 27 a Fuera, el resto a Otras", () => {
    let b = borradorDesdeRespuesta(respuesta());
    expect(b.target).toBe("P5_agrup");
    b = aplicar(b, { tipo: "agregar" }, { tipo: "agregar" }, { tipo: "agregar" });
    const [lima, otras, fuera] = b.categorias.map((c) => c.id);
    b = aplicar(
      b,
      { tipo: "editar", id: lima, cambios: { etiqueta: "Lima y Callao" } },
      { tipo: "editar", id: otras, cambios: { etiqueta: "Otras regiones" } },
      { tipo: "editar", id: fuera, cambios: { etiqueta: "Fuera del Perú" } },
      { tipo: "asignarCodigo", codigo: "15", id: lima },
      { tipo: "asignarCodigo", codigo: "7", id: lima },
      { tipo: "asignarCodigo", codigo: "27", id: fuera },
      { tipo: "resto", id: otras, activo: true },
    );
    expect(validarBorrador(b, "P5")).toEqual([]);
    expect(destinoDeCodigo(b, "4")).toEqual({ id: otras, via: "resto" });
    expect(destinoDeCodigo(b, "15")).toEqual({ id: lima, via: "codigo" });

    const spec = construirSpec(b, "P5");
    expect(spec).toEqual({
      parent: "P5",
      target: "P5_agrup",
      text_col: null,
      codigo_otro: null,
      categorias: [
        { codigo: "1", etiqueta: "Lima y Callao", codigos: ["15", "7"], rango: null, otros_textos: [], otros_numerico: false, otros_resto: false, resto: false },
        { codigo: "2", etiqueta: "Otras regiones", codigos: [], rango: null, otros_textos: [], otros_numerico: false, otros_resto: false, resto: true },
        { codigo: "3", etiqueta: "Fuera del Perú", codigos: ["27"], rango: null, otros_textos: [], otros_numerico: false, otros_resto: false, resto: false },
      ],
    });
  });

  it("un código vive en una sola categoría y el resto es exclusivo", () => {
    let b = aplicar(borradorDesdeRespuesta(respuesta()), { tipo: "agregar" }, { tipo: "agregar" });
    const [a, z] = b.categorias.map((c) => c.id);
    b = aplicar(b, { tipo: "asignarCodigo", codigo: "15", id: a }, { tipo: "asignarCodigo", codigo: "15", id: z });
    expect(b.categorias[0].codigos).toEqual([]);
    expect(b.categorias[1].codigos).toEqual(["15"]);
    b = aplicar(b, { tipo: "asignarCodigo", codigo: "15", id: null });
    expect(b.categorias.flatMap((c) => c.codigos)).toEqual([]);
    b = aplicar(b, { tipo: "resto", id: a, activo: true }, { tipo: "resto", id: z, activo: true });
    expect(b.categorias.map((c) => c.resto)).toEqual([false, true]);
  });

  it("reordena sin salirse de los bordes y quitar borra sus asignaciones", () => {
    let b = aplicar(borradorDesdeRespuesta(respuesta()), { tipo: "agregar" }, { tipo: "agregar" });
    const [a, z] = b.categorias.map((c) => c.id);
    b = aplicar(b, { tipo: "mover", id: a, delta: -1 });
    expect(b.categorias.map((c) => c.id)).toEqual([a, z]);
    b = aplicar(b, { tipo: "mover", id: a, delta: 1 }, { tipo: "asignarCodigo", codigo: "4", id: a });
    expect(b.categorias.map((c) => c.id)).toEqual([z, a]);
    b = aplicar(b, { tipo: "quitar", id: a });
    expect(destinoDeCodigo(b, "4")).toBeNull();
    // El código nuevo no reusa uno ocupado.
    b = aplicar(b, { tipo: "agregar" });
    expect(b.categorias.map((c) => c.codigo)).toEqual(["2", "3"]);
  });

  it("año de ingreso: el rango abierto no se traga el 88 de Otro ni el 99", () => {
    const r = respuesta({
      parent: "P8",
      target_sugerido: "P8_agrup",
      text_col_sugerida: "P8_otro",
      codigos: [
        { codigo: "2019", etiqueta: "2019", n: 5 },
        { codigo: "2023", etiqueta: "2023", n: 40 },
        { codigo: "88", etiqueta: "Otro (especifique)", n: 6 },
        { codigo: "99", etiqueta: "No responde", n: 2 },
      ],
      textos_otro: [{ texto: "2015", n: 3 }, { texto: "no recuerdo", n: 1 }],
    });
    expect(sugerirCodigoOtro(r.codigos)).toBe("88");
    let b = borradorDesdeRespuesta(r);
    expect(b.textCol).toBe("P8_otro");
    expect(b.codigoOtro).toBe("88");
    b = aplicar(b, { tipo: "agregar" }, { tipo: "agregar" }, { tipo: "agregar" });
    const [antes, recientes, nr] = b.categorias.map((c) => c.id);
    b = aplicar(
      b,
      { tipo: "editar", id: antes, cambios: { etiqueta: "2021 o antes", rangoMax: "2021", otrosNumerico: true } },
      { tipo: "editar", id: recientes, cambios: { etiqueta: "2022 a 2025", rangoMin: "2022", rangoMax: "2025" } },
      { tipo: "editar", id: nr, cambios: { etiqueta: "No responde" } },
      { tipo: "asignarCodigo", codigo: "99", id: nr },
      { tipo: "otrosResto", id: nr, activo: true },
    );
    expect(validarBorrador(b, "P8")).toEqual([]);
    expect(destinoDeCodigo(b, "2019")).toEqual({ id: antes, via: "rango" });
    expect(destinoDeCodigo(b, "88")).toBeNull();
    expect(destinoDeCodigo(b, "99")).toEqual({ id: nr, via: "codigo" });
    expect(destinoDeTexto(b, "2015")).toEqual({ id: antes, via: "rango" });
    expect(destinoDeTexto(b, "no recuerdo")).toEqual({ id: nr, via: "resto" });
    const spec = construirSpec(b, "P8");
    expect(spec.text_col).toBe("P8_otro");
    expect(spec.codigo_otro).toBe("88");
    expect(spec.categorias[0].rango).toEqual({ min: null, max: 2021 });
    expect(spec.categorias[0].otros_numerico).toBe(true);
  });

  it("asignar un texto de Otro compara sin tildes ni mayúsculas", () => {
    let b = borradorDesdeRespuesta(respuesta({ text_col_sugerida: "P4_otro", codigos: [{ codigo: "5", etiqueta: "Otro", n: 2 }] }));
    b = aplicar(b, { tipo: "agregar" }, { tipo: "agregar" });
    const [a, z] = b.categorias.map((c) => c.id);
    b = aplicar(b, { tipo: "asignarTexto", texto: "Pansexual", id: a }, { tipo: "asignarTexto", texto: "PANSEXUAL ", id: z });
    expect(b.categorias[0].otrosTextos).toEqual([]);
    expect(destinoDeTexto(b, "pansexual")).toEqual({ id: z, via: "texto" });
  });

  it("valida lo que el backend rechazaría", () => {
    let b = borradorDesdeRespuesta(respuesta({ nombres_ocupados: ["P5_recod"] }));
    expect(validarBorrador(b, "P5")).toContain("Agrega al menos una categoría.");
    b = aplicar(b, { tipo: "target", valor: "P5 nueva" });
    expect(validarBorrador(b, "P5").join(" ")).toMatch(/no es un nombre válido/);
    b = aplicar(b, { tipo: "target", valor: "p5_RECOD" });
    expect(validarBorrador(b, "P5", ["P5_recod"]).join(" ")).toMatch(/ya lo usa otra codificación/);
    b = aplicar(b, { tipo: "target", valor: "P5" });
    expect(validarBorrador(b, "P5").join(" ")).toMatch(/igual que la original/);
    b = aplicar(b, { tipo: "target", valor: "P5_agrup" }, { tipo: "agregar" }, { tipo: "agregar" });
    const [a, z] = b.categorias.map((c) => c.id);
    b = aplicar(
      b,
      { tipo: "editar", id: a, cambios: { codigo: "1", etiqueta: "A", rangoMin: "10", rangoMax: "2" } },
      { tipo: "editar", id: z, cambios: { codigo: "1", etiqueta: "", otrosNumerico: true } },
    );
    const errores = validarBorrador(b, "P5").join(" ");
    expect(errores).toMatch(/se repite/);
    expect(errores).toMatch(/mínimo mayor que el máximo/);
    expect(errores).toMatch(/Falta la etiqueta/);
    expect(errores).toMatch(/no tiene rango/);
    expect(errores).toMatch(/código de «Otro»/);
  });

  it("recupera un borrador desde una spec guardada", () => {
    const b = borradorDesdeRespuesta(respuesta({
      spec: {
        parent: "P5", target: "P5_grupos", text_col: null, codigo_otro: null,
        categorias: [{ codigo: "1", etiqueta: "Lima", codigos: ["15"], rango: { min: 2000, max: null }, otros_textos: [], otros_numerico: false, otros_resto: false, resto: true }],
      },
    }));
    expect(b.target).toBe("P5_grupos");
    expect(b.categorias[0]).toMatchObject({ codigo: "1", rangoMin: "2000", rangoMax: "", resto: true });
    expect(construirSpec(b, "P5").categorias[0].rango).toEqual({ min: 2000, max: null });
  });
});

describe("normalizadores de agrupación", () => {
  it("tolera escalares unboxed, objetos vacíos y nulos", () => {
    const r = normalizeAgrupacionResponse({
      ok: true,
      parent: "P4",
      spec: {
        parent: "P4", target: "P4_agrup", text_col: null, codigo_otro: "5",
        categorias: { codigo: 1, etiqueta: "Hetero", codigos: "1", rango: null, otros_textos: {}, otros_numerico: false, otros_resto: false, resto: false },
      },
      target_sugerido: "P4_agrup",
      text_col_sugerida: "P4_otro",
      nombres_ocupados: "P4_recod",
      codigos: [{ codigo: 1, etiqueta: "Heterosexual", n: "3" }, { etiqueta: "sin código" }],
      textos_otro: { texto: "pansexual", n: 1 },
    }, "P4");
    expect(r.nombres_ocupados).toEqual(["P4_recod"]);
    expect(r.codigos).toEqual([{ codigo: "1", etiqueta: "Heterosexual", n: 3 }]);
    expect(r.textos_otro).toEqual([{ texto: "pansexual", n: 1 }]);
    expect(r.spec?.categorias).toEqual([
      { codigo: "1", etiqueta: "Hetero", codigos: ["1"], rango: null, otros_textos: [], otros_numerico: false, otros_resto: false, resto: false },
    ]);
    expect(normalizeAgrupacionResponse(null, "P9")).toMatchObject({ parent: "P9", spec: null, target_sugerido: "P9_agrup", codigos: [] });
    expect(normalizeAgrupacionGuardada({ ok: true, parent: "P4", spec: null }, "P4")).toMatchObject({ spec: null, vista_previa: null });
    expect(normalizeAgrupacionGuardada({
      vista_previa: { categorias: [{ codigo: "1", etiqueta: "A", n: 4 }], n_sin_categoria: 2 },
    }, "P4").vista_previa).toEqual({ categorias: [{ codigo: "1", etiqueta: "A", n: 4 }], n_sin_categoria: 2 });
  });
});
