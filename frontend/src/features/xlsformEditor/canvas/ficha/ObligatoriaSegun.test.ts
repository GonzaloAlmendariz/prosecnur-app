// Mata: «nunca» que escribe «no» en vez de vaciar la columna, «sólo si» que pierde la condición y una condición vacía
// que deja la pregunta obligatoria siempre.
import { describe, expect, it } from "vitest";
import { lecturaRequired } from "../../parsing/parseType";
import { requiredDe } from "./ObligatoriaSegun";

describe("obligatoria en tres modos", () => {
  it("cada modo escribe lo que la plataforma entiende", () => {
    expect(requiredDe("siempre", "")).toBe("yes");
    expect(requiredDe("nunca", "${p} = '1'")).toBe("");
    expect(requiredDe("expresion", " ${p} = '1' ")).toBe("${p} = '1'");
  });
  it("lo escrito se relee en el mismo modo", () => {
    expect(lecturaRequired(requiredDe("siempre", ""))).toBe("siempre");
    expect(lecturaRequired(requiredDe("nunca", ""))).toBe("nunca");
    expect(lecturaRequired(requiredDe("expresion", "${p} = '1'"))).toBe("expresion");
    expect(lecturaRequired(requiredDe("expresion", ""))).toBe("nunca");
  });
});
