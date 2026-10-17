import { describe, expect, it } from "vitest";
import { casosQueCumplen, condicionDesdeBorrador, textoCondicion } from "./casoValidoManualModel";

const sel = { variable: "seleccionado", etiqueta: "", del_formulario: false, n_con_dato: 3318, valores: [{ valor: "0", etiqueta: "", n: 818 }, { valor: "1", etiqueta: "", n: 2500 }] };
const p1 = { variable: "P1", etiqueta: "", del_formulario: true, n_con_dato: 10, valores: [{ valor: "1", etiqueta: "Sí", n: 6 }, { valor: "99", etiqueta: "No responde", n: 4 }] };

describe("caso válido a mano", () => {
  it("arma el operador desde el sentido y la cantidad de valores", () => {
    expect(condicionDesdeBorrador("seleccionado", "es", ["1"])).toEqual({ variable: "seleccionado", operador: "==", valores: ["1"] });
    expect(condicionDesdeBorrador("P1", "no_es", ["98", "99"])?.operador).toBe("not_in");
    expect(condicionDesdeBorrador("P1", "es", [])).toBeNull();
  });

  it("lee la condición con la etiqueta del valor cuando la hay", () => {
    expect(textoCondicion({ variable: "seleccionado", operador: "==", valores: ["1"] }, sel)).toBe("seleccionado es «1»");
    expect(textoCondicion({ variable: "P1", operador: "not_in", valores: ["1", "99"] }, p1)).toBe("P1 no es «Sí» (1) o «No responde» (99)");
  });

  it("cuenta los casos de una condición sola", () => {
    expect(casosQueCumplen(sel, "es", ["1"], 3318)).toBe(2500);
    expect(casosQueCumplen(sel, "no_es", ["1"], 3318)).toBe(818);
  });
});
