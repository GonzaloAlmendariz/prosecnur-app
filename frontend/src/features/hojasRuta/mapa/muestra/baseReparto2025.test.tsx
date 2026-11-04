import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeHojasRutaBaseReparto, type HojasRutaIntegratedConfig, type HojasRutaSampleSizeConfig, type HojasRutaTerritory } from "../../../../api/hojasRuta";
import { BaseReparto2025, fuenteDelReparto, sinBase2025 } from "./BaseReparto2025";
import { entradaDesdeConfig, poblacionDeReparto } from "./desdeConfig";

const ss = (base?: HojasRutaSampleSizeConfig["base_reparto"]): HojasRutaSampleSizeConfig => ({
  confidence_level: 0.95, margin_total: 0.05, margin_district: 0.1, expected_proportion: 0.5, design_effect: 1,
  response_rate: 0.9, apply_fpc: true, base_reparto: base,
});
const t = (ubigeo: string, poblacion: number, p25: number | null): HojasRutaTerritory => ({
  ubigeo, departamento: "LIMA", provincia: "LIMA", distrito: `D${ubigeo}`, viviendas: 1, poblacion, manzanas: 1,
  captacion: 84.2, u17: 0.95, a17: 0.7, p25, pob25: 1000,
});

describe("base de reparto 2025 en la UI (ADR 0131 §2)", () => {
  it("el espejo reparte con P̂25 sólo cuando la base está activa", () => {
    expect(poblacionDeReparto(t("150110", 500, 320.5), true)).toBe(320.5);
    expect(poblacionDeReparto(t("150110", 500, 320.5), false)).toBe(500);
    expect(poblacionDeReparto(t("150110", 500, null), true)).toBe(500);
    const config = { territorios: ["150110"], sample_size: ss("cpv2025_adultos_urbanos"), sample_size_mode: "external_total", n_objetivo: 8, entrevistas_por_manzana: 8 } as unknown as HojasRutaIntegratedConfig;
    expect(entradaDesdeConfig(config, [t("150110", 500, 320.5)]).distritos[0].poblacion).toBe(320.5);
  });

  it("declara la fuente y los supuestos cuando está activa, y nada de eso apagada", () => {
    const on = renderToStaticMarkup(<BaseReparto2025 sampleSize={ss("cpv2025_adultos_urbanos")} territorios={[t("150110", 500, 320.5)]} deshabilitado={false} onCambio={() => undefined} />);
    expect(on).toContain("CPV 2025 (supuestos u17, a17 de 2017)");
    expect(on).toContain("u17");
    expect(on).toContain("Captación");
    expect(on).toContain('data-base-reparto="cpv2025"');
    const off = renderToStaticMarkup(<BaseReparto2025 sampleSize={ss()} territorios={[t("150110", 500, 320.5)]} deshabilitado={false} onCambio={() => undefined} />);
    expect(off).toContain("CPV 2017");
    expect(off).not.toContain("Captación");
    expect(fuenteDelReparto(ss())).toMatch(/2017/);
  });

  it("sin P̂25 en algún distrito no deja encender la base y dice cuál", () => {
    const territorios = [t("150110", 500, 320.5), t("150101", 400, null)];
    expect(sinBase2025(territorios).map((x) => x.ubigeo)).toEqual(["150101"]);
    const html = renderToStaticMarkup(<BaseReparto2025 sampleSize={ss()} territorios={territorios} deshabilitado={false} onCambio={() => undefined} />);
    expect(html).toContain("Sin población 2025");
    expect(html).toMatch(/disabled/);
  });

  it("el normalizador descarta un payload incompleto y acepta escalares en arreglo", () => {
    expect(normalizeHojasRutaBaseReparto(null)).toBeNull();
    expect(normalizeHojasRutaBaseReparto({ codigo: "cpv2017", fuente: "x" })).toBeNull();
    const n = normalizeHojasRutaBaseReparto({
      codigo: "cpv2025_adultos_urbanos", fuente: "CPV 2025 (supuestos u17, a17 de 2017)", supuestos: { u17: "a", a17: "b" },
      distritos: [{ ubigeo: ["150110"], pob25: [1], pob17_redatam: [1], pob17_en_capa: [1], pob18_17: [1], u17: [1], a17: [0.7], p25: [0.7], g: [0.7] }, { ubigeo: "x" }],
    });
    expect(n?.distritos).toHaveLength(1);
    expect(n?.distritos[0].a17).toBe(0.7);
  });
});

describe("π publicada en la muestra (ADR 0131 §5)", () => {
  it("piDeManzana acepta una probabilidad y descarta lo demás", async () => {
    const { piDeManzana } = await import("../../../../api/hojasRuta");
    expect(piDeManzana({ pi: 0.25 })).toBe(0.25);
    expect(piDeManzana({ pi: null })).toBeNull();
    expect(piDeManzana({ pi: 0 })).toBeNull();
    expect(piDeManzana({ pi: 1.5 })).toBeNull();
    expect(piDeManzana({ pi: [0.4] as unknown as number })).toBe(0.4);
  });
});
