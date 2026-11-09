// El universo de la cobertura por categorías (ADR 0140): lectura defensiva, filas por código (también n = 0), universo
// viejo sin borrar nada, avisos en vivo que no bloquean y qué args muestra cada versión.
import { describe, expect, it } from "vitest";
import type { CategoriasDeBase } from "../../../../api/graficosCoberturaCategorias";
import { camposDeDatos } from "../argsDatosGrafico";
import type { ArgMetadata } from "../../../../api/graficos";
import {
  argDeLaVersion, avisoDeBase, baseAGuardar, cambioDeModo, conBase, esCoberturaCategorias, filasDeBase, leerUniverso, numeroUniverso,
  rellenarBase, sumaDeBase, toleranciaAGuardar, universoViejo,
} from "./modeloUniversoCategorias";

const BASE: CategoriasDeBase = {
  base: "estudiantes", variable_usada: "p6", recodificada: false, n_encuestados: 120, n_validos: 115,
  categorias: [{ codigo: "1", etiqueta: "Primer ciclo", n: 70 }, { codigo: "2", etiqueta: "Segundo ciclo", n: 45 }, { codigo: "3", etiqueta: "Tercer ciclo", n: 0 }],
  especiales: [],
};

describe("lectura del universo guardado", () => {
  it("lee modo, total, variable y categorías; descarta lo que no es objeto y códigos repetidos", () => {
    const u = leerUniverso({
      estudiantes: { modo: "porcentajes", total: null, variable: "p6", categorias: [{ codigo: 1, etiqueta: "Primer ciclo", valor: "60" }, { codigo: "1", valor: 3 }] },
      docentes: "x", "": { modo: "conteos" },
    });
    expect(u).toEqual({ estudiantes: { modo: "porcentajes", total: null, variable: "p6", categorias: [{ codigo: "1", etiqueta: "Primer ciclo", valor: 60 }] } });
    expect(leerUniverso(null)).toEqual({});
    expect(leerUniverso([1, 2])).toEqual({});
  });

  it("los números tecleados: coma de millares es-PE, coma suelta decimal, vacío o negativo es null", () => {
    expect(numeroUniverso("1,234")).toBe(1234);
    expect(numeroUniverso("12,5")).toBe(12.5);
    expect(numeroUniverso("12.5")).toBe(12.5);
    expect(numeroUniverso(" 40 ")).toBe(40);
    for (const v of ["", "x", "-3", "12.", null, undefined, -1, NaN]) expect(numeroUniverso(v)).toBeNull();
  });

  it("la tolerancia vacía o en 0 no se guarda (la lámina no la menciona)", () => {
    expect(toleranciaAGuardar(3)).toBe(3);
    expect(toleranciaAGuardar(0)).toBeNull();
    expect(toleranciaAGuardar(null)).toBeNull();
  });
});

describe("filas de la tabla", () => {
  it("una fila por categoría de la muestra (también n = 0), con lo tecleado por código", () => {
    const guardado = { modo: "conteos" as const, total: 500, variable: "p6", categorias: [{ codigo: "2", etiqueta: "", valor: 200 }] };
    expect(filasDeBase(guardado, BASE, false)).toEqual([
      { codigo: "1", etiqueta: "Primer ciclo", n: 70, valor: null },
      { codigo: "2", etiqueta: "Segundo ciclo", n: 45, valor: 200 },
      { codigo: "3", etiqueta: "Tercer ciclo", n: 0, valor: null },
    ]);
  });

  it("una categoría guardada que la variable no trae se queda al final, sin n (nunca se borra)", () => {
    const guardado = { modo: "conteos" as const, total: null, variable: "p6", categorias: [{ codigo: "9", etiqueta: "Cuarto", valor: 5 }, { codigo: "1", etiqueta: "", valor: 10 }] };
    const filas = filasDeBase(guardado, BASE, false);
    expect(filas.at(-1)).toEqual({ codigo: "9", etiqueta: "Cuarto", n: null, valor: 5 });
    expect(filas).toHaveLength(4);
  });

  it("guardar escribe todas las filas a la vista, con la variable contada; en porcentajes no lleva total", () => {
    const filas = filasDeBase(undefined, BASE, false).map((f) => (f.codigo === "1" ? { ...f, valor: 60 } : f));
    expect(baseAGuardar(filas, "porcentajes", 500, "p6")).toEqual({
      modo: "porcentajes", total: null, variable: "p6",
      categorias: [
        { codigo: "1", etiqueta: "Primer ciclo", valor: 60 }, { codigo: "2", etiqueta: "Segundo ciclo", valor: null },
        { codigo: "3", etiqueta: "Tercer ciclo", valor: null },
      ],
    });
    const otro = { modo: "conteos" as const, total: 1, variable: "x", categorias: [] };
    expect(Object.keys(conBase({ docentes: otro }, "estudiantes", otro))).toEqual(["docentes", "estudiantes"]);
  });
});

