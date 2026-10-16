import { describe, expect, test } from "vitest";
import type { BuilderNode } from "../types";
import { evaluarRestriccion, valoresDeEjemplo } from "./probarRestriccion";

const nodo = (base: string, constraint: string) => ({ typeInfo: { raw: base, base, listName: "" }, constraint } as BuilderNode);

describe("probar una restricción", () => {
  test("rango sobre la propia respuesta", () => {
    expect(evaluarRestriccion(". >= 18 and . <= 99", "17")).toBe("rechaza");
    expect(evaluarRestriccion(". >= 18 and . <= 99", "18")).toBe("acepta");
    expect(evaluarRestriccion(". >= 18 and . <= 99", "100")).toBe("rechaza");
  });
  test("regex, largo de texto y fecha", () => {
    expect(evaluarRestriccion("regex(., '^[0-9]{9}$')", "987654321")).toBe("acepta");
    expect(evaluarRestriccion("regex(., '^[0-9]{9}$')", "98765")).toBe("rechaza");
    expect(evaluarRestriccion("string-length(.) <= 3", "abcd")).toBe("rechaza");
    expect(evaluarRestriccion(". <= today()", "1990-05-01")).toBe("acepta");
    expect(evaluarRestriccion(". <= today()", "2999-01-01")).toBe("rechaza");
  });
  test("lo que el evaluador no conoce se dice, no se inventa", () => {
    expect(evaluarRestriccion("pulldata('t', 'a', 'b', .) != ''", "x")).toBe("no-evaluable");
  });
  test("selección múltiple: una opción, varias y la exclusiva con otra", () => {
    const vals = valoresDeEjemplo(nodo("select_multiple", "not(selected(., '99') and count-selected(.) > 1)"), ["1", "2", "3", "99"]);
    expect(vals).toContain("1 99");
    expect(evaluarRestriccion("not(selected(., '99') and count-selected(.) > 1)", "1 99")).toBe("rechaza");
    expect(evaluarRestriccion("not(selected(., '99') and count-selected(.) > 1)", "99")).toBe("acepta");
  });
  test("los valores de ejemplo salen de los bordes de la regla", () => {
    expect(valoresDeEjemplo(nodo("integer", ". >= 18 and . <= 99"))).toEqual(["17", "18", "59", "99", "100"]);
  });
});
