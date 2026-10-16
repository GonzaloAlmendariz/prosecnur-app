import { describe, expect, it } from "vitest";
import { textoPlano } from "./textoPlano";

describe("textoPlano", () => {
  it("quita el span con estilo de un rótulo de Kobo", () => {
    expect(textoPlano('<span style="color:#002060">CARACTERÍSTICAS SOCIODEMOGRÁFICAS</span>'))
      .toBe("CARACTERÍSTICAS SOCIODEMOGRÁFICAS");
  });

  it("quita etiquetas anidadas y saltos de línea", () => {
    expect(textoPlano("<b>Sección <i>A</i></b><br/>Clima")).toBe("Sección A Clima");
  });

  it("decodifica las entidades básicas sin decodificar dos veces", () => {
    expect(textoPlano("Hogar &amp; familia &lt;18 &gt; 5 &quot;sí&quot; &#39;no&#39;"))
      .toBe("Hogar & familia <18 > 5 \"sí\" 'no'");
    expect(textoPlano("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
  });

  it("deja el texto sin marcado igual y tolera vacíos", () => {
    expect(textoPlano("Datos generales")).toBe("Datos generales");
    expect(textoPlano("Edad < 18 y > 5")).toBe("Edad < 18 y > 5");
    expect(textoPlano(null)).toBe("");
    expect(textoPlano(undefined)).toBe("");
  });

  it("quita el énfasis markdown del formulario", () => {
    expect(textoPlano("¿quién fue la *persona agresora*?")).toBe("¿quién fue la persona agresora?");
    expect(textoPlano("Instancia **NO PUCP**")).toBe("Instancia NO PUCP");
    expect(textoPlano("3 * 4")).toBe("3 * 4");
  });
});