describe("universo viejo", () => {
  const guardado = (variable: string | null, codigos: string[]) => ({
    modo: "conteos" as const, total: null, variable, categorias: codigos.map((c) => ({ codigo: c, etiqueta: c, valor: 10 })),
  });

  it("tecleado para otra variable (ni la de la lámina ni la contada) es viejo", () => {
    expect(universoViejo(guardado("gedad", ["1"]), "p6", BASE)).toBe(true);
    expect(universoViejo(guardado("p6", ["1"]), "p6", BASE)).toBe(false);
    expect(universoViejo(guardado("p6", ["1"]), "estudiantes$p6", BASE)).toBe(false);
    // La recodificada: la lámina dice p6 y se contó p6_recod.
    expect(universoViejo(guardado("p6_recod", ["1"]), "p6", { ...BASE, variable_usada: "p6_recod" })).toBe(false);
  });

  it("ninguna categoría con valor está en la variable: viejo; sin guardar o sin respuesta, no", () => {
    expect(universoViejo(guardado(null, ["8", "9"]), "p6", BASE)).toBe(true);
    expect(universoViejo(guardado(null, ["1", "9"]), "p6", BASE)).toBe(false);
    expect(universoViejo(undefined, "p6", BASE)).toBe(false);
    expect(universoViejo(guardado("gedad", ["1"]), "p6", undefined)).toBe(false);
  });

  it("viejo: la tabla muestra lo guardado tal cual; rellenar trae las categorías actuales con valores vacíos", () => {
    const g = guardado("gedad", ["8"]);
    expect(filasDeBase(g, BASE, true)).toEqual([{ codigo: "8", etiqueta: "8", n: null, valor: 10 }]);
    const r = rellenarBase(BASE, "porcentajes");
    expect(r.variable).toBe("p6");
    expect(r.categorias.map((c) => c.codigo)).toEqual(["1", "2", "3"]);
    expect(r.categorias.every((c) => c.valor === null)).toBe(true);
  });
});

describe("avisos en vivo (no bloquean)", () => {
  const filas = (valores: (number | null)[]) => valores.map((v, i) => ({ codigo: String(i + 1), etiqueta: "x", n: 1, valor: v }));

  it("porcentajes: avisa fuera de 99.5–100.5; nada tecleado no avisa", () => {
    expect(avisoDeBase(filas([60, 40]), "porcentajes", null)).toBeNull();
    expect(avisoDeBase(filas([60, 40.4]), "porcentajes", null)).toBeNull();
    expect(avisoDeBase(filas([60, 30]), "porcentajes", null)).toMatch(/suman 90 %/);
    expect(avisoDeBase(filas([null, null]), "porcentajes", null)).toBeNull();
  });

  it("conteos: avisa si el total no coincide con la suma; sin total, no", () => {
    expect(avisoDeBase(filas([300, 200]), "conteos", 500)).toBeNull();
    expect(avisoDeBase(filas([300, 200]), "conteos", null)).toBeNull();
    expect(avisoDeBase(filas([300, 150]), "conteos", 500)).toMatch(/total \(500\).*suma de las categorías \(450\)/);
    expect(sumaDeBase(filas([300, null]))).toBe(300);
    expect(sumaDeBase(filas([null]))).toBeNull();
  });
});

