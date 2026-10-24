// U2 del QA de CCSS (2026-10-24): la composición de una lámina real (Inspector y miniaturas) dibujaba «64%» al centro
// de la dona cuando el dato era 53%. Con las opciones de la lámina (maqueta) no lleva cifras de ejemplo (M6), como
// FichaRanura; sin ellas (catálogo de tipos), el dibujo del catálogo.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComposicionLamina } from "./ComposicionLamina";

const pintar = (opciones?: Record<string, object>) => renderToStaticMarkup(
  <ComposicionLamina tipo="p_slide_1_grafico" slots={["grafico"]} graficos={{ grafico: "p_donut" }} opciones={opciones} />,
);

describe("ComposicionLamina · sin cifras de ejemplo en una lámina real", () => {
  it("con opciones de la lámina no dibuja «64%»", () => {
    expect(pintar({ grafico: { otros: false } })).not.toContain("64%");
    expect(pintar({})).not.toContain("64%");
  });
  it("en el catálogo (sin opciones) conserva el dibujo de siempre", () => {
    expect(pintar()).toContain("64%");
  });
});
