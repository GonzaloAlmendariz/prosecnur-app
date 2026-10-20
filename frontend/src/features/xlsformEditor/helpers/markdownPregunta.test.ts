import { describe, expect, test } from "vitest";
import { conReferencias, esNotaSinTexto, pistaLegible, textoPreguntaHtml, textoPreguntaPlano } from "./markdownPregunta";

const etiquetas: Record<string, string> = { HH01: "Nombre del miembro del hogar", largo: "x".repeat(60) };
const lector = { etiquetaDe: (n: string) => etiquetas[n] };

describe("texto de pregunta", () => {
  test("${x} sin respuesta va como [Etiqueta corta] o [código]", () => {
    expect(conReferencias("¿Edad de ${HH01}?", lector)).toBe("¿Edad de [Nombre del miembro del hogar]?");
    expect(conReferencias("${largo} y ${nada}", lector)).toBe("[largo] y [nada]");
  });
  test("${x} con respuesta dada va con la respuesta", () => {
    expect(conReferencias("¿Edad de ${HH01}?", { ...lector, respuestaDe: (n) => (n === "HH01" ? "Rosa" : undefined) })).toBe("¿Edad de Rosa?");
  });
  test("markdown se pinta y <br> es salto, nunca crudo", () => {
    const html = textoPreguntaHtml("**Lea** en *voz alta*<br>Luego<BR/>pregunte", lector);
    expect(html).toBe("<strong>Lea</strong> en <em>voz alta</em><br>Luego<br>pregunte");
    expect(textoPreguntaHtml("<b>x</b>", lector)).toContain("&lt;b&gt;");
  });
  test("versión plana sin marcas", () => {
    expect(textoPreguntaPlano("**Sí**<br>de ${HH01}", lector)).toBe("Sí de [Nombre del miembro del hogar]");
  });
  test("filas técnicas", () => {
    expect(esNotaSinTexto({ kind: "note", label: "", name: "logo" })).toBe(true);
    expect(esNotaSinTexto({ kind: "note", label: "logo", name: "logo" })).toBe(true);
    expect(esNotaSinTexto({ kind: "note", label: "**Hola**", name: "n1" })).toBe(false);
    expect(pistaLegible({ hint: "REG02_Other_recod", name: "REG02_Other_recod" })).toBe("");
    expect(pistaLegible({ hint: "Lea las opciones", name: "p1" })).toBe("Lea las opciones");
  });
});
