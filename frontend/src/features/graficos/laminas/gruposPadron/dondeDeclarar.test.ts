// X5 y R5-4: dónde se declara el padrón que falta; sin tipo del estudio, la Ficha.
import { describe, expect, it } from "vitest";
import { dondeDeclararPadron, HREF_FICHA } from "./dondeDeclarar";

describe("dondeDeclararPadron", () => {
  it("con el modo del estudio, Cálculo de muestra en ese modo", () => {
    const [d] = dondeDeclararPadron({ calc: "opinion-universitaria", monitoreo: [] });
    expect(d.clave).toBe("calc-muestra");
    expect(d.href).toContain("modo=opinion-universitaria");
    expect(d.href).not.toContain("[object");
  });

  it("R5-4: leído y sin modo, la Ficha del estudio con «Declarar el tipo del estudio»", () => {
    const destinos = dondeDeclararPadron({ calc: null, monitoreo: [] });
    expect(destinos).toEqual([expect.objectContaining({ clave: "ficha", texto: "Declarar el tipo del estudio", href: "/?panel=estudio" })]);
    expect(HREF_FICHA).toBe("/?panel=estudio");
    expect(dondeDeclararPadron({ calc: "  ", monitoreo: [] })[0].clave).toBe("ficha");
  });

  it("mientras carga, Cálculo de muestra sin modo; con acreditación, también Monitoreo", () => {
    expect(dondeDeclararPadron(null)[0]).toMatchObject({ clave: "calc-muestra", href: "/calc-muestra" });
    const destinos = dondeDeclararPadron({ calc: "acreditacion", monitoreo: ["acreditacion"] });
    expect(destinos.map((d) => d.clave)).toEqual(["calc-muestra", "monitoreo"]);
    expect(dondeDeclararPadron({ calc: null, monitoreo: ["acreditacion"] }).map((d) => d.texto))
      .toEqual(["Declarar el tipo del estudio", "o declarar en Monitoreo"]);
  });

  it("X5 grupos: el marco de Cálculo de muestra en el modo del estudio, sin Monitoreo (su universo es por actor)", () => {
    const destinos = dondeDeclararPadron({ calc: "acreditacion", monitoreo: ["acreditacion"] }, "grupos");
    expect(destinos).toEqual([expect.objectContaining({
      clave: "calc-muestra", texto: "Ver el marco en Cálculo de muestra", href: expect.stringContaining("modo=acreditacion"),
    })]);
    expect(destinos[0].href.startsWith("/calc-muestra")).toBe(true);
    expect(dondeDeclararPadron({ calc: null, monitoreo: [] }, "grupos")[0].clave).toBe("ficha");
  });
});
