import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { normalizarConfigTelefonica } from "../../../api/materialTelefonica";
import { EntregaTelefonica } from "./SeccionesTelefonicas";

// P5b: «Leyendo la campaña…» con la campaña ya leída era una carga que no terminaba
// nunca, y con la marca de readiness habría colgado el QA.
describe("Telefónica › Entrega", () => {
  const pintar = (config: ReturnType<typeof normalizarConfigTelefonica> | null) =>
    renderToStaticMarkup(<MemoryRouter><EntregaTelefonica config={config} /></MemoryRouter>);

  it("mientras no llega la campaña, carga con su marca de «todavía no»", () => {
    const html = pintar(null);
    expect(html).toContain("Leyendo la campaña…");
    expect(html).toContain('data-audit-ready="false"');
  });

  it("con la campaña leída y sin columnas, lo dice y no se queda cargando", () => {
    const html = pintar(normalizarConfigTelefonica({ campaign_id: "telefonica.principal", llave: "Código", lee_monitoreo: [] }));
    expect(html).toContain("no declara columnas de lectura");
    expect(html).not.toContain("Leyendo la campaña…");
    expect(html).not.toContain('data-audit-ready="false"');
  });
});
