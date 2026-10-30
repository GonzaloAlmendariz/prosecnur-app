import { describe, expect, it } from "vitest";
import type { HojasRutaIntegratedConfig, HojasRutaRouteSnapshot } from "../../api/hojasRuta";
import { configDeRestauracion } from "./rutasHistorialClasica";

const vigente = { seed: 1, sampling_method: "pps", n_objetivo: 400, territorios: ["150101", "150102"] } as unknown as HojasRutaIntegratedConfig;
const ruteo = { id: "r1", config: { seed: 9, sampling_method: "sistematico", n_objetivo: 30, territorios: ["150101"] } } as unknown as HojasRutaRouteSnapshot;

describe("configDeRestauracion", () => {
  it("aplica sólo los parámetros del sorteo sobre la configuración vigente", () => {
    const c = configDeRestauracion(vigente, ruteo);
    expect(c.seed).toBe(9);
    expect(c.sampling_method).toBe("sistematico");
    expect(c.n_objetivo).toBe(400);
    expect(c.territorios).toEqual(["150101", "150102"]);
  });
  it("sin configuración vigente usa la del ruteo", () => {
    expect(configDeRestauracion(null, ruteo)).toBe(ruteo.config);
  });
});
