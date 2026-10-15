import { describe, expect, it } from "vitest";
import type { FilaCalculo } from "../estiloInforme/modeloEstiloInforme";
import { conRedondeo, describirRedondeo, leerRedondeo, sinRedondeo } from "./modeloRedondeoGrafico";

const fila = (o: Partial<FilaCalculo> = {}): FilaCalculo => ({
  preset: "barras_apiladas", titulo: "Barras apiladas", icono: "", admiteMetodo: true, campoDecimales: "decimales",
  metodo: "estandar", metodoDefault: "estandar", choicesMetodo: [], decimales: 0, decimalesDefault: 0, procedencia: "recetario", ...o,
});

// R4: el redondeo propio es una excepción explícita (`calculos_propios`), como la honra el motor.
describe("redondeo propio de un gráfico", () => {
  // Mata: tomar como propio un valor viejo que quedó en el plan sin la marca (el motor lo ignora).
  it("sin la marca, un valor viejo no cuenta: el gráfico sigue a su tipo", () => {
    const viejo = { overrides: { metodo_redondeo: "reparto", decimales: 1 } };
    expect(leerRedondeo(viejo, fila())).toEqual({ propio: false, metodo: "estandar", decimales: 0 });
    expect(describirRedondeo(viejo, fila())).toBeNull();
  });

  it("propio: escribe la marca y los campos de su familia, y se describe", () => {
    const ov = conRedondeo({ overrides: { titulo: "x" } }, fila(), { metodo: "reparto" });
    expect(ov).toEqual({ titulo: "x", calculos_propios: true, metodo_redondeo: "reparto", decimales: 0 });
    expect(describirRedondeo({ overrides: ov }, fila())).toBe("Reparto a 100 %, Sin decimales");
    // Una familia sin método (respuesta múltiple) sólo lleva decimales, en su propio campo.
    const multiple = fila({ admiteMetodo: false, campoDecimales: "decimales_pct" });
    expect(conRedondeo({}, multiple, { decimales: 1 })).toEqual({ calculos_propios: true, decimales_pct: 1 });
    expect(describirRedondeo({ overrides: { calculos_propios: true, decimales_pct: 1 } }, multiple)).toBe("Un decimal");
  });

  // Mata: un «Como el informe» que deje la marca o un campo gobernado.
  it("«Como el informe» quita la marca y los campos gobernados y conserva lo demás", () => {
    expect(sinRedondeo({ overrides: { titulo: "x", calculos_propios: true, metodo_redondeo: "reparto", decimales: 1, decimales_pct: 2 } }))
      .toEqual({ titulo: "x" });
  });
});
