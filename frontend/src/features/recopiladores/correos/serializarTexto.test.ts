import { describe, expect, it } from "vitest";

import { esMac, rotuloDeAtajo } from "./atajosDelEditor";
import { textoEnLaPlataforma } from "./comoSaleEnLaPlataforma";
import { domDePrueba } from "./domDePrueba.test-util";
import { textoPlano } from "./modeloCorreo";
import { enfasisAHtml, htmlDelTexto, sinEnfasis, textoDelDom, type OpcionesDeTexto } from "./serializarTexto";

const MULTI: OpcionesDeTexto = { enlaces: true, multilinea: true };
const dom = (html: string) => domDePrueba(html) as unknown as Node;

function idaYVuelta(texto: string, opts: OpcionesDeTexto = MULTI): string {
  return textoDelDom(dom(htmlDelTexto(texto, opts)), opts);
}

describe("cursiva y negrita (E1n)", () => {
  it.each([
    "Un *estudio de opinión* breve.",
    "Esto es **importante** y esto *también*.",
    "Las dos: ***muy importante***.",
    "Hola ***{{nombre}}***, *responde* **hoy**.",
    "**Importante: [lee esto](https://x.org)** y responde.",
    "Cuenta: 5\\*3 = 15 y 2\\*\\*2 = 4.",
    "Un \\* suelto y *una cursiva* juntos.",
    "Dos renglones *en cursiva*\ny **en negrita**",
  ])("ida y vuelta exacta: %s", (texto) => {
    expect(idaYVuelta(texto)).toBe(texto);
  });

  it("una cursiva que cubre todo el enlace se escribe por fuera (mismo árbol)", () => {
    expect(idaYVuelta("Lee [*la guía*](https://x.org/guia) primero.")).toBe("Lee *[la guía](https://x.org/guia)* primero.");
    expect(idaYVuelta("Lee [la *guía*](https://x.org/guia) primero.")).toBe("Lee [la *guía*](https://x.org/guia) primero.");
  });

  it("«5*3» escrito en el editor queda literal, nunca abre una cursiva", () => {
    expect(textoDelDom(dom("5*3 y 2*4"), MULTI)).toBe("5\\*3 y 2\\*4");
    expect(htmlDelTexto("5\\*3 y 2\\*4", MULTI)).toBe("5*3 y 2*4");
    expect(idaYVuelta("5\\*3 y 2\\*4")).toBe("5\\*3 y 2\\*4");
  });

  it("el HTML del editor: <em>, <strong> y los dos anidados", () => {
    expect(htmlDelTexto("*a* **b** ***c***", MULTI)).toBe("<em>a</em> <strong>b</strong> <em><strong>c</strong></em>");
    expect(enfasisAHtml("**a *b* c**")).toBe("<strong>a <em>b</em> c</strong>");
    expect(enfasisAHtml("* no es cursiva *")).toBe("* no es cursiva *");
  });

  it("lee con pila las formas anidadas del importador (collection_mail_marks.R)", () => {
    expect(enfasisAHtml("***a** b*")).toBe("<em><strong>a</strong> b</em>");
    expect(enfasisAHtml("*a **b***")).toBe("<em>a <strong>b</strong></em>");
    expect(enfasisAHtml("**a *b***")).toBe("<strong>a <em>b</em></strong>");
    // Un asterisco sin pareja queda literal; las marcas no cruzan renglones.
    expect(enfasisAHtml("5*3 y 2 * 4")).toBe("5*3 y 2 * 4");
    expect(enfasisAHtml("*a\nb*")).toBe("*a\nb*");
  });

  it("ida y vuelta de la forma anidada: se escribe plana y se lee con el mismo árbol", () => {
    const anidada = "Un *estudio **de opinión***.";
    const plano = idaYVuelta(anidada);
    expect(plano).toBe("Un *estudio* ***de opinión***.");
    const arbol = (t: string) => htmlDelTexto(t, MULTI).replace(/<\/em> <em>/g, " ");
    expect(htmlDelTexto(anidada, MULTI)).toBe("Un <em>estudio <strong>de opinión</strong></em>.");
    // Uniendo las dos cursivas vecinas, el árbol es el mismo que el de la forma anidada.
    expect(arbol(plano)).toBe(htmlDelTexto(anidada, MULTI));
    // Y la forma plana es estable: otra vuelta no la cambia.
    expect(idaYVuelta(plano)).toBe(plano);
  });

  it("lo que deja execCommand (<b>, <i>, style) se lee como negrita y cursiva", () => {
    expect(textoDelDom(dom("<i>uno</i> <b>dos</b>"), MULTI)).toBe("*uno* **dos**");
    expect(textoDelDom(dom('<span style="font-style: italic">tres</span>'), MULTI)).toBe("*tres*");
    expect(textoDelDom(dom('<em>a <span style="font-style: normal">b</span> c</em>'), MULTI)).toBe("*a* b *c*");
    expect(textoDelDom(dom("<em>a</em><em>b</em>"), MULTI)).toBe("*ab*");
  });

  it("anidar escribe tramos completos que se leen igual", () => {
    // **a *b* c** se escribe por tramos: mismo árbol, sin marcas que se crucen.
    const t = textoDelDom(dom("<strong>a <em>b</em> c</strong>"), MULTI);
    expect(t).toBe("**a** ***b*** **c**");
    expect(htmlDelTexto(t, MULTI)).toBe("<strong>a</strong> <em><strong>b</strong></em> <strong>c</strong>");
    // Una cursiva al final de la negrita.
    expect(textoDelDom(dom("<strong>a <em>b</em></strong>"), MULTI)).toBe("**a** ***b***");
  });

  it("los espacios del borde quedan fuera de las marcas", () => {
    expect(textoDelDom(dom("hola<em> mundo </em>!"), MULTI)).toBe("hola *mundo* !");
    expect(textoDelDom(dom("<em> </em>x"), MULTI)).toBe(" x");
  });

  it("un cambio de formato a mitad de palabra se queda con lo que comparte", () => {
    expect(textoDelDom(dom("<strong>pa</strong><strong><em>labra</em></strong>"), MULTI)).toBe("**palabra**");
    expect(textoDelDom(dom("<strong>pa</strong><em>labra</em>"), MULTI)).toBe("palabra");
  });

  it("los resúmenes y la plataforma no dejan asteriscos de marca", () => {
    expect(sinEnfasis("Un *estudio* **breve** y ***claro***: 5\\*3")).toBe("Un estudio breve y claro: 5*3");
    expect(textoPlano("Un *estudio de opinión*")).toBe("Un estudio de opinión");
    const plantilla = { fields: [{ key: "carrera", tag: "CARRERA", label: "Carrera" }] };
    expect(textoEnLaPlataforma("*Ya* {{nombre}} en {{carrera}}", plantilla, "mailchimp"))
      .toBe("<em>Ya</em> *|FNAME|* en *|CARRERA|*");
  });
});

describe("atajos por sistema", () => {
  it("⌘ en macOS, Ctrl en Windows", () => {
    expect(rotuloDeAtajo("Negrita", "B", true)).toBe("Negrita (⌘B)");
    expect(rotuloDeAtajo("Cursiva", "I", false)).toBe("Cursiva (Ctrl+I)");
    expect(esMac({ platform: "MacIntel" })).toBe(true);
    expect(esMac({ platform: "Win32" })).toBe(false);
    expect(esMac({ userAgentData: { platform: "Windows" }, platform: "MacIntel" })).toBe(false);
    expect(esMac({})).toBe(false);
  });
});
