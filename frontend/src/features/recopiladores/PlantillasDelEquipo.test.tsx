import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PlantillasDelEquipo } from "./PlantillasDelEquipo";

describe("Plantillas del equipo de aulas", () => {
  it("ofrece la asignación inicial de aplicadores y manda el reparto diario a Monitoreo (R7)", () => {
    const html = renderToStaticMarkup(<MemoryRouter><PlantillasDelEquipo /></MemoryRouter>);
    expect(html).toContain("Asignación inicial de aplicadores");
    expect(html).toContain("El reparto de cada día sobre la agenda lo rehace Monitoreo");
    expect(html).toMatch(/href="\/monitoreo\?[^"]*modo=aulas[^"]*seccion=modelo[^"]*pestana=carga/);
  });
});
