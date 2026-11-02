import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { normalizarUnidadesTerritoriales } from "../../../api/materialTerritorial";
import { ZonasDeCuotas, cuotaPorSexo } from "./ZonasDeCuotas";

const UNIDADES = normalizarUnidadesTerritoriales({
  campaign_id: "territorial.principal", fase: "field", kind: "cuotas", n_zonas: 2, n_entrevistas: 9,
  units: [
    { unit_id: "150103", role: "zona", label: "ATE", n: 5, cuotas: [{ sexo: "Hombre", rango_id: "r1", rango_edad: "18-29", n: 2 }, { sexo: "Mujer", rango_id: "r1", rango_edad: "18-29", n: 3 }] },
    { unit_id: "150132", role: "zona", label: "SAN JUAN DE LURIGANCHO", n: 4, cuotas: [{ sexo: "Mujer", rango_id: "r1", rango_edad: "18-29", n: 4 }] },
  ],
});

describe("ZonasDeCuotas", () => {
  it("resume la cuota por sexo en el orden en que llega", () => {
    expect(cuotaPorSexo(UNIDADES.zonas[0])).toBe("Hombre 2 · Mujer 3");
  });

  it("lista cada zona con su hoja de conteo y la cabecera dice zonas y entrevistas", () => {
    const html = renderToStaticMarkup(<ZonasDeCuotas campaignId="territorial.principal" unidades={UNIDADES} />);
    for (const t of ["Zonas de la muestra por cuotas", "2 zonas y 9 entrevistas", "Hoja de conteo de ATE",
      "Hoja de conteo de SAN JUAN DE LURIGANCHO", "Hojas de conteo de todas", "Hombre 2 · Mujer 3"]) {
      expect(html).toContain(t);
    }
  });

  it("con el envío desactualizado no imprime y lo avisa", () => {
    const html = renderToStaticMarkup(<MemoryRouter><ZonasDeCuotas campaignId="territorial.principal" unidades={{ ...UNIDADES, stale: true }} /></MemoryRouter>);
    expect(html).toContain("La muestra cambió en Hojas de ruta");
    expect(html.match(/disabled=""/g)?.length).toBe(3);
  });
});
