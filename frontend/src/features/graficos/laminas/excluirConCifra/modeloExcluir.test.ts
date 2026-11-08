// Ítem 1 de la oleada I2: las variantes que se piden y la línea del efecto, con detalles simulados.
import { describe, expect, it } from "vitest";
import { detalle, fila } from "../cifrasInspector/fixturaDetalle.test-utils";
import { textoBase } from "../cifrasInspector/modeloCifras";
import { efectoSondeo, variantesExcluir } from "./modeloExcluir";

const ARGS = { var: "b$p1", excluir_opciones: ["99"] };
const ANTES = detalle([{ clave: "Sí", valor: 58 }, { clave: "No", valor: 34 }, { clave: "No sabe", valor: 8 }], { n: 412 });
const DESPUES = detalle([{ clave: "Sí", valor: 63 }, { clave: "No", valor: 37 }], { n: 380 });

describe("variantes de Excluir respuestas", () => {
  it("pide la actual, la de sin exclusiones y la sondeada (con la ficha alternada)", () => {
    const v = variantesExcluir(ARGS, "excluir_opciones", ["99"], "2", ["1", "2", "99"]);
    expect(v.map((x) => x.clave)).toEqual(["actual", "sin", "sondeo"]);
    expect(v[1].args.excluir_opciones).toEqual([]);
    expect(v[2].args.excluir_opciones).toEqual(["2", "99"]);
  });
  it("sin exclusiones no pide «sin»; una sondeada que no es de la lista no se pide", () => {
    expect(variantesExcluir({ var: "b$p1" }, "excluir_opciones", [], "77", ["1"]).map((x) => x.clave)).toEqual(["actual"]);
  });
});

describe("efecto de la ficha sondeada", () => {
  it("dice el antes y el después de la más alta que queda", () => {
    expect(efectoSondeo(ANTES, DESPUES, "No sabe", false)).toBe('Sin "No sabe": Sí 58% → 63%');
  });
  it("una ya excluida dice lo que pasa al devolverla", () => {
    expect(efectoSondeo(DESPUES, ANTES, "No sabe", true)).toBe('Con "No sabe": Sí 63% → 58%');
  });
  it("sin fila que resuma (varias barras) se dice con la base", () => {
    const a = detalle([{ clave: "Sí", valor: 50 }], { n: 412, filas: [fila("A", [{ clave: "Sí", valor: 50 }]), fila("B", [{ clave: "Sí", valor: 40 }])] });
    const b = detalle([{ clave: "Sí", valor: 55 }], { n: 380, filas: [fila("A", [{ clave: "Sí", valor: 55 }]), fila("B", [{ clave: "Sí", valor: 45 }])] });
    expect(efectoSondeo(a, b, "No sabe", false)).toBe('Sin "No sabe": Base 412 → 380');
  });
  it("sin detalle no inventa nada", () => {
    expect(efectoSondeo(null, DESPUES, "No sabe", false)).toBeNull();
    expect(efectoSondeo(ANTES, null, "No sabe", false)).toBeNull();
  });
  it("la base antes y después", () => {
    expect(textoBase(ANTES, DESPUES)).toBe("Base 412 → 380");
    expect(textoBase(null, DESPUES)).toBe("Base 380");
    expect(textoBase(null, null)).toBeNull();
  });
});
