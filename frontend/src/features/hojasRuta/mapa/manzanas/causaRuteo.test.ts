import { describe, expect, it } from "vitest";
import type { HojasRutaRouteSnapshot, HojasRutaSamplePreview } from "../../../../api/hojasRuta";
import { causaDeRuteo, TEXTO_CAUSA } from "./causaRuteo";
import { firmasDeMuestra } from "./sorteo";

const HUELLA = `sha256:${"a".repeat(64)}`;
const OTRA = `sha256:${"b".repeat(64)}`;

function muestra(cambios: Partial<HojasRutaSamplePreview> = {}, config: Record<string, unknown> = {}): HojasRutaSamplePreview {
  return {
    seed: 7,
    method: "pps",
    algoritmo_sorteo: "reparto_v2",
    sample_fingerprint: HUELLA,
    frame_meta: { version: "2017.1" },
    marco_elegible: { hash_marco: "m1", hash_criterios: "c1" },
    config: { seed: 7, sampling_method: "pps", territorios: ["150101"], excluded_titular_ids: ["x1"], ...config },
    ...cambios,
  } as unknown as HojasRutaSamplePreview;
}

function instantanea(m = muestra()): HojasRutaRouteSnapshot {
  return { id: "r1", label: "r1", seed: 7, config: m.config, ...firmasDeMuestra(m) } as unknown as HojasRutaRouteSnapshot;
}

describe("causaDeRuteo", () => {
  it("la misma huella es la misma muestra", () => {
    expect(causaDeRuteo(instantanea(), muestra())).toBe("coincide");
  });
  it('sin huella guardada no se puede comprobar, nunca "coincide"', () => {
    expect(causaDeRuteo({ ...instantanea(), sample_fingerprint: null }, muestra())).toBe("sin_huella");
  });
  it("con otros parámetros o territorio la causa son los parámetros", () => {
    expect(causaDeRuteo(instantanea(), muestra({ sample_fingerprint: OTRA }, { seed: 8 }))).toBe("parametros");
    expect(causaDeRuteo(instantanea(), muestra({ sample_fingerprint: OTRA }, { territorios: ["150102"] }))).toBe("parametros");
  });
  it("una instantánea sin firma de reparto es v1: la causa es el motor", () => {
    const vieja = { ...instantanea(), algoritmo_sorteo: null };
    expect(causaDeRuteo(vieja, muestra({ sample_fingerprint: OTRA }))).toBe("motor");
  });
  it("otro marco u otra versión del marco: la causa es el marco", () => {
    expect(causaDeRuteo(instantanea(), muestra({ sample_fingerprint: OTRA, marco_elegible: { hash_marco: "m2", hash_criterios: "c1" } }))).toBe("marco");
    expect(causaDeRuteo(instantanea(), muestra({ sample_fingerprint: OTRA, frame_meta: { version: "2025.1" } } as Partial<HojasRutaSamplePreview>))).toBe("marco");
  });
  it("otras exclusiones con los mismos parámetros: cambió la piloto", () => {
    expect(causaDeRuteo(instantanea(), muestra({ sample_fingerprint: OTRA }, { excluded_titular_ids: ["x1", "x2"] }))).toBe("piloto");
  });
  it("si nada lo explica, lo dice", () => {
    expect(causaDeRuteo(instantanea(), muestra({ sample_fingerprint: OTRA }))).toBe("otra");
  });
  it("cada causa tiene su texto", () => {
    for (const t of Object.values(TEXTO_CAUSA)) expect(t.length).toBeGreaterThan(10);
  });
});
