// Mata: una regla de opciones solas que se escribe mal, que pisa lo que la restricción ya exigía, que no se reconoce al
// volver a abrir, que deja pasar «Ninguno» junto con otra opción, y sugerencias que marcan opciones normales.
import { describe, expect, it } from "vitest";
import { evaluarRestriccion } from "../../logic/probarRestriccion";
import { escribirSolas, leerSolas, mensajeSolas, reglaSolas, sugeridasSolas } from "./opcionesSolasModelo";

describe("opciones que van solas", () => {
  it("escribe la regla y la vuelve a leer", () => {
    const r = reglaSolas(["99", "98"]);
    expect(r).toBe("not((selected(., '99') or selected(., '98')) and count-selected(.) > 1)");
    expect(leerSolas(r).solas).toEqual(["99", "98"]);
    expect(leerSolas("not(selected(., '0') and count-selected(.) > 1)").solas).toEqual(["0"]);
  });

  it("conserva lo que la restricción ya exigía y quita la regla si no queda ninguna", () => {
    const con = escribirSolas("count-selected(.) <= 3", ["99"]);
    expect(con).toBe("count-selected(.) <= 3 and not(selected(., '99') and count-selected(.) > 1)");
    expect(leerSolas(con)).toEqual({ solas: ["99"], resto: ["count-selected(.) <= 3"] });
    expect(escribirSolas(con, [])).toBe("count-selected(.) <= 3");
    expect(escribirSolas(reglaSolas(["99"]), [])).toBe("");
  });

  it('la regla deja "Ninguno" solo y acepta lo demás', () => {
    const r = reglaSolas(["99"]);
    const acepta = (valor: string) => evaluarRestriccion(r, valor, {});
    expect(acepta("99")).toBe("acepta");
    expect(acepta("1 2")).toBe("acepta");
    expect(acepta("1 99")).toBe("rechaza");
  });

  it("sugiere las opciones que suelen ir solas y arma el mensaje", () => {
    const ops = [
      { name: "1", label: "Televisión" }, { name: "2", label: "Radio" },
      { name: "98", label: "No sabe" }, { name: "99", label: "Ninguno" }, { name: "97", label: "Prefiere no responder" },
    ];
    expect(sugeridasSolas(ops)).toEqual(["98", "99", "97"]);
    expect(mensajeSolas(["Ninguno"])).toBe('"Ninguno" no se puede marcar junto con otras opciones.');
    expect(mensajeSolas(["No sabe", "Ninguno"])).toBe('"No sabe" y "Ninguno" no se pueden marcar junto con otras opciones.');
  });
});
