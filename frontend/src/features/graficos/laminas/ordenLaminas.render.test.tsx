// La Estructura y la tira se ordenan arrastrando: cada fila y cada miniatura lleva su asa («Mover lámina N: título»),
// fuera del botón que abre la lámina, en el orden del plan.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// El lote de miniaturas pide al backend y lee la dirección: fuera de este test.
vi.mock("./miniaturas/useMiniaturasLote", () => ({
  useMiniaturasLote: () => ({ entradas: {}, avance: null, reintentar: () => undefined }),
}));

import type { Slide, SlideType } from "../../../api/graficos";
import { EstructuraInforme } from "./EstructuraInforme";
import { construirEstructura } from "./modeloEstructura";
import { TiraMiniaturas } from "./TiraMiniaturas";

const s = (id: string, tipo: SlideType, payload: Record<string, unknown> = {}): Slide => ({ id, tipo, payload });
const graf = { graficador: "p_barras_apiladas", args: { var: "P1" } };
const estructura = construirEstructura([
  s("a", "p_slide_portada", { titulo: "Estudio" }),
  s("d", "p_slide_seccion", { titulo: "Perfil" }),
  s("e", "p_slide_1_grafico", { titulo: "Edad.", grafico: graf }),
]);

describe("asas de orden", () => {
  it("Estructura: un asa por fila con su nombre, en el orden del plan, fuera del botón de la fila", () => {
    const html = renderToStaticMarkup(
      <EstructuraInforme onCerrar={() => undefined} estructura={estructura} posicionActiva={1} onSeleccionar={() => undefined} validacion={{}} />,
    );
    expect(html).toContain('aria-label="Mover lámina 1: Estudio"');
    expect(html).toContain('aria-label="Mover lámina 2: Perfil"');
    expect(html).toContain('aria-label="Mover lámina 3: Edad"');
    expect(html.indexOf("Mover lámina 1")).toBeLessThan(html.indexOf("Mover lámina 3"));
    expect(html.match(/aria-roledescription="sortable"/g)).toHaveLength(3);
    // Un botón no contiene otro: el asa es hermana del botón de la fila.
    expect(html).not.toMatch(/<button[^>]*pulso-f6-lamina[^>]*>(?:(?!<\/button>).)*pulso-f6-asa-lamina/);
  });

  it("tira: un asa por miniatura con su nombre", () => {
    const html = renderToStaticMarkup(<TiraMiniaturas estructura={estructura} posicionActiva={1} onIr={() => undefined} />);
    expect(html).toContain('aria-label="Mover lámina 3: Edad"');
    expect(html.match(/pulso-f6-asa-lamina is-tira/g)).toHaveLength(3);
  });
});
