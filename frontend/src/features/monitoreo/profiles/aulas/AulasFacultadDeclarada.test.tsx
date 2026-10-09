import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AulasFacultadDeclarada from "./AulasFacultadDeclarada";

const VARIABLES = [
  { name: "datos_demo/P2", values: ["1", "2"] },
  { name: "datos_demo/P7", values: ["1", "2", "3", "10"] },
];
const FACULTADES = ["ARQUITECTURA", "ARTE Y DISEÑO", "ARTES ESCÉNICAS", "DERECHO"];

const pinta = (props: Partial<Parameters<typeof AulasFacultadDeclarada>[0]> = {}) =>
  renderToStaticMarkup(
    <AulasFacultadDeclarada
      variables={VARIABLES}
      facultadesDelPlan={FACULTADES}
      onDeclarar={() => {}}
      {...props}
    />,
  );

describe("la pantalla de la facultad declarada", () => {
  it("sin variable declarada explica qué se pierde, no se queda muda", () => {
    const html = pinta();
    expect(html).toContain("no se adivina qué columna es");
    // C3: el vacío está contenido y el selector sigue ahí.
    expect(html).toContain("sin declarar");
    expect(html).toContain("datos_demo/P7");
  });

  it("con la variable elegida pinta un desplegable por código", () => {
    const html = pinta({ facultadVar: "datos_demo/P7" });
    for (const codigo of ["1", "2", "3", "10"]) {
      expect(html).toContain(`Facultad del código ${codigo}`);
    }
    // Y ofrece las facultades del DISEÑO, que son las que tienen cuota.
    expect(html).toContain("ARTES ESCÉNICAS");
  });

  it("dice cuántos códigos quedan sin facultad", () => {
    const html = pinta({
      facultadVar: "datos_demo/P7",
      etiquetas: { "1": "ARQUITECTURA" },
    });
    expect(html).toContain("3 códigos sin facultad");
    expect(html).toContain("2, 3, 10");
  });

  it("no ofrece proponer cuando las listas no miden lo mismo, y dice por qué", () => {
    // Cuatro códigos y cuatro facultades sí casan; con la variable de sexo (2
    // valores) contra 4 facultades, no. Proponer ahí correría el catálogo.
    const si = pinta({ facultadVar: "datos_demo/P7" });
    expect(si).not.toContain("Emparejar por posición correría");
    const no = pinta({ facultadVar: "datos_demo/P2" });
    expect(no).toContain("Emparejar por posición correría el catálogo entero");
  });

  it("enseña el veredicto del cruce cuando el motor lo devuelve", () => {
    const html = pinta({
      facultadVar: "datos_demo/P7",
      etiquetas: { "1": "ARQUITECTURA" },
      control: { ok: true, comparables: 2477, coinciden: 2357 },
    });
    expect(html).toContain("95.2 %");
    expect(html).toContain("es-ok");
  });

  it("y avisa cuando el mapeo está corrido, sin llamarlo hallazgo de campo", () => {
    const html = pinta({
      facultadVar: "datos_demo/P7",
      etiquetas: { "1": "DERECHO" },
      control: { ok: true, comparables: 2477, coinciden: 28 },
    });
    expect(html).toContain("catálogo está mal emparejado");
    expect(html).toContain("es-atencion");
  });

  it("una variable sin valores en la base lo declara en vez de dejar la lista vacía", () => {
    const html = pinta({
      variables: [{ name: "vacía", values: [] }],
      facultadVar: "vacía",
    });
    expect(html).toContain("no trae valores en la base sincronizada");
  });
});
