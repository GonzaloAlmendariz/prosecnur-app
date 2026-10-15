import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { paginasWord } from "../vistaGeneral/paginasWord";
import { capitulosDelPlan } from "./DetalleCapitulos";

const sep = (id: string, payload: Record<string, unknown>) => ({ id, tipo: "p_slide_seccion", payload }) as unknown as Slide;

// W4: la apertura y la entrada de cada capítulo, como `.word_apertura` y `.word_documento`.
describe("Word › Capítulos", () => {
  // Mata: contar un subcapítulo como capítulo (desde 6db06a91c es sección N.M).
  it("sólo los separadores de capítulo, con su subtítulo y su entrada", () => {
    const c = capitulosDelPlan([
      sep("a", { titulo: "Docencia", subtitulo: "Cómo ven la enseñanza", introduccion_word: "" }),
      sep("b", { titulo: "Tutoría", subtitulo: "", meta: { nivel: "subcapitulo" } }),
      sep("c", { titulo: "Servicios", subtitulo: "", introduccion_word: "Biblioteca y comedor.", meta: { nivel: "subcapitulo", word_heading_level: 1 } }),
      { id: "d", tipo: "p_slide_1_grafico", payload: {} } as unknown as Slide,
    ]);
    expect(c).toEqual([
      { id: "a", titulo: "Docencia", subtitulo: "Cómo ven la enseñanza", entrada: "" },
      { id: "c", titulo: "Servicios", subtitulo: "", entrada: "Biblioteca y comedor." },
    ]);
  });

  it("la página que abre un capítulo lleva su número, título y entrada", () => {
    const pags = paginasWord([{ clase: "seccion", nivel: 1, titulo: "Docencia", entrada: "Cómo ven la enseñanza" }],
      { tituloInforme: "x", hayEscalas: false, hayBottom: false });
    const cap = pags.find((p) => p.clase === "capitulo");
    expect(cap?.clase === "capitulo" && cap.apertura).toEqual({ numero: 1, titulo: "Docencia", entrada: "Cómo ven la enseñanza" });
  });
});
