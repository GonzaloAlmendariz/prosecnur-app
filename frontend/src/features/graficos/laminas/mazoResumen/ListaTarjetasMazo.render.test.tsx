// La grilla ordenable: cada tarjeta lleva su asa («Mover …») y los números siguen el orden recibido.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PropuestaMazo } from "./modeloMazo";

vi.mock("../reglaPreguntas/useConteoRegla", () => ({
  useConteoRegla: () => ({ conteo: null, cargando: false, error: null, codigo: null }),
}));

import { ListaTarjetasMazo } from "./ListaTarjetasMazo";

const base: PropuestaMazo = {
  id: "panorama", clase: "panorama", tarjeta: "p_slide_1_grafico:panorama", tipo: "p_slide_1_grafico", nombre: "Panorama",
  claseTarjeta: "resumen", publicos: ["docentes"], graficador: "p_panorama", slot: "grafico", args: {}, reglaEnPalabras: "", falta: null,
};

describe("ListaTarjetasMazo", () => {
  it("asa por tarjeta, en el orden recibido, sin casilla nativa", () => {
    const html = renderToStaticMarkup(
      <ListaTarjetasMazo propuestas={[{ ...base, id: "contraste", nombre: "Contraste" }, base]} elegidas={{ panorama: true }} editando={null}
        scope="active" idLateral="lat" onAlternar={() => undefined} onEditar={() => undefined} onOrdenar={() => undefined} />,
    );
    expect(html).toContain('aria-label="Mover Contraste"');
    expect(html).toContain('aria-label="Mover Panorama"');
    expect(html.indexOf("Mover Contraste")).toBeLessThan(html.indexOf("Mover Panorama"));
    expect(html).toContain('aria-roledescription="sortable"');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).not.toContain('type="checkbox"');
  });
});
