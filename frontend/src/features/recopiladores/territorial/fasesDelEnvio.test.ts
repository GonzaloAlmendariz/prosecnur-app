import { describe, expect, it } from "vitest";

import { normalizarEnviosPorFase } from "../../../api/materialTerritorial";
import { eleccionDeFase, faseParaCrear } from "./fasesDelEnvio";

const META = { sample_fingerprint: "sha256:a", enviado_at: "2026-10-29T10:00:00", n_titulares: [2], n_reemplazos: 1, desactualizado: false };

describe("de qué fase sale la campaña territorial", () => {
  it("pregunta sólo si piloto y campo real tienen envío", () => {
    const ambas = normalizarEnviosPorFase({ runs: { pilot: { envio_meta: META }, field: { envio_meta: META } } });
    expect(eleccionDeFase(ambas)).toEqual({ tipo: "elegir" });
    expect(faseParaCrear(eleccionDeFase(ambas), null)).toBeNull();
    expect(faseParaCrear(eleccionDeFase(ambas), "pilot")).toBe("pilot");
    const soloPiloto = normalizarEnviosPorFase({ runs: { pilot: { envio_meta: META }, field: { envio_meta: null } } });
    expect(eleccionDeFase(soloPiloto)).toEqual({ tipo: "unica", fase: "pilot" });
    expect(faseParaCrear(eleccionDeFase(soloPiloto), "field")).toBe("pilot");
    expect(soloPiloto.pilot?.n_titulares).toBe(2);
    expect(eleccionDeFase(normalizarEnviosPorFase({ runs: [] }))).toEqual({ tipo: "ninguna" });
    expect(eleccionDeFase(null)).toEqual({ tipo: "ninguna" });
  });
});
