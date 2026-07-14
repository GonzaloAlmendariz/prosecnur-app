import { describe, expect, test } from "vitest";
import { renderMarkdownInline, sanitizeColor, stripMarkdown } from "./markdown";

describe("sanitizeColor", () => {
  test("acepta hex de 3/6/8 dígitos", () => {
    expect(sanitizeColor("#e11d48")).toBe("#e11d48");
    expect(sanitizeColor("#ABC")).toBe("#abc");
    expect(sanitizeColor("#11223344")).toBe("#11223344");
  });
  test("acepta keywords de la whitelist", () => {
    expect(sanitizeColor("Red")).toBe("red");
    expect(sanitizeColor("blue")).toBe("blue");
  });
  test("rechaza valores arbitrarios → inherit (anti-inyección)", () => {
    expect(sanitizeColor("red;} body{display:none")).toBe("inherit");
    expect(sanitizeColor("url(javascript:alert(1))")).toBe("inherit");
    expect(sanitizeColor("expression(x)")).toBe("inherit");
  });
});

describe("renderMarkdownInline — color", () => {
  test("reconstruye <span style=color> con color saneado", () => {
    const html = renderMarkdownInline('Hola <span style="color:#e11d48">rojo</span>');
    expect(html).toContain('<span style="color:#e11d48">rojo</span>');
  });
  test("un color con `;` no reconstruye el span (queda escapado, sin inyección)", () => {
    const html = renderMarkdownInline('<span style="color:red;}evil">x</span>');
    // El patrón no calza → el span queda escapado como texto inerte,
    // nunca como un <span style> vivo que rompa el atributo.
    expect(html).not.toContain('<span style="color:red;}evil"');
    expect(html).toContain("&lt;span");
  });
  test("un keyword de color fuera de whitelist se sanea a inherit", () => {
    const html = renderMarkdownInline('<span style="color:hotpink">x</span>');
    expect(html).toContain('<span style="color:inherit">x</span>');
  });
  test("procesa negrita dentro del color", () => {
    const html = renderMarkdownInline('<span style="color:blue">**fuerte**</span>');
    expect(html).toContain('<span style="color:blue"><strong>fuerte</strong></span>');
  });
  test("HTML no whitelisteado sigue escapado", () => {
    const html = renderMarkdownInline('<script>alert(1)</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderMarkdownInline — encabezado", () => {
  test("#### al inicio de línea → span de encabezado", () => {
    const html = renderMarkdownInline("#### Título");
    expect(html).toContain('<span class="pulso-md-h4">Título</span>');
  });
  test("#### en medio de texto NO es encabezado", () => {
    const html = renderMarkdownInline("texto #### no");
    expect(html).not.toContain("pulso-md-h4");
  });
});

describe("stripMarkdown", () => {
  test("quita prefijo de encabezado y spans de color, deja el texto", () => {
    expect(stripMarkdown("#### Título")).toBe("Título");
    expect(stripMarkdown('<span style="color:#e11d48">rojo</span>')).toBe("rojo");
    expect(stripMarkdown('a **b** <span style="color:blue">c</span>')).toBe("a b c");
  });
});
