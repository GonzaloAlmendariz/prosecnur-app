// M6 del contrato de la maqueta (galería, casos 22–28): las láminas de estructura informan con su texto real; el
// selector y las miniaturas (sin datos) conservan su esquema.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Slide } from "../../../../api/graficos";
import { ComposicionLamina } from "../../iconos/ComposicionLamina";
import { datosEstructura } from "./datosEstructura";

const s = (tipo: string, payload: Record<string, unknown>) => ({ tipo, payload }) as unknown as Slide;
const textos = (html: string) => [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe("datos de las láminas de estructura", () => {
  it("objetivo: el texto sin marcas de negrita y los actores con nombre", () => {
    const d = datosEstructura(s("p_slide_objetivo_icono", {
      texto: "Conocer la percepción sobre **la gestión**", meta: { actores: ["Docentes", "", "Estudiantes"], actores_iconos: ["book-open", "", ""] },
    }));
    expect(d.texto).toBe("Conocer la percepción sobre la gestión");
    expect(d.actores).toEqual([{ nombre: "Docentes", icono: "book-open" }, { nombre: "Estudiantes", icono: "" }]);
  });

  it("ficha técnica: los criterios; cierre: los contactos; portada: título, subtítulo y fecha", () => {
    expect(datosEstructura(s("p_slide_tabla_tecnica", { filas: [{ criterio: "Población", detalle: "x" }, { criterio: "Muestra", detalle: "y" }] })).criterios).toEqual(["Población", "Muestra"]);
    expect(datosEstructura(s("p_slide_cierre", { correo: "pulso@pucp.edu.pe", web: "pulso.pucp.edu.pe" })).contactos).toEqual(["pulso@pucp.edu.pe", "pulso.pucp.edu.pe"]);
    expect(datosEstructura(s("p_slide_portada", { titulo: "Estudio", subtitulo: "Facultad", fecha: "2026" }))).toMatchObject({ titulo: "Estudio", subtitulo: "Facultad", fecha: "2026" });
  });
});

describe("la maqueta de estructura muestra su texto real", () => {
  const render = (tipo: string, payload: Record<string, unknown>, variante: string | null, conDatos: boolean) =>
    renderToStaticMarkup(<ComposicionLamina tipo={tipo} slots={[]} variante={variante} datos={conDatos ? datosEstructura(s(tipo, payload)) : undefined} />);

  it("objetivo, en sus tres composiciones, nombra a los actores", () => {
    const payload = { texto: "Conocer la percepción de los públicos", meta: { actores: ["Docentes", "Estudiantes", "Egresados"], dimensiones: ["Los propósitos", "La gestión"] } };
    for (const v of ["clasica", "panel", "dimensiones"]) {
      const t = textos(render("p_slide_objetivo_icono", payload, v, true));
      expect(t, v).toEqual(expect.arrayContaining(["Docentes", "Estudiantes", "Egresados"]));
    }
    expect(textos(render("p_slide_objetivo_icono", payload, "dimensiones", true))).toEqual(expect.arrayContaining(["Los propósitos", "La gestión"]));
  });

  it("índice: sus capítulos, y «y N capítulos más» si pasan de seis", () => {
    const capitulos = Array.from({ length: 8 }, (_, i) => `Capítulo ${i + 1}`);
    const t = textos(render("p_slide_indice", { secciones: capitulos.join("\n") }, "arcos", true));
    expect(t).toEqual(expect.arrayContaining(["Capítulo 1", "Capítulo 5", "y 3 capítulos más"]));
  });

  it("índice con subcapítulos: cada capítulo con sus «k.j», en las cuatro composiciones del recetario", () => {
    const payload = { secciones: "Gestión\nDocencia", subindices: "Gestión: Autoridades\nGestión: Trámites\nDocencia: Calidad" };
    const t = textos(render("p_slide_indice", payload, "arcos", true));
    expect(t).toEqual(expect.arrayContaining(["Gestión", "1.1", "Autoridades", "1.2", "Trámites", "Docencia", "2.1", "Calidad"]));
    for (const c of ["facetas", "circulos", "bloques"]) expect(textos(render("p_slide_indice", payload, c, true)), c).toEqual(t);
  });

  it("sin datos (selector, miniaturas) el esquema no lleva texto, como siempre", () => {
    for (const tipo of ["p_slide_portada", "p_slide_indice", "p_slide_seccion", "p_slide_objetivo_icono", "p_slide_tabla_tecnica", "p_slide_cierre"]) {
      expect(textos(render(tipo, { titulo: "T" }, null, false)), tipo).toEqual([]);
    }
  });
});
