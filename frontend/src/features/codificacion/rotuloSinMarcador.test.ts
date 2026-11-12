// Los rótulos de sección del formulario con un marcador sin reemplazar no se muestran crudos (rótulos reales
// de acnur_pdm).
import { describe, expect, test } from "vitest";
import { armarUnidades, seccionesVisibles } from "./preguntas/modeloUnidades";
import { pregunta } from "./preguntas/unidadesDePrueba";
import { rotuloSinMarcador } from "./sugerenciasModulo";

describe("rotuloSinMarcador", () => {
  test("corta antes del marcador y quita el conector que queda colgando", () => {
    expect(rotuloSinMarcador("Acceso al Espacio de Protección de ${sede_ppl}")).toBe("Acceso al Espacio de Protección");
    expect(rotuloSinMarcador("Recepción y/o registro inicial en Espacio de Protección de ${sede_ppl}")).toBe("Recepción y/o registro inicial en Espacio de Protección");
    expect(rotuloSinMarcador("Datos generales")).toBe("Datos generales");
    expect(rotuloSinMarcador("${sede_ppl}")).toBe("");
  });

  test("la sección de Preguntas no muestra el marcador; sin texto antes, usa el nombre de la sección", () => {
    const unidades = armarUnidades([
      pregunta("p1", "text", { section: "acceso", section_label: "Acceso al Espacio de Protección de ${sede_ppl}" }),
      pregunta("p2", "text", { section: "sede", section_label: "${sede_ppl}" }),
    ]);
    const rotulos = seccionesVisibles(unidades, "todas", "").map((s) => s.rotulo);
    expect(rotulos).toEqual(["Acceso al Espacio de Protección", "sede"]);
    expect(rotulos.join(" ")).not.toContain("${");
  });
});

describe("sinMarcadores", () => {
  test("quita el marcador con su conector y ordena los espacios", async () => {
    const { sinMarcadores } = await import("./sugerenciasModulo");
    expect(sinMarcadores("¿Cómo se enteró del Espacio de Protección de ${sede_ppl} ?")).toBe("¿Cómo se enteró del Espacio de Protección?");
    expect(sinMarcadores("“Hola, me llamo ${Enumeratorname}, trabajo para la encuesta")).toBe("“Hola, me llamo, trabajo para la encuesta");
    expect(sinMarcadores("Sin marcador")).toBe("Sin marcador");
  });
});
