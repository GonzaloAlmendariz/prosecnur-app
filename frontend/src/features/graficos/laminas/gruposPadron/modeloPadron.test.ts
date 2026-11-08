// Padrón, meta, filas extra, públicos y propuesta de las láminas de resumen (ADR 0135 §6): los formatos son los que lee el
// motor (`.contraste_universos`, `.cobertura_metas`, `.cobertura_extras`) y apagar «Padrón confiable» no borra lo escrito.
import { describe, expect, it } from "vitest";
import type { PadronPropuesto } from "../../../../api/graficosPadron";
import {
  alternarPublico, clavePadron, conExtras, conMeta, conPadron, conPropuesta, escribirPadrones, extrasDe, leerMetas,
  leerPadrones, llevaPadronPublicos, metaDe, nombrePublico, numeroDePadron, padronDe, propuestaEnUso, propuestaUtil,
  publicoIncluido, publicosDe, ultimoPublico,
} from "./modeloPadron";

const propuesta = (base: string, extra: Partial<PadronPropuesto> = {}): PadronPropuesto => ({
  base, padron: null, padron_origen: "", meta: null, meta_unidad: null, meta_origen: "", motivo: "", ...extra,
});

describe("padrones", () => {
  it("lee el texto del motor, con millares y sin repetir claves", () => {
    expect(leerPadrones("Docentes TC: 24; Docentes TP: 1,091; docentes tc: 3")).toEqual([
      { nombre: "Docentes TC", valor: 24 }, { nombre: "Docentes TP", valor: 1091 },
    ]);
    expect(leerPadrones({ Docentes: 123 })).toEqual([{ nombre: "Docentes", valor: 123 }]);
    expect(leerPadrones("Docentes: x; : 3")).toEqual([]);
    expect(escribirPadrones([])).toBeNull();
  });

  it("empareja sin tildes ni mayúsculas y capitaliza el público como el motor", () => {
    expect(clavePadron("  Administración ")).toBe("administracion");
    expect(nombrePublico("docentes")).toBe("Docentes");
    expect(numeroDePadron("1.234")).toBe(1234);
    expect(numeroDePadron("0")).toBeNull();
  });

  it("confiable va a universos; apagado se guarda aparte y no se pierde", () => {
    const args = { universos: "Docentes TC: 24; Docentes TP: 91" };
    expect(padronDe(args, "docentes tp")).toEqual({ valor: 91, confiable: true });
    const apagado = conPadron(args, "Docentes TP", { valor: 91, confiable: false }, true);
    expect(apagado).toEqual({ universos: "Docentes TC: 24", universos_no_confiables: "Docentes TP: 91" });
    expect(padronDe({ ...args, ...apagado }, "Docentes TP")).toEqual({ valor: 91, confiable: false });
    const encendido = conPadron({ ...args, ...apagado }, "Docentes TP", { valor: 91, confiable: true }, true);
    expect(encendido).toEqual({ universos: "Docentes TC: 24; Docentes TP: 91", universos_no_confiables: null });
  });

  it("sin el arg en el registro, apagar quita el número y no escribe universos_no_confiables", () => {
    expect(conPadron({ universos: "A: 1" }, "A", { valor: 1, confiable: false }, false)).toEqual({ universos: null });
  });

  it("R8-6: un grupo sin padrón queda vacío y NO confiable; teclear el padrón no enciende «Padrón confiable»", () => {
    expect(padronDe({}, "Docentes")).toEqual({ valor: null, confiable: false });
    const tecleado = conPadron({}, "Docentes", { ...padronDe({}, "Docentes"), valor: 60 }, true);
    expect(tecleado.universos).toBeNull();
    expect(padronDe(tecleado, "Docentes")).toEqual({ valor: 60, confiable: false });
  });
});

describe("metas", () => {
  it("porcentaje o casos, con el decimal del motor", () => {
    expect(leerMetas("Docentes: 60%; Administrativos: 74; Estudiantes: 12,5%")).toEqual([
      { nombre: "Docentes", meta: { valor: 60, unidad: "porcentaje" } },
      { nombre: "Administrativos", meta: { valor: 74, unidad: "casos" } },
      { nombre: "Estudiantes", meta: { valor: 12.5, unidad: "porcentaje" } },
    ]);
    const patch = conMeta({ metas: "Docentes: 60%" }, "Administrativos", { valor: 90, unidad: "porcentaje" });
    expect(patch).toEqual({ metas: "Docentes: 60%; Administrativos: 90%" });
    expect(metaDe(patch, "administrativos")).toEqual({ valor: 90, unidad: "porcentaje" });
    expect(conMeta({ metas: "Docentes: 60%" }, "Docentes", null)).toEqual({ metas: null });
  });
});