describe("qué args muestra cada versión de la cobertura", () => {
  const CAT = { modo: "categorias" };

  it("la versión se lee del modo", () => {
    expect(esCoberturaCategorias("p_cobertura", CAT)).toBe(true);
    expect(esCoberturaCategorias("p_cobertura", { modo: ["categorias"] })).toBe(true);
    expect(esCoberturaCategorias("p_cobertura", {})).toBe(false);
    expect(esCoberturaCategorias("p_dumbbell", CAT)).toBe(false);
  });

  it("por categorías esconde los de públicos; por públicos esconde los de categorías; fuera de la cobertura, todo", () => {
    for (const a of ["universos", "metas", "extras", "universos_no_confiables"]) {
      expect(argDeLaVersion("p_cobertura", CAT, a)).toBe(false);
      expect(argDeLaVersion("p_cobertura", {}, a)).toBe(true);
    }
    for (const a of ["variable", "universo_categorias", "tolerancia_pts"]) {
      expect(argDeLaVersion("p_cobertura", CAT, a)).toBe(true);
      expect(argDeLaVersion("p_cobertura", {}, a)).toBe(false);
    }
    expect(argDeLaVersion("p_dumbbell", {}, "variable")).toBe(true);
  });

  it("la tarjeta: variable, Universo y Tolerancia sólo en la versión por categorías (depende del registro)", () => {
    const dep = { arg: "modo", valores: ["categorias"] };
    const args: ArgMetadata[] = [
      { name: "modo", label: "Versión", tipo_input: "meta", grupo: "datos" },
      { name: "variable", label: "Variable", tipo_input: "variable", grupo: "datos", depende: dep },
      { name: "universo_categorias", label: "Universo por categoría", tipo_input: "universo_categorias", grupo: "datos", depende: dep },
      { name: "tolerancia_pts", label: "Tolerancia (pts)", tipo_input: "number", grupo: "datos", depende: dep, min: 0, max: 50, step: 0.5 },
    ];
    const nombres = (v: Record<string, unknown>) => camposDeDatos(args, v, "p_cobertura").map((c) => [c.arg.name, c.rotulo, c.control]);
    expect(nombres(CAT)).toEqual([
      ["variable", "Variable", "variable"], ["universo_categorias", "Universo", "universo_categorias"], ["tolerancia_pts", "Tolerancia (pts)", "numero"],
    ]);
    expect(nombres({})).toEqual([]);
  });
});

describe("ronda 19 (O1): cambiar de modo no reinterpreta lo tecleado", () => {
  const filas = (valores: (number | null)[]) => valores.map((valor, i) => ({ codigo: String(i + 1), etiqueta: `C${i + 1}`, n: 10, valor }));
  it("conteos → %: sobre el total y lo dice", () => {
    const c = cambioDeModo(filas([30, 170]), "conteos", "porcentajes", 200);
    expect(c.filas.map((f) => f.valor)).toEqual([15, 85]);
    expect(c.total).toBeNull();
    expect(c.aviso).toBe("Los conteos pasaron a % sobre el total (200).");
  });
  it("conteos → % sin total: sobre la suma, y lo dice", () => {
    const c = cambioDeModo(filas([30, 90, null]), "conteos", "porcentajes", null);
    expect(c.filas.map((f) => f.valor)).toEqual([25, 75, null]);
    expect(c.aviso).toMatch(/sobre su suma \(120\): no había total/);
  });
  it("% → conteos: sin total no se inventan casos; las celdas quedan vacías con el aviso", () => {
    const c = cambioDeModo(filas([45, 55]), "porcentajes", "conteos", null);
    expect(c.filas.map((f) => f.valor)).toEqual([null, null]);
    expect(c.aviso).toMatch(/Sin total, los % no se pueden pasar a casos/);
  });
  it("sin cifras tecleadas o al mismo modo, sólo cambia el modo y no hay aviso", () => {
    expect(cambioDeModo(filas([null]), "conteos", "porcentajes", 100)).toMatchObject({ aviso: null });
    expect(cambioDeModo(filas([3]), "conteos", "conteos", 100).filas[0].valor).toBe(3);
    expect(cambioDeModo(filas([0, 0]), "conteos", "porcentajes", null).filas.map((f) => f.valor)).toEqual([null, null]);
  });
});
