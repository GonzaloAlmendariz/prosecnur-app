import { describe, expect, it } from "vitest";
import { avisoTrasCalcular } from "../avisoCalculo";

const comp = (status?: string) => ({
  resultado: status ? { distribucion_universitaria: { status } } : { n_objetivo: 2500 },
});

describe("avisoTrasCalcular", () => {
  it("todo bien: anuncia los componentes, como siempre", () => {
    expect(avisoTrasCalcular([comp(), comp()])).toEqual({
      kind: "info",
      text: "Cálculo completado: 2 componentes.",
    });
    expect(avisoTrasCalcular([comp()]).text).toBe("Cálculo completado: 1 componente.");
  });

  it("todos incompatibles: no felicita, y manda donde está el porqué", () => {
    // Medido en vivo: el motor devolvió los dos componentes con
    // `population_design_sum_mismatch` y la pantalla anunciaba «Cálculo
    // completado: 2 componentes» al lado de «resultado inválido».
    const a = avisoTrasCalcular([comp("incompatible"), comp("incompatible")]);
    expect(a.kind).toBe("warn");
    expect(a.text).toContain("incompatible con el marco");
    expect(a.text).toContain("resumen del diseño");
    expect(a.text).not.toContain("completado");
  });

  it("sólo algunos: dice cuántos de cuántos", () => {
    const a = avisoTrasCalcular([comp("incompatible"), comp(), comp()]);
    expect(a.kind).toBe("warn");
    expect(a.text).toContain("1 de 3");
  });

  it("un status distinto de «incompatible» no dispara la advertencia", () => {
    // El motor puede publicar otros estados; sólo éste invalida el resultado.
    expect(avisoTrasCalcular([comp("ok"), comp("revisar")]).kind).toBe("info");
  });

  it("no se rompe con resultados ausentes o de otra forma", () => {
    expect(avisoTrasCalcular([{ resultado: null }, { resultado: undefined }, {}]).kind).toBe("info");
    expect(avisoTrasCalcular([{ resultado: "texto" }]).kind).toBe("info");
    expect(avisoTrasCalcular([]).text).toBe("Cálculo completado: 0 componentes.");
  });
});