describe("filas extra", () => {
  it("lee la lista y el texto viejo y guarda todas como lista", () => {
    expect(extrasDe({ extras: "34 | egresados(as) | en 4 grupos focales" })).toEqual([
      { cifra: "34", rotulo: "egresados(as)", detalle: "en 4 grupos focales" },
    ]);
    expect(extrasDe({ extras: [{ cifra: 34, rotulo: "egresados(as)" }] })).toEqual([{ cifra: "34", rotulo: "egresados(as)", detalle: "" }]);
    expect(conExtras([{ cifra: "", rotulo: "", detalle: "" }])).toEqual({ extras: [{ cifra: "", rotulo: "", detalle: "" }] });
  });
});

describe("públicos", () => {
  it("cobertura: todas las del estudio; contraste: las del primer tema; fortalezas: la de sus preguntas", () => {
    expect(publicosDe("p_cobertura", {}, ["docentes", "estudiantes"])).toEqual(["docentes", "estudiantes"]);
    expect(publicosDe("p_dumbbell", { vars: { t1: ["estudiantes$p1", "docentes$p1"] } }, [])).toEqual(["estudiantes", "docentes"]);
    expect(publicosDe("p_fortalezas", { vars: ["docentes$*"] }, [])).toEqual(["docentes"]);
    expect(publicosDe("p_dumbbell", { vars: [] }, ["a"])).toEqual([]);
    // El par del contraste declarado en `bases` manda; incompleto, no cuenta.
    expect(publicosDe("p_dumbbell", { bases: ["estudiantes", "administrativos"] }, [])).toEqual(["estudiantes", "administrativos"]);
    expect(publicosDe("p_dumbbell", { bases: ["estudiantes", ""], vars: { t1: ["docentes$p1", "estudiantes$p1"] } }, [])).toEqual(["docentes", "estudiantes"]);
  });

  it("incluir y sacar públicos de la cobertura, sin dejarla vacía", () => {
    const todas = ["docentes", "estudiantes", "administrativos"];
    expect(publicoIncluido({}, "docentes")).toBe(true);
    const sin = alternarPublico({}, todas, "estudiantes", false);
    expect(sin).toEqual({ bases: ["docentes", "administrativos"] });
    expect(alternarPublico(sin, todas, "estudiantes", true)).toEqual({ bases: todas });
    expect(ultimoPublico({ bases: ["docentes"] }, todas, "docentes")).toBe(true);
  });

  it("qué láminas llevan el padrón por público", () => {
    expect(llevaPadronPublicos("p_cobertura", {})).toBe(true);
    expect(llevaPadronPublicos("p_dumbbell", { estilo: "resumen", cruce: null })).toBe(true);
    expect(llevaPadronPublicos("p_dumbbell", { estilo: "resumen", cruce: "docentes$dedicacion" })).toBe(false);
    expect(llevaPadronPublicos("p_dumbbell", { estilo: "recetario", cruce: null })).toBe(false);
  });
});

describe("propuesta", () => {
  const props = [
    propuesta("docentes", { padron: 123, padron_origen: "Cálculo de muestra: marco validado (Docentes)", meta: 60, meta_unidad: "porcentaje" }),
    propuesta("estudiantes", { motivo: "Sin padrón declarado." }),
  ];

  it("escribe el padrón como confiable y la meta con su unidad; sin dato no toca lo escrito", () => {
    const patch = conPropuesta({ universos: "Estudiantes: 300" }, props, ["docentes", "estudiantes"], true, true);
    expect(patch).toEqual({ universos: "Estudiantes: 300; Docentes: 123", universos_no_confiables: null, metas: "Docentes: 60%" });
    expect(propuestaEnUso({ ...patch }, "docentes", props[0], true)).toBe(true);
    expect(propuestaEnUso({ universos: "Docentes: 120" }, "docentes", props[0], false)).toBe(false);
  });

  it("fuera de la cobertura la meta no cuenta", () => {
    expect(propuestaUtil(propuesta("x", { meta: 60, meta_unidad: "porcentaje" }), false)).toBe(false);
    expect(propuestaUtil(propuesta("x", { meta: 60, meta_unidad: "porcentaje" }), true)).toBe(true);
    expect(propuestaUtil(props[1], true)).toBe(false);
  });
});
