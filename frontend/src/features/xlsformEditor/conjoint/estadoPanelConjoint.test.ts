// Mata: una clave inválida desde un rótulo con tildes, dos atributos con la misma clave, una condición que queda
// apuntando a un atributo renombrado o borrado, códigos de nivel desordenados tras quitar uno y pesos que no suman 1.
import { describe, expect, it } from "vitest";
import { validarDiseno } from "./modeloConjoint";
import { claveDesde, disenoInicial, reducirConjoint } from "./estadoPanelConjoint";

describe("estado del panel conjoint", () => {
  it("la clave sale del rótulo y no se repite", () => {
    expect(claveDesde("Formación en el exterior")).toBe("formacion_en_el_exte");
    expect(claveDesde("¿Edad?", ["edad"])).toBe("edad_2");
    expect(claveDesde("2026")).toBe("a_2026");
  });

  it("el diseño inicial es válido", () => {
    expect(validarDiseno(disenoInicial("cj"))).toEqual([]);
  });

  it("renombrar arrastra la condición y borrar la suelta", () => {
    let d = disenoInicial("cj");
    d = reducirConjoint(d, { tipo: "condicion", atributo: 1, soloSi: { atributo: "edad", noEs: ["1"] } });
    d = reducirConjoint(d, { tipo: "rotuloAtributo", indice: 0, rotulo: "Años cumplidos" });
    expect(d.atributos[1]!.soloSi?.atributo).toBe("anos_cumplidos");
    expect(validarDiseno(d)).toEqual([]);
    d = reducirConjoint(d, { tipo: "quitarAtributo", indice: 0 });
    expect(d.atributos[0]!.soloSi).toBeUndefined();
  });

  it("quitar un nivel recodifica y los pesos iguales suman 1", () => {
    let d = disenoInicial("cj");
    d = reducirConjoint(d, { tipo: "quitarNivel", atributo: 0, nivel: 0 });
    expect(d.atributos[0]!.niveles.map((n) => n.codigo)).toEqual(["1", "2"]);
    d = reducirConjoint(d, { tipo: "agregarNivel", atributo: 0 });
    d = reducirConjoint(d, { tipo: "usarPesos", atributo: 0, usar: true });
    const suma = d.atributos[0]!.niveles.reduce((s, n) => s + (n.peso ?? 0), 0);
    expect(Math.abs(suma - 1)).toBeLessThan(1e-9);
    expect(validarDiseno(d)).toEqual([]);
    d = reducirConjoint(d, { tipo: "agregarNivel", atributo: 0 });
    expect(Math.abs(d.atributos[0]!.niveles.reduce((s, n) => s + (n.peso ?? 0), 0) - 1)).toBeLessThan(1e-9);
  });
});
