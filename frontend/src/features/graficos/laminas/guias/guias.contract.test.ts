// D17 y plan F6 §8: las guías son del visor. No viajan en la config del proyecto ni en el pedido de la vista previa, y
// el conmutador viejo que las horneaba en la imagen («Guías (beta)», `debugPh`) ya no vive en el visor.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

describe("guías del visor (contrato)", () => {
  it("el visor ya no monta el conmutador que horneaba las guías", () => {
    const visor = leer("../VisorLamina.tsx");
    expect(visor).not.toMatch(/DebugPhToggle/);
    expect(visor).toMatch(/<BotonGuias /);
    expect(visor).toMatch(/<GuiasSobreLamina /);
  });

  it("el estado de las capas vive en su store efímero, no en el plan ni en la config", () => {
    const store = leer("./guiasStore.ts");
    expect(store).not.toMatch(/usePlanStore|configSnapshot|buildGraficosConfig/);
    for (const f of ["./BotonGuias.tsx", "./GuiasSobreLamina.tsx", "./modeloGuias.ts"]) {
      expect(leer(f)).not.toMatch(/usePlanStore|setDebugPh|buildGraficosConfig/);
    }
  });

  it("el panel se abre por la dirección canónica (panel=guias)", () => {
    expect(leer("./panelGuias.ts")).toMatch(/id: "guias"/);
    expect(leer("./BotonGuias.tsx")).toMatch(/usePanelDireccionable\(PANEL_GUIAS_LAMINA\)/);
  });
});
