import { describe, expect, test } from "vitest";
import { antetituloDelTipo } from "./antetituloDelTipo";

// G3/G4 (Gonzalo, 2026-10-13): el índice y el objetivo pedían antetítulo; el motor no lo dibuja en ellos ni en la
// portada, y las láminas de ayuda llevan el suyo fijo.
describe("antetítulo por tipo de lámina", () => {
  test.each(["p_slide_indice", "p_slide_objetivo_icono", "p_slide_portada", "p_slide_cierre"])("%s no lo lleva", (tipo) => {
    expect(antetituloDelTipo(tipo)).toEqual({ modo: "ninguno" });
  });

  test("las láminas de ayuda traen el del estándar, sin campo", () => {
    expect(antetituloDelTipo("p_slide_top_two_box")).toEqual({ modo: "fijo", texto: "Cómo leer este informe" });
    expect(antetituloDelTipo("p_slide_redondeo")).toEqual({ modo: "fijo", texto: "Cómo leer este informe" });
    expect(antetituloDelTipo("p_slide_tabla_tecnica")).toEqual({ modo: "fijo", texto: "Metodología" });
  });

  test("el separador abre capítulo y una lámina de gráficos lo deja editar", () => {
    expect(antetituloDelTipo("p_slide_seccion")).toEqual({ modo: "capitulo" });
    expect(antetituloDelTipo("p_slide_1_grafico")).toEqual({ modo: "editable" });
  });
});
