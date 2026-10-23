import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (relativo: string) => fs.readFileSync(path.join(__dirname, relativo), "utf8");
const source = leer("TerritorialMonitoreoPage.tsx");
const chrome = leer("navegacion/ChromeTerritorial.tsx");
const selector = leer("navegacion/SelectorDeFase.tsx");

describe("Territorial: navegación del esqueleto común", () => {
  it("el rail es el de Monitoreo, con el corte al pie y sin el rail heredado", () => {
    expect(source).toContain("<RailTerritorial");
    expect(source).not.toContain("<ContextTabRail");
    expect(chrome).toContain("<MonitoreoWorkbenchRail");
    expect(chrome).toContain('label: "Corte"');
    // MonitoreoWorkbenchChrome ya emite la clase canónica; repetirla desde la
    // página territorial mezclaba responsabilidades y hacía más frágil el layout.
    expect(source).not.toContain('className="pulso-context-tab-layout"');
  });

  it("la pestaña activa es la dirección pública y el contenido es su tabpanel", () => {
    expect(source).toContain("useMonitoreoDireccionTraducida({");
    expect(source).toContain('modo: "territorial"');
    expect(source).toContain('contentRole="tabpanel"');
    expect(source).toContain("contentAriaLabelledBy={`monitoreo-${direccion.seccion}-tab-${direccion.pestana}`}");
  });

  it("la fase se elige en la barra del modo, no en la cabecera ni en el rail", () => {
    expect(source).toContain("selector: (");
    expect(source).toContain("<SelectorDeFase");
    expect(source).not.toContain('aria-label="Piloto o campo"');
    expect(chrome).not.toContain("phase");
    expect(selector).toContain('role="menuitemradio"');
    expect(selector).toContain("aria-checked={item.activa}");
    expect(selector).toContain('event.key !== "Escape"');
  });
});
