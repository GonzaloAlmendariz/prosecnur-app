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

// QA A3, defecto 2: a 1024 con la Estructura abierta (visor de 701 px) el botón Guías quedaba en 0 × 0 por una regla de
// contenedor, y con capas encendidas no había control a la vista ni alternativa en «Más acciones».
describe("el botón Guías nunca desaparece de la barra del visor", () => {
  const css = leer("../visorLamina.css");
  const bloques = [...css.matchAll(/@container[^{]*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);

  // Mutante que mata: volver a ocultar el contenedor del botón en cualquier ancho de visor.
  it("ninguna regla de contenedor oculta el botón ni su envoltorio", () => {
    expect(bloques.length).toBeGreaterThanOrEqual(4);
    for (const b of bloques) {
      const reglas = [...b.matchAll(/([^{}]+)\{([^}]*)\}/g)];
      for (const [, selector, cuerpo] of reglas) {
        if (/pulso-f6-guias/.test(selector)) expect(cuerpo).not.toMatch(/display:\s*none|visibility:\s*hidden|width:\s*0/);
      }
    }
    expect(css).not.toMatch(/\.pulso-f6-guias[^{]*\{[^}]*display:\s*none/);
  });

  it("en el ancho chico el botón queda en ícono y cuenta: el rótulo es «medio» y la cuenta no lleva clase de rótulo", () => {
    const boton = leer("./BotonGuias.tsx");
    expect(boton).toMatch(/<span className="pulso-f6-rotulo-medio">Guías<\/span>/);
    expect(boton).toMatch(/className="pulso-f6-guias-cuenta"/);
    expect(boton).not.toMatch(/pulso-f6-guias-cuenta[^"]*rotulo/);
  });

  // Mutante que mata: quitar la compactación de la barra a 800 px (sin ella el botón no cabe junto a Ajustes).
  it("por debajo de 800 px ceden «Lámina» y «Ajustes» a la vista (siguen en el nombre accesible)", () => {
    const b800 = css.match(/@container pulso-f6-visor \(max-width: 800px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(b800).toMatch(/\.pulso-f6-rotulo-angosto\s*\{[^}]*clip: rect\(0, 0, 0, 0\)/);
    const visor = leer("../VisorLamina.tsx");
    expect(visor).toMatch(/<span className="pulso-f6-rotulo-angosto">Lámina <\/span>/);
    expect(visor).toMatch(/<span className="pulso-f6-rotulo-angosto">Ajustes<\/span>/);
  });

  it("el panel se ancla con `posicionPanelGuias` (botón o visor), no en una coordenada fija", () => {
    const boton = leer("./BotonGuias.tsx");
    expect(boton).toMatch(/posicionPanelGuias\(/);
    expect(boton).toMatch(/closest<HTMLElement>\("\.pulso-f6-visor"\)/);
    expect(boton).not.toMatch(/:\s*56\b/);
  });
});

describe("rótulos de la capa (QA A3, defecto 1)", () => {
  // Mutante que mata: volver a pintar un rótulo por capa con desplazamientos de CSS (salían por el borde izquierdo).
  it("la capa pinta los rótulos que coloca `colocarRotulos`, sin desplazamientos de CSS", () => {
    const capa = leer("./GuiasSobreLamina.tsx");
    expect(capa).toMatch(/colocarRotulos\(modelo, hoja\)/);
    expect(capa).not.toMatch(/modelo\.(tipografia|medidas)\.map/);
    const css = leer("./guias.css");
    const reglasRotulo = [...css.matchAll(/\.pulso-f6-guia-rotulo[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
    for (const r of reglasRotulo) expect(r).not.toMatch(/translate|\bleft:|\bright:|\btop:/);
  });
});
