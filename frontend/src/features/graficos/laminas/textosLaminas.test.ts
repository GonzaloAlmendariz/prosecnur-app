// U7 del QA de CCSS (2026-10-24): textos que se leían mal en la pestaña Láminas.
import { describe, expect, it } from "vitest";
import { rotuloHeredado } from "../word/modeloMultiWord";
import { fraseOtrasPreguntas } from "./colores/frasesPaleta";
import { rolDeEstructura } from "./rolEstructura";

describe("textos de la pestaña Láminas", () => {
  it("«otra pregunta», nunca «otras 1 pregunta»", () => {
    expect(fraseOtrasPreguntas(1)).toBe("Estos colores también pintan otra pregunta con las mismas respuestas.");
    expect(fraseOtrasPreguntas(3)).toBe("Estos colores también pintan otras 3 preguntas con las mismas respuestas.");
    expect(fraseOtrasPreguntas(0)).toBe("Estos colores son los de esta pregunta.");
  });

  it("«Como el informe (…)» sin paréntesis anidados", () => {
    expect(rotuloHeredado("mismo_actor_escala")).toBe("por pregunta");
    expect(rotuloHeredado("automatico")).toBe("una figura por tema");
    expect(rotuloHeredado("un_grafico")).toBe("un gráfico");
    for (const m of ["mismo_actor_escala", "automatico", "un_grafico", "por_tema", "por_barra", "un_grafico_mismo_publico"] as const) {
      expect(rotuloHeredado(m)).not.toMatch(/[()]/);
    }
  });

  it("las láminas sin gráficos dicen su papel, no «Estructura del informe» ni «ranuras»", () => {
    expect(rolDeEstructura("p_slide_cierre")).toBe("Cierra el informe");
    expect(rolDeEstructura("p_slide_tabla_tecnica")).toBe("Resume el diseño del estudio");
    expect(rolDeEstructura("p_slide_portada")).toBe("Abre el informe");
    expect(rolDeEstructura("p_slide_seccion")).toBe("Abre un capítulo");
    for (const t of ["p_slide_cierre", "p_slide_tabla_tecnica", "p_slide_indice", "p_slide_desconocido"]) {
      expect(rolDeEstructura(t)).not.toMatch(/Estructura del informe|ranura/i);
    }
  });
});
