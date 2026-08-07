import { describe, expect, it } from "vitest";
import { formatBaseLabels, parseBaseLabels } from "./BaseLabelsField";

// El valor viaja como `clave=Título` por línea —el mismo formato que
// `titulos_grupo` de las multiapiladas— pero el analista nunca lo escribe: la
// aplicación ya sabe cuántas bases hay y cómo se llaman.

describe("nombres de columna por base", () => {
  it("lee el formato del motor", () => {
    expect(parseBaseLabels("docentes=Docentes\negresados=Egresados")).toEqual({
      docentes: "Docentes",
      egresados: "Egresados",
    });
    expect(parseBaseLabels("  docentes = Docentes  ")).toEqual({ docentes: "Docentes" });
  });

  it("ignora lo que no es una asignación, en vez de romperse", () => {
    expect(parseBaseLabels("sin igual")).toEqual({});
    expect(parseBaseLabels("=solo valor")).toEqual({});
    expect(parseBaseLabels(undefined)).toEqual({});
    expect(parseBaseLabels(42)).toEqual({});
  });

  it("escribe en el orden de las bases y salta lo vacío", () => {
    // Una clave sin título no renombra nada: escribirla igual dejaría
    // `docentes=` en el plan, que el motor leería como «llámala cadena vacía».
    const mapa = { egresados: "Egresados", docentes: "", estudiantes: "  " };
    expect(formatBaseLabels(mapa, ["docentes", "estudiantes", "egresados"]))
      .toBe("egresados=Egresados");
  });

  it("el orden lo dan las bases, no el orden en que se escribieron", () => {
    const mapa = { egresados: "Egresados", docentes: "Docentes" };
    expect(formatBaseLabels(mapa, ["docentes", "egresados"]))
      .toBe("docentes=Docentes\negresados=Egresados");
  });

  it("ida y vuelta conserva lo declarado", () => {
    const texto = "docentes=Docentes\negresados=Egresados";
    expect(formatBaseLabels(parseBaseLabels(texto), ["docentes", "egresados"])).toBe(texto);
  });
});
